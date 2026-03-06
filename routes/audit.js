const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const auditController = require('../controllers/auditController');

// All routes require authentication
router.use(authenticate);

// Create audit logs (batch)
router.post('/logs/batch/', auditController.createAuditLogs);

// Get audit logs (admin only)
router.get('/logs', requireRole('admin'), auditController.getAuditLogs);
router.get('/logs/:id', requireRole('admin'), auditController.getAuditLog);

module.exports = router;
