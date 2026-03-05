import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  TextField,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  Grid,
  Card,
  CardContent,
  Avatar,
  Alert,
  Snackbar,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  type ChipProps,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Search,
  Edit,
  MoreVert,
  PersonAdd,
  Refresh,
  EmailOutlined,
  DeleteOutline,
  CheckCircleOutline,
} from '@mui/icons-material';
import axios from 'axios';
import AddPatientForm from '../../components/AddPatientForm';
import { apiService } from '../../services/apiService';

// Backend patient interface - matches Django API response
interface BackendPatient {
  id: string;
  patient_number: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  date_of_birth: string;
  gender: string;
  status: string;
  primary_therapist: string | null;
  primary_therapist_name: string | null;
  admission_date: string;
  created_at: string;
  updated_at: string;
}

// Paginated API response interface
interface PaginatedResponse<T> {
  count: number;
  current_page: number;
  total_pages: number;
  page_size: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

type PatientUpdatePayload = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  date_of_birth: string;
  gender: string;
  status: string;
  admission_date: string;
};

// Form data interface
interface PatientFormData {
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
  emergencyContact: {
    name: string;
    phone: string;
    relationship: string;
    email: string;
  };
  insurance: {
    provider: string;
    policyNumber: string;
    groupNumber: string;
    memberID: string;
    effectiveDate: Date | null;
  };
  medical: {
    primaryDiagnosis: string;
    secondaryDiagnoses: string[];
    allergies: string[];
    medications: string[];
    primaryTherapist: string;
    referringPhysician: string;
    medicalHistory: string;
  };
  compliance: {
    consentForms: boolean;
    privacyPolicy: boolean;
    treatmentAgreement: boolean;
    hipaaAuthorization: boolean;
  };
}

const AdminPatientManagement: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [patients, setPatients] = useState<BackendPatient[]>([]);
  const [filteredPatients, setFilteredPatients] = useState<BackendPatient[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [addPatientOpen, setAddPatientOpen] = useState(false);
  const [editPatientOpen, setEditPatientOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<BackendPatient | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showError, setShowError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actionAnchorEl, setActionAnchorEl] = useState<null | HTMLElement>(null);
  const [actionPatient, setActionPatient] = useState<BackendPatient | null>(null);
  const [removePatientOpen, setRemovePatientOpen] = useState(false);
  const [completePatientOpen, setCompletePatientOpen] = useState(false);

  const getErrorMessage = (error: unknown, fallback: string): string => {
    if (axios.isAxiosError(error)) {
      const data: unknown = error.response?.data;
      if (data && typeof data === 'object') {
        const responseData = data as Record<string, unknown>;

        const detail = responseData.detail;
        if (typeof detail === 'string' && detail) {
          return detail;
        }

        const directError = responseData.error;
        if (typeof directError === 'string' && directError) {
          return directError;
        }

        const emailWrite = responseData.email_write;
        if (Array.isArray(emailWrite) && typeof emailWrite[0] === 'string') {
          return emailWrite[0];
        }

        const email = responseData.email;
        if (Array.isArray(email) && typeof email[0] === 'string') {
          return email[0];
        }
      }
    }

    if (error instanceof Error && error.message) {
      return error.message;
    }

    return fallback;
  };

  // Load patients from API
  const loadPatients = async () => {
    try {
      console.log('🔵 loadPatients called - starting...');
      setLoading(true);
      
      console.log('🔵 Making API call to /patients/...');
      const response = await apiService.get('/patients/');
      console.log('🔵 Raw API response:', response);
      
      const data = (response.data || response) as BackendPatient[] | PaginatedResponse<BackendPatient>;
      console.log('🔵 Extracted data:', data);
      
      // Handle paginated response - check if it has a 'results' field
      let patientsData: BackendPatient[] = [];
      
      if (Array.isArray(data)) {
        console.log('✅ Response is a plain array');
        patientsData = data;
      } else if (data && 'results' in data && Array.isArray(data.results)) {
        console.log('✅ Response is paginated - extracting results');
        patientsData = data.results;
      } else {
        console.error('❌ Unexpected API response format:', data);
        setErrorMessage('Unexpected response format from server');
        setShowError(true);
        setPatients([]);
        setFilteredPatients([]);
        return;
      }
      
      console.log('✅ Setting patients state with', patientsData.length, 'patients');
      console.log('✅ First patient:', patientsData[0]);
      setPatients(patientsData);
      setFilteredPatients(patientsData);
      console.log('✅ State updated');
      
    } catch (error: unknown) {
      console.error('❌ Error loading patients:', error);
      setErrorMessage(`Failed to load patients: ${getErrorMessage(error, 'Unknown error')}`);
      setShowError(true);
      setPatients([]);
      setFilteredPatients([]);
    } finally {
      setLoading(false);
      console.log('🔵 loadPatients completed');
    }
  };

  // Open edit patient dialog
  const handleEditPatient = async (patientId: string) => {
    try {
      const response = await apiService.get(`/patients/${patientId}/`);
      setSelectedPatient(response.data as BackendPatient);
      setEditPatientOpen(true);
    } catch (error: unknown) {
      console.error('❌ Error loading patient details:', error);
      setErrorMessage('Failed to load patient details');
      setShowError(true);
    }
  };

  // Handle patient update
  const handleUpdatePatient = async (formData: PatientUpdatePayload) => {
    try {
      if (!selectedPatient) return;
      
      await apiService.put(`/patients/${selectedPatient.id}/`, formData);
      setSuccessMessage('Patient updated successfully');
      setShowSuccess(true);
      setEditPatientOpen(false);
      setSelectedPatient(null);
      void loadPatients(); // Reload the patient list
    } catch (error: unknown) {
      console.error('❌ Error updating patient:', error);
      setErrorMessage('Failed to update patient');
      setShowError(true);
    }
  };

  // Resend welcome email to patient
  const handleResendEmail = async (patientId: string) => {
    try {
      const response = await apiService.post<{ message: string }>(`/patients/${patientId}/resend-welcome-email`);
      setSuccessMessage(response.data?.message || 'Welcome email resent successfully.');
      setShowSuccess(true);
    } catch (error: unknown) {
      console.error('❌ Error resending email:', error);
      setErrorMessage(getErrorMessage(error, 'Failed to send registration email. Please try again.'));
      setShowError(true);
    }
  };

  const handleOpenActionsMenu = (event: React.MouseEvent<HTMLElement>, patient: BackendPatient) => {
    setActionAnchorEl(event.currentTarget);
    setActionPatient(patient);
  };

  const handleCloseActionsMenu = () => {
    setActionAnchorEl(null);
  };

  const handleMenuResendEmail = async () => {
    if (!actionPatient) return;
    await handleResendEmail(actionPatient.id);
    handleCloseActionsMenu();
  };

  const handleMenuEditPatient = async () => {
    if (!actionPatient) return;
    await handleEditPatient(actionPatient.id);
    handleCloseActionsMenu();
  };

  const handleMenuRemovePatient = () => {
    setRemovePatientOpen(true);
    handleCloseActionsMenu();
  };

  const handleConfirmRemovePatient = async () => {
    if (!actionPatient) return;

    try {
      await apiService.delete(`/patients/${actionPatient.id}/`);
      setSuccessMessage('Patient removed successfully');
      setShowSuccess(true);
      await loadPatients();
    } catch (error: unknown) {
      console.error('❌ Error removing patient:', error);
      setErrorMessage(getErrorMessage(error, 'Failed to remove patient'));
      setShowError(true);
    } finally {
      setRemovePatientOpen(false);
      setActionPatient(null);
    }
  };

  const handleMenuCompletePatient = () => {
    setCompletePatientOpen(true);
    handleCloseActionsMenu();
  };

  const handleConfirmCompletePatient = async () => {
    if (!actionPatient) return;

    try {
      await apiService.patch(`/patients/${actionPatient.id}/`, {
        status: 'discharged',
        discharge_date: new Date().toISOString().split('T')[0],
      });
      setSuccessMessage('Patient marked complete successfully');
      setShowSuccess(true);
      await loadPatients();
    } catch (error: unknown) {
      console.error('❌ Error completing patient:', error);
      setErrorMessage(getErrorMessage(error, 'Failed to mark patient complete'));
      setShowError(true);
    } finally {
      setCompletePatientOpen(false);
      setActionPatient(null);
    }
  };

  // Load patients on mount
  useEffect(() => {
    void loadPatients();
  }, []);

  // Filter patients when search or status changes
  useEffect(() => {
    console.log('🔍 FILTER EFFECT running');
    console.log('🔍 patients array:', patients);
    console.log('🔍 statusFilter:', statusFilter);
    console.log('🔍 searchTerm:', searchTerm);
    
    let filtered = [...patients];

    // Apply status filter
    if (statusFilter !== 'all') {
      console.log('🔍 Applying status filter:', statusFilter);
      filtered = filtered.filter(p => p.status === statusFilter);
      console.log('🔍 After status filter:', filtered.length);
    }

    // Apply search filter
    if (searchTerm) {
      console.log('🔍 Applying search filter:', searchTerm);
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(p =>
        p.first_name.toLowerCase().includes(search) ||
        p.last_name.toLowerCase().includes(search) ||
        p.email.toLowerCase().includes(search) ||
        p.phone.includes(search) ||
        p.patient_number.toLowerCase().includes(search)
      );
      console.log('🔍 After search filter:', filtered.length);
    }

    console.log('✅ FILTER RESULT - Setting filteredPatients to:', filtered.length, 'patients');
    setFilteredPatients(filtered);
  }, [searchTerm, statusFilter, patients]);

  // Handle add patient
  const handleAddPatient = async (formData: PatientFormData) => {
    try {
      // Generate username from email (prefix before @) or first.last
      const generateUsername = (email: string, firstName: string, lastName: string): string => {
        if (email && email.includes('@')) {
          return email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '_');
        }
        return `${firstName}.${lastName}`.toLowerCase().replace(/[^a-z0-9_.]/g, '_');
      };

      const username = generateUsername(formData.email, formData.firstName, formData.lastName);

      // Transform form data to match backend API
      const patientData = {
        // User data (required)
        username,
        email: formData.email,
        firstName: formData.firstName,
        lastName: formData.lastName,
        phoneNumber: formData.phone,
        
        // Patient data
        dateOfBirth: formData.dateOfBirth ? new Date(formData.dateOfBirth).toISOString().split('T')[0] : undefined,
        street: formData.address.street || undefined,
        city: formData.address.city || undefined,
        state: formData.address.state || undefined,
        zipCode: formData.address.zipCode || undefined,
        
        // Emergency contact
        emergencyContactName: formData.emergencyContact.name || undefined,
        emergencyContactPhone: formData.emergencyContact.phone || undefined,
        emergencyContactRelationship: formData.emergencyContact.relationship || undefined,
        emergencyContactEmail: formData.emergencyContact.email || undefined,
        
        // Gender
        gender: formData.gender || undefined,
        
        // Insurance
        insuranceProvider: formData.insurance.provider || undefined,
        insurancePolicyNumber: formData.insurance.policyNumber || undefined,
        insuranceGroupNumber: formData.insurance.groupNumber || undefined,
        insuranceMemberID: formData.insurance.memberID || undefined,
        insuranceEffectiveDate: formData.insurance.effectiveDate
          ? new Date(formData.insurance.effectiveDate).toISOString().split('T')[0]
          : undefined,
        
        // Medical
        medicalHistory: formData.medical.medicalHistory || undefined,
        allergies: formData.medical.allergies.join(', ') || undefined,
        primaryDiagnosis: formData.medical.primaryDiagnosis || undefined,
        assignedTherapistId: formData.medical.primaryTherapist || undefined,
      };

      console.log('📤 Sending patient data to API:', patientData);

      const response = await apiService.post('/patients/', patientData);

      // apiService.post swallows HTTP errors instead of throwing — detect them here
      if (response.success === false) {
        const errMsg =
          response.message ||
          (Array.isArray(response.errors) && response.errors[0]) ||
          'Failed to create patient';
        throw new Error(errMsg);
      }

      console.log('✅ Patient created successfully:', response);

      const emailSent = (response as unknown as Record<string, unknown>).email_sent !== false;
      setSuccessMessage(
        emailSent
          ? 'Patient created successfully! Welcome email sent with login credentials.'
          : 'Patient created successfully. Note: Welcome email could not be sent — please share credentials manually.'
      );
      setShowSuccess(true);
      
      // Clear search term to show the new patient
      setSearchTerm('');
      
      // Reload patients
      await loadPatients();
      
    } catch (error: unknown) {
      console.error('❌ Error creating patient:', error);
      const errorMsg = getErrorMessage(error, 'Failed to create patient');
      setErrorMessage(errorMsg);
      setShowError(true);
      throw error; // Re-throw so AddPatientForm stays open for retry
    }
  };

  // Calculate statistics
  const totalPatients = patients.length;
  const activePatients = patients.filter(p => p.status === 'active').length;
  const inactivePatients = patients.filter(p => p.status === 'inactive').length;
  const dischargedPatients = patients.filter(p => p.status === 'discharged').length;

  console.log('🔍 RENDER - patients.length:', patients.length);
  console.log('🔍 RENDER - filteredPatients.length:', filteredPatients.length);
  console.log('🔍 RENDER - loading:', loading);
  console.log('🔍 RENDER - statusFilter:', statusFilter);
  console.log('🔍 RENDER - searchTerm:', searchTerm);

  // Helper function to calculate age
  const calculateAge = (dateOfBirth: string): number => {
    if (!dateOfBirth) return 0;
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  // Get status color
  const getStatusColor = (status: string): ChipProps['color'] => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'success';
      case 'inactive':
        return 'warning';
      case 'discharged':
        return 'default';
      case 'deceased':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Box sx={{ p: { xs: 1.5, sm: 3 } }}>
      {/* Header */}
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'center' }, gap: 1.5, mb: 3 }}>
        <Typography variant="h4" component="h1">
          Patient Management
        </Typography>
        <Box sx={{ display: 'flex', gap: 1.5, flexDirection: { xs: 'column', sm: 'row' } }}>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={() => void loadPatients()}
            disabled={loading}
            fullWidth={isMobile}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<PersonAdd />}
            onClick={() => setAddPatientOpen(true)}
            fullWidth={isMobile}
          >
            Add Patient
          </Button>
        </Box>
      </Box>

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom variant="body2">
                Total Patients
              </Typography>
              <Typography variant="h3" component="div">
                {totalPatients}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom variant="body2">
                Active
              </Typography>
              <Typography variant="h3" component="div" color="success.main">
                {activePatients}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom variant="body2">
                Inactive
              </Typography>
              <Typography variant="h3" component="div" color="warning.main">
                {inactivePatients}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom variant="body2">
                Discharged
              </Typography>
              <Typography variant="h3" component="div" color="text.secondary">
                {dischargedPatients}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Search and Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              placeholder="Search by name, email, phone, or patient number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              select
              fullWidth
              label="Status Filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              SelectProps={{ native: true }}
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="discharged">Discharged</option>
              <option value="deceased">Deceased</option>
            </TextField>
          </Grid>
          <Grid item xs={12} md={3}>
            <Typography variant="body2" color="text.secondary">
              Showing {filteredPatients.length} of {totalPatients} patients
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      {/* Patients List */}
      {isMobile ? (
        <Box sx={{ display: 'grid', gap: 1.5 }}>
          {loading ? (
            <Paper sx={{ p: 2.5, textAlign: 'center' }}>
              <Typography>Loading patients...</Typography>
            </Paper>
          ) : filteredPatients.length === 0 ? (
            <Paper sx={{ p: 2.5, textAlign: 'center' }}>
              <Typography color="text.secondary">
                {patients.length === 0 ? 'No patients found. Click "Add Patient" to create one.' : 'No patients match your search criteria.'}
              </Typography>
            </Paper>
          ) : (
            filteredPatients.map((patient) => (
              <Card key={patient.id}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Avatar sx={{ bgcolor: 'primary.main' }}>
                        {patient.first_name.charAt(0)}{patient.last_name.charAt(0)}
                      </Avatar>
                      <Box>
                        <Typography variant="subtitle1">{patient.first_name} {patient.last_name}</Typography>
                        <Typography variant="caption" color="text.secondary">#{patient.patient_number} • Age {calculateAge(patient.date_of_birth)}</Typography>
                      </Box>
                    </Box>
                    <IconButton size="small" onClick={(event) => handleOpenActionsMenu(event, patient)}>
                      <MoreVert />
                    </IconButton>
                  </Box>

                  <Chip
                    label={patient.status.charAt(0).toUpperCase() + patient.status.slice(1)}
                    color={getStatusColor(patient.status)}
                    size="small"
                    sx={{ mb: 1.25 }}
                  />

                  <Typography variant="body2"><strong>Email:</strong> {patient.email || 'N/A'}</Typography>
                  <Typography variant="body2"><strong>Phone:</strong> {patient.phone || 'N/A'}</Typography>
                  <Typography variant="body2"><strong>DOB:</strong> {new Date(patient.date_of_birth).toLocaleDateString()}</Typography>
                  <Typography variant="body2"><strong>Admission:</strong> {new Date(patient.admission_date).toLocaleDateString()}</Typography>
                  <Typography variant="body2"><strong>Therapist:</strong> {patient.primary_therapist_name || 'Not assigned'}</Typography>
                </CardContent>
              </Card>
            ))
          )}
        </Box>
      ) : (
        <Paper>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Patient</TableCell>
                  <TableCell>Patient #</TableCell>
                  <TableCell>Contact</TableCell>
                  <TableCell>Date of Birth</TableCell>
                  <TableCell>Gender</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Admission Date</TableCell>
                  <TableCell>Therapist</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center">
                      <Typography>Loading patients...</Typography>
                    </TableCell>
                  </TableRow>
                ) : filteredPatients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center">
                      <Typography color="text.secondary">
                        {patients.length === 0 ? 'No patients found. Click "Add Patient" to create one.' : 'No patients match your search criteria.'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPatients.map((patient) => (
                    <TableRow key={patient.id} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Avatar sx={{ bgcolor: 'primary.main' }}>
                            {patient.first_name.charAt(0)}{patient.last_name.charAt(0)}
                          </Avatar>
                          <Box>
                            <Typography variant="subtitle2">
                              {patient.first_name} {patient.last_name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Age: {calculateAge(patient.date_of_birth)}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                          {patient.patient_number}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{patient.phone}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {patient.email}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {new Date(patient.date_of_birth).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {patient.gender === 'male' ? 'Male' : patient.gender === 'female' ? 'Female' : patient.gender === 'other' ? 'Other' : patient.gender === 'prefer-not-to-say' ? 'Prefer not to say' : patient.gender || 'Not specified'}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={patient.status.charAt(0).toUpperCase() + patient.status.slice(1)}
                          color={getStatusColor(patient.status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {new Date(patient.admission_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {patient.primary_therapist_name || 'Not assigned'}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <IconButton
                          size="small"
                          onClick={(event) => handleOpenActionsMenu(event, patient)}
                        >
                          <MoreVert />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      <Menu
        anchorEl={actionAnchorEl}
        open={Boolean(actionAnchorEl)}
        onClose={handleCloseActionsMenu}
      >
        <MenuItem onClick={() => void handleMenuResendEmail()}>
          <ListItemIcon>
            <EmailOutlined fontSize="small" />
          </ListItemIcon>
          <ListItemText>Resend Email</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => void handleMenuEditPatient()}>
          <ListItemIcon>
            <Edit fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit Patient</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleMenuCompletePatient}>
          <ListItemIcon>
            <CheckCircleOutline fontSize="small" />
          </ListItemIcon>
          <ListItemText>Complete</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleMenuRemovePatient} sx={{ color: 'error.main' }}>
          <ListItemIcon>
            <DeleteOutline fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Remove Patient</ListItemText>
        </MenuItem>
      </Menu>

      {/* Add Patient Dialog */}
      <AddPatientForm
        open={addPatientOpen}
        onClose={() => setAddPatientOpen(false)}
        onSubmit={handleAddPatient}
      />

      {/* Edit Patient Dialog */}
      <Dialog
        open={editPatientOpen}
        onClose={() => {
          setEditPatientOpen(false);
          setSelectedPatient(null);
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Edit Patient Profile</DialogTitle>
        <DialogContent dividers>
          {selectedPatient && (
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="First Name"
                  defaultValue={selectedPatient.first_name}
                  id="edit-first-name"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Last Name"
                  defaultValue={selectedPatient.last_name}
                  id="edit-last-name"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Email"
                  type="email"
                  defaultValue={selectedPatient.email}
                  id="edit-email"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Phone"
                  defaultValue={selectedPatient.phone}
                  id="edit-phone"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Date of Birth"
                  type="date"
                  defaultValue={selectedPatient.date_of_birth}
                  id="edit-dob"
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Gender"
                  select
                  defaultValue={selectedPatient.gender}
                  SelectProps={{ native: true }}
                  id="edit-gender"
                >
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                  <option value="O">Other</option>
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Status"
                  select
                  defaultValue={selectedPatient.status}
                  SelectProps={{ native: true }}
                  id="edit-status"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="discharged">Discharged</option>
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Admission Date"
                  type="date"
                  defaultValue={selectedPatient.admission_date}
                  id="edit-admission"
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setEditPatientOpen(false);
            setSelectedPatient(null);
          }}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={() => {
              // Gather form data and submit
              const formData = {
                first_name: (document.getElementById('edit-first-name') as HTMLInputElement)?.value,
                last_name: (document.getElementById('edit-last-name') as HTMLInputElement)?.value,
                email: (document.getElementById('edit-email') as HTMLInputElement)?.value,
                phone: (document.getElementById('edit-phone') as HTMLInputElement)?.value,
                date_of_birth: (document.getElementById('edit-dob') as HTMLInputElement)?.value,
                gender: (document.getElementById('edit-gender') as HTMLSelectElement)?.value,
                status: (document.getElementById('edit-status') as HTMLSelectElement)?.value,
                admission_date: (document.getElementById('edit-admission') as HTMLInputElement)?.value,
              };
              void handleUpdatePatient(formData);
            }}
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={removePatientOpen}
        onClose={() => setRemovePatientOpen(false)}
      >
        <DialogTitle>Remove Patient</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to remove {actionPatient ? `${actionPatient.first_name} ${actionPatient.last_name}` : 'this patient'}?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRemovePatientOpen(false)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={() => void handleConfirmRemovePatient()}>
            Remove
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={completePatientOpen}
        onClose={() => setCompletePatientOpen(false)}
      >
        <DialogTitle>Complete Patient</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Mark {actionPatient ? `${actionPatient.first_name} ${actionPatient.last_name}` : 'this patient'} as complete? This will set status to discharged.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCompletePatientOpen(false)}>Cancel</Button>
          <Button color="success" variant="contained" onClick={() => void handleConfirmCompletePatient()}>
            Complete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success Snackbar */}
      <Snackbar
        open={showSuccess}
        autoHideDuration={6000}
        onClose={() => setShowSuccess(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={() => setShowSuccess(false)} severity="success" sx={{ width: '100%' }}>
          {successMessage}
        </Alert>
      </Snackbar>

      {/* Error Snackbar */}
      <Snackbar
        open={showError}
        autoHideDuration={6000}
        onClose={() => setShowError(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={() => setShowError(false)} severity="error" sx={{ width: '100%' }}>
          {errorMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default AdminPatientManagement;
