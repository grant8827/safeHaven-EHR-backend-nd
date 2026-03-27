const prisma = require('../utils/prisma');
const { asyncHandler } = require('../middleware/errorHandler');

// ── Notification Templates ────────────────────────────────────────────────────

const getNotificationTemplates = asyncHandler(async (req, res) => {
  const templates = await prisma.notificationTemplate.findMany({
    orderBy: { type: 'asc' },
  });
  res.json({ results: templates, count: templates.length });
});

const getNotificationTemplate = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const template = await prisma.notificationTemplate.findUnique({ where: { id } });
  if (!template) return res.status(404).json({ error: 'Notification template not found' });
  res.json(template);
});

const createNotificationTemplate = asyncHandler(async (req, res) => {
  const { type, title, body, isActive } = req.body;
  if (!type || !title || !body) {
    return res.status(400).json({ error: 'type, title, and body are required' });
  }
  const template = await prisma.notificationTemplate.create({
    data: { type: type.trim().toLowerCase(), title, body, isActive: isActive ?? true },
  });
  res.status(201).json(template);
});

const updateNotificationTemplate = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { title, body, isActive } = req.body;
  const template = await prisma.notificationTemplate.update({
    where: { id },
    data: {
      ...(title !== undefined && { title }),
      ...(body !== undefined && { body }),
      ...(isActive !== undefined && { isActive }),
    },
  });
  res.json(template);
});

const deleteNotificationTemplate = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await prisma.notificationTemplate.delete({ where: { id } });
  res.status(204).send();
});

// ── Message Templates ─────────────────────────────────────────────────────────

const getMessageTemplates = asyncHandler(async (req, res) => {
  const templates = await prisma.messageTemplate.findMany({
    orderBy: { type: 'asc' },
  });
  res.json({ results: templates, count: templates.length });
});

const getMessageTemplate = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const template = await prisma.messageTemplate.findUnique({ where: { id } });
  if (!template) return res.status(404).json({ error: 'Message template not found' });
  res.json(template);
});

const createMessageTemplate = asyncHandler(async (req, res) => {
  const { type, subject, body, isActive } = req.body;
  if (!type || !subject || !body) {
    return res.status(400).json({ error: 'type, subject, and body are required' });
  }
  const template = await prisma.messageTemplate.create({
    data: { type: type.trim().toLowerCase(), subject, body, isActive: isActive ?? true },
  });
  res.status(201).json(template);
});

const updateMessageTemplate = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { subject, body, isActive } = req.body;
  const template = await prisma.messageTemplate.update({
    where: { id },
    data: {
      ...(subject !== undefined && { subject }),
      ...(body !== undefined && { body }),
      ...(isActive !== undefined && { isActive }),
    },
  });
  res.json(template);
});

const deleteMessageTemplate = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await prisma.messageTemplate.delete({ where: { id } });
  res.status(204).send();
});

module.exports = {
  getNotificationTemplates,
  getNotificationTemplate,
  createNotificationTemplate,
  updateNotificationTemplate,
  deleteNotificationTemplate,
  getMessageTemplates,
  getMessageTemplate,
  createMessageTemplate,
  updateMessageTemplate,
  deleteMessageTemplate,
};
