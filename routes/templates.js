const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const {
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
} = require('../controllers/templateController');

router.use(authenticate);

// Notification templates
router.get('/notifications/', getNotificationTemplates);
router.get('/notifications/:id/', getNotificationTemplate);
router.post('/notifications/', requireRole('admin'), createNotificationTemplate);
router.patch('/notifications/:id/', requireRole('admin'), updateNotificationTemplate);
router.delete('/notifications/:id/', requireRole('admin'), deleteNotificationTemplate);

// Message templates
router.get('/messages/', getMessageTemplates);
router.get('/messages/:id/', getMessageTemplate);
router.post('/messages/', requireRole('admin'), createMessageTemplate);
router.patch('/messages/:id/', requireRole('admin'), updateMessageTemplate);
router.delete('/messages/:id/', requireRole('admin'), deleteMessageTemplate);

module.exports = router;
