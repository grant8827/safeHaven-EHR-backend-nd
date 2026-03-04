const { sendPatientWelcomeEmail } = require('./utils/emailService');

// Test email sending
const testEmail = {
  email: 'patient_demo@example.com', // Change this to YOUR email to test
  firstName: 'John',
  lastName: 'Doe',
  username: 'patient_demo',
  temporaryPassword: 'Patient123!',
  assignedTherapist: 'Sarah Johnson',
};

console.log('📧 Sending test welcome email...');
console.log('To:', testEmail.email);

sendPatientWelcomeEmail(testEmail)
  .then((result) => {
    if (result.success) {
      console.log('✅ Test email sent successfully!');
      console.log('Message ID:', result.messageId);
      console.log('\nCheck your inbox for the welcome email.');
    } else {
      console.error('❌ Failed to send test email:', result.error);
    }
    process.exit(result.success ? 0 : 1);
  })
  .catch((error) => {
    console.error('❌ Error sending test email:', error);
    process.exit(1);
  });
