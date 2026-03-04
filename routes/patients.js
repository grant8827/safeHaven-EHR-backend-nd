const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const patientsController = require('../controllers/patientsController');

// All routes require authentication
router.use(authenticate);

// Get patients
router.get('/', requireRole('admin', 'therapist', 'staff'), patientsController.getPatients);

// Create patient
router.post('/', requireRole('admin', 'therapist', 'staff'), patientsController.createPatient);

// Get patient by user ID
router.get('/user/:userId', requireRole('admin', 'therapist', 'staff'), patientsController.getPatientByUserId);

// Get single patient
router.get('/:id', requireRole('admin', 'therapist', 'staff', 'client'), patientsController.getPatient);

// Update patient
router.patch('/:id', requireRole('admin', 'therapist', 'staff'), patientsController.updatePatient);
router.put('/:id', requireRole('admin', 'therapist', 'staff'), patientsController.updatePatient);

// Delete patient
router.delete('/:id', requireRole('admin'), patientsController.deletePatient);

module.exports = router;
