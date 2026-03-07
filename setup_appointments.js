const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');

dotenv.config();

const prisma = new PrismaClient();

// Helper function to generate room ID for telehealth
const generateRoomId = () => {
  return `room_${uuidv4().split('-')[0]}`;
};

// Helper function to generate session URL
const generateSessionUrl = (roomId) => {
  return `https://telehealth.safehaven.com/session/${roomId}`;
};

// Function to create appointments
const setupAppointments = async () => {
  console.log('\n📅 Setting up appointments...\n');

  try {
    // 1. Find users by role
    console.log('🔍 Finding users by role...');
    
    // Find clients (patients)
    const clientUsers = await prisma.user.findMany({
      where: { 
        role: 'client',
        isActive: true,
      },
      include: {
        patientProfile: true,
      },
    });

    console.log(`   Found ${clientUsers.length} client users`);

    // Filter only those with patient profiles
    const patientsWithProfiles = clientUsers.filter(user => user.patientProfile);
    console.log(`   ${patientsWithProfiles.length} have patient profiles`);

    if (patientsWithProfiles.length === 0) {
      console.log('❌ No patients with profiles found. Please create patient profiles first.');
      return;
    }

    // Find therapists
    const therapists = await prisma.user.findMany({
      where: { 
        role: 'therapist',
        isActive: true,
      },
    });

    console.log(`   Found ${therapists.length} therapists`);

    if (therapists.length === 0) {
      console.log('❌ No therapists found. Please create therapist users first.');
      return;
    }

    // Find staff/admin users for createdBy field
    const staffUser = await prisma.user.findFirst({
      where: {
        role: { in: ['admin', 'staff'] },
        isActive: true,
      },
    });

    if (!staffUser) {
      console.log('❌ No admin/staff user found for createdBy field.');
      return;
    }

    console.log(`   Using ${staffUser.firstName} ${staffUser.lastName} as creator\n`);

    // 2. Create sample appointments
    const appointmentData = [
      {
        type: 'initial_consultation',
        daysFromNow: 1,
        startHour: 9,
        duration: 60, // minutes
      },
      {
        type: 'therapy_session',
        daysFromNow: 3,
        startHour: 14,
        duration: 50,
      },
      {
        type: 'telehealth',
        daysFromNow: 5,
        startHour: 10,
        duration: 45,
        createSession: true, // This will create a telehealth session
      },
      {
        type: 'follow_up',
        daysFromNow: 7,
        startHour: 15,
        duration: 30,
      },
      {
        type: 'group_therapy',
        daysFromNow: 10,
        startHour: 16,
        duration: 90,
      },
      {
        type: 'telehealth',
        daysFromNow: 12,
        startHour: 11,
        duration: 50,
        createSession: true,
      },
    ];

    const createdAppointments = [];

    for (let i = 0; i < appointmentData.length; i++) {
      const appt = appointmentData[i];
      
      // Rotate through patients and therapists
      const patient = patientsWithProfiles[i % patientsWithProfiles.length];
      const therapist = therapists[i % therapists.length];

      // Calculate start and end times
      const startTime = new Date();
      startTime.setDate(startTime.getDate() + appt.daysFromNow);
      startTime.setHours(appt.startHour, 0, 0, 0);

      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + appt.duration);

      // Create appointment
      const appointment = await prisma.appointment.create({
        data: {
          patientId: patient.patientProfile.id,
          therapistId: therapist.id,
          createdById: staffUser.id,
          startTime,
          endTime,
          type: appt.type,
          status: 'scheduled',
          notes: `${appt.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} appointment`,
          location: appt.type === 'telehealth' ? 'Online' : 'Office Room 101',
        },
        include: {
          patient: {
            include: {
              user: true,
            },
          },
          therapist: true,
          createdBy: true,
        },
      });

      console.log(`✅ Created ${appt.type} appointment:`);
      console.log(`   Patient: ${appointment.patient.user.firstName} ${appointment.patient.user.lastName}`);
      console.log(`   Therapist: ${appointment.therapist.firstName} ${appointment.therapist.lastName}`);
      console.log(`   Date: ${startTime.toLocaleDateString()} at ${startTime.toLocaleTimeString()}`);
      console.log(`   Duration: ${appt.duration} minutes`);

      // Create telehealth session if appointment type is telehealth
      if (appt.createSession && appt.type === 'telehealth') {
        const roomId = generateRoomId();
        const sessionUrl = generateSessionUrl(roomId);

        const session = await prisma.telehealthSession.create({
          data: {
            appointmentId: appointment.id,
            patientId: patient.patientProfile.id,
            roomId,
            sessionUrl,
            status: 'scheduled',
            scheduledDuration: appt.duration,
            platform: 'webrtc',
            recordingEnabled: false,
            participants: {
              create: [
                {
                  userId: therapist.id,
                  role: 'host',
                },
                {
                  userId: patient.id,
                  role: 'participant',
                },
              ],
            },
          },
        });

        console.log(`   📹 Telehealth session created:`);
        console.log(`      Room ID: ${roomId}`);
        console.log(`      Session URL: ${sessionUrl}`);
      }

      console.log('');
      createdAppointments.push(appointment);
    }

    // 3. Summary
    console.log('━'.repeat(70));
    console.log(`\n✨ Successfully created ${createdAppointments.length} appointments!\n`);
    
    const telehealthCount = createdAppointments.filter(a => a.type === 'telehealth').length;
    console.log(`📊 Summary:`);
    console.log(`   Total Appointments: ${createdAppointments.length}`);
    console.log(`   Telehealth Sessions: ${telehealthCount}`);
    console.log(`   In-Person Sessions: ${createdAppointments.length - telehealthCount}`);
    console.log(`   Patients Involved: ${new Set(createdAppointments.map(a => a.patientId)).size}`);
    console.log(`   Therapists Involved: ${new Set(createdAppointments.map(a => a.therapistId)).size}`);
    
    console.log('\n📋 Appointment Breakdown by Type:');
    const typeCount = {};
    createdAppointments.forEach(a => {
      typeCount[a.type] = (typeCount[a.type] || 0) + 1;
    });
    
    Object.entries(typeCount).forEach(([type, count]) => {
      console.log(`   ${type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}: ${count}`);
    });
    
    console.log('\n━'.repeat(70));
    console.log('\n🎉 Appointment setup complete!\n');

  } catch (error) {
    console.error('❌ Error setting up appointments:', error);
    throw error;
  }
};

// Main execution
setupAppointments()
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
