const prisma = require('../utils/prisma');
const { asyncHandler } = require('../middleware/errorHandler');
const { chatHelpers } = require('../utils/redis');

// Get message threads for a user
const getThreads = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const userId = req.user.id;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const take = parseInt(limit);

  // Find threads where user is a participant (correct membership check)
  const participantFilter = { participants: { some: { userId } } };

  const [threads, total] = await Promise.all([
    prisma.messageThread.findMany({
      where: participantFilter,
      skip,
      take,
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, role: true },
            },
          },
        },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            content: true,
            createdAt: true,
            senderId: true,
            sender: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                role: true,
              },
            },
          },
        },
        _count: {
          select: {
            messages: {
              where: {
                readAt: null,
                senderId: { not: userId },
              },
            },
          },
        },
      },
      orderBy: { lastActivity: 'desc' },
    }),
    prisma.messageThread.count({ where: participantFilter }),
  ]);

  // Transform to snake_case fields expected by frontend
  const transformed = threads.map((thread) => {
    const lastMsg = thread.messages[0];
    return {
      id: thread.id,
      subject: thread.subject,
      is_archived: thread.isArchived,
      updated_at: thread.lastActivity,
      last_message: lastMsg
        ? {
            id: lastMsg.id,
            content: lastMsg.content,
            created_at: lastMsg.createdAt,
            sender: lastMsg.sender
              ? {
                  id: lastMsg.sender.id,
                  full_name: `${lastMsg.sender.firstName} ${lastMsg.sender.lastName}`.trim(),
                  role: lastMsg.sender.role,
                }
              : null,
          }
        : null,
      unread_count: thread._count.messages,
      participants: thread.participants.map((p) => ({
        id: p.user.id,
        full_name: `${p.user.firstName} ${p.user.lastName}`.trim(),
        role: p.user.role,
        is_online: false,
      })),
    };
  });

  return res.json({
    results: transformed,
    count: total,
    next: skip + take < total ? parseInt(page) + 1 : null,
    previous: page > 1 ? parseInt(page) - 1 : null,
  });
});

// Get single thread
const getThread = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const thread = await prisma.messageThread.findFirst({
    where: {
      id,
      participants: {
        some: { userId },
      },
    },
    include: {
      participants: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              role: true,
              email: true,
            },
          },
        },
      },
    },
  });

  if (!thread) {
    return res.status(404).json({ error: 'Thread not found' });
  }

  return res.json(thread);
});

// Create message thread
const createThread = asyncHandler(async (req, res) => {
  const { participantIds, subject } = req.body;
  const userId = req.user.id;

  if (!subject?.trim()) {
    return res.status(400).json({ error: 'subject is required' });
  }

  // Deduplicate: always include creator
  const allIds = Array.from(new Set([userId, ...(Array.isArray(participantIds) ? participantIds : [])]));

  const thread = await prisma.$transaction(async (tx) => {
    const t = await tx.messageThread.create({
      data: { subject: subject.trim() },
    });

    await tx.messageThreadParticipant.createMany({
      data: allIds.map((uid) => ({ threadId: t.id, userId: uid })),
      skipDuplicates: true,
    });

    return tx.messageThread.findUnique({
      where: { id: t.id },
      include: {
        participants: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, role: true } },
          },
        },
      },
    });
  });

  return res.status(201).json(thread);
});

// Get messages in a thread
const getMessages = asyncHandler(async (req, res) => {
  const { threadId } = req.params;
  const { page = 1, limit = 50 } = req.query;
  const userId = req.user.id;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const take = parseInt(limit);

  // Verify user is participant
  const thread = await prisma.messageThread.findFirst({
    where: {
      id: threadId,
      participants: { some: { userId } },
    },
  });

  if (!thread) {
    return res.status(404).json({ error: 'Thread not found' });
  }

  const [messages, total] = await Promise.all([
    prisma.message.findMany({
      where: { threadId },
      skip,
      take,
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.message.count({ where: { threadId } }),
  ]);

  // Transform to snake_case fields expected by frontend
  const transformedMessages = messages.map((msg) => ({
    id: msg.id,
    thread_id: msg.threadId,
    content: msg.content,
    priority: msg.priority,
    is_read: msg.isRead,
    is_starred: false,
    is_encrypted: msg.isEncrypted,
    created_at: msg.createdAt,
    sent_at: msg.sentAt,
    read_at: msg.readAt,
    attachments: [],
    sender: msg.sender
      ? {
          id: msg.sender.id,
          full_name: `${msg.sender.firstName} ${msg.sender.lastName}`.trim(),
          role: msg.sender.role,
        }
      : null,
  }));

  return res.json({
    results: transformedMessages,
    count: total,
    next: skip + take < total ? parseInt(page) + 1 : null,
    previous: page > 1 ? parseInt(page) - 1 : null,
  });
});

// Send message
const sendMessage = asyncHandler(async (req, res) => {
  const { threadId, content, priority, isEncrypted, recipient_ids, subject } = req.body;
  const userId = req.user.id;

  if (!content) {
    return res.status(400).json({ error: 'content is required' });
  }

  let resolvedThreadId = threadId;

  // ── Find-or-create thread when caller supplies recipient_ids instead of threadId ──
  if (!resolvedThreadId) {
    if (!recipient_ids || !Array.isArray(recipient_ids) || recipient_ids.length === 0) {
      return res.status(400).json({ error: 'threadId or recipient_ids is required' });
    }

    const allParticipantIds = Array.from(new Set([userId, ...recipient_ids]));

    // For 1-to-1 conversations, look for an existing thread between exactly these two users
    if (allParticipantIds.length === 2) {
      const existing = await prisma.messageThread.findFirst({
        where: {
          AND: allParticipantIds.map((uid) => ({
            participants: { some: { userId: uid } },
          })),
        },
        include: {
          participants: { select: { userId: true } },
        },
        orderBy: { lastActivity: 'desc' },
      });

      // Only reuse if the thread has exactly these two participants
      if (existing && existing.participants.length === 2) {
        resolvedThreadId = existing.id;
      }
    }

    // Create a new thread if none found
    if (!resolvedThreadId) {
      const newThread = await prisma.$transaction(async (tx) => {
        const t = await tx.messageThread.create({
          data: { subject: subject || 'New Message' },
        });
        await tx.messageThreadParticipant.createMany({
          data: allParticipantIds.map((uid) => ({ threadId: t.id, userId: uid })),
          skipDuplicates: true,
        });
        return t;
      });
      resolvedThreadId = newThread.id;
    }
  }

  // ── Verify requesting user is a participant ──
  const thread = await prisma.messageThread.findFirst({
    where: {
      id: resolvedThreadId,
      participants: { some: { userId } },
    },
  });

  if (!thread) {
    return res.status(404).json({ error: 'Thread not found' });
  }

  const message = await prisma.message.create({
    data: {
      threadId: resolvedThreadId,
      senderId: userId,
      content,
      priority: priority || 'normal',
      isEncrypted: isEncrypted || false,
    },
    include: {
      sender: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          role: true,
        },
      },
    },
  });

  // Update thread's lastActivity
  await prisma.messageThread.update({
    where: { id: resolvedThreadId },
    data: { lastActivity: new Date() },
  });

  // Push to Redis history buffer
  const senderName = `${req.user.firstName} ${req.user.lastName}`.trim();
  const payload = {
    id: message.id,
    threadId: resolvedThreadId,
    senderId: userId,
    senderName,
    senderRole: req.user.role,
    content: message.content,
    priority: message.priority,
    timestamp: message.createdAt.toISOString(),
    isRead: false,
    isEncrypted: message.isEncrypted,
    deliveryStatus: 'sent',
    attachments: [],
  };
  await chatHelpers.pushMessage(resolvedThreadId, payload);

  // Increment unread for other participants
  const threadData = await prisma.messageThread.findUnique({
    where: { id: resolvedThreadId },
    include: { participants: { select: { userId: true } } },
  });
  if (threadData) {
    await Promise.all(
      threadData.participants
        .filter((p) => p.userId !== userId)
        .map((p) => chatHelpers.incrUnread(p.userId, userId)),
    );
  }

  // Emit via chat namespace if Socket.io is available (real-time push)
  const io = req.app?.get('io');
  if (io) {
    io.of('/chat').to(`thread:${resolvedThreadId}`).emit('message:receive', payload);
  }

  // Include thread.id in response so frontend can navigate to the conversation
  return res.status(201).json({ ...message, thread: { id: resolvedThreadId } });
});

// Mark message as read
const markAsRead = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const message = await prisma.message.findUnique({
    where: { id },
    include: { thread: true },
  });

  if (!message) {
    return res.status(404).json({ error: 'Message not found' });
  }

  // Verify user is participant
  const isParticipant = await prisma.messageThread.findFirst({
    where: {
      id: message.threadId,
      participants: { some: { userId } },
    },
  });

  if (!isParticipant) {
    return res.status(403).json({ error: 'Not authorized' });
  }

  const updatedMessage = await prisma.message.update({
    where: { id },
    data: { readAt: new Date() },
  });

  return res.json(updatedMessage);
});

// Toggle star on message
const toggleStar = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const message = await prisma.message.findUnique({
    where: { id },
  });

  if (!message) {
    return res.status(404).json({ error: 'Message not found' });
  }

  // Verify user is participant
  const isParticipant = await prisma.messageThread.findFirst({
    where: {
      id: message.threadId,
      participants: { some: { userId } },
    },
  });

  if (!isParticipant) {
    return res.status(403).json({ error: 'Not authorized' });
  }

  const updatedMessage = await prisma.message.update({
    where: { id },
    data: { isRead: message.isRead }, // isStarred not in schema — no-op update to return message
  });

  return res.json(updatedMessage);
});

// Delete message
const deleteMessage = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const message = await prisma.message.findUnique({
    where: { id },
  });

  if (!message) {
    return res.status(404).json({ error: 'Message not found' });
  }

  // Only sender can delete
  if (message.senderId !== userId) {
    return res.status(403).json({ error: 'Only sender can delete message' });
  }

  await prisma.message.delete({
    where: { id },
  });

  return res.status(204).send();
});

module.exports = {
  getThreads,
  getThread,
  createThread,
  getMessages,
  sendMessage,
  markAsRead,
  toggleStar,
  deleteMessage,
};
