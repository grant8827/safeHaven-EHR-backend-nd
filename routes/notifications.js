const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const prisma = require('../utils/prisma');
const { asyncHandler } = require('../middleware/errorHandler');

// All routes require authentication
router.use(authenticate);

// Get all notifications for current user
router.get('/', asyncHandler(async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json({ results: notifications, count: notifications.length });
}));

// Get unread notification count
router.get('/unread_count/', asyncHandler(async (req, res) => {
  const count = await prisma.notification.count({
    where: { userId: req.user.id, isRead: false },
  });
  res.json({ count });
}));

// Mark a notification as read
router.patch('/:id/read/', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const notification = await prisma.notification.updateMany({
    where: { id, userId: req.user.id },
    data: { isRead: true },
  });
  res.json({ success: true });
}));

// Mark all notifications as read
router.patch('/mark_all_read/', asyncHandler(async (req, res) => {
  await prisma.notification.updateMany({
    where: { userId: req.user.id, isRead: false },
    data: { isRead: true },
  });
  res.json({ success: true });
}));

module.exports = router;
