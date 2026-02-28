const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const documentsController = require('../controllers/documentsController');

// All routes require authentication
router.use(authenticate);

// Get documents
router.get('/', documentsController.getDocuments);

// Upload document
router.post('/', requireRole('admin', 'therapist', 'staff'), documentsController.uploadDocument);

// Get single document
router.get('/:id', documentsController.getDocument);

// Update document
router.patch('/:id', requireRole('admin', 'therapist', 'staff'), documentsController.updateDocument);
router.put('/:id', requireRole('admin', 'therapist', 'staff'), documentsController.updateDocument);

// Delete document
router.delete('/:id', requireRole('admin', 'therapist', 'staff'), documentsController.deleteDocument);

// Share document
router.post('/:id/share', requireRole('admin', 'therapist', 'staff'), documentsController.shareDocument);
router.delete('/:id/share/:shareId', requireRole('admin', 'therapist', 'staff'), documentsController.revokeShare);

// Access logs
router.get('/:id/logs', requireRole('admin', 'therapist', 'staff'), documentsController.getAccessLogs);

module.exports = router;
