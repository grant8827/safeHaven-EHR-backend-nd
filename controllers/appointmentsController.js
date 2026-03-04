const prisma = require('../utils/prisma');
const { asyncHandler } = require('../middleware/errorHandler');
const { toSnakeAppointment } = require('../utils/transformers');

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

  const appointment = await prisma.appointment.create({
    data: {
      patientId,
      therapistId,
      createdById: req.user.id,
      startTime: new Date(startTime),
      endTime: new Date(calculatedEndTime),
      type: type || appointmentType || 'therapy_session',
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

  return res.status(201).json(toSnakeAppointment(appointment));
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

  const appointment = await prisma.appointment.update({
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
    },
  });

  return res.json(toSnakeAppointment(appointment));
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
  getAppointmentTypes,
};
