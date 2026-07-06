const prisma = require('../utils/prisma');
const { asyncHandler } = require('../middleware/errorHandler');
const {
  sendContactSubmissionNotification,
  sendAppointmentRequestNotification,
} = require('../utils/emailService');

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// POST /api/contact — SHRM public website contact form
const createContactSubmission = asyncHandler(async (req, res) => {
  const { name, email, phone, subject, message } = req.body;

  if (!name || name.trim().length < 2) {
    return res.status(400).json({ error: 'Please enter a valid name (at least 2 characters).' });
  }
  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }
  if (!subject) {
    return res.status(400).json({ error: 'Please select a subject for your message.' });
  }
  if (!message || message.trim().length < 10) {
    return res.status(400).json({ error: 'Please enter a message (at least 10 characters).' });
  }

  const submission = await prisma.contactSubmission.create({
    data: { name: name.trim(), email: email.trim(), phone: phone?.trim() || null, subject, message: message.trim() },
  });

  sendContactSubmissionNotification(submission).catch((err) =>
    console.error('Contact notification email failed:', err)
  );

  return res.status(201).json({ message: 'Thank you for your message! We will respond within 24 hours.' });
});

// POST /api/appointment-requests — SHRM public website appointment request form
const createAppointmentRequest = asyncHandler(async (req, res) => {
  const {
    firstName,
    lastName,
    email,
    phone,
    dateOfBirth,
    serviceType,
    preferredDate,
    preferredTime,
    sessionType,
    hasInsurance,
    insuranceProvider,
    policyNumber,
    isEmergency,
    emergencyContactName,
    emergencyContactPhone,
    reasonForCounseling,
    previousCounseling,
    medications,
    additionalInfo,
  } = req.body;

  const required = { firstName, lastName, email, phone, serviceType, preferredDate, preferredTime, reasonForCounseling };
  for (const [field, value] of Object.entries(required)) {
    if (!value || (typeof value === 'string' && !value.trim())) {
      return res.status(400).json({ error: `${field.replace(/([A-Z])/g, ' $1').toLowerCase()} is required` });
    }
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  const request = await prisma.appointmentRequest.create({
    data: {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      serviceType,
      preferredDate: new Date(preferredDate),
      preferredTime,
      sessionType,
      hasInsurance: Boolean(hasInsurance),
      insuranceProvider: insuranceProvider?.trim() || null,
      policyNumber: policyNumber?.trim() || null,
      isEmergency: Boolean(isEmergency),
      emergencyContactName: emergencyContactName?.trim() || null,
      emergencyContactPhone: emergencyContactPhone?.trim() || null,
      reasonForCounseling,
      previousCounseling: Boolean(previousCounseling),
      medications: medications?.trim() || null,
      additionalInfo: additionalInfo?.trim() || null,
    },
  });

  sendAppointmentRequestNotification(request).catch((err) =>
    console.error('Appointment request notification email failed:', err)
  );

  return res.status(201).json({
    message: 'Thank you! Your appointment request has been submitted successfully. We will contact you within 24 hours to confirm your appointment.',
  });
});

module.exports = {
  createContactSubmission,
  createAppointmentRequest,
};
