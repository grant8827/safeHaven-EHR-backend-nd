const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  console.log('Checking all patients in database...\n');
  
  const allPatients = await prisma.patient.findMany({
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          isActive: true,
          username: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`Total patients in database: ${allPatients.length}\n`);
  
  allPatients.forEach((patient, index) => {
    console.log(`${index + 1}. ${patient.user.firstName} ${patient.user.lastName}`);
    console.log(`   Username: ${patient.user.username}`);
    console.log(`   Email: ${patient.user.email}`);
    console.log(`   User Active: ${patient.user.isActive}`);
    console.log(`   Patient Active: ${patient.isActive}`);
    console.log('');
  });
  
  const greggrant = allPatients.find(p => p.user.email === 'greggrant3760@gmail.com');
  if (greggrant) {
    console.log('✅ greggrant3760@gmail.com IS in the database!');
    console.log('Patient should appear in the frontend.');
  } else {
    console.log('❌ greggrant3760@gmail.com NOT found');
  }
  
  await prisma.$disconnect();
})();
