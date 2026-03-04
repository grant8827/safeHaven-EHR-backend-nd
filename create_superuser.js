const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const readline = require('readline');

dotenv.config();

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

const createSuperUser = async () => {
  console.log('\n🔐 Create Super Admin User\n');
  console.log('━'.repeat(60));

  try {
    const username = await question('Username: ');
    const email = await question('Email: ');
    const firstName = await question('First Name: ');
    const lastName = await question('Last Name: ');
    const password = await question('Password (min 8 chars): ');

    // Validation
    if (!username || username.length < 3) {
      throw new Error('Username must be at least 3 characters');
    }

    if (!email || !email.includes('@')) {
      throw new Error('Valid email is required');
    }

    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    // Check if user already exists
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { username },
          { email },
        ],
      },
    });

    if (existing) {
      throw new Error(`User already exists with ${existing.username === username ? 'username' : 'email'}`);
    }

    // Create user
    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash,
        firstName: firstName || 'Super',
        lastName: lastName || 'Admin',
        role: 'admin',
        isActive: true,
        mustChangePassword: false,
      },
    });

    console.log('\n✅ Super Admin Created Successfully!\n');
    console.log('━'.repeat(60));
    console.log(`   Username:     ${newUser.username}`);
    console.log(`   Email:        ${newUser.email}`);
    console.log(`   Name:         ${newUser.firstName} ${newUser.lastName}`);
    console.log(`   Role:         ${newUser.role.toUpperCase()}`);
    console.log(`   Active:       ${newUser.isActive}`);
    console.log('━'.repeat(60));
    console.log('\n🔑 Login Credentials:');
    console.log(`   Username: ${username}`);
    console.log(`   Password: ${password}`);
    console.log('\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
};

createSuperUser();
