const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Get unread notification count (placeholder)
router.get('/unread_count/', (req, res) => {
  // For now, return 0 as we don't have notifications implemented yet
  res.json({ count: 0 });
});

module.exports = router;
