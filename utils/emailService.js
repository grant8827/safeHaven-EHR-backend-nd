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
                <a href="${process.env.CORS_ORIGIN || 'http://localhost:5173'}/login" class="button">Login to Your Portal</a>
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

You can now access your patient portal at: ${process.env.CORS_ORIGIN || 'http://localhost:5173'}/login

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
  testEmailConnection,
};
