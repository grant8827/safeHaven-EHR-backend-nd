const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const user = await prisma.user.findUnique({
    where: { email: 'greggrant3760@gmail.com' },
    include: { patientProfile: true }
  });
  
  console.log('User:', user.username, '(', user.email, ')');
  console.log('Has Patient Record:', !!user.patientProfile);
  
  if (!user.patientProfile) {
    console.log('\n❌ NO PATIENT RECORD FOUND');
    console.log('This is why the user does not show in the patient list!');
    console.log('\nThe AdminPatientManagement page shows PATIENTS, not all USERS.');
    console.log('User "greggrant3760" needs a Patient record to appear in the list.');
  } else {
    console.log('\n✅ Patient record exists:');
    console.log(user.patientProfile);
  }
  
  await prisma.$disconnect();
})();
