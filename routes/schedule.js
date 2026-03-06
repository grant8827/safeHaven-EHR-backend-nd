const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const scheduleController = require('../controllers/scheduleController');

// All schedule routes require authentication
router.use(authenticate);

// GET /schedule/therapists — admin/staff: list active therapists for the booking dropdown
router.get('/therapists', requireRole('admin', 'staff'), scheduleController.getTherapists);

// GET /schedule/:therapistId?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
// Any authenticated user can view an availability grid
router.get('/:therapistId', scheduleController.getAvailability);

// POST /schedule/toggle — therapist only: mark slots available/unavailable
router.post('/toggle', requireRole('therapist', 'admin'), scheduleController.toggleSlot);

// POST /schedule/book — admin/staff only: atomically book a slot
router.post('/book', requireRole('admin', 'staff'), scheduleController.bookSlot);

module.exports = router;
