const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const appointmentsController = require('../controllers/appointmentsController');

// All routes require authentication
router.use(authenticate);

// Get appointment types
router.get('/types', appointmentsController.getAppointmentTypes);

// Get appointments
router.get('/', appointmentsController.getAppointments);

// Create appointment
router.post('/', requireRole('admin', 'therapist', 'staff'), appointmentsController.createAppointment);

// Get single appointment
router.get('/:id', appointmentsController.getAppointment);

// Update appointment
router.patch('/:id', requireRole('admin', 'therapist', 'staff'), appointmentsController.updateAppointment);
router.put('/:id', requireRole('admin', 'therapist', 'staff'), appointmentsController.updateAppointment);

// Cancel appointment
router.post('/:id/cancel', requireRole('admin', 'therapist', 'staff', 'client'), appointmentsController.cancelAppointment);

// Mark as no-show
router.post('/:id/no-show', requireRole('admin', 'therapist', 'staff'), appointmentsController.markNoShow);

// Delete appointment
router.delete('/:id', requireRole('admin'), appointmentsController.deleteAppointment);

module.exports = router;
