const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const authController = require('../controllers/authController');

// Public routes
router.post('/login/', authController.login);
router.post('/register', authenticate, authController.register); // Admin only (enforced in controller)
router.post('/password-reset-request', authController.requestPasswordReset);
router.post('/password-reset', authController.resetPassword);

// Protected routes
router.post('/refresh/', authController.refresh);
router.post('/logout', authenticate, authController.logout);
router.post('/validate', authenticate, authController.validate);
router.post('/change-password', authenticate, authController.changePassword);

// 2FA routes
router.post('/2fa/enable', authenticate, authController.enable2FA);
router.post('/2fa/verify', authenticate, authController.verify2FA);
router.post('/2fa/disable', authenticate, authController.disable2FA);

// List active users (for compatibility)
router.get('/', authenticate, async (req, res) => {
  const prisma = require('../utils/prisma');
  
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: {
      id: true,
      username: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
    },
  });
  
  res.json(users);
});

module.exports = router;
