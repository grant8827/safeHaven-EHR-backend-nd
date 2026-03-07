const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testConnections() {
  console.log('\n=== CONNECTION STATUS CHECK ===\n');
  
  // Test Database
  try {
    await prisma.$connect();
    const userCount = await prisma.user.count();
    const patientCount = await prisma.patient.count();
    const appointmentCount = await prisma.appointment.count();
    console.log('✅ DATABASE: Connected');
    console.log('   └─ Users:', userCount);
    console.log('   └─ Patients:', patientCount);
    console.log('   └─ Appointments:', appointmentCount);
  } catch (error) {
    console.log('❌ DATABASE: Connection Failed');
    console.log('   └─ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
  
  console.log('\n');
}

testConnections();
