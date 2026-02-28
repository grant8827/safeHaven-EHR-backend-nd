const prisma = require('../utils/prisma');
const { asyncHandler } = require('../middleware/errorHandler');
const { toSnakePatient } = require('../utils/transformers');
const { sendPatientWelcomeEmail } = require('../utils/emailService');

// Get all patients (with filters and pagination)
const getPatients = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    search,
    assignedTherapistId,
    isActive,
  } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const take = parseInt(limit);

  const where = {};

  if (search) {
    where.OR = [
      { user: { firstName: { contains: search, mode: 'insensitive' } } },
      { user: { lastName: { contains: search, mode: 'insensitive' } } },
      { user: { email: { contains: search, mode: 'insensitive' } } },
      { phone: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (assignedTherapistId) {
    where.assignedTherapistId = assignedTherapistId;
  }

  if (isActive !== undefined) {
    where.user = { ...where.user, isActive: isActive === 'true' };
  }

  const [patients, total] = await Promise.all([
    prisma.patient.findMany({
      where,
      skip,
      take,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            firstName: true,
            lastName: true,
            phoneNumber: true,
            isActive: true,
          },
        },
        assignedTherapist: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.patient.count({ where }),
  ]);

  // Transform patients to snake_case with flattened user fields
  const transformedPatients = patients.map(toSnakePatient);

  return res.json({
    results: transformedPatients,
    count: total,
    next: skip + take < total ? parseInt(page) + 1 : null,
    previous: page > 1 ? parseInt(page) - 1 : null,
  });
});

// Get single patient
const getPatient = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const patient = await prisma.patient.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          email: true,
          firstName: true,
          lastName: true,
          phoneNumber: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      assignedTherapist: {
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  if (!patient) {
    return res.status(404).json({ error: 'Patient not found' });
  }

  // Transform patient to snake_case with flattened user fields
  const transformedPatient = toSnakePatient(patient);

  return res.json(transformedPatient);
});

// Create patient
const createPatient = asyncHandler(async (req, res) => {
  const {
    userId,
    dateOfBirth,
    gender,
    phone,
    address,
    city,
    state,
    zipCode,
    emergencyContactName,
    emergencyContactPhone,
    emergencyContactRelation,
    insuranceProvider,
    insurancePolicyNumber,
    insuranceGroupNumber,
    medicalHistory,
    allergies,
    currentMedications,
    assignedTherapistId,
  } = req.body;

  if (!userId || !dateOfBirth) {
    return res.status(400).json({ error: 'userId and dateOfBirth are required' });
  }

  const patient = await prisma.patient.create({
    data: {
      userId,
      dateOfBirth: new Date(dateOfBirth),
      gender,
      phone,
      address,
      city,
      state,
      zipCode,
      emergencyContactName,
      emergencyContactPhone,
      emergencyContactRelation,
      insuranceProvider,
      insurancePolicyNumber,
      insuranceGroupNumber,
      medicalHistory,
      allergies,
      currentMedications,
      assignedTherapistId,
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
      assignedTherapist: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  // Send welcome email if patient has therapist assigned
  if (patient.user.role === 'client' || assignedTherapistId) {
    const therapistName = patient.assignedTherapist
      ? `${patient.assignedTherapist.firstName} ${patient.assignedTherapist.lastName}`
      : null;

    // Note: We don't have the password here since the user was created separately
    // This email will only include therapist assignment info
    console.log(`📧 Patient profile created for ${patient.user.email} - Welcome email will be sent during user registration`);
  }

  return res.status(201).json(patient);
});

// Update patient
const updatePatient = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    dateOfBirth,
    gender,
    phone,
    address,
    city,
    state,
    zipCode,
    emergencyContactName,
    emergencyContactPhone,
    emergencyContactRelation,
    insuranceProvider,
    insurancePolicyNumber,
    insuranceGroupNumber,
    medicalHistory,
    allergies,
    currentMedications,
    assignedTherapistId,
  } = req.body;

  const updateData = {};
  
  if (dateOfBirth) updateData.dateOfBirth = new Date(dateOfBirth);
  if (gender !== undefined) updateData.gender = gender;
  if (phone !== undefined) updateData.phone = phone;
  if (address !== undefined) updateData.address = address;
  if (city !== undefined) updateData.city = city;
  if (state !== undefined) updateData.state = state;
  if (zipCode !== undefined) updateData.zipCode = zipCode;
  if (emergencyContactName !== undefined) updateData.emergencyContactName = emergencyContactName;
  if (emergencyContactPhone !== undefined) updateData.emergencyContactPhone = emergencyContactPhone;
  if (emergencyContactRelation !== undefined) updateData.emergencyContactRelation = emergencyContactRelation;
  if (insuranceProvider !== undefined) updateData.insuranceProvider = insuranceProvider;
  if (insurancePolicyNumber !== undefined) updateData.insurancePolicyNumber = insurancePolicyNumber;
  if (insuranceGroupNumber !== undefined) updateData.insuranceGroupNumber = insuranceGroupNumber;
  if (medicalHistory !== undefined) updateData.medicalHistory = medicalHistory;
  if (allergies !== undefined) updateData.allergies = allergies;
  if (currentMedications !== undefined) updateData.currentMedications = currentMedications;
  if (assignedTherapistId !== undefined) updateData.assignedTherapistId = assignedTherapistId;

  const patient = await prisma.patient.update({
    where: { id },
    data: updateData,
    include: {
      user: {
        select: {
          id: true,
          username: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
      assignedTherapist: {
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  return res.json(patient);
});

// Delete patient
const deletePatient = asyncHandler(async (req, res) => {
  const { id } = req.params;

  await prisma.patient.delete({
    where: { id },
  });

  return res.status(204).send();
});

// Get patient by user ID
const getPatientByUserId = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const patient = await prisma.patient.findUnique({
    where: { userId },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          email: true,
          firstName: true,
          lastName: true,
          isActive: true,
        },
      },
      assignedTherapist: {
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  if (!patient) {
    return res.status(404).json({ error: 'Patient not found' });
  }

  return res.json(patient);
});

module.exports = {
  getPatients,
  getPatient,
  createPatient,
  updatePatient,
  deletePatient,
  getPatientByUserId,
};
