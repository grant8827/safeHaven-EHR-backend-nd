const prisma = require('../utils/prisma');
const { asyncHandler } = require('../middleware/errorHandler');
const { toSnakeAppointment } = require('../utils/transformers');
const crypto = require('crypto');
const { redisClient } = require('../utils/redis');

// Get all appointments (with filters)
const getAppointments = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    patientId,
    therapistId,
    status,
    startDate,
    endDate,
    appointmentType,
  } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const take = parseInt(limit);

  const where = {};

  if (patientId) where.patientId = patientId;
  if (therapistId) where.therapistId = therapistId;
  if (status) where.status = status;
  if (appointmentType) where.appointmentType = appointmentType;

  if (startDate || endDate) {
    where.startTime = {};
    if (startDate) where.startTime.gte = new Date(startDate);
    if (endDate) where.startTime.lte = new Date(endDate);
  }

  const [appointments, total] = await Promise.all([
    prisma.appointment.findMany({
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
        therapist: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { startTime: 'desc' },
    }),
    prisma.appointment.count({ where }),
  ]);

  return res.json({
    results: appointments.map(toSnakeAppointment),
    count: total,
    next: skip + take < total ? parseInt(page) + 1 : null,
    previous: page > 1 ? parseInt(page) - 1 : null,
  });
});

// Get single appointment
const getAppointment = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const appointment = await prisma.appointment.findUnique({
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
              phone: true,
            },
          },
        },
      },
      therapist: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      soapNote: true,
      relatedInvoices: true,
      session: true, // Include telehealth session if exists
    },
  });

  if (!appointment) {
    return res.status(404).json({ error: 'Appointment not found' });
  }

  return res.json(toSnakeAppointment(appointment));
});

// Create appointment
const createAppointment = asyncHandler(async (req, res) => {
  const {
    patientId,
    therapistId,
    startTime,
    endTime,
    duration,
    appointmentType,
    type,
    status,
    notes,
    telehealthLink,
    location,
  } = req.body;

  if (!patientId || !therapistId || !startTime) {
    return res.status(400).json({ 
      error: 'patientId, therapistId, and startTime are required' 
    });
  }

  // Calculate endTime if not provided but duration is
  let calculatedEndTime = endTime;
  if (!calculatedEndTime && duration) {
    const start = new Date(startTime);
    calculatedEndTime = new Date(start.getTime() + duration * 60000); // duration in minutes
  } else if (!calculatedEndTime) {
    // Default 60-minute appointment
    const start = new Date(startTime);
    calculatedEndTime = new Date(start.getTime() + 60 * 60000);
  }

  // Determine appointment type
  const finalAppointmentType = type || appointmentType || 'therapy_session';
  // Create a telehealth session if type is telehealth OR if telehealthLink was provided
  const isTelehealth = finalAppointmentType === 'telehealth' || (telehealthLink != null && telehealthLink !== '');

  // Calculate duration in minutes
  const durationMinutes = duration || Math.round((new Date(calculatedEndTime) - new Date(startTime)) / 60000);

  // Create appointment and telehealth session in a transaction if needed
  const result = await prisma.$transaction(async (tx) => {
    // Create the appointment
    const appointment = await tx.appointment.create({
      data: {
        patientId,
        therapistId,
        createdById: req.user.id,
        startTime: new Date(startTime),
        endTime: new Date(calculatedEndTime),
        type: finalAppointmentType,
        status: status || 'scheduled',
        notes,
        telehealthLink,
        location,
      },
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
        therapist: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    // If it's a telehealth appointment, create a session
    let createdSession = null;
    if (isTelehealth) {
      const roomId = crypto.randomBytes(16).toString('hex');
      const sessionToken = crypto.randomBytes(32).toString('hex');
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const sessionUrl = `${baseUrl}/telehealth/session/${roomId}`;

      createdSession = await tx.telehealthSession.create({
        data: {
          appointmentId: appointment.id,
          patientId,
          therapistId,
          roomId,
          sessionUrl,
          sessionToken,
          status: 'scheduled',
          scheduledDuration: durationMinutes,
          platform: 'webrtc',
          recordingEnabled: true,
          chatEnabled: true,
          screenShareEnabled: true,
        },
      });
    }

    return { appointment, createdSession };
  });

  // Cache sessionId in Redis keyed by appointmentId, TTL = appointment duration
  if (result.createdSession) {
    const ttlSeconds = durationMinutes * 60;
    if (redisClient) {
      await redisClient.set(
        `telehealth:appt:${result.appointment.id}`,
        result.createdSession.id,
        'EX',
        ttlSeconds
      ).catch((err) => console.error('[Redis] Failed to cache session:', err));
    }
  }

  return res.status(201).json(toSnakeAppointment(result.appointment));
});

// Update appointment
const updateAppointment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    startTime,
    endTime,
    duration,
    appointmentType,
    type,
    status,
    notes,
    telehealthLink,
    location,
    noShowReason,
    cancelledBy,
  } = req.body;

  const updateData = {};
  
  if (startTime) {
    updateData.startTime = new Date(startTime);
    // If duration is provided, calculate endTime
    if (duration && !endTime) {
      const start = new Date(startTime);
      updateData.endTime = new Date(start.getTime() + duration * 60000);
    }
  }
  if (endTime) updateData.endTime = new Date(endTime);
  if (type || appointmentType) updateData.type = type || appointmentType;
  if (status) updateData.status = status;
  if (notes !== undefined) updateData.notes = notes;
  if (telehealthLink !== undefined) updateData.telehealthLink = telehealthLink;
  if (location !== undefined) updateData.location = location;
  if (noShowReason !== undefined) updateData.noShowReason = noShowReason;
  if (cancelledBy !== undefined) updateData.cancelledBy = cancelledBy;

  // Check if the appointment is being changed to telehealth
  const finalType = type || appointmentType;
  const isChangingToTelehealth = finalType === 'telehealth';

  const result = await prisma.$transaction(async (tx) => {
    // Update the appointment
    const appointment = await tx.appointment.update({
      where: { id },
      data: updateData,
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
        therapist: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        session: true, // Include session to check if it exists
      },
    });

    // If the appointment is now telehealth and doesn't have a session, create one
    let newSession = null;
    if (isChangingToTelehealth && !appointment.session) {
      const durationMinutes = duration || Math.round((appointment.endTime - appointment.startTime) / 60000);
      const roomId = crypto.randomBytes(16).toString('hex');
      const sessionToken = crypto.randomBytes(32).toString('hex');
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const sessionUrl = `${baseUrl}/telehealth/session/${roomId}`;

      newSession = await tx.telehealthSession.create({
        data: {
          appointmentId: appointment.id,
          patientId: appointment.patientId,
          roomId,
          sessionUrl,
          sessionToken,
          status: 'scheduled',
          scheduledDuration: durationMinutes,
          platform: 'webrtc',
          recordingEnabled: true,
          chatEnabled: true,
          screenShareEnabled: true,
        },
      });
    }

    return { appointment, newSession };
  });

  // Cache newly created session in Redis
  if (result.newSession) {
    const appt = result.appointment;
    const durationMinutes = Math.round((appt.endTime - appt.startTime) / 60000);
    const ttlSeconds = durationMinutes * 60;
    if (redisClient) {
      await redisClient.set(
        `telehealth:appt:${appt.id}`,
        result.newSession.id,
        'EX',
        ttlSeconds
      ).catch((err) => console.error('[Redis] Failed to cache session:', err));
    }
  }

  return res.json(toSnakeAppointment(result.appointment));
});

// Delete appointment
const deleteAppointment = asyncHandler(async (req, res) => {
  const { id } = req.params;

  await prisma.appointment.delete({
    where: { id },
  });

  return res.status(204).send();
});

// Cancel appointment
const cancelAppointment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { cancelledBy, notes } = req.body;

  const appointment = await prisma.appointment.update({
    where: { id },
    data: {
      status: 'cancelled',
      cancelledBy,
      notes,
    },
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
      therapist: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  return res.json(toSnakeAppointment(appointment));
});

// Mark as no-show
const markNoShow = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const appointment = await prisma.appointment.update({
    where: { id },
    data: {
      status: 'no_show',
      noShowReason: reason,
    },
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
      therapist: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  return res.json(toSnakeAppointment(appointment));
});

// Confirm appointment (patient confirms their own, or staff confirms on their behalf)
const confirmAppointment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = req.user;

  // Find appointment first to verify ownership when patient is confirming
  const existingAppointment = await prisma.appointment.findUnique({
    where: { id },
    include: {
      patient: {
        include: {
          user: { select: { id: true } },
        },
      },
    },
  });

  if (!existingAppointment) {
    return res.status(404).json({ error: 'Appointment not found' });
  }

  // Clients may only confirm their own appointment
  if (user.role === 'client') {
    const patientUserId = existingAppointment.patient?.user?.id;
    if (patientUserId !== user.id) {
      return res.status(403).json({ error: 'Not authorized to confirm this appointment' });
    }
  }

  const appointment = await prisma.appointment.update({
    where: { id },
    data: { status: 'confirmed' },
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
      therapist: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  return res.json(toSnakeAppointment(appointment));
});

// Get appointment types (from enum)
const getAppointmentTypes = asyncHandler(async (req, res) => {
  // Return the appointment types from the Prisma schema enum
  const types = [
    { value: 'initial_consultation', label: 'Initial Consultation' },
    { value: 'therapy_session', label: 'Therapy Session' },
    { value: 'follow_up', label: 'Follow-up' },
    { value: 'group_therapy', label: 'Group Therapy' },
    { value: 'telehealth', label: 'Telehealth' },
    { value: 'assessment', label: 'Assessment' },
  ];
  
  return res.json(types);
});

module.exports = {
  getAppointments,
  getAppointment,
  createAppointment,
  updateAppointment,
  deleteAppointment,
  cancelAppointment,
  markNoShow,
  confirmAppointment,
  getAppointmentTypes,
};
