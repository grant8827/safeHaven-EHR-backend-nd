const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

dotenv.config();

const prisma = new PrismaClient();

const createDummyPatient = async () => {
  console.log('\n🏥 Creating dummy patient user...\n');

  try {
    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username: 'patient_demo' },
          { email: 'patient.demo@example.com' },
        ],
      },
    });

    if (existingUser) {
      console.log('⚠️  Dummy patient user already exists!');
      console.log(`   Username: patient_demo`);
      console.log(`   Email: patient.demo@example.com`);
      
      // Check if patient profile exists
      const existingPatient = await prisma.patient.findUnique({
        where: { userId: existingUser.id },
        include: {
          user: true,
          assignedTherapist: true,
        },
      });

      if (existingPatient) {
        console.log('   ✅ Patient profile exists');
        console.log(`   Patient ID: ${existingPatient.id}`);
        if (existingPatient.assignedTherapist) {
          console.log(`   Assigned Therapist: ${existingPatient.assignedTherapist.firstName} ${existingPatient.assignedTherapist.lastName}`);
        }
      } else {
        console.log('   ⚠️  Patient profile missing - will create it');
        await createPatientProfile(existingUser.id);
      }
      
      return;
    }

    // Get a therapist to assign (if available)
    const therapist = await prisma.user.findFirst({
      where: { role: 'therapist', isActive: true },
    });

    // Create the user
    const passwordHash = await bcrypt.hash('Patient123!', 10);
    const user = await prisma.user.create({
      data: {
        username: 'patient_demo',
        email: 'patient.demo@example.com',
        passwordHash,
        firstName: 'John',
        lastName: 'Doe',
        phoneNumber: '555-0123',
        role: 'client',
        isActive: true,
        mustChangePassword: false,
      },
    });

    console.log(`✅ User created successfully!`);
    console.log(`   Username: patient_demo`);
    console.log(`   Password: Patient123!`);
    console.log(`   Email: patient.demo@example.com`);
    console.log(`   Name: ${user.firstName} ${user.lastName}`);

    // Create patient profile
    const patient = await prisma.patient.create({
      data: {
        userId: user.id,
        dateOfBirth: new Date('1985-06-15'),
        street: '123 Main Street',
        city: 'Springfield',
        state: 'IL',
        zipCode: '62701',
        country: 'USA',
        
        emergencyContactName: 'Jane Doe',
        emergencyContactRelationship: 'Spouse',
        emergencyContactPhone: '555-0124',
        emergencyContactEmail: 'jane.doe@example.com',
        
        insuranceProvider: 'Blue Cross Blue Shield',
        insurancePolicyNumber: 'BCBS123456789',
        insuranceGroupNumber: 'GRP98765',
        insuranceCopay: 25.00,
        insuranceDeductible: 1500.00,
        
        medicalHistory: 'History of anxiety and depression. Previously treated with CBT.',
        allergies: 'Penicillin, Peanuts',
        
        assignedTherapistId: therapist?.id || null,
        isActive: true,
      },
      include: {
        user: true,
        assignedTherapist: true,
      },
    });

    console.log(`\n✅ Patient profile created successfully!`);
    console.log(`   Patient ID: ${patient.id}`);
    console.log(`   Date of Birth: ${patient.dateOfBirth?.toISOString().split('T')[0]}`);
    console.log(`   Address: ${patient.street}, ${patient.city}, ${patient.state} ${patient.zipCode}`);
    console.log(`   Emergency Contact: ${patient.emergencyContactName} (${patient.emergencyContactRelationship})`);
    console.log(`   Insurance: ${patient.insuranceProvider} - Policy #${patient.insurancePolicyNumber}`);
    
    if (patient.assignedTherapist) {
      console.log(`   Assigned Therapist: ${patient.assignedTherapist.firstName} ${patient.assignedTherapist.lastName}`);
    } else {
      console.log(`   ⚠️  No therapist assigned (none available in database)`);
    }

    console.log('\n🔐 Login Credentials:');
    console.log('━'.repeat(60));
    console.log(`   Username: patient_demo`);
    console.log(`   Password: Patient123!`);
    console.log(`   Email:    patient.demo@example.com`);
    console.log('━'.repeat(60));
    console.log('\n✨ Dummy patient setup complete!\n');

  } catch (error) {
    console.error('❌ Error creating dummy patient:', error);
    throw error;
  }
};

async function createPatientProfile(userId) {
  const therapist = await prisma.user.findFirst({
    where: { role: 'therapist', isActive: true },
  });

  const patient = await prisma.patient.create({
    data: {
      userId: userId,
      dateOfBirth: new Date('1985-06-15'),
      street: '123 Main Street',
      city: 'Springfield',
      state: 'IL',
      zipCode: '62701',
      country: 'USA',
      
      emergencyContactName: 'Jane Doe',
      emergencyContactRelationship: 'Spouse',
      emergencyContactPhone: '555-0124',
      emergencyContactEmail: 'jane.doe@example.com',
      
      insuranceProvider: 'Blue Cross Blue Shield',
      insurancePolicyNumber: 'BCBS123456789',
      insuranceGroupNumber: 'GRP98765',
      insuranceCopay: 25.00,
      insuranceDeductible: 1500.00,
      
      medicalHistory: 'History of anxiety and depression. Previously treated with CBT.',
      allergies: 'Penicillin, Peanuts',
      
      assignedTherapistId: therapist?.id || null,
      isActive: true,
    },
  });

  console.log(`   ✅ Patient profile created - ID: ${patient.id}`);
}

createDummyPatient()
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
