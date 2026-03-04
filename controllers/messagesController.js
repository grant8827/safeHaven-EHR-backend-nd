const prisma = require('../utils/prisma');
const { asyncHandler } = require('../middleware/errorHandler');

// Get message threads for a user
const getThreads = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const userId = req.user.id;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const take = parseInt(limit);

  // Find threads where user is sender or reader of any message
  const [threads, total] = await Promise.all([
    prisma.messageThread.findMany({
      where: {
        messages: {
          some: {
            OR: [
              { senderId: userId },
              { readerId: userId },
            ],
          },
        },
      },
      skip,
      take,
      include: {
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
    prisma.messageThread.count({
      where: {
        messages: {
          some: {
            OR: [
              { senderId: userId },
              { readerId: userId },
            ],
          },
        },
      },
    }),
  ]);

  return res.json({
    results: threads,
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
        some: {
          id: userId,
        },
      },
    },
    include: {
      participants: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          role: true,
          email: true,
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
  const {  participantIds, subject } = req.body;
  const userId = req.user.id;

  // Note: Participants are currently derived from messages (sender/reader)
  // To fully implement participant management, add MessageThreadParticipant table

  const thread = await prisma.messageThread.create({
    data: {
      subject,
    },
    include: {
      messages: true,
    },
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
      participants: {
        some: {
          id: userId,
        },
      },
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
        attachments: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.message.count({ where: { threadId } }),
  ]);

  return res.json({
    results: messages,
    count: total,
    next: skip + take < total ? parseInt(page) + 1 : null,
    previous: page > 1 ? parseInt(page) - 1 : null,
  });
});

// Send message
const sendMessage = asyncHandler(async (req, res) => {
  const { threadId, content, priority, isEncrypted } = req.body;
  const userId = req.user.id;

  if (!threadId || !content) {
    return res.status(400).json({ error: 'threadId and content are required' });
  }

  // Verify user is participant
  const thread = await prisma.messageThread.findFirst({
    where: {
      id: threadId,
      participants: {
        some: {
          id: userId,
        },
      },
    },
  });

  if (!thread) {
    return res.status(404).json({ error: 'Thread not found' });
  }

  const message = await prisma.message.create({
    data: {
      threadId,
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

  // Update thread's updatedAt
  await prisma.messageThread.update({
    where: { id: threadId },
    data: { updatedAt: new Date() },
  });

  return res.status(201).json(message);
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
      participants: {
        some: {
          id: userId,
        },
      },
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
      participants: {
        some: {
          id: userId,
        },
      },
    },
  });

  if (!isParticipant) {
    return res.status(403).json({ error: 'Not authorized' });
  }

  const updatedMessage = await prisma.message.update({
    where: { id },
    data: { isStarred: !message.isStarred },
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
