const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const messagesController = require('../controllers/messagesController');

// All routes require authentication
router.use(authenticate);

// Message threads
router.get('/threads', messagesController.getThreads);
router.post('/threads', messagesController.createThread);
router.get('/threads/:id', messagesController.getThread);

// Messages
router.get('/threads/:threadId/messages', messagesController.getMessages);
router.post('/messages', messagesController.sendMessage);
router.patch('/messages/:id/read', messagesController.markAsRead);
router.patch('/messages/:id/star', messagesController.toggleStar);
router.delete('/messages/:id', messagesController.deleteMessage);

module.exports = router;
