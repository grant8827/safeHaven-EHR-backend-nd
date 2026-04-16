const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const usersController = require('../controllers/usersController');

// All routes require authentication
router.use(authenticate);

// Current user
router.get('/current/', usersController.getCurrentUser);
router.put('/profile/', usersController.updateProfile);
router.post('/change-password/', usersController.changePassword);

// Therapists and clients (for appointment scheduling - accessible to all authenticated users)
router.get('/therapists/', usersController.getTherapists);
router.get('/clients/', usersController.getClients);

// Admin routes
router.get('/', requireRole('admin', 'staff'), usersController.getUsers);
router.get('/:id/', requireRole('admin', 'staff'), usersController.getUser);
router.patch('/:id/', requireRole('admin', 'staff'), usersController.updateUser);
router.delete('/:id/', requireRole('admin', 'staff'), usersController.deleteUser);

module.exports = router;
