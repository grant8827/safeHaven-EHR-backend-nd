const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const billingController = require('../controllers/billingController');

// All routes require authentication
router.use(authenticate);

// Invoices
router.get('/invoices', requireRole('admin', 'therapist', 'staff'), billingController.getInvoices);
router.post('/invoices', requireRole('admin', 'staff'), billingController.createInvoice);
router.get('/invoices/:id', requireRole('admin', 'therapist', 'staff', 'client'), billingController.getInvoice);
router.patch('/invoices/:id', requireRole('admin', 'staff'), billingController.updateInvoice);
router.put('/invoices/:id', requireRole('admin', 'staff'), billingController.updateInvoice);
router.delete('/invoices/:id', requireRole('admin'), billingController.deleteInvoice);
router.post('/invoices/:id/payment', requireRole('admin', 'staff'), billingController.addPayment);

// Claims
router.get('/claims', requireRole('admin', 'staff'), billingController.getClaims);
router.post('/claims', requireRole('admin', 'staff'), billingController.createClaim);
router.get('/claims/:id', requireRole('admin', 'staff'), billingController.getClaim);
router.patch('/claims/:id', requireRole('admin', 'staff'), billingController.updateClaim);
router.put('/claims/:id', requireRole('admin', 'staff'), billingController.updateClaim);
router.delete('/claims/:id', requireRole('admin'), billingController.deleteClaim);

module.exports = router;
