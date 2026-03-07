const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      firstName: true,
      lastName: true,
      isActive: true,
      createdAt: true,
    }
  });
  
  console.log('\n=== USERS IN DATABASE ===\n');
  users.forEach((user, index) => {
    console.log(`${index + 1}. Username: ${user.username}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Name: ${user.firstName} ${user.lastName}`);
    console.log(`   Active: ${user.isActive}`);
    console.log(`   Created: ${user.createdAt}`);
    console.log('');
  });
  
  console.log(`Total users: ${users.length}\n`);
  console.log('NOTE: Passwords are hashed - you need to use the seeded passwords:');
  console.log('- admin/Admin123!');
  console.log('- therapist1/Therapist123!');
  console.log('- staff1/Staff123!');
  console.log('- client1/Client123!\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
