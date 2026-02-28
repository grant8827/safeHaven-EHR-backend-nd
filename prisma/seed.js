const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

dotenv.config();

const prisma = new PrismaClient();

const seed = async () => {
  const username = process.env.ADMIN_SEED_USERNAME || 'admin';
  const email = process.env.ADMIN_SEED_EMAIL || 'admin@example.com';
  const password = process.env.ADMIN_SEED_PASSWORD || 'Admin123!';

  const existing = await prisma.user.findFirst({
    where: { OR: [{ username }, { email }] },
  });

  if (existing) {
    console.log('Seed admin already exists.');
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: {
      username,
      email,
      passwordHash,
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      isActive: true,
      mustChangePassword: true,
    },
  });

  console.log('Seed admin created.');
};

seed()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
