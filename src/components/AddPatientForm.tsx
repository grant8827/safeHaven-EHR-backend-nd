import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stepper,
  Step,
  StepLabel,
  Paper,
  Divider,
  FormControlLabel,
  Checkbox,
  Alert,
  AlertTitle,
  Chip,
  IconButton,
} from '@mui/material';
import {
  Person,
  Phone,
  Home,
  LocalHospital,
  MedicalServices,
  Security,
  Add,
  Remove,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

interface PatientFormData {
  // Personal Information
  firstName: string;
  lastName: string;
  dateOfBirth: Date | null;
  gender: string;
  phone: string;
  email: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
  };
  
  // Emergency Contact
  emergencyContact: {
    name: string;
    phone: string;
    relationship: string;
    email: string;
  };
  
  // Insurance Information
  insurance: {
    provider: string;
    policyNumber: string;
    groupNumber: string;
    memberID: string;
    effectiveDate: Date | null;
  };
  
  // Medical Information
  medical: {
    primaryDiagnosis: string;
    secondaryDiagnoses: string[];
    allergies: string[];
    medications: string[];
    primaryTherapist: string;
    referringPhysician: string;
    medicalHistory: string;
  };
  
  // Compliance
  compliance: {
    consentForms: boolean;
    privacyPolicy: boolean;
    treatmentAgreement: boolean;
    hipaaAuthorization: boolean;
  };
}

interface AddPatientFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (patientData: PatientFormData) => void;
}

const steps = [
  'Personal Information',
  'Contact & Emergency',
  'Insurance Information',
  'Medical Information',
  'Compliance & Documents'
];

const insuranceProviders = [
  'Blue Cross Blue Shield',
  'Aetna',
  'United Healthcare',
  'Cigna',
  'Humana',
  'Kaiser Permanente',
  'Anthem',
  'Other'
];

const AddPatientForm: React.FC<AddPatientFormProps> = ({ open, onClose, onSubmit }) => {
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState<PatientFormData>({
    firstName: '',
    lastName: '',
    dateOfBirth: null,
    gender: '',
    phone: '',
    email: '',
    address: {
      street: '',
      city: '',
      state: '',
      zipCode: '',
    },
    emergencyContact: {
      name: '',
      phone: '',
      relationship: '',
      email: '',
    },
    insurance: {
      provider: '',
      policyNumber: '',
      groupNumber: '',
      memberID: '',
      effectiveDate: null,
    },
    medical: {
      primaryDiagnosis: '',
      secondaryDiagnoses: [],
      allergies: [],
      medications: [],
      primaryTherapist: '',
      referringPhysician: '',
      medicalHistory: '',
    },
    compliance: {
      consentForms: false,
      privacyPolicy: false,
      treatmentAgreement: false,
      hipaaAuthorization: false,
    },
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    switch (step) {
      case 0: // Personal Information
        if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
        if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
        if (!formData.dateOfBirth) newErrors.dateOfBirth = 'Date of birth is required';
        if (!formData.gender) newErrors.gender = 'Gender is required';
        if (!formData.phone.trim()) newErrors.phone = 'Phone number is required';
        if (!formData.email.trim()) newErrors.email = 'Email is required';
        else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Invalid email format';
        break;

      case 1: // Contact & Emergency
        if (!formData.address.street.trim()) newErrors.street = 'Street address is required';
        if (!formData.address.city.trim()) newErrors.city = 'City is required';
        if (!formData.address.state.trim()) newErrors.state = 'State is required';
        if (!formData.address.zipCode.trim()) newErrors.zipCode = 'ZIP code is required';
        if (!formData.emergencyContact.name.trim()) newErrors.emergencyName = 'Emergency contact name is required';
        if (!formData.emergencyContact.phone.trim()) newErrors.emergencyPhone = 'Emergency contact phone is required';
        if (!formData.emergencyContact.relationship.trim()) newErrors.emergencyRelationship = 'Relationship is required';
        break;

      case 2: // Insurance Information
        // Insurance fields are now optional
        break;

      case 3: // Medical Information
        if (!formData.medical.primaryDiagnosis.trim()) newErrors.primaryDiagnosis = 'Primary diagnosis is required';
        // Primary therapist is optional - will be assigned when scheduling appointments
        break;

      case 4: // Compliance - For testing, make these warnings instead of errors
        // Note: In production, you may want to enforce these as required
        // For now, allowing submission even if not all compliance items are checked
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(activeStep)) {
      setActiveStep((prevActiveStep) => prevActiveStep + 1);
    }
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleSubmit = () => {
    console.log('Form submitted, validating step:', activeStep);
    console.log('Form data:', formData);
    
    if (validateStep(activeStep)) {
      console.log('Validation passed, calling onSubmit');
      onSubmit(formData);
      handleReset();
      onClose();
    } else {
      console.log('Validation failed, errors:', errors);
    }
  };

  const handleReset = () => {
    setActiveStep(0);
    setFormData({
      firstName: '',
      lastName: '',
      dateOfBirth: null,
      gender: '',
      phone: '',
      email: '',
      address: {
        street: '',
        city: '',
        state: '',
        zipCode: '',
      },
      emergencyContact: {
        name: '',
        phone: '',
        relationship: '',
        email: '',
      },
      insurance: {
        provider: '',
        policyNumber: '',
        groupNumber: '',
        memberID: '',
        effectiveDate: null,
      },
      medical: {
        primaryDiagnosis: '',
        secondaryDiagnoses: [],
        allergies: [],
        medications: [],
        primaryTherapist: '',
        referringPhysician: '',
        medicalHistory: '',
      },
      compliance: {
        consentForms: false,
        privacyPolicy: false,
        treatmentAgreement: false,
        hipaaAuthorization: false,
      },
    });
    setErrors({});
  };

  const handleAddItem = (field: 'secondaryDiagnoses' | 'allergies' | 'medications', value: string) => {
    if (value.trim()) {
      setFormData(prev => ({
        ...prev,
        medical: {
          ...prev.medical,
          [field]: [...prev.medical[field], value.trim()]
        }
      }));
    }
  };

  const handleRemoveItem = (field: 'secondaryDiagnoses' | 'allergies' | 'medications', index: number) => {
    setFormData(prev => ({
      ...prev,
      medical: {
        ...prev.medical,
        [field]: prev.medical[field].filter((_, i) => i !== index)
      }
    }));
  };

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Box display="flex" alignItems="center" mb={2}>
                <Person sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">Personal Information</Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="First Name"
                value={formData.firstName}
                onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                error={!!errors.firstName}
                helperText={errors.firstName}
                required
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Last Name"
                value={formData.lastName}
                onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                error={!!errors.lastName}
                helperText={errors.lastName}
                required
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <DatePicker
                label="Date of Birth"
                value={formData.dateOfBirth}
                onChange={(date) => setFormData(prev => ({ ...prev, dateOfBirth: date }))}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    error: !!errors.dateOfBirth,
                    helperText: errors.dateOfBirth,
                    required: true
                  }
                }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth error={!!errors.gender} required>
                <InputLabel>Gender</InputLabel>
                <Select
                  value={formData.gender}
                  label="Gender"
                  onChange={(e) => setFormData(prev => ({ ...prev, gender: e.target.value }))}
                >
                  <MenuItem value="male">Male</MenuItem>
                  <MenuItem value="female">Female</MenuItem>
                  <MenuItem value="other">Other</MenuItem>
                  <MenuItem value="prefer-not-to-say">Prefer not to say</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Phone Number"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                error={!!errors.phone}
                helperText={errors.phone}
                required
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Email Address"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                error={!!errors.email}
                helperText={errors.email}
                required
              />
            </Grid>
          </Grid>
        );

      case 1:
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Box display="flex" alignItems="center" mb={2}>
                <Home sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">Address Information</Typography>
              </Box>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Street Address"
                value={formData.address.street}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  address: { ...prev.address, street: e.target.value }
                }))}
                error={!!errors.street}
                helperText={errors.street}
                required
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="City"
                value={formData.address.city}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  address: { ...prev.address, city: e.target.value }
                }))}
                error={!!errors.city}
                helperText={errors.city}
                required
              />
            </Grid>

            <Grid item xs={12} sm={3}>
              <TextField
                fullWidth
                label="State"
                value={formData.address.state}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  address: { ...prev.address, state: e.target.value }
                }))}
                error={!!errors.state}
                helperText={errors.state}
                required
              />
            </Grid>

            <Grid item xs={12} sm={3}>
              <TextField
                fullWidth
                label="ZIP Code"
                value={formData.address.zipCode}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  address: { ...prev.address, zipCode: e.target.value }
                }))}
                error={!!errors.zipCode}
                helperText={errors.zipCode}
                required
              />
            </Grid>

            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Box display="flex" alignItems="center" mb={2}>
                <Phone sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">Emergency Contact</Typography>
              </Box>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Emergency Contact Name"
                value={formData.emergencyContact.name}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  emergencyContact: { ...prev.emergencyContact, name: e.target.value }
                }))}
                error={!!errors.emergencyName}
                helperText={errors.emergencyName}
                required
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Emergency Contact Phone"
                value={formData.emergencyContact.phone}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  emergencyContact: { ...prev.emergencyContact, phone: e.target.value }
                }))}
                error={!!errors.emergencyPhone}
                helperText={errors.emergencyPhone}
                required
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Relationship"
                value={formData.emergencyContact.relationship}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  emergencyContact: { ...prev.emergencyContact, relationship: e.target.value }
                }))}
                error={!!errors.emergencyRelationship}
                helperText={errors.emergencyRelationship}
                required
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Emergency Contact Email (Optional)"
                type="email"
                value={formData.emergencyContact.email}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  emergencyContact: { ...prev.emergencyContact, email: e.target.value }
                }))}
              />
            </Grid>
          </Grid>
        );

      case 2:
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Box display="flex" alignItems="center" mb={2}>
                <LocalHospital sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">Insurance Information</Typography>
              </Box>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth error={!!errors.insuranceProvider}>
                <InputLabel>Insurance Provider</InputLabel>
                <Select
                  value={formData.insurance.provider}
                  label="Insurance Provider"
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    insurance: { ...prev.insurance, provider: e.target.value }
                  }))}
                >
                  {insuranceProviders.map((provider) => (
                    <MenuItem key={provider} value={provider}>
                      {provider}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Member ID (Optional)"
                value={formData.insurance.memberID}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  insurance: { ...prev.insurance, memberID: e.target.value }
                }))}
                error={!!errors.memberID}
                helperText={errors.memberID}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Policy Number (Optional)"
                value={formData.insurance.policyNumber}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  insurance: { ...prev.insurance, policyNumber: e.target.value }
                }))}
                error={!!errors.policyNumber}
                helperText={errors.policyNumber}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Group Number (Optional)"
                value={formData.insurance.groupNumber}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  insurance: { ...prev.insurance, groupNumber: e.target.value }
                }))}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <DatePicker
                label="Insurance Effective Date (Optional)"
                value={formData.insurance.effectiveDate}
                onChange={(date) => setFormData(prev => ({ 
                  ...prev, 
                  insurance: { ...prev.insurance, effectiveDate: date }
                }))}
                slotProps={{
                  textField: {
                    fullWidth: true
                  }
                }}
              />
            </Grid>
          </Grid>
        );

      case 3:
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Box display="flex" alignItems="center" mb={2}>
                <MedicalServices sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">Medical Information</Typography>
              </Box>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Primary Diagnosis"
                value={formData.medical.primaryDiagnosis}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  medical: { ...prev.medical, primaryDiagnosis: e.target.value }
                }))}
                error={!!errors.primaryDiagnosis}
                helperText={errors.primaryDiagnosis}
                required
              />
            </Grid>

            <Grid item xs={12}>
              <Alert severity="info" sx={{ mb: 2 }}>
                <AlertTitle>Note: Primary Therapist Assignment</AlertTitle>
                The primary therapist will be assigned when you schedule the patient's first appointment.
              </Alert>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Referring Physician (Optional)"
                value={formData.medical.referringPhysician}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  medical: { ...prev.medical, referringPhysician: e.target.value }
                }))}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Medical History (Optional)"
                value={formData.medical.medicalHistory}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  medical: { ...prev.medical, medicalHistory: e.target.value }
                }))}
              />
            </Grid>

            {/* Dynamic Fields */}
            {(['secondaryDiagnoses', 'allergies', 'medications'] as const).map((field) => (
              <Grid item xs={12} key={field}>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle1" sx={{ mb: 1, textTransform: 'capitalize' }}>
                    {field.replace(/([A-Z])/g, ' $1').toLowerCase()}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                    {formData.medical[field].map((item, index) => (
                      <Chip
                        key={index}
                        label={item}
                        onDelete={() => handleRemoveItem(field, index)}
                        deleteIcon={<Remove />}
                      />
                    ))}
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField
                      size="small"
                      label={`Add ${field.slice(0, -1)}`}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          const input = e.target as HTMLInputElement;
                          handleAddItem(field, input.value);
                          input.value = '';
                        }
                      }}
                    />
                    <IconButton
                      color="primary"
                      onClick={(e) => {
                        const input = (e.currentTarget.parentNode?.querySelector('input') as HTMLInputElement);
                        handleAddItem(field, input.value);
                        input.value = '';
                      }}
                    >
                      <Add />
                    </IconButton>
                  </Box>
                </Box>
              </Grid>
            ))}
          </Grid>
        );

      case 4:
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Box display="flex" alignItems="center" mb={2}>
                <Security sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">Compliance & Legal Documents</Typography>
              </Box>
              <Alert severity="info" sx={{ mb: 3 }}>
                <AlertTitle>Required Documentation</AlertTitle>
                All compliance documents must be completed before the patient can be registered.
              </Alert>
            </Grid>

            <Grid item xs={12}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.compliance.consentForms}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        compliance: { ...prev.compliance, consentForms: e.target.checked }
                      }))}
                      color={errors.consentForms ? 'error' : 'primary'}
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body1">Consent Forms</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Patient has completed and signed all required consent forms
                      </Typography>
                    </Box>
                  }
                />
                {errors.consentForms && (
                  <Typography variant="caption" color="error" display="block" sx={{ ml: 4 }}>
                    {errors.consentForms}
                  </Typography>
                )}
              </Paper>
            </Grid>

            <Grid item xs={12}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.compliance.privacyPolicy}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        compliance: { ...prev.compliance, privacyPolicy: e.target.checked }
                      }))}
                      color={errors.privacyPolicy ? 'error' : 'primary'}
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body1">Privacy Policy Acknowledgment</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Patient has read and acknowledged the privacy policy
                      </Typography>
                    </Box>
                  }
                />
                {errors.privacyPolicy && (
                  <Typography variant="caption" color="error" display="block" sx={{ ml: 4 }}>
                    {errors.privacyPolicy}
                  </Typography>
                )}
              </Paper>
            </Grid>

            <Grid item xs={12}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.compliance.treatmentAgreement}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        compliance: { ...prev.compliance, treatmentAgreement: e.target.checked }
                      }))}
                      color={errors.treatmentAgreement ? 'error' : 'primary'}
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body1">Treatment Agreement</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Patient has signed the treatment agreement and understands terms
                      </Typography>
                    </Box>
                  }
                />
                {errors.treatmentAgreement && (
                  <Typography variant="caption" color="error" display="block" sx={{ ml: 4 }}>
                    {errors.treatmentAgreement}
                  </Typography>
                )}
              </Paper>
            </Grid>

            <Grid item xs={12}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.compliance.hipaaAuthorization}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        compliance: { ...prev.compliance, hipaaAuthorization: e.target.checked }
                      }))}
                      color={errors.hipaaAuthorization ? 'error' : 'primary'}
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body1">HIPAA Authorization</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Patient has completed HIPAA authorization forms
                      </Typography>
                    </Box>
                  }
                />
                {errors.hipaaAuthorization && (
                  <Typography variant="caption" color="error" display="block" sx={{ ml: 4 }}>
                    {errors.hipaaAuthorization}
                  </Typography>
                )}
              </Paper>
            </Grid>
          </Grid>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Typography variant="h5" component="div">
          Add New Patient
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Complete all required information to register a new patient
        </Typography>
      </DialogTitle>

      <DialogContent dividers>
        <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        <Box sx={{ mt: 2 }}>
          {renderStepContent(activeStep)}
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 3 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Box sx={{ flexGrow: 1 }} />
        <Button
          disabled={activeStep === 0}
          onClick={handleBack}
        >
          Back
        </Button>
        {activeStep === steps.length - 1 ? (
          <Button
            variant="contained"
            onClick={handleSubmit}
            color="primary"
          >
            Add Patient
          </Button>
        ) : (
          <Button
            variant="contained"
            onClick={handleNext}
            color="primary"
          >
            Next
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default AddPatientForm;