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

  // Privacy: therapist only sees patients assigned to them
  if (req.user.role === 'therapist') {
    where.assignedTherapistId = req.user.id;
  }

  // Privacy: client only sees their own record
  if (req.user.role === 'client') {
    where.userId = req.user.id;
  }

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

  // Privacy: therapist can only view their assigned patient
  if (req.user.role === 'therapist' && patient.assignedTherapistId !== req.user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  // Privacy: client can only view their own record
  if (req.user.role === 'client' && patient.userId !== req.user.id) {
    return res.status(403).json({ error: 'Access denied' });
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
    primaryDiagnosis,
    insuranceMemberID,
    insuranceEffectiveDate,
    assignedTherapistId,
    gender,
  } = req.body;

  // Validate required fields
  if (!username || !email || !firstName || !lastName) {
    return res.status(400).json({ 
      error: 'username, email, firstName, and lastName are required' 
    });
  }

  // Check if email already exists (hard stop — one account per email)
  const existingByEmail = await prisma.user.findFirst({ where: { email } });
  if (existingByEmail) {
    return res.status(400).json({ error: 'A patient with this email already exists' });
  }

  // Check if username is taken and auto-suffix if needed
  let finalUsername = username;
  const existingByUsername = await prisma.user.findFirst({ where: { username } });
  if (existingByUsername) {
    const suffix = Math.random().toString(16).slice(2, 6);
    finalUsername = `${username}_${suffix}`;
  }

  // Generate temporary password
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, 10);

  // Create user and patient in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // Create user account
    const user = await tx.user.create({
      data: {
        username: finalUsername,
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
        gender,
        medicalHistory,
        allergies,
        primaryDiagnosis,
        insuranceMemberID,
        insuranceEffectiveDate: insuranceEffectiveDate ? new Date(insuranceEffectiveDate) : null,
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

  // Send welcome email and capture result
  let emailSent = false;
  try {
    const emailResult = await sendPatientWelcomeEmail(emailData);
    emailSent = emailResult.success === true;
    if (emailSent) {
      console.log(`✅ Welcome email sent to patient: ${user.email}`);
    } else {
      console.error(`❌ Failed to send welcome email to ${user.email}:`, emailResult.error);
    }
  } catch (emailError) {
    console.error(`❌ Error sending welcome email to ${user.email}:`, emailError);
  }

  // Send in-app welcome notification + message using templates
  try {
    const [notifTemplate, msgTemplate, adminUser] = await Promise.all([
      prisma.notificationTemplate.findUnique({ where: { type: 'welcome' } }),
      prisma.messageTemplate.findUnique({ where: { type: 'welcome' } }),
      prisma.user.findFirst({ where: { role: 'admin', isActive: true }, orderBy: { createdAt: 'asc' } }),
    ]);

    // Create in-app notification for the new patient
    if (notifTemplate && notifTemplate.isActive) {
      await prisma.notification.create({
        data: {
          userId: user.id,
          type: notifTemplate.type,
          title: notifTemplate.title,
          body: notifTemplate.body,
        },
      });
      console.log(`✅ Welcome notification created for patient: ${user.email}`);
    }

    // Create welcome message thread from admin to patient
    if (msgTemplate && msgTemplate.isActive && adminUser) {
      const personalizedBody = msgTemplate.body.replace(/\{\{first_name\}\}/gi, user.firstName);
      await prisma.messageThread.create({
        data: {
          subject: msgTemplate.subject,
          participants: {
            create: [
              { userId: adminUser.id },
              { userId: user.id },
            ],
          },
          messages: {
            create: {
              senderId: adminUser.id,
              content: personalizedBody,
              priority: 'normal',
            },
          },
        },
      });
      console.log(`✅ Welcome message sent to patient: ${user.email}`);
    }
  } catch (templateError) {
    // Non-fatal — patient was still created successfully
    console.error('⚠️ Error sending welcome templates:', templateError);
  }

  // Transform to snake_case for API response
  const transformedPatient = toSnakePatient(patient);

  return res.status(201).json({
    ...transformedPatient,
    email_sent: emailSent,
    message: emailSent
      ? 'Patient created successfully. Welcome email sent with login credentials.'
      : 'Patient created successfully. Note: Welcome email could not be sent.',
  });
});

// Update patient
const updatePatient = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Fetch existing patient for role check + therapist-change detection
  const existingPatient = await prisma.patient.findUnique({
    where: { id },
    select: {
      assignedTherapistId: true,
      primaryDiagnosis: true,
      user: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  if (!existingPatient) return res.status(404).json({ error: 'Patient not found' });

  // Privacy: therapist can only update their assigned patient
  if (req.user.role === 'therapist') {
    if (existingPatient.assignedTherapistId !== req.user.id) return res.status(403).json({ error: 'Access denied' });
  }

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
    status,
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
  if (status !== undefined) updateData.isActive = status === 'active';

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
          bio: true,
        },
      },
    },
  });

  // ── Fire assign_therapist notifications & messages when therapist changes ──
  const therapistChanged =
    assignedTherapistId !== undefined &&
    assignedTherapistId !== null &&
    assignedTherapistId !== existingPatient.assignedTherapistId;

  if (therapistChanged && patient.assignedTherapist) {
    try {
      const therapist = patient.assignedTherapist;
      const patientUser = existingPatient.user;
      const primaryDiagnosis = existingPatient.primaryDiagnosis || 'Not specified';
      const therapistFullName = `${therapist.firstName} ${therapist.lastName}`;
      const patientFullName = `${patientUser.firstName} ${patientUser.lastName}`;
      const therapistBio = therapist.bio || '';

      // Find an admin to be the message sender
      const adminUser = await prisma.user.findFirst({ where: { role: 'admin' }, select: { id: true } });
      const senderId = adminUser?.id || req.user.id;

      // 1. Patient notification
      const patNotifTpl = await prisma.notificationTemplate.findUnique({ where: { type: 'assign_therapist_patient' } });
      if (patNotifTpl) {
        await prisma.notification.create({
          data: {
            userId: patientUser.id,
            type: 'assign_therapist_patient',
            title: patNotifTpl.title,
            body: patNotifTpl.body,
            isRead: false,
          },
        });
      }

      // 2. Patient message
      const patMsgTpl = await prisma.messageTemplate.findUnique({ where: { type: 'assign_therapist_patient' } });
      if (patMsgTpl) {
        const patMsgBody = patMsgTpl.body
          .replace(/\{\{therapist_name\}\}/g, therapistFullName)
          .replace(/\{\{therapist_bio\}\}/g, therapistBio);
        const patThread = await prisma.messageThread.create({
          data: {
            subject: patMsgTpl.subject,
            participants: { create: [{ userId: senderId }, { userId: patientUser.id }] },
          },
        });
        await prisma.message.create({
          data: { threadId: patThread.id, senderId, body: patMsgBody },
        });
      }

      // 3. Therapist notification
      const thrNotifTpl = await prisma.notificationTemplate.findUnique({ where: { type: 'assign_therapist_therapist' } });
      if (thrNotifTpl) {
        const thrNotifBody = thrNotifTpl.body.replace(/\{\{patient_name\}\}/g, patientFullName);
        await prisma.notification.create({
          data: {
            userId: therapist.id,
            type: 'assign_therapist_therapist',
            title: thrNotifTpl.title,
            body: thrNotifBody,
            isRead: false,
          },
        });
      }

      // 4. Therapist message
      const thrMsgTpl = await prisma.messageTemplate.findUnique({ where: { type: 'assign_therapist_therapist' } });
      if (thrMsgTpl) {
        const thrMsgBody = thrMsgTpl.body
          .replace(/\{\{patient_name\}\}/g, patientFullName)
          .replace(/\{\{primary_diagnosis\}\}/g, primaryDiagnosis);
        const thrThread = await prisma.messageThread.create({
          data: {
            subject: thrMsgTpl.subject,
            participants: { create: [{ userId: senderId }, { userId: therapist.id }] },
          },
        });
        await prisma.message.create({
          data: { threadId: thrThread.id, senderId, body: thrMsgBody },
        });
      }
    } catch (notifErr) {
      console.error('⚠️  assign_therapist notifications failed (non-fatal):', notifErr.message);
    }
  }

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

// Resend welcome email with a new temporary password
const resendWelcomeEmail = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Find patient with user info
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

  if (!patient) {
    return res.status(404).json({ error: 'Patient not found' });
  }

  // Generate a new temporary password
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, 10);

  // Update user with new password and re-flag mustChangePassword
  await prisma.user.update({
    where: { id: patient.user.id },
    data: {
      passwordHash,
      mustChangePassword: true,
    },
  });

  // Send welcome email
  const therapistName = patient.assignedTherapist
    ? `${patient.assignedTherapist.firstName} ${patient.assignedTherapist.lastName}`
    : null;

  const emailResult = await sendPatientWelcomeEmail({
    email: patient.user.email,
    firstName: patient.user.firstName,
    lastName: patient.user.lastName,
    username: patient.user.username,
    temporaryPassword,
    assignedTherapist: therapistName,
  });

  if (!emailResult.success) {
    console.error(`❌ Failed to resend welcome email to ${patient.user.email}:`, emailResult.error);
    return res.status(500).json({ error: 'Failed to send welcome email. Please try again.' });
  }

  console.log(`✅ Welcome email resent to patient: ${patient.user.email}`);

  return res.json({
    message: `Welcome email resent successfully to ${patient.user.email}. A new temporary password has been generated.`,
  });
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
  resendWelcomeEmail,
};
