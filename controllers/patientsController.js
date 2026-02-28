const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const prisma = require('../utils/prisma');
const { asyncHandler } = require('../middleware/errorHandler');
const { toSnakePatient } = require('../utils/transformers');
const { sendPatientWelcomeEmail } = require('../utils/emailService');

// Helper function to generate temporary password
const generateTemporaryPassword = () => {
  // Generate a random password with uppercase, lowercase, numbers, and special char
  const length = 12;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  
  // Ensure at least one of each type
  password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]; // uppercase
  password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]; // lowercase
  password += '0123456789'[Math.floor(Math.random() * 10)]; // number
  password += '!@#$%^&*'[Math.floor(Math.random() * 8)]; // special
  
  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
};

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
    // User data
    username,
    email,
    firstName,
    lastName,
    phoneNumber,
    
    // Patient data
    dateOfBirth,
    street,
    city,
    state,
    zipCode,
    country,
    emergencyContactName,
    emergencyContactPhone,
    emergencyContactRelationship,
    emergencyContactEmail,
    insuranceProvider,
    insurancePolicyNumber,
    insuranceGroupNumber,
    insuranceCopay,
    insuranceDeductible,
    medicalHistory,
    allergies,
    assignedTherapistId,
  } = req.body;

  // Validate required fields
  if (!username || !email || !firstName || !lastName) {
    return res.status(400).json({ 
      error: 'username, email, firstName, and lastName are required' 
    });
  }

  // Check if username or email already exists
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        { username },
        { email },
      ],
    },
  });

  if (existingUser) {
    return res.status(400).json({ 
      error: existingUser.username === username 
        ? 'Username already exists' 
        : 'Email already exists' 
    });
  }

  // Generate temporary password
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, 10);

  // Create user and patient in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // Create user account
    const user = await tx.user.create({
      data: {
        username,
        email,
        passwordHash,
        firstName,
        lastName,
        phoneNumber,
        role: 'client',
        mustChangePassword: true,
        isActive: true,
      },
    });

    // Create patient profile
    const patient = await tx.patient.create({
      data: {
        userId: user.id,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        street,
        city,
        state,
        zipCode,
        country,
        emergencyContactName,
        emergencyContactPhone,
        emergencyContactRelationship,
        emergencyContactEmail,
        insuranceProvider,
        insurancePolicyNumber,
        insuranceGroupNumber,
        insuranceCopay: insuranceCopay ? parseFloat(insuranceCopay) : null,
        insuranceDeductible: insuranceDeductible ? parseFloat(insuranceDeductible) : null,
        medicalHistory,
        allergies,
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
            phoneNumber: true,
            role: true,
            isActive: true,
          },
        },
        assignedTherapist: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return { user, patient };
  });

  const { user, patient } = result;

  // Prepare email data
  const therapistName = patient.assignedTherapist
    ? `${patient.assignedTherapist.firstName} ${patient.assignedTherapist.lastName}`
    : null;

  const emailData = {
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    username: user.username,
    temporaryPassword,
    assignedTherapist: therapistName,
  };

  // Send welcome email asynchronously
  sendPatientWelcomeEmail(emailData)
    .then((result) => {
      if (result.success) {
        console.log(`✅ Welcome email sent to patient: ${user.email}`);
      } else {
        console.error(`❌ Failed to send welcome email to ${user.email}:`, result.error);
      }
    })
    .catch((error) => {
      console.error(`❌ Error sending welcome email to ${user.email}:`, error);
    });

  // Transform to snake_case for API response
  const transformedPatient = toSnakePatient(patient);

  return res.status(201).json({
    ...transformedPatient,
    message: 'Patient created successfully. Welcome email sent with login credentials.',
  });
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
