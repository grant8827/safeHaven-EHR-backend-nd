const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const soapNotesController = require('../controllers/soapNotesController');

// All routes require authentication
router.use(authenticate);

// Get SOAP notes
router.get('/', requireRole('admin', 'therapist', 'staff'), soapNotesController.getSoapNotes);

// Create SOAP note
router.post('/', requireRole('admin', 'therapist'), soapNotesController.createSoapNote);

// Get single SOAP note
router.get('/:id', requireRole('admin', 'therapist', 'staff'), soapNotesController.getSoapNote);

// Update SOAP note
router.patch('/:id', requireRole('admin', 'therapist'), soapNotesController.updateSoapNote);
router.put('/:id', requireRole('admin', 'therapist'), soapNotesController.updateSoapNote);

// Delete SOAP note
router.delete('/:id', requireRole('admin'), soapNotesController.deleteSoapNote);

module.exports = router;
