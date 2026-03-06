const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

(async () => {
  try {
    await prisma.$connect();
    console.log('✅ Database connection successful!\n');
    
    const stats = {
      users: await prisma.user.count(),
      patients: await prisma.patient.count(),
      appointments: await prisma.appointment.count(),
      telehealthSessions: await prisma.telehealthSession.count(),
      soapNotes: await prisma.sOAPNote.count(),
      messages: await prisma.message.count()
    };
    
    console.log('📊 Database Statistics:');
    console.log('━'.repeat(50));
    console.log('  Users:               ', stats.users);
    console.log('  Patients:            ', stats.patients);
    console.log('  Appointments:        ', stats.appointments);
    console.log('  Telehealth Sessions: ', stats.telehealthSessions);
    console.log('  SOAP Notes:          ', stats.soapNotes);
    console.log('  Messages:            ', stats.messages);
    
    console.log('\n📍 Database Information:');
    console.log('━'.repeat(50));
    console.log('  Host:     gondola.proxy.rlwy.net:16249');
    console.log('  Database: railway');
    console.log('  Status:   ✅ CONNECTED & HEALTHY');
    
    // Get sample users
    const users = await prisma.user.findMany({
      take: 5,
      select: { username: true, role: true, email: true }
    });
    
    console.log('\n👥 Sample Users:');
    console.log('━'.repeat(50));
    users.forEach(u => {
      console.log(`  • ${u.username.padEnd(20)} [${u.role.padEnd(10)}] ${u.email}`);
    });
    
    await prisma.$disconnect();
  } catch(e) {
    console.error('❌ Database Error:', e.message);
    process.exit(1);
  }
})();
