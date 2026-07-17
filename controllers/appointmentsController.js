const prisma = require('../utils/prisma');
const { asyncHandler } = require('../middleware/errorHandler');
const { toSnakeAppointment } = require('../utils/transformers');
const { redisClient } = require('../utils/redis');
const { createTelehealthSessionForAppointment } = require('../utils/telehealthSession');
const { stopSeries } = require('../utils/recurringAppointments');

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

  if (status) where.status = status;
  if (appointmentType) where.appointmentType = appointmentType;

  if (startDate || endDate) {
    where.startTime = {};
    if (startDate) where.startTime.gte = new Date(startDate);
    if (endDate) where.startTime.lte = new Date(endDate);
  }

  // Access control — mirrors patientsController/soapNotesController. Without
  // this, any authenticated user (including other therapists) could see
  // every appointment for every patient/therapist in the system.
  if (req.user.role === 'client') {
    const patientRecord = await prisma.patient.findFirst({ where: { userId: req.user.id } });
    if (!patientRecord) {
      return res.json({ results: [], count: 0, next: null, previous: null });
    }
    where.patientId = patientRecord.id;
  } else if (req.user.role === 'therapist') {
    where.therapistId = req.user.id;
    if (patientId) where.patientId = patientId;
  } else {
    // admin/staff — honor explicit filters
    if (patientId) where.patientId = patientId;
    if (therapistId) where.therapistId = therapistId;
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
              phoneNumber: true,
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
      invoice: true,
      session: true, // Include telehealth session if exists
    },
  });

  if (!appointment) {
    return res.status(404).json({ error: 'Appointment not found' });
  }

  if (req.user.role === 'therapist' && appointment.therapistId !== req.user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }
  if (req.user.role === 'client') {
    const patientRecord = await prisma.patient.findFirst({ where: { userId: req.user.id } });
    if (!patientRecord || appointment.patientId !== patientRecord.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
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
    repeat,
    isRecurring = false,
    recurrenceIntervalWeeks = 1,
    recurrenceEndDate,
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

  const shouldRepeat = Boolean(repeat || isRecurring);
  let existingRecurring = null;
  if (shouldRepeat) {
    existingRecurring = await prisma.appointment.findFirst({
      where: {
        patientId,
        therapistId,
        OR: [{ isRecurring: true }, { seriesId: { not: null } }],
        status: { in: ['scheduled', 'confirmed', 'in_progress'] },
      },
    });
  }

  // Repeated bookings are upserts: reuse the current appointment/session rows.
  const result = await prisma.$transaction(async (tx) => {
    const appointmentData = {
      patientId,
      therapistId,
      startTime: new Date(startTime),
      endTime: new Date(calculatedEndTime),
      type: finalAppointmentType,
      status: status || 'scheduled',
      notes,
      telehealthLink,
      location,
      isRecurring: shouldRepeat,
      recurrenceIntervalWeeks: Math.max(1, parseInt(recurrenceIntervalWeeks, 10) || 1),
      recurrenceEndDate: recurrenceEndDate ? new Date(recurrenceEndDate) : null,
    };
    const include = {
      patient: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      },
      therapist: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      session: true,
    };
    const appointment = existingRecurring
      ? await tx.appointment.update({
          where: { id: existingRecurring.id },
          data: appointmentData,
          include,
        })
      : await tx.appointment.create({
          data: { ...appointmentData, createdById: req.user.id },
          include,
        });

    let scheduledSession = null;
    if (isTelehealth && appointment.session) {
      scheduledSession = await tx.telehealthSession.update({
        where: { id: appointment.session.id },
        data: {
          status: 'scheduled',
          startedAt: null,
          endedAt: null,
          scheduledDuration: durationMinutes,
        },
      });
      await tx.telehealthParticipant.updateMany({
        where: { sessionId: appointment.session.id },
        data: { status: 'invited', joinedAt: null, leftAt: null },
      });
    } else if (isTelehealth) {
      scheduledSession = await createTelehealthSessionForAppointment(tx, {
        appointmentId: appointment.id,
        patientId,
        therapistId,
        patientUserId: appointment.patient.user.id,
        durationMinutes,
      });
    }

    return { appointment, scheduledSession };
  });

  // Cache sessionId in Redis keyed by appointmentId, TTL = appointment duration
  if (result.scheduledSession) {
    const ttlSeconds = durationMinutes * 60;
    if (redisClient) {
      await redisClient.set(
        `telehealth:appt:${result.appointment.id}`,
        result.scheduledSession.id,
        'EX',
        ttlSeconds
      ).catch((err) => console.error('[Redis] Failed to cache session:', err));
    }
  }

  return res.status(existingRecurring ? 200 : 201).json({
    ...toSnakeAppointment(result.appointment),
    updated_existing: Boolean(existingRecurring),
  });
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
    isRecurring,
    recurrenceIntervalWeeks,
    recurrenceEndDate,
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
  if (isRecurring !== undefined) updateData.isRecurring = Boolean(isRecurring);
  if (recurrenceIntervalWeeks !== undefined) {
    updateData.recurrenceIntervalWeeks = Math.max(1, parseInt(recurrenceIntervalWeeks, 10) || 1);
  }
  if (recurrenceEndDate !== undefined) {
    updateData.recurrenceEndDate = recurrenceEndDate ? new Date(recurrenceEndDate) : null;
  }

  if (isRecurring === true) {
    const current = await prisma.appointment.findUnique({ where: { id } });
    if (!current) return res.status(404).json({ error: 'Appointment not found' });
    const existingRecurring = await prisma.appointment.findFirst({
      where: {
        id: { not: id },
        patientId: current.patientId,
        therapistId: current.therapistId,
        OR: [{ isRecurring: true }, { seriesId: { not: null } }],
        status: { in: ['scheduled', 'confirmed', 'in_progress'] },
      },
    });
    if (existingRecurring) {
      return res.status(409).json({ error: 'This client already has a current recurring appointment with this therapist' });
    }
  }

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
      newSession = await createTelehealthSessionForAppointment(tx, {
        appointmentId: appointment.id,
        patientId: appointment.patientId,
        therapistId: appointment.therapistId,
        patientUserId: appointment.patient.user.id,
        durationMinutes,
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

// Stop a recurring appointment series: marks it inactive and cancels any
// not-yet-occurred generated appointments (past/in-progress ones are kept).
const stopAppointmentSeries = asyncHandler(async (req, res) => {
  const { seriesId } = req.params;

  const existing = await prisma.appointmentSeries.findUnique({ where: { id: seriesId } });
  if (!existing) {
    return res.status(404).json({ error: 'Appointment series not found' });
  }

  const { series, cancelledCount } = await stopSeries(seriesId);
  return res.json({
    series_id: series.id,
    is_active: series.isActive,
    cancelled_count: cancelledCount,
  });
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
  stopAppointmentSeries,
};
