/**
 * HIPAA-compliant Real-Time Chat Namespace
 *
 * Attaches a Socket.io /chat namespace to an existing io instance.
 * The Redis Pub/Sub adapter is already configured on `io` by signalingServer.js,
 * so all messages automatically scale across multiple Node.js instances.
 *
 * Redis data schema (managed via chatHelpers):
 *   history:room:{threadId}          LIST   – last 50 messages (LPUSH/LTRIM)
 *   unread:user:{uid}:from:{sender}  STRING – unread counter   (INCR/DEL)
 *   user:status:{userId}             STRING – presence TTL 300s (via presenceHelpers)
 *
 * Socket.io events:
 *   CLIENT → SERVER  join-thread, message:send, typing:start, typing:stop, mark-read, heartbeat
 *   SERVER → CLIENT  thread-history, message:receive, typing:start, typing:stop, error
 */

const jwt = require('jsonwebtoken');
const prisma = require('./prisma');
const { chatHelpers, presenceHelpers } = require('./redis');

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'your-secret-key';

/**
 * Attach the /chat namespace to an existing Socket.io server instance.
 * @param {import('socket.io').Server} io
 * @returns {import('socket.io').Namespace}
 */
const createChatNamespace = (io) => {
  const chat = io.of('/chat');

  // -----------------------------------------------------------------------
  // Middleware: JWT authentication
  // -----------------------------------------------------------------------
  chat.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));

    try {
      const decoded = jwt.verify(token, JWT_ACCESS_SECRET);
      const user = await prisma.user.findUnique({
        where: { id: decoded.sub },
        select: { id: true, firstName: true, lastName: true, role: true, isActive: true },
      });

      if (!user) return next(new Error('User not found'));
      if (!user.isActive) return next(new Error('Account inactive'));

      socket.userId = user.id;
      socket.displayName = `${user.firstName} ${user.lastName}`.trim();
      socket.userRole = user.role;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  // -----------------------------------------------------------------------
  // Connection handler
  // -----------------------------------------------------------------------
  chat.on('connection', async (socket) => {
    const { userId, displayName, userRole } = socket;
    console.log(`[Chat] 🟢 ${displayName} (${userId}) connected`);

    // Mark user online
    await presenceHelpers.setOnline(userId);

    // ------------------------------------------------------------------
    // join-thread  –  subscribe to a thread room
    //   Security: server validates the user is a participant before joining
    // ------------------------------------------------------------------
    socket.on('join-thread', async ({ threadId }) => {
      if (!threadId) return;

      try {
        // SECURITY: confirm user is a thread participant
        const membership = await prisma.messageThreadParticipant.findUnique({
          where: { threadId_userId: { threadId, userId } },
        });

        if (!membership) {
          socket.emit('error', { message: 'Not authorized for this thread' });
          return;
        }

        await socket.join(`thread:${threadId}`);
        socket.currentThreadId = threadId;

        // Deliver Redis history buffer for instant display (before DB loads)
        const history = await chatHelpers.getHistory(threadId);
        socket.emit('thread-history', { threadId, messages: history });

        // Clear unread counters for this user in this thread
        const thread = await prisma.messageThread.findUnique({
          where: { id: threadId },
          include: { participants: { select: { userId: true } } },
        });
        if (thread) {
          await Promise.all(
            thread.participants
              .filter((p) => p.userId !== userId)
              .map((p) => chatHelpers.clearUnread(userId, p.userId)),
          );
        }

        console.log(`[Chat] ${displayName} joined thread:${threadId}`);
      } catch (err) {
        console.error('[Chat] join-thread error:', err.message);
        socket.emit('error', { message: 'Failed to join thread' });
      }
    });

    // ------------------------------------------------------------------
    // message:send  –  validate → save to DB → push to Redis → broadcast
    // ------------------------------------------------------------------
    socket.on('message:send', async ({ threadId, content, priority = 'normal' }) => {
      if (!threadId || !content?.trim()) return;

      try {
        // SECURITY: confirm sender is a participant
        const membership = await prisma.messageThreadParticipant.findUnique({
          where: { threadId_userId: { threadId, userId } },
        });

        if (!membership) {
          socket.emit('error', { message: 'Not authorized for this thread' });
          return;
        }

        // Persist to DB
        const message = await prisma.message.create({
          data: {
            threadId,
            senderId: userId,
            content: content.trim(),
            priority: ['low', 'normal', 'high', 'urgent'].includes(priority) ? priority : 'normal',
          },
          include: {
            sender: { select: { id: true, firstName: true, lastName: true, role: true } },
          },
        });

        // Update thread lastActivity
        await prisma.messageThread.update({
          where: { id: threadId },
          data: { lastActivity: new Date() },
        });

        const payload = {
          id: message.id,
          threadId,
          senderId: userId,
          senderName: displayName,
          senderRole: userRole,
          content: message.content,
          priority: message.priority,
          timestamp: message.createdAt.toISOString(),
          isRead: false,
          isEncrypted: false,
          deliveryStatus: 'sent',
          attachments: [],
        };

        // Push to Redis history buffer
        await chatHelpers.pushMessage(threadId, payload);

        // Increment unread for other participants
        const thread = await prisma.messageThread.findUnique({
          where: { id: threadId },
          include: { participants: { select: { userId: true } } },
        });
        if (thread) {
          await Promise.all(
            thread.participants
              .filter((p) => p.userId !== userId)
              .map((p) => chatHelpers.incrUnread(p.userId, userId)),
          );
        }

        // Broadcast to everyone in the thread room (including sender)
        chat.to(`thread:${threadId}`).emit('message:receive', payload);

        console.log(`[Chat] Message from ${displayName} → thread:${threadId}`);
      } catch (err) {
        console.error('[Chat] message:send error:', err.message);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // ------------------------------------------------------------------
    // typing:start / typing:stop  –  forwarded to peers only
    // ------------------------------------------------------------------
    socket.on('typing:start', ({ threadId }) => {
      if (!threadId) return;
      socket.to(`thread:${threadId}`).emit('typing:start', { userId, displayName });
    });

    socket.on('typing:stop', ({ threadId }) => {
      if (!threadId) return;
      socket.to(`thread:${threadId}`).emit('typing:stop', { userId });
    });

    // ------------------------------------------------------------------
    // mark-read  –  clear unread counter
    // ------------------------------------------------------------------
    socket.on('mark-read', async ({ threadId, fromUserId }) => {
      if (!threadId || !fromUserId) return;
      try {
        await chatHelpers.clearUnread(userId, fromUserId);
        // Also update DB
        await prisma.message.updateMany({
          where: { threadId, senderId: fromUserId, readAt: null },
          data: { readAt: new Date(), isRead: true },
        });
      } catch (err) {
        console.error('[Chat] mark-read error:', err.message);
      }
    });

    // ------------------------------------------------------------------
    // heartbeat  –  refresh presence TTL every 60s
    // ------------------------------------------------------------------
    socket.on('heartbeat', async () => {
      await presenceHelpers.refreshPresence(userId);
    });

    // ------------------------------------------------------------------
    // disconnect
    // ------------------------------------------------------------------
    socket.on('disconnect', async () => {
      console.log(`[Chat] 🔴 ${displayName} (${userId}) disconnected`);
      await presenceHelpers.setOffline(userId);

      // Broadcast typing-stop if they were typing
      if (socket.currentThreadId) {
        socket.to(`thread:${socket.currentThreadId}`).emit('typing:stop', { userId });
      }
    });
  });

  return chat;
};

module.exports = { createChatNamespace };
