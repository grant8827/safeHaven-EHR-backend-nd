const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const c = require('../controllers/soapNotesController');

router.use(authenticate);

router.get('/',    requireRole('admin', 'therapist', 'staff'), c.getSoapNotes);
router.post('/',   requireRole('admin', 'therapist', 'staff'),          c.createSoapNote);
router.get('/:id', requireRole('admin', 'therapist', 'staff'), c.getSoapNote);

// Autosave → Redis (low-latency, no DB write)
router.patch('/:id/autosave', requireRole('admin', 'therapist', 'staff'), c.autosaveNote);

// Finalize → Redis draft → DB, locks the record
router.post('/:id/finalize',  requireRole('admin', 'therapist', 'staff'), c.finalizeNote);

// Standard update (draft notes only)
router.patch('/:id', requireRole('admin', 'therapist', 'staff'), c.updateSoapNote);
router.put('/:id',   requireRole('admin', 'therapist', 'staff'), c.updateSoapNote);

router.delete('/:id', requireRole('admin', 'staff'), c.deleteSoapNote);

module.exports = router;

