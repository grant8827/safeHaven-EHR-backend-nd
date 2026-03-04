const prisma = require('../utils/prisma');
const { asyncHandler } = require('../middleware/errorHandler');

// Get all SOAP notes (with filters)
const getSoapNotes = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    patientId,
    therapistId,
    appointmentId,
  } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const take = parseInt(limit);

  const where = {};

  if (patientId) where.patientId = patientId;
  if (therapistId) where.therapistId = therapistId;
  if (appointmentId) where.appointmentId = appointmentId;

  const [soapNotes, total] = await Promise.all([
    prisma.sOAPNote.findMany({
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
        appointment: {
          select: {
            id: true,
            startTime: true,
            endTime: true,
            type: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.sOAPNote.count({ where }),
  ]);

  return res.json({
    results: soapNotes,
    count: total,
    next: skip + take < total ? parseInt(page) + 1 : null,
    previous: page > 1 ? parseInt(page) - 1 : null,
  });
});

// Get single SOAP note
const getSoapNote = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const soapNote = await prisma.sOAPNote.findUnique({
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
      therapist: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      appointment: {
        select: {
          id: true,
          appointmentDate: true,
          appointmentType: true,
          duration: true,
        },
      },
    },
  });

  if (!soapNote) {
    return res.status(404).json({ error: 'SOAP note not found' });
  }

  return res.json(soapNote);
});

// Create SOAP note
const createSoapNote = asyncHandler(async (req, res) => {
  const {
    patientId,
    therapistId,
    appointmentId,
    subjective,
    objective,
    assessment,
    plan,
    diagnosis,
    interventions,
    goals,
    homework,
  } = req.body;

  if (!patientId || !therapistId) {
    return res.status(400).json({ 
      error: 'patientId and therapistId are required' 
    });
  }

  const soapNote = await prisma.sOAPNote.create({
    data: {
      patientId,
      therapistId,
      appointmentId,
      subjective,
      objective,
      assessment,
      plan,
      diagnosis,
      interventions,
      goals,
      homework,
    },
    include: {
      patient: {
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
      therapist: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      appointment: {
        select: {
          id: true,
          appointmentDate: true,
        },
      },
    },
  });

  return res.status(201).json(soapNote);
});

// Update SOAP note
const updateSoapNote = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    subjective,
    objective,
    assessment,
    plan,
    diagnosis,
    interventions,
    goals,
    homework,
  } = req.body;

  const updateData = {};
  
  if (subjective !== undefined) updateData.subjective = subjective;
  if (objective !== undefined) updateData.objective = objective;
  if (assessment !== undefined) updateData.assessment = assessment;
  if (plan !== undefined) updateData.plan = plan;
  if (diagnosis !== undefined) updateData.diagnosis = diagnosis;
  if (interventions !== undefined) updateData.interventions = interventions;
  if (goals !== undefined) updateData.goals = goals;
  if (homework !== undefined) updateData.homework = homework;

  const soapNote = await prisma.sOAPNote.update({
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
      appointment: {
        select: {
          id: true,
          appointmentDate: true,
        },
      },
    },
  });

  return res.json(soapNote);
});

// Delete SOAP note
const deleteSoapNote = asyncHandler(async (req, res) => {
  const { id } = req.params;

  await prisma.sOAPNote.delete({
    where: { id },
  });

  return res.status(204).send();
});

module.exports = {
  getSoapNotes,
  getSoapNote,
  createSoapNote,
  updateSoapNote,
  deleteSoapNote,
};
