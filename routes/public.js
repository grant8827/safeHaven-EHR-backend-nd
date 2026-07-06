const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { createContactSubmission, createAppointmentRequest } = require('../controllers/publicController');

// Stricter limiter for public, unauthenticated lead-capture forms (SHRM website)
const publicFormLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many submissions. Please try again later.' },
});

router.post('/contact', publicFormLimiter, createContactSubmission);
router.post('/appointment-requests', publicFormLimiter, createAppointmentRequest);

module.exports = router;
