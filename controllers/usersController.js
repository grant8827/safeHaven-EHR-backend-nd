const bcrypt = require('bcryptjs');
const prisma = require('../utils/prisma');
const { asyncHandler } = require('../middleware/errorHandler');
const { toSnakeUser, toCamelUser } = require('../utils/transformers');

// Get all users (admin only)
const getUsers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, role, isActive, search } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const take = parseInt(limit);

  const where = {};

  if (role) where.role = role;
  if (isActive !== undefined) where.isActive = isActive === 'true';
  if (search) {
    where.OR = [
      { username: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take,
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        isActive: true,
        mustChangePassword: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count({ where }),
  ]);

  return res.json({
    results: users.map((u) => 
      req.path.includes('/v1/') ? toCamelUser(u) : toSnakeUser(u)
    ),
    count: total,
    next: skip + take < total ? parseInt(page) + 1 : null,
    previous: page > 1 ? parseInt(page) - 1 : null,
  });
});

// Get current user
const getCurrentUser = asyncHandler(async (req, res) => {
  return res.json(
    req.path.includes('/v1/') ? toCamelUser(req.user) : toSnakeUser(req.user)
  );
});

// Get single user (admin only)
const getUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      firstName: true,
      lastName: true,
      isActive: true,
      mustChangePassword: true,
      bio: true,
      jobTitle: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  return res.json(
    req.path.includes('/v1/') ? toCamelUser(user) : toSnakeUser(user)
  );
});

// Update user profile (self)
const updateProfile = asyncHandler(async (req, res) => {
  // Accept both camelCase and snake_case body fields from frontend
  const firstName = req.body.firstName ?? req.body.first_name;
  const lastName  = req.body.lastName  ?? req.body.last_name;
  const email     = req.body.email;
  const bio       = req.body.bio;
  const jobTitle  = req.body.jobTitle  ?? req.body.job_title;
  const userId = req.user.id;

  const updateData = {};
  
  if (firstName !== undefined) updateData.firstName = firstName;
  if (lastName  !== undefined) updateData.lastName  = lastName;
  if (email     !== undefined) updateData.email     = email;
  if (bio       !== undefined) updateData.bio       = bio;
  if (jobTitle  !== undefined) updateData.jobTitle  = jobTitle;

  const user = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      firstName: true,
      lastName: true,
      isActive: true,
      mustChangePassword: true,
      bio: true,
      jobTitle: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return res.json(
    req.path.includes('/v1/') ? toCamelUser(user) : toSnakeUser(user)
  );
});

// Update user (admin only)
const updateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  // Accept both camelCase and snake_case body fields from frontend
  const email              = req.body.email;
  const role               = req.body.role;
  const firstName          = req.body.firstName          ?? req.body.first_name;
  const lastName           = req.body.lastName           ?? req.body.last_name;
  const isActive           = req.body.isActive           ?? req.body.is_active;
  const mustChangePassword = req.body.mustChangePassword ?? req.body.must_change_password;
  const bio                = req.body.bio;
  const jobTitle           = req.body.jobTitle           ?? req.body.job_title;

  const updateData = {};
  
  if (email              !== undefined) updateData.email              = email;
  if (role               !== undefined) updateData.role               = role;
  if (firstName          !== undefined) updateData.firstName          = firstName;
  if (lastName           !== undefined) updateData.lastName           = lastName;
  if (isActive           !== undefined) updateData.isActive           = isActive;
  if (mustChangePassword !== undefined) updateData.mustChangePassword = mustChangePassword;
  if (bio                !== undefined) updateData.bio                = bio;
  if (jobTitle           !== undefined) updateData.jobTitle           = jobTitle;

  const user = await prisma.user.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      firstName: true,
      lastName: true,
      isActive: true,
      mustChangePassword: true,
      bio: true,
      jobTitle: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return res.json(
    req.path.includes('/v1/') ? toCamelUser(user) : toSnakeUser(user)
  );
});

// Delete user (admin only)
const deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  await prisma.user.delete({
    where: { id },
  });

  return res.status(204).send();
});

// Get therapists (for appointment scheduling - accessible to all authenticated users)
const getTherapists = asyncHandler(async (req, res) => {
  // Privacy: client can only see their assigned therapist
  if (req.user.role === 'client') {
    const patient = await prisma.patient.findFirst({
      where: { userId: req.user.id },
      include: {
        assignedTherapist: {
          select: { id: true, username: true, email: true, role: true, firstName: true, lastName: true, isActive: true },
        },
      },
    });
    const results = (patient?.assignedTherapist && patient.assignedTherapist.isActive)
      ? [patient.assignedTherapist]
      : [];
    return res.json({
      results: results.map((u) => req.path.includes('/v1/') ? toCamelUser(u) : toSnakeUser(u)),
      count: results.length,
    });
  }

  const therapists = await prisma.user.findMany({
    where: {
      role: 'therapist',
      isActive: true,
    },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      firstName: true,
      lastName: true,
      isActive: true,
    },
    orderBy: [
      { lastName: 'asc' },
      { firstName: 'asc' },
    ],
  });

  return res.json({
    results: therapists.map((u) => 
      req.path.includes('/v1/') ? toCamelUser(u) : toSnakeUser(u)
    ),
    count: therapists.length,
  });
});

// Get clients/patients (for appointment scheduling - accessible to all authenticated users)
const getClients = asyncHandler(async (req, res) => {
  const clients = await prisma.user.findMany({
    where: {
      role: 'client',
      isActive: true,
    },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      firstName: true,
      lastName: true,
      isActive: true,
    },
    orderBy: [
      { lastName: 'asc' },
      { firstName: 'asc' },
    ],
  });

  return res.json({
    results: clients.map((u) => 
      req.path.includes('/v1/') ? toCamelUser(u) : toSnakeUser(u)
    ),
    count: clients.length,
  });
});

// Change password (authenticated user)
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.id;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required' });
  }

  // Validate new password strength
  if (newPassword.length < 10) {
    return res.status(400).json({ 
      error: 'New password must be at least 10 characters long' 
    });
  }

  // Get current user
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Verify current password
  const passwordMatch = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!passwordMatch) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  // Hash new password
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  // Update password and reset mustChangePassword flag
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { 
      passwordHash: hashedPassword,
      mustChangePassword: false,
    },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      firstName: true,
      lastName: true,
      isActive: true,
      mustChangePassword: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return res.json({
    message: 'Password changed successfully',
    user: req.path.includes('/v1/') ? toCamelUser(updatedUser) : toSnakeUser(updatedUser),
  });
});

module.exports = {
  getUsers,
  getCurrentUser,
  getUser,
  updateProfile,
  updateUser,
  deleteUser,
  getTherapists,
  getClients,
  changePassword,
};
