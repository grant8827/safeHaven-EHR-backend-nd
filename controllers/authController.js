const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const prisma = require('../utils/prisma');
const { asyncHandler } = require('../middleware/errorHandler');
const { toSnakeUser, toCamelUser } = require('../utils/transformers');
const { sendPatientWelcomeEmail } = require('../utils/emailService');
const {
  signAccessToken,
  createRefreshToken,
  validateRefreshToken,
  revokeRefreshTokensForUser,
} = require('../utils/tokens');

// Login
const login = asyncHandler(async (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ username }, { email: username }],
    },
  });

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const passwordMatch = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatch) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  if (!user.isActive) {
    return res.status(403).json({ error: 'Account is inactive' });
  }

  const access = signAccessToken(user);
  const refresh = await createRefreshToken(user.id);

  return res.json({
    access,
    refresh,
    user: req.path.includes('/v1/') ? toCamelUser(user) : toSnakeUser(user),
  });
});

// Refresh token
const refresh = asyncHandler(async (req, res) => {
  const { refresh: refreshToken } = req.body || {};
  const authHeader = req.headers.authorization;

  let token = refreshToken;

  // If no refresh token in body, try to get most recent valid from user
  if (!token && authHeader && authHeader.startsWith('Bearer ')) {
    const accessToken = authHeader.substring(7);
    try {
      const decoded = require('jsonwebtoken').decode(accessToken);
      if (decoded && decoded.sub) {
        const latestToken = await prisma.refreshToken.findFirst({
          where: {
            userId: decoded.sub,
            revokedAt: null,
            expiresAt: { gt: new Date() },
          },
          orderBy: { createdAt: 'desc' },
        });
        token = latestToken?.token;
      }
    } catch (e) {
      // Ignore decode errors
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'Refresh token is required' });
  }

  const validToken = await validateRefreshToken(token);
  if (!validToken) {
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }

  const access = signAccessToken(validToken.user);
  const newRefresh = await createRefreshToken(validToken.user.id);

  return res.json({
    access,
    refresh: newRefresh,
    user: req.path.includes('/v1/') ? toCamelUser(validToken.user) : toSnakeUser(validToken.user),
  });
});

// Logout
const logout = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  await revokeRefreshTokensForUser(userId);
  return res.json({ message: 'Logged out successfully' });
});

// Register new user (admin only)
const register = asyncHandler(async (req, res) => {
  const { username, email, password, role, firstName, lastName } = req.body;

  if (!username || !email || !password || !role) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const newUser = await prisma.user.create({
    data: {
      username,
      email,
      passwordHash,
      role,
      firstName: firstName || '',
      lastName: lastName || '',
      mustChangePassword: true,
    },
  });

  // Send welcome email to patients
  if (role === 'client') {
    const emailData = {
      email: newUser.email,
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      username: newUser.username,
      temporaryPassword: password, // Only available during registration
      assignedTherapist: null,
    };

    // Send email asynchronously (don't wait for it)
    sendPatientWelcomeEmail(emailData)
      .then((result) => {
        if (result.success) {
          console.log(`✅ Welcome email sent to patient: ${newUser.email}`);
        } else {
          console.error(`❌ Failed to send welcome email to ${newUser.email}:`, result.error);
        }
      })
      .catch((error) => {
        console.error(`❌ Error sending welcome email to ${newUser.email}:`, error);
      });
  }

  return res.status(201).json({
    user: req.path.includes('/v1/') ? toCamelUser(newUser) : toSnakeUser(newUser),
  });
});

// Validate token
const validate = asyncHandler(async (req, res) => {
  return res.json({
    user: req.path.includes('/v1/') ? toCamelUser(req.user) : toSnakeUser(req.user),
  });
});

// Request password reset
const requestPasswordReset = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (user) {
    const token = uuidv4();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour

    await prisma.passwordResetToken.create({
      data: {
        token,
        userId: user.id,
        expiresAt,
      },
    });

    // TODO: Send email with reset link
    console.log(`Password reset token for ${email}: ${token}`);
  }

  // Always return success to prevent email enumeration
  return res.json({ message: 'If the email exists, a reset link has been sent' });
});

// Reset password
const resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Token and new password are required' });
  }

  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!resetToken || resetToken.usedAt || new Date() > resetToken.expiresAt) {
    return res.status(400).json({ error: 'Invalid or expired token' });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash, mustChangePassword: false },
    }),
    prisma.passwordResetToken.update({
      where: { token },
      data: { usedAt: new Date() },
    }),
  ]);

  return res.json({ message: 'Password reset successfully' });
});

// Change password (authenticated)
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new password are required' });
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
  });

  const passwordMatch = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!passwordMatch) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { id: req.user.id },
    data: { passwordHash, mustChangePassword: false },
  });

  return res.json({ message: 'Password changed successfully' });
});

// 2FA stubs
const enable2FA = asyncHandler(async (req, res) => {
  // TODO: Implement 2FA
  return res.json({ message: '2FA would be enabled here', qrCode: 'placeholder' });
});

const verify2FA = asyncHandler(async (req, res) => {
  // TODO: Implement 2FA verification
  return res.json({ message: '2FA would be verified here' });
});

const disable2FA = asyncHandler(async (req, res) => {
  // TODO: Implement 2FA disable
  return res.json({ message: '2FA would be disabled here' });
});

module.exports = {
  login,
  refresh,
  logout,
  register,
  validate,
  requestPasswordReset,
  resetPassword,
  changePassword,
  enable2FA,
  verify2FA,
  disable2FA,
};
