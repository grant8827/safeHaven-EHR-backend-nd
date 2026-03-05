const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const telehealthController = require('../controllers/telehealthController');

// All routes require authentication
router.use(authenticate);

// Sessions
router.get('/sessions', telehealthController.getSessions);
router.post('/sessions', requireRole('admin', 'therapist', 'staff'), telehealthController.createSession);
router.post('/sessions/create_emergency', requireRole('admin', 'therapist', 'staff'), telehealthController.createEmergencySession);
// Lookup by appointmentId FK — must be BEFORE /:id wildcard
router.get('/sessions/by-appointment/:appointmentId', telehealthController.getSessionByAppointmentId);
// my_sessions alias — must be BEFORE /:id wildcard so it doesn't hit getSession
router.get('/sessions/my_sessions', telehealthController.getSessions);
router.get('/sessions/:id', telehealthController.getSession);
router.patch('/sessions/:id', requireRole('admin', 'therapist', 'staff'), telehealthController.updateSession);
router.put('/sessions/:id', requireRole('admin', 'therapist', 'staff'), telehealthController.updateSession);
router.delete('/sessions/:id', requireRole('admin'), telehealthController.deleteSession);

// Session actions
router.post('/sessions/:id/start', requireRole('admin', 'therapist'), telehealthController.startSession);
router.post('/sessions/:id/end', requireRole('admin', 'therapist'), telehealthController.endSession);
router.post('/sessions/:id/join', telehealthController.joinSession);
router.post('/sessions/:id/leave', telehealthController.leaveSession);

// Recordings and transcripts
router.post('/recordings', requireRole('admin', 'therapist', 'staff'), telehealthController.saveRecording);
router.post('/transcripts', requireRole('admin', 'therapist', 'staff'), telehealthController.saveTranscript);

// Presence (Redis-backed user online status for Waiting Room)
router.get('/presence/:userId', telehealthController.getUserPresence);
router.post('/presence/batch', telehealthController.getBatchPresence);

// Room metadata (Redis Hash)
router.get('/rooms/:roomId/meta', telehealthController.getRoomMeta);

module.exports = router;
