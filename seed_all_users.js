const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

dotenv.config();

const prisma = new PrismaClient();

const testUsers = [
  {
    username: 'admin',
    email: 'admin@example.com',
    password: 'Admin123!',
    firstName: 'Admin',
    lastName: 'User',
    role: 'admin',
  },
  {
    username: 'therapist1',
    email: 'therapist1@example.com',
    password: 'Therapist123!',
    firstName: 'Sarah',
    lastName: 'Johnson',
    role: 'therapist',
  },
  {
    username: 'therapist2',
    email: 'therapist2@example.com',
    password: 'Therapist123!',
    firstName: 'Michael',
    lastName: 'Chen',
    role: 'therapist',
  },
  {
    username: 'staff1',
    email: 'staff1@example.com',
    password: 'Staff123!',
    firstName: 'Jennifer',
    lastName: 'Martinez',
    role: 'staff',
  },
  {
    username: 'staff2',
    email: 'staff2@example.com',
    password: 'Staff123!',
    firstName: 'David',
    lastName: 'Williams',
    role: 'staff',
  },
  {
    username: 'client1',
    email: 'client1@example.com',
    password: 'Client123!',
    firstName: 'Emma',
    lastName: 'Davis',
    role: 'client',
  },
  {
    username: 'client2',
    email: 'client2@example.com',
    password: 'Client123!',
    firstName: 'James',
    lastName: 'Brown',
    role: 'client',
  },
];

const seedAllUsers = async () => {
  console.log('\n🌱 Seeding test users...\n');

  for (const user of testUsers) {
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { username: user.username },
          { email: user.email },
        ],
      },
    });

    if (existing) {
      console.log(`⏭️  ${user.role.toUpperCase().padEnd(10)} ${user.username} already exists`);
      continue;
    }

    const passwordHash = await bcrypt.hash(user.password, 10);
    await prisma.user.create({
      data: {
        username: user.username,
        email: user.email,
        passwordHash,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isActive: true,
        mustChangePassword: false,
      },
    });

    console.log(`✅ ${user.role.toUpperCase().padEnd(10)} ${user.username} created (${user.password})`);
  }

  const totalUsers = await prisma.user.count();
  console.log(`\n📊 Total users in database: ${totalUsers}\n`);
  
  console.log('🔐 Login Credentials:');
  console.log('━'.repeat(60));
  testUsers.forEach(user => {
    console.log(`   ${user.role.toUpperCase().padEnd(10)} → ${user.username.padEnd(12)} / ${user.password}`);
  });
  console.log('━'.repeat(60));
};

seedAllUsers()
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
