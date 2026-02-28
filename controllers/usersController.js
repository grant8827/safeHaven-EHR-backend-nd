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
        twoFactorEnabled: true,
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
      twoFactorEnabled: true,
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
  const { firstName, lastName, email } = req.body;
  const userId = req.user.id;

  const updateData = {};
  
  if (firstName !== undefined) updateData.firstName = firstName;
  if (lastName !== undefined) updateData.lastName = lastName;
  if (email !== undefined) updateData.email = email;

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
      twoFactorEnabled: true,
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
  const {
    email,
    role,
    firstName,
    lastName,
    isActive,
    mustChangePassword,
  } = req.body;

  const updateData = {};
  
  if (email !== undefined) updateData.email = email;
  if (role !== undefined) updateData.role = role;
  if (firstName !== undefined) updateData.firstName = firstName;
  if (lastName !== undefined) updateData.lastName = lastName;
  if (isActive !== undefined) updateData.isActive = isActive;
  if (mustChangePassword !== undefined) updateData.mustChangePassword = mustChangePassword;

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
      twoFactorEnabled: true,
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

module.exports = {
  getUsers,
  getCurrentUser,
  getUser,
  updateProfile,
  updateUser,
  deleteUser,
  getTherapists,
  getClients,
};
