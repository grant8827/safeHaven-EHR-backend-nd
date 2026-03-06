const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const patients = await prisma.patient.findMany({
      include: {
        user: {
          select: {
            username: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });
    
    console.log('\n📋 Last 10 Patients in Database:');
    console.log('━'.repeat(70));
    patients.forEach(p => {
      console.log(`${p.user.firstName} ${p.user.lastName} (@${p.user.username})`);
      console.log(`  Email: ${p.user.email}`);
      console.log(`  Patient ID: ${p.id}`);
      console.log(`  Created: ${p.createdAt}`);
      console.log('');
    });
    console.log('━'.repeat(70));
    console.log(`Total patients found: ${patients.length}`);
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
