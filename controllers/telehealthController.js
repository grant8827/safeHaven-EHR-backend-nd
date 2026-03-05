const prisma = require('../utils/prisma');
const { asyncHandler } = require('../middleware/errorHandler');
const { v4: uuidv4 } = require('uuid');
const { presenceHelpers, telehealthSessionHelpers } = require('../utils/redis');

// Get telehealth sessions
const getSessions = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    status,
    patientId,
    therapistId,
  } = req.query;
  const userId = req.user.id;
  const userRole = req.user.role;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const take = parseInt(limit);

  const where = {};

  if (status) where.status = status;

  // Access control
  if (userRole === 'client') {
    where.participants = {
      some: {
        userId,
      },
    };
  } else {
    if (patientId) {
      where.participants = {
        some: {
          userId: patientId,
          role: 'patient',
        },
      };
    }
    if (therapistId) {
      where.participants = {
        some: {
          userId: therapistId,
          role: 'therapist',
        },
      };
    }
  }

  const [sessions, total] = await Promise.all([
    prisma.telehealthSession.findMany({
      where,
      skip,
      take,
      include: {
        patient: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        appointment: {
          include: {
            therapist: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        participants: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                role: true,
              },
            },
          },
        },
        recordings: true,
        transcripts: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.telehealthSession.count({ where }),
  ]);

  // Transform sessions to match frontend expectations
  const transformedSessions = sessions.map(session => {
    const patientUser = session.patient?.user;
    const therapist = session.appointment?.therapist;
    
    return {
      id: session.id,
      room_id: session.roomId,
      session_url: session.sessionUrl,
      status: session.status,
      scheduled_at: session.appointment?.startTime || session.createdAt,
      duration: session.scheduledDuration,
      started_at: session.startedAt,
      ended_at: session.endedAt,
      platform: session.platform,
      patient: session.patientId,
      patient_details: patientUser ? {
        id: patientUser.id,
        first_name: patientUser.firstName,
        last_name: patientUser.lastName,
        email: patientUser.email,
      } : null,
      therapist: therapist?.id,
      therapist_details: therapist ? {
        id: therapist.id,
        first_name: therapist.firstName,
        last_name: therapist.lastName,
        email: therapist.email,
      } : null,
      appointment_id: session.appointmentId,
      title: session.appointment ? 'Telehealth Appointment' : 'Telehealth Session',
      is_emergency: false,
      has_recording: session.recordings && session.recordings.length > 0,
      has_transcript: session.transcripts && session.transcripts.length > 0,
      recording_enabled: session.recordingEnabled,
      chat_enabled: session.chatEnabled,
      screen_share_enabled: session.screenShareEnabled,
      participants: session.participants,
    };
  });

  return res.json({
    results: transformedSessions,
    count: total,
    next: skip + take < total ? parseInt(page) + 1 : null,
    previous: page > 1 ? parseInt(page) - 1 : null,
  });
});

// Get single session
const getSession = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const userRole = req.user.role;

  const session = await prisma.telehealthSession.findUnique({
    where: { id },
    include: {
      patient: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      },
      appointment: {
        include: {
          therapist: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      },
      participants: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              role: true,
              email: true,
            },
          },
        },
      },
      recordings: true,
      transcripts: true,
    },
  });

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  // Access control
  if (userRole === 'client') {
    const isParticipant = session.participants.some((p) => p.userId === userId);
    if (!isParticipant) {
      return res.status(403).json({ error: 'Access denied' });
    }
  }

  // Transform session to match frontend expectations
  const patientUser = session.patient?.user;
  const therapist = session.appointment?.therapist;
  
  const transformedSession = {
    id: session.id,
    room_id: session.roomId,
    session_url: session.sessionUrl,
    status: session.status,
    scheduled_at: session.appointment?.startTime || session.createdAt,
    duration: session.scheduledDuration,
    started_at: session.startedAt,
    ended_at: session.endedAt,
    platform: session.platform,
    patient: session.patientId,
    patient_details: patientUser ? {
      id: patientUser.id,
      first_name: patientUser.firstName,
      last_name: patientUser.lastName,
      email: patientUser.email,
    } : null,
    therapist: therapist?.id,
    therapist_details: therapist ? {
      id: therapist.id,
      first_name: therapist.firstName,
      last_name: therapist.lastName,
      email: therapist.email,
    } : null,
    appointment_id: session.appointmentId,
    title: session.appointment ? 'Telehealth Appointment' : 'Telehealth Session',
    is_emergency: false,
    has_recording: session.recordings && session.recordings.length > 0,
    has_transcript: session.transcripts && session.transcripts.length > 0,
    recording_enabled: session.recordingEnabled,
    chat_enabled: session.chatEnabled,
    screen_share_enabled: session.screenShareEnabled,
    participants: session.participants,
    recordings: session.recordings,
    transcripts: session.transcripts,
  };

  return res.json(transformedSession);
});

// Create telehealth session
const createSession = asyncHandler(async (req, res) => {
  const {
    roomId,
    patientId,
    scheduledDuration,
    participantIds,
  } = req.body;

  if (!patientId) {
    return res.status(400).json({ 
      error: 'patientId is required' 
    });
  }

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const generatedRoomId = roomId || uuidv4();
  const sessionUrl = `${frontendUrl}/telehealth/session/${generatedRoomId}`;

  const session = await prisma.telehealthSession.create({
    data: {
      roomId: generatedRoomId,
      sessionUrl,
      patientId,
      scheduledDuration: scheduledDuration || 60,
      status: 'scheduled',
      participants: {
        create: participantIds && participantIds.length > 0
          ? participantIds.map((userId) => ({
              userId,
              role: 'participant',
            }))
          : [],
      },
    },
    include: {
      participants: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              role: true,
            },
          },
        },
      },
    },
  });

  return res.status(201).json(session);
});

// Start session
const startSession = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const session = await prisma.telehealthSession.update({
    where: { id },
    data: {
      status: 'active',
      startedAt: new Date(),
    },
    include: {
      participants: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
  });

  return res.json(session);
});

// End session
const endSession = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { notes } = req.body;

  const session = await prisma.telehealthSession.findUnique({
    where: { id },
  });

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const actualDuration = session.startedAt 
    ? Math.floor((new Date() - session.startedAt) / 1000 / 60)
    : 0;

  const updatedSession = await prisma.telehealthSession.update({
    where: { id },
    data: {
      status: 'completed',
      endedAt: new Date(),
      actualDuration,
    },
    include: {
      participants: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
  });

  return res.json(updatedSession);
});

// Update session
const updateSession = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    status,
    notes,
    connectionQuality,
  } = req.body;

  const updateData = {};
  
  if (status) updateData.status = status;
  if (notes !== undefined) updateData.notes = notes;
  if (connectionQuality !== undefined) updateData.connectionQuality = connectionQuality;

  const session = await prisma.telehealthSession.update({
    where: { id },
    data: updateData,
    include: {
      participants: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
  });

  return res.json(session);
});

// Delete session
const deleteSession = asyncHandler(async (req, res) => {
  const { id } = req.params;

  await prisma.telehealthSession.delete({
    where: { id },
  });

  return res.status(204).send();
});

// Join session (update participant status)
const joinSession = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const participant = await prisma.telehealthParticipant.findFirst({
    where: {
      sessionId: id,
      userId,
    },
  });

  if (!participant) {
    return res.status(404).json({ error: 'Participant not found' });
  }

  const updatedParticipant = await prisma.telehealthParticipant.update({
    where: { id: participant.id },
    data: {
      joinedAt: new Date(),
    },
    include: {
      session: true,
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  return res.json(updatedParticipant);
});

// Leave session (update participant status)
const leaveSession = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const participant = await prisma.telehealthParticipant.findFirst({
    where: {
      sessionId: id,
      userId,
    },
  });

  if (!participant) {
    return res.status(404).json({ error: 'Participant not found' });
  }

  const updatedParticipant = await prisma.telehealthParticipant.update({
    where: { id: participant.id },
    data: {
      leftAt: new Date(),
    },
    include: {
      session: true,
    },
  });

  return res.json(updatedParticipant);
});

// Save recording metadata
const saveRecording = asyncHandler(async (req, res) => {
  const { sessionId, fileUrl, fileSize, duration, storageProvider } = req.body;

  if (!sessionId || !fileUrl) {
    return res.status(400).json({ error: 'sessionId and fileUrl are required' });
  }

  const recording = await prisma.recordingMetadata.create({
    data: {
      sessionId,
      fileUrl,
      fileSize,
      duration,
      storageProvider,
    },
    include: {
      session: {
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
      },
    },
  });

  return res.status(201).json(recording);
});

// Save transcript
const saveTranscript = asyncHandler(async (req, res) => {
  const { sessionId, content, speakerId, timestamp } = req.body;

  if (!sessionId || !content) {
    return res.status(400).json({ error: 'sessionId and content are required' });
  }

  const transcript = await prisma.transcript.create({
    data: {
      sessionId,
      content,
      speakerId,
      timestamp: timestamp ? parseFloat(timestamp) : 0,
    },
  });

  return res.status(201).json(transcript);
});

// Create emergency session
const createEmergencySession = asyncHandler(async (req, res) => {
  const { patient_id } = req.body;
  const therapistId = req.user.id;

  if (!patient_id) {
    return res.status(400).json({ error: 'patient_id is required' });
  }

  // Verify patient exists
  const patient = await prisma.patient.findUnique({
    where: { id: patient_id },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  if (!patient) {
    return res.status(404).json({ error: 'Patient not found' });
  }

  // Create session with room ID
  const roomId = `emergency-${uuidv4()}`;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const sessionUrl = `${frontendUrl}/telehealth/session/${roomId}`;

  const session = await prisma.telehealthSession.create({
    data: {
      patientId: patient_id,
      roomId,
      sessionUrl,
      status: 'active',
      scheduledDuration: 60, // 60 minutes default for emergency sessions
      platform: 'webrtc',
      recordingEnabled: true,
      chatEnabled: true,
      screenShareEnabled: true,
      participants: {
        create: [
          {
            userId: therapistId,
            role: 'therapist',
            status: 'invited',
          },
          {
            userId: patient.user.id,
            role: 'patient',
            status: 'invited',
          },
        ],
      },
    },
    include: {
      participants: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true,
            },
          },
        },
      },
      patient: {
        include: {
          user: true,
        },
      },
    },
  });

  // Send email to patient with join link
  try {
    const emailService = require('../utils/emailService');
    await emailService.sendEmergencySessionEmail({
      email: patient.user.email,
      firstName: patient.user.firstName,
      lastName: patient.user.lastName,
      sessionUrl,
      roomId,
    });
  } catch (emailError) {
    console.error('Error sending emergency session email:', emailError);
    // Don't fail the request if email fails
  }

  return res.status(201).json({
    session,
    session_url: sessionUrl,
    room_id: roomId,
    message: 'Emergency session created and email sent to patient',
  });
});

// GET /telehealth/presence/:userId
// Returns whether a given user is currently online (for Waiting Room UI)
const getUserPresence = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const isOnline = await presenceHelpers.isOnline(userId);
  return res.json({ userId, online: isOnline });
});

// GET /telehealth/presence/batch
// Check presence for multiple users at once
// body: { userIds: ["id1", "id2", ...] }
const getBatchPresence = asyncHandler(async (req, res) => {
  const { userIds } = req.body;
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ error: 'userIds array required' });
  }
  const results = {};
  await Promise.all(
    userIds.map(async (id) => {
      results[id] = await presenceHelpers.isOnline(id);
    })
  );
  return res.json({ presence: results });
});

// GET /telehealth/sessions/room/:roomId/meta
// Returns Redis Hash session metadata for a room
const getRoomMeta = asyncHandler(async (req, res) => {
  const { roomId } = req.params;
  const meta = await telehealthSessionHelpers.getSessionMeta(roomId);
  if (!meta) {
    return res.status(404).json({ error: 'No active session found for this room' });
  }
  return res.json({ roomId, meta });
});

module.exports = {
  getSessions,
  getSession,
  createSession,
  createEmergencySession,
  startSession,
  endSession,
  updateSession,
  deleteSession,
  joinSession,
  leaveSession,
  saveRecording,
  saveTranscript,
  getUserPresence,
  getBatchPresence,
  getRoomMeta,
};
