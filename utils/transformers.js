// Transform user object to snake_case (for /api/auth/* routes)
const toSnakeUser = (user) => ({
  id: user.id,
  username: user.username,
  email: user.email,
  role: user.role,
  first_name: user.firstName,
  last_name: user.lastName,
  is_active: user.isActive,
  must_change_password: user.mustChangePassword,
  bio: user.bio ?? null,
  job_title: user.jobTitle ?? null,
  created_at: user.createdAt,
  updated_at: user.updatedAt,
});

// Transform user object to camelCase (for /api/v1/* routes)
const toCamelUser = (user) => ({
  id: user.id,
  username: user.username,
  email: user.email,
  role: user.role,
  firstName: user.firstName,
  lastName: user.lastName,
  isActive: user.isActive,
  mustChangePassword: user.mustChangePassword,
  bio: user.bio ?? null,
  jobTitle: user.jobTitle ?? null,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

// Transform patient to camelCase
const toCamelPatient = (patient) => ({
  id: patient.id,
  userId: patient.userId,
  dateOfBirth: patient.dateOfBirth,
  gender: patient.gender,
  phone: patient.phone,
  address: patient.address,
  city: patient.city,
  state: patient.state,
  zipCode: patient.zipCode,
  emergencyContactName: patient.emergencyContactName,
  emergencyContactPhone: patient.emergencyContactPhone,
  emergencyContactRelation: patient.emergencyContactRelation,
  insuranceProvider: patient.insuranceProvider,
  insurancePolicyNumber: patient.insurancePolicyNumber,
  insuranceGroupNumber: patient.insuranceGroupNumber,
  medicalHistory: patient.medicalHistory,
  allergies: patient.allergies,
  currentMedications: patient.currentMedications,
  assignedTherapistId: patient.assignedTherapistId,
  createdAt: patient.createdAt,
  updatedAt: patient.updatedAt,
});

// Transform patient to snake_case with flattened user fields (for frontend)
const toSnakePatient = (patient) => {
  const transformed = {
    id: patient.id,
    patient_number: patient.id.split('-')[0], // Generate a short patient number
    user_id: patient.userId,
    date_of_birth: patient.dateOfBirth,
    gender: patient.gender || 'Not specified',
    phone: patient.user?.phoneNumber || '',
    email: patient.user?.email || '',
    status: patient.isActive ? 'active' : 'inactive',
    
    // Flatten user fields
    first_name: patient.user?.firstName || '',
    last_name: patient.user?.lastName || '',
    
    // Address fields
    street: patient.street,
    city: patient.city,
    state: patient.state,
    zip_code: patient.zipCode,
    country: patient.country,
    
    // Emergency contact
    emergency_contact_name: patient.emergencyContactName,
    emergency_contact_relationship: patient.emergencyContactRelationship,
    emergency_contact_phone: patient.emergencyContactPhone,
    emergency_contact_email: patient.emergencyContactEmail,
    
    // Insurance
    insurance_provider: patient.insuranceProvider,
    insurance_policy_number: patient.insurancePolicyNumber,
    insurance_group_number: patient.insuranceGroupNumber,
    insurance_copay: patient.insuranceCopay,
    insurance_deductible: patient.insuranceDeductible,
    
    // Medical info
    medical_history: patient.medicalHistory,
    allergies: patient.allergies,
    primary_diagnosis: patient.primaryDiagnosis,
    
    // Insurance extra
    insurance_member_id: patient.insuranceMemberID,
    insurance_effective_date: patient.insuranceEffectiveDate,

    // Therapist
    primary_therapist: patient.assignedTherapistId,
    primary_therapist_name: patient.assignedTherapist 
      ? `${patient.assignedTherapist.firstName} ${patient.assignedTherapist.lastName}`
      : null,
    
    // Active status
    is_active: patient.isActive,

    // Timestamps
    admission_date: patient.createdAt,
    created_at: patient.createdAt,
    updated_at: patient.updatedAt,
  };
  
  return transformed;
};

// Transform appointment to snake_case (for /api/appointments/ routes)
const toSnakeAppointment = (appointment) => {
  const patientName = appointment.patient?.user 
    ? `${appointment.patient.user.firstName} ${appointment.patient.user.lastName}`
    : 'Unknown Patient';
  
  const therapistName = appointment.therapist
    ? `${appointment.therapist.firstName} ${appointment.therapist.lastName}`
    : 'Unknown Therapist';

  return {
    id: appointment.id,
    patient: appointment.patientId,
    patient_name: patientName,
    therapist: appointment.therapistId,
    therapist_name: therapistName,
    start_datetime: appointment.startTime,
    end_datetime: appointment.endTime,
    appointment_type: appointment.type,
    status: appointment.status,
    notes: appointment.notes || '',
    is_telehealth: !!appointment.telehealthLink,
    telehealth_link: appointment.telehealthLink || null,
    location: appointment.location || '',
    created_by: appointment.createdById,
    created_at: appointment.createdAt,
    updated_at: appointment.updatedAt,
  };
};

module.exports = {
  toSnakeUser,
  toCamelUser,
  toCamelPatient,
  toSnakePatient,
  toSnakeAppointment,
};
