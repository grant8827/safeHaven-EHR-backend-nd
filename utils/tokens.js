const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const prisma = require('./prisma');

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'your-secret-key';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key';
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

// Sign access token
const signAccessToken = (user) => {
  return jwt.sign(
    {
      sub: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    },
    JWT_ACCESS_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
};

// Sign refresh token
const signRefreshToken = (user) => {
  return jwt.sign(
    {
      sub: user.id,
      type: 'refresh',
    },
    JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );
};

// Create refresh token in database
const createRefreshToken = async (userId) => {
  const token = uuidv4();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

  await prisma.refreshToken.create({
    data: {
      token,
      userId,
      expiresAt,
    },
  });

  return token;
};

// Validate refresh token
const validateRefreshToken = async (token) => {
  const refreshToken = await prisma.refreshToken.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!refreshToken) {
    return null;
  }

  if (refreshToken.revokedAt) {
    return null;
  }

  if (new Date() > refreshToken.expiresAt) {
    return null;
  }

  return refreshToken;
};

// Revoke all refresh tokens for a user
const revokeRefreshTokensForUser = async (userId) => {
  await prisma.refreshToken.updateMany({
    where: {
      userId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
};

module.exports = {
  signAccessToken,
  signRefreshToken,
  createRefreshToken,
  validateRefreshToken,
  revokeRefreshTokensForUser,
};
