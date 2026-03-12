const nodemailer = require('nodemailer');

// Create email transporter using Mailgun SMTP
const createTransporter = () => {
  const config = {
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_USE_SSL === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_HOST_USER,
      pass: process.env.EMAIL_HOST_PASSWORD,
    },
  };

  console.log('Email transporter config:', {
    host: config.host,
    port: config.port,
    secure: config.secure,
    user: config.auth.user,
  });

  return nodemailer.createTransport(config);
};

// Send welcome email to new patient
const sendPatientWelcomeEmail = async (patientData) => {
  try {
    const transporter = createTransporter();

    // Get the production frontend URL (prefer https over http)
    const corsOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(o => o.trim()) : [];
    const frontendUrl = corsOrigins.find(url => url.startsWith('https://')) || corsOrigins[0] || 'http://localhost:5173';

    const mailOptions = {
      from: process.env.DEFAULT_FROM_EMAIL,
      to: patientData.email,
      subject: 'Welcome to Safe Haven EHR',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
            .credentials { background: white; padding: 15px; border-left: 4px solid #667eea; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to Safe Haven EHR!</h1>
            </div>
            <div class="content">
              <h2>Hello ${patientData.firstName} ${patientData.lastName},</h2>
              <p>Welcome! Your patient account has been successfully created in our Electronic Health Records system.</p>
              
              <div class="credentials">
                <h3>Your Login Credentials:</h3>
                <p><strong>Username:</strong> ${patientData.username}<br>
                <strong>Email:</strong> ${patientData.email}<br>
                <strong>Temporary Password:</strong> ${patientData.temporaryPassword}</p>
                <p style="color: #e74c3c;"><strong>⚠️ Important:</strong> Please change your password after your first login.</p>
              </div>

              ${patientData.assignedTherapist ? `
                <p><strong>Your assigned therapist:</strong> ${patientData.assignedTherapist}</p>
              ` : ''}

              <p>You can now access your patient portal to:</p>
              <ul>
                <li>View and schedule appointments</li>
                <li>Access your medical records</li>
                <li>Communicate with your healthcare team</li>
                <li>Update your personal information</li>
              </ul>

              <center>
                <a href="${frontendUrl}/login" class="button">Login to Your Portal</a>
              </center>

              <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
              
              <p>Best regards,<br>
              Safe Haven EHR Team</p>
            </div>
            <div class="footer">
              <p>This is an automated message. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Welcome to Safe Haven EHR!

Hello ${patientData.firstName} ${patientData.lastName},

Your patient account has been successfully created.

Login Credentials:
- Username: ${patientData.username}
- Email: ${patientData.email}
- Temporary Password: ${patientData.temporaryPassword}

⚠️ IMPORTANT: Please change your password after your first login.

${patientData.assignedTherapist ? `Your assigned therapist: ${patientData.assignedTherapist}\n\n` : ''}

You can now access your patient portal at: ${frontendUrl}/login

Best regards,
Safe Haven EHR Team
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Welcome email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Failed to send welcome email:', error);
    return { success: false, error: error.message };
  }
};

// Send appointment confirmation email
const sendAppointmentConfirmationEmail = async (appointmentData) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: process.env.DEFAULT_FROM_EMAIL,
      to: appointmentData.patientEmail,
      subject: 'Appointment Confirmation - Safe Haven EHR',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .appointment-details { background: white; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0; }
            .button { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📅 Appointment Confirmed</h1>
            </div>
            <div class="content">
              <h2>Hello ${appointmentData.patientName},</h2>
              <p>Your appointment has been successfully scheduled.</p>
              
              <div class="appointment-details">
                <h3>Appointment Details:</h3>
                <p><strong>Date:</strong> ${appointmentData.date}<br>
                <strong>Time:</strong> ${appointmentData.time}<br>
                <strong>Therapist:</strong> ${appointmentData.therapistName}<br>
                <strong>Type:</strong> ${appointmentData.type}<br>
                ${appointmentData.isTelehealth ? `<strong>Format:</strong> Telehealth<br>
                <strong>Meeting Link:</strong> <a href="${appointmentData.telehealthLink}">${appointmentData.telehealthLink}</a><br>` : ''}
                ${appointmentData.location ? `<strong>Location:</strong> ${appointmentData.location}<br>` : ''}
                </p>
              </div>

              <p>Please arrive 10 minutes early if this is an in-person appointment.</p>

              <center>
                <a href="${process.env.CORS_ORIGIN || 'http://localhost:5173'}/appointments" class="button">View My Appointments</a>
              </center>

              <p>If you need to cancel or reschedule, please contact us at least 24 hours in advance.</p>
              
              <p>Best regards,<br>
              Safe Haven EHR Team</p>
            </div>
            <div class="footer">
              <p>This is an automated message. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Appointment confirmation email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Failed to send appointment email:', error);
    return { success: false, error: error.message };
  }
};

// Send emergency session email
const sendEmergencySessionEmail = async (sessionData) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: process.env.DEFAULT_FROM_EMAIL,
      to: sessionData.email,
      subject: '🚨 URGENT: Emergency Telehealth Session - Join Now',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .alert-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
            .session-details { background: white; padding: 20px; border-left: 4px solid #e74c3c; margin: 20px 0; }
            .button { display: inline-block; padding: 12px 24px; background: #e74c3c; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; font-weight: bold; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🚨 Emergency Telehealth Session</h1>
            </div>
            <div class="content">
              <h2>Hello ${sessionData.firstName} ${sessionData.lastName},</h2>
              
              <div class="alert-box">
                <strong>⚠️ URGENT:</strong> An emergency telehealth session has been initiated for you.
              </div>
              
              <p>Your therapist has started an emergency session and is waiting for you to join.</p>
              
              <div class="session-details">
                <h3>Session Information:</h3>
                <p>
                  <strong>Room ID:</strong> ${sessionData.roomId}<br>
                  <strong>Session Link:</strong> <a href="${sessionData.sessionUrl}">${sessionData.sessionUrl}</a><br>
                  <strong>Status:</strong> Active - Ready to Join
                </p>
              </div>

              <center>
                <a href="${sessionData.sessionUrl}" class="button">🎥 JOIN SESSION NOW</a>
              </center>

              <p><strong>What to do:</strong></p>
              <ul>
                <li>Click the "JOIN SESSION NOW" button above</li>
                <li>Allow camera and microphone access when prompted</li>
                <li>Your therapist will be waiting in the session</li>
                <li>If you have trouble joining, please call the clinic immediately</li>
              </ul>

              <p><strong>Technical Requirements:</strong></p>
              <ul>
                <li>A device with camera and microphone</li>
                <li>A stable internet connection</li>
                <li>Latest version of Chrome, Firefox, Safari, or Edge browser</li>
              </ul>
              
              <p>If you did not request this session or have questions, please contact the clinic immediately.</p>
              
              <p>Best regards,<br>
              Safe Haven EHR Team</p>
            </div>
            <div class="footer">
              <p>This is an automated message. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
🚨 URGENT: Emergency Telehealth Session

Hello ${sessionData.firstName} ${sessionData.lastName},

An emergency telehealth session has been initiated for you.
Your therapist is waiting for you to join.

Session Information:
- Room ID: ${sessionData.roomId}
- Session Link: ${sessionData.sessionUrl}
- Status: Active - Ready to Join

JOIN NOW: ${sessionData.sessionUrl}

What to do:
1. Click the session link above
2. Allow camera and microphone access when prompted
3. Your therapist will be waiting in the session
4. If you have trouble joining, please call the clinic immediately

Technical Requirements:
- A device with camera and microphone
- A stable internet connection
- Latest version of Chrome, Firefox, Safari, or Edge browser

If you did not request this session or have questions, please contact the clinic immediately.

Best regards,
Safe Haven EHR Team
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Emergency session email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Failed to send emergency session email:', error);
    return { success: false, error: error.message };
  }
};

// Send password reset email
const sendPasswordResetEmail = async ({ email, firstName, resetUrl }) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: process.env.DEFAULT_FROM_EMAIL,
      to: email,
      subject: 'Reset Your Safe Haven EHR Password',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; padding: 14px 28px; background: #667eea; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; font-size: 16px; font-weight: bold; }
            .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 12px 16px; margin: 20px 0; border-radius: 0 4px 4px 0; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Password Reset Request</h1>
            </div>
            <div class="content">
              <h2>Hello ${firstName},</h2>
              <p>We received a request to reset your Safe Haven EHR account password.</p>
              <p>Click the button below to create a new password:</p>
              <center>
                <a href="${resetUrl}" class="button" style="color: white !important; text-decoration: none;">Reset My Password</a>
              </center>
              <div class="warning">
                <strong>⏰ This link expires in 1 hour.</strong><br>
                If you did not request a password reset, you can safely ignore this email — your password will not change.
              </div>
              <p>If the button doesn't work, copy and paste this link into your browser:</p>
              <p style="word-break: break-all; font-size: 13px; color: #555;">${resetUrl}</p>
              <p>Best regards,<br>Safe Haven EHR Team</p>
            </div>
            <div class="footer">
              <p>This is an automated message. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `Hello ${firstName},\n\nWe received a request to reset your Safe Haven EHR password.\n\nReset your password here (link expires in 1 hour):\n${resetUrl}\n\nIf you did not request this, ignore this email — your password will not change.\n\nBest regards,\nSafe Haven EHR Team`,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Password reset email sent to', email, ':', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Failed to send password reset email:', error);
    return { success: false, error: error.message };
  }
};

// Test email configuration
const testEmailConnection = async () => {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    console.log('✅ Email service is ready');
    return true;
  } catch (error) {
    console.error('❌ Email service error:', error);
    return false;
  }
};

module.exports = {
  sendPatientWelcomeEmail,
  sendAppointmentConfirmationEmail,
  sendEmergencySessionEmail,
  sendPasswordResetEmail,
  testEmailConnection,
};
