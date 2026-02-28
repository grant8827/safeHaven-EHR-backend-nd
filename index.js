const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const { testEmailConnection } = require('./utils/emailService');

dotenv.config();

const app = express();

const PORT = process.env.PORT || 8000;

// CORS Configuration
const corsOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : [];

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  ...corsOrigins
].filter(Boolean);

// Middleware
app.use(cors({ 
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true 
}));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

// Import routes
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const patientsRoutes = require('./routes/patients');
const appointmentsRoutes = require('./routes/appointments');
const soapNotesRoutes = require('./routes/soapNotes');
const messagesRoutes = require('./routes/messages');
const documentsRoutes = require('./routes/documents');
const billingRoutes = require('./routes/billing');
const telehealthRoutes = require('./routes/telehealth');
const auditRoutes = require('./routes/audit');
const notificationsRoutes = require('./routes/notifications');

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Safe Haven EHR Backend is running' });
});

// API Routes - v1 (camelCase responses)
const v1Router = express.Router();
v1Router.use('/users/auth', authRoutes);
v1Router.use('/users', usersRoutes);
v1Router.use('/patients', patientsRoutes);
v1Router.use('/appointments', appointmentsRoutes);
v1Router.use('/soap-notes', soapNotesRoutes);
v1Router.use('/messages', messagesRoutes);
v1Router.use('/documents', documentsRoutes);
v1Router.use('/billing', billingRoutes);
v1Router.use('/telehealth', telehealthRoutes);
v1Router.use('/audit', auditRoutes);
v1Router.use('/notifications', notificationsRoutes);

app.use('/api/v1', v1Router);

// API Routes - Legacy (snake_case responses)
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/patients', patientsRoutes);
app.use('/api/appointments', appointmentsRoutes);
app.use('/api/soap-notes', soapNotesRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/telehealth', telehealthRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/notifications', notificationsRoutes);

// Error handler (must be last)
const { errorHandler } = require('./middleware/errorHandler');
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
app.listen(PORT, async () => {
  console.log(`Backend listening on port ${PORT}`);
  
  // Test email configuration on startup
  console.log('\n📧 Testing email service...');
  await testEmailConnection();
  console.log('');
});

module.exports = app;
