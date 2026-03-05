const express = require('express');
const http = require('http');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const { testEmailConnection } = require('./utils/emailService');
const { redisClient } = require('./utils/redis');
const { createSignalingServer } = require('./utils/signalingServer');

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

// Health check - root and /api/health for Railway
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Safe Haven EHR Backend is running', version: '1.0.0' });
});

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

// Create HTTP server and attach Socket.io signaling
const httpServer = http.createServer(app);

const allowedOriginsForSignaling = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  ...corsOrigins,
].filter(Boolean);

const io = createSignalingServer(httpServer, allowedOriginsForSignaling);

// Make io accessible to controllers if needed
app.set('io', io);

// Start server
httpServer.listen(PORT, async () => {
  console.log(`Backend listening on port ${PORT}`);
  console.log(`🔌 Socket.io signaling server ready on port ${PORT}`);

  // Test email configuration on startup
  console.log('\n📧 Testing email service...');
  await testEmailConnection();

  // Check Redis connection
  console.log('\n🔴 Checking Redis connection...');
  if (redisClient) {
    try {
      await redisClient.ping();
      console.log('✅ Redis is connected and ready');
    } catch (err) {
      console.error('❌ Redis connection failed:', err.message);
    }
  } else {
    console.log('⚠️  Redis is not configured (REDIS_URL not set)');
  }

  console.log('');
});

module.exports = app;
