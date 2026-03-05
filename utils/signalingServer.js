/**
 * Telehealth Signaling Server
 * Uses Socket.io + Redis Pub/Sub adapter for scalable real-time signaling.
 *
 * Redis data schema:
 *   user:status:{userId}   STRING  – "online" with 300s TTL
 *   session:{roomId}       HASH    – startTime, hostId, guestId, encryptionToken, status
 *   ice:{roomId}:{userId}  LIST    – buffered ICE candidates (10s TTL reconnection window)
 *   signaling:channel      PUB/SUB – distributes signals across cluster nodes (via adapter)
 */

const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const Redis = require('ioredis');
const { presenceHelpers, telehealthSessionHelpers } = require('./redis');

/**
 * Attach a Socket.io signaling server to an existing HTTP server.
 * @param {import('http').Server} httpServer
 * @param {string[]} allowedOrigins
 * @returns {import('socket.io').Server}
 */
const createSignalingServer = (httpServer, allowedOrigins = []) => {
  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    // Allow both websocket and polling transports
    transports: ['websocket', 'polling'],
    path: '/socket.io',
  });

  // ------------------------------------------------------------------
  // Redis Pub/Sub adapter (enables multi-instance horizontal scaling)
  // ------------------------------------------------------------------
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    try {
      const pubClient = new Redis(redisUrl);
      const subClient = pubClient.duplicate();
      io.adapter(createAdapter(pubClient, subClient));
      console.log('✅ Socket.io Redis adapter attached (Pub/Sub signaling channel ready)');
    } catch (err) {
      console.error('❌ Failed to attach Redis adapter to Socket.io:', err.message);
      console.warn('⚠️  Running Socket.io without Redis adapter (single instance only)');
    }
  } else {
    console.warn('⚠️  REDIS_URL not set – Socket.io running without Redis adapter');
  }

  // ------------------------------------------------------------------
  // Middleware: Authenticate the connecting socket
  // ------------------------------------------------------------------
  io.use((socket, next) => {
    const userId = socket.handshake.auth?.userId;
    const token = socket.handshake.auth?.token;

    if (!userId || !token) {
      return next(new Error('Authentication required'));
    }

    // Attach identity to socket for later use
    socket.userId = userId;
    socket.displayName = socket.handshake.auth?.displayName || 'Participant';
    socket.userRole = socket.handshake.auth?.role || 'client';
    next();
  });

  // ------------------------------------------------------------------
  // Connection handler
  // ------------------------------------------------------------------
  io.on('connection', async (socket) => {
    const { userId, displayName, userRole } = socket;
    console.log(`[Signaling] 🟢 Connected: ${displayName} (${userId})`);

    // Mark user as online in Redis
    await presenceHelpers.setOnline(userId);

    // ----------------------------------------------------------------
    // join-room  – patient or therapist enters a session room
    // ----------------------------------------------------------------
    socket.on('join-room', async ({ roomId, sessionId }) => {
      if (!roomId) return;

      // Join the Socket.io room
      socket.roomId = roomId;
      socket.sessionId = sessionId;
      await socket.join(roomId);

      console.log(`[Signaling] ${displayName} joined room: ${roomId}`);

      // Read or initialise session metadata in Redis Hash
      let meta = await telehealthSessionHelpers.getSessionMeta(roomId);
      if (!meta) {
        // First participant – create the Hash
        meta = {
          hostId: userId,
          guestId: '',
          startTime: new Date().toISOString(),
          encryptionToken: require('crypto').randomBytes(16).toString('hex'),
          status: 'waiting',
        };
        await telehealthSessionHelpers.setSessionMeta(roomId, meta);
      } else if (!meta.guestId || meta.guestId === '') {
        // Second participant joins
        await telehealthSessionHelpers.updateSessionField(roomId, 'guestId', userId);
        await telehealthSessionHelpers.updateSessionField(roomId, 'status', 'active');
        meta.guestId = userId;
        meta.status = 'active';
      }

      // Tell the joining user who is already in the room
      const roomSockets = await io.in(roomId).fetchSockets();
      const others = roomSockets
        .filter((s) => s.id !== socket.id)
        .map((s) => ({ userId: s.userId, displayName: s.displayName, role: s.userRole }));

      socket.emit('room-joined', {
        roomId,
        sessionId,
        meta,
        participants: others,
        yourUserId: userId,
      });

      // Notify everyone else in the room
      socket.to(roomId).emit('participant-joined', {
        userId,
        displayName,
        role: userRole,
      });

      // Deliver any buffered ICE candidates from before reconnection
      const buffered = await telehealthSessionHelpers.getBufferedIceCandidates(roomId, userId);
      if (buffered.length > 0) {
        console.log(`[Signaling] Delivering ${buffered.length} buffered ICE candidates to ${displayName}`);
        socket.emit('buffered-candidates', { candidates: buffered });
      }
    });

    // ----------------------------------------------------------------
    // offer – WebRTC offer from initiator → sent to peers in room
    // ----------------------------------------------------------------
    socket.on('offer', ({ roomId: room, offer, targetUserId }) => {
      console.log(`[Signaling] offer from ${displayName} in room ${room}`);
      if (targetUserId) {
        // Direct to specific peer
        socket.to(targetUserId).emit('offer', { offer, fromUserId: userId, fromDisplayName: displayName });
      } else {
        socket.to(room).emit('offer', { offer, fromUserId: userId, fromDisplayName: displayName });
      }
    });

    // ----------------------------------------------------------------
    // answer – WebRTC answer from responder → back to initiator
    // ----------------------------------------------------------------
    socket.on('answer', ({ roomId: room, answer, targetUserId }) => {
      console.log(`[Signaling] answer from ${displayName} in room ${room}`);
      if (targetUserId) {
        socket.to(targetUserId).emit('answer', { answer, fromUserId: userId });
      } else {
        socket.to(room).emit('answer', { answer, fromUserId: userId });
      }
    });

    // ----------------------------------------------------------------
    // ice-candidate – trickle ICE forwarding
    // ----------------------------------------------------------------
    socket.on('ice-candidate', async ({ roomId: room, candidate, targetUserId }) => {
      // Buffer in Redis for the 10-second reconnection window (bonus requirement)
      if (room && candidate) {
        await telehealthSessionHelpers.bufferIceCandidate(room, userId, candidate);
      }

      if (targetUserId) {
        socket.to(targetUserId).emit('ice-candidate', { candidate, fromUserId: userId });
      } else if (room) {
        socket.to(room).emit('ice-candidate', { candidate, fromUserId: userId });
      }
    });

    // ----------------------------------------------------------------
    // heartbeat – client sends every 60s to refresh presence TTL
    // ----------------------------------------------------------------
    socket.on('heartbeat', async () => {
      await presenceHelpers.refreshPresence(userId);
    });

    // ----------------------------------------------------------------
    // leave-room – explicit graceful leave
    // ----------------------------------------------------------------
    socket.on('leave-room', async ({ roomId: room }) => {
      await handleLeave(socket, io, room, userId, displayName);
    });

    // ----------------------------------------------------------------
    // disconnect – socket dropped (browser closed / network loss)
    // ----------------------------------------------------------------
    socket.on('disconnect', async () => {
      console.log(`[Signaling] 🔴 Disconnected: ${displayName} (${userId})`);
      await presenceHelpers.setOffline(userId);

      if (socket.roomId) {
        // Notify peers but don't delete session meta immediately –
        // allow the 10-second ICE reconnection window to be useful.
        socket.to(socket.roomId).emit('participant-left', {
          userId,
          displayName,
        });

        // Clean up session meta if room is now empty
        const roomSockets = await io.in(socket.roomId).fetchSockets();
        if (roomSockets.length === 0) {
          await telehealthSessionHelpers.deleteSessionMeta(socket.roomId);
          console.log(`[Signaling] Room ${socket.roomId} is empty – session meta cleaned up`);
        }
      }
    });
  });

  return io;
};

// ------------------------------------------------------------------
// Helper: handle a user leaving a room
// ------------------------------------------------------------------
async function handleLeave(socket, io, roomId, userId, displayName) {
  if (!roomId) return;
  await socket.leave(roomId);
  socket.to(roomId).emit('participant-left', { userId, displayName });

  const roomSockets = await io.in(roomId).fetchSockets();
  if (roomSockets.length === 0) {
    await telehealthSessionHelpers.deleteSessionMeta(roomId);
    console.log(`[Signaling] Room ${roomId} cleaned up after leave`);
  }
}

module.exports = { createSignalingServer };
