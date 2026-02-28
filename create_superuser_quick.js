const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

dotenv.config();

const prisma = new PrismaClient();

// Get arguments from command line
const args = process.argv.slice(2);
const username = args[0] || 'superadmin';
const password = args[1] || 'SuperAdmin123!';
const email = args[2] || `${username}@example.com`;
const firstName = args[3] || 'Super';
const lastName = args[4] || 'Admin';

const createSuperUser = async () => {
  console.log('\n🔐 Creating Super Admin User...\n');

  try {
    // Validation
    if (password.length < 8) {
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
      console.log(`⚠️  User already exists:`);
      console.log(`   Username: ${existing.username}`);
      console.log(`   Email:    ${existing.email}`);
      console.log(`   Role:     ${existing.role}`);
      console.log('\n💡 Try a different username or email\n');
      return;
    }

    // Create user
    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash,
        firstName,
        lastName,
        role: 'admin',
        isActive: true,
        mustChangePassword: false,
      },
    });

    console.log('✅ Super Admin Created Successfully!\n');
    console.log('━'.repeat(60));
    console.log(`   ID:           ${newUser.id}`);
    console.log(`   Username:     ${newUser.username}`);
    console.log(`   Email:        ${newUser.email}`);
    console.log(`   Name:         ${newUser.firstName} ${newUser.lastName}`);
    console.log(`   Role:         ${newUser.role.toUpperCase()}`);
    console.log(`   Active:       ${newUser.isActive}`);
    console.log('━'.repeat(60));
    console.log('\n🔑 Login Credentials:');
    console.log(`   URL:      http://localhost:3001`);
    console.log(`   Username: ${username}`);
    console.log(`   Password: ${password}`);
    console.log('\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
};

console.log('\n📝 Usage: node create_superuser_quick.js [username] [password] [email] [firstName] [lastName]');
console.log('   Or run without arguments to use defaults\n');

createSuperUser();
