const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const telehealthController = require('../controllers/telehealthController');

// All routes require authentication
router.use(authenticate);

// Sessions
router.get('/sessions', telehealthController.getSessions);
router.post('/sessions', requireRole('admin', 'therapist', 'staff'), telehealthController.createSession);
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

module.exports = router;
