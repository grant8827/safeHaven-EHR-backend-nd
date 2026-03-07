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
  Grid,
  Card,
  CardContent,
  Avatar,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Menu,
  ListItemIcon,
  ListItemText,
  DialogContentText,
  Snackbar,
  Alert,
  CircularProgress,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Add,
  Search,
  MoreVert,
  EmailOutlined,
  Edit,
  DeleteOutline,
  CheckCircleOutline,
  Person,
  Phone,
  MedicalServices,
  AssignmentInd,
} from '@mui/icons-material';
import axios from 'axios';
import { apiClient } from '../../services/apiClient';

interface PatientItem {
  id: string;
  name: string;
  age: number;
  phone: string;
  email: string;
  lastVisit: string;
  status: string;
  diagnosis: string;
  nextAppointment?: string;
}

const PatientManagement: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [patients, setPatients] = useState<PatientItem[]>([]);
  const [, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalPatients: 0,
    activePatients: 0,
    thisWeek: 0,
    nextWeek: 0
  });

  useEffect(() => {
    void loadPatients();
    void loadTherapists();
  }, []);

  const loadTherapists = async () => {
    try {
      // Fetch therapists (users with role ADMIN or THERAPIST)
      const response = await apiClient.get('/auth/?role=ADMIN,THERAPIST');
      const therapistList = response.data.results.map((user: any) => ({
        id: user.id,
        name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username
      }));
      setTherapists(therapistList);
    } catch (error) {
      console.error('Error loading therapists:', error);
      setTherapists([]);
    }
  };

  const loadPatients = async () => {
    try {
      setLoading(true);
      const patientsRes = await apiClient.get('/api/patients/');
      
      // Transform backend data to match PatientItem interface
      const transformedPatients = patientsRes.data.results.map((patient: any) => ({
        id: patient.id,
        name: `${patient.first_name} ${patient.last_name}`,
        age: patient.date_of_birth ? 
          new Date().getFullYear() - new Date(patient.date_of_birth).getFullYear() : 0,
        phone: patient.phone_number || patient.phone || '',
        email: patient.email,
        lastVisit: patient.updated_at || patient.created_at,
        status: patient.is_active ? 'active' : 'inactive',
        diagnosis: patient.medical_history || '',
        nextAppointment: '',
      }));
      
      setPatients(transformedPatients);
      setStats({
        totalPatients: patientsRes.data.count || transformedPatients.length,
        activePatients: transformedPatients.filter((p: PatientItem) => p.status === 'active').length,
        thisWeek: 0,
        nextWeek: 0
      });
      setLoading(false);
    } catch (error) {
      console.error('Error loading patients:', error);
      setPatients([]);
      setStats({
        totalPatients: 0,
        activePatients: 0,
        thisWeek: 0,
        nextWeek: 0
      });
      setLoading(false);
    }
  };
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<PatientItem | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [addPatientOpen, setAddPatientOpen] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [actionAnchorEl, setActionAnchorEl] = useState<null | HTMLElement>(null);
  const [actionPatient, setActionPatient] = useState<PatientItem | null>(null);
  const [editPatientOpen, setEditPatientOpen] = useState(false);
  const [removePatientOpen, setRemovePatientOpen] = useState(false);
  const [completePatientOpen, setCompletePatientOpen] = useState(false);
  const [therapists, setTherapists] = useState<Array<{ id: string; name: string }>>([]);

  // Assign therapist feature
  const [assignTherapistOpen, setAssignTherapistOpen] = useState(false);
  const [selectedTherapistId, setSelectedTherapistId] = useState<string>('');
  const [assigningTherapist, setAssigningTherapist] = useState(false);
  const [editPatientData, setEditPatientData] = useState({
    name: '',
    email: '',
    phone: '',
  });
  
  const [newPatientData, setNewPatientData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    date_of_birth: '',
    diagnosis: '',
    assigned_therapist: '',
  });
  
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const filteredPatients = patients.filter(patient =>
    patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.diagnosis.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenActions = (event: React.MouseEvent<HTMLElement>, patient: PatientItem) => {
    setActionAnchorEl(event.currentTarget);
    setActionPatient(patient);
    setSelectedPatient(patient);
  };

  const handleCloseActions = () => {
    setActionAnchorEl(null);
  };

  const handleResendEmail = async () => {
    if (!actionPatient) return;

    try {
      await apiClient.post(`/api/patients/${actionPatient.id}/resend_welcome_email/`);
      setSnackbar({ open: true, message: `Registration email resent to ${actionPatient.email}`, severity: 'success' });
    } catch {
      setSnackbar({ open: true, message: 'Failed to resend registration email', severity: 'error' });
    } finally {
      handleCloseActions();
    }
  };

  const handleOpenEditPatient = () => {
    if (!actionPatient) return;

    setEditPatientData({
      name: actionPatient.name,
      email: actionPatient.email,
      phone: actionPatient.phone,
    });
    setEditPatientOpen(true);
    handleCloseActions();
  };

  const handleSaveEditPatient = async () => {
    if (!actionPatient) return;

    const nameParts = editPatientData.name.trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ');

    if (!firstName || !lastName || !editPatientData.email.trim()) {
      setSnackbar({ open: true, message: 'Name (first and last) and email are required', severity: 'error' });
      return;
    }

    try {
      await apiClient.patch(`/api/patients/${actionPatient.id}/`, {
        first_name_write: firstName,
        last_name_write: lastName,
        email_write: editPatientData.email.trim(),
        phone_write: editPatientData.phone.trim(),
      });

      setPatients(prev => prev.map(patient => (
        patient.id === actionPatient.id
          ? {
              ...patient,
              name: editPatientData.name.trim(),
              email: editPatientData.email.trim(),
              phone: editPatientData.phone.trim(),
            }
          : patient
      )));

      setSnackbar({ open: true, message: 'Patient updated successfully', severity: 'success' });
      setEditPatientOpen(false);
    } catch {
      setSnackbar({ open: true, message: 'Failed to update patient', severity: 'error' });
    }
  };

  const handleOpenRemovePatient = () => {
    setRemovePatientOpen(true);
    handleCloseActions();
  };

  const handleOpenAssignTherapist = () => {
    if (!actionPatient) return;
    setSelectedTherapistId('');
    setAssignTherapistOpen(true);
    handleCloseActions();
  };

  const handleSaveAssignTherapist = async () => {
    if (!actionPatient) return;
    try {
      setAssigningTherapist(true);
      await apiClient.patch(`/api/patients/${actionPatient.id}/`, {
        assignedTherapistId: selectedTherapistId || null,
      });
      const therapistName = therapists.find((t) => t.id === selectedTherapistId)?.name;
      setSnackbar({
        open: true,
        message: therapistName
          ? `Therapist "${therapistName}" assigned to ${actionPatient.name}`
          : `Therapist removed from ${actionPatient.name}`,
        severity: 'success',
      });
      await loadPatients();
    } catch {
      setSnackbar({ open: true, message: 'Failed to assign therapist', severity: 'error' });
    } finally {
      setAssigningTherapist(false);
      setAssignTherapistOpen(false);
      setActionPatient(null);
    }
  };

  const handleRemovePatient = async () => {
    if (!actionPatient) return;

    try {
      await apiClient.delete(`/api/patients/${actionPatient.id}/`);
      setPatients(prev => prev.filter(patient => patient.id !== actionPatient.id));
      setSnackbar({ open: true, message: 'Patient removed successfully', severity: 'success' });
    } catch {
      setSnackbar({ open: true, message: 'Failed to remove patient', severity: 'error' });
    } finally {
      setRemovePatientOpen(false);
      setActionPatient(null);
    }
  };

  const handleOpenCompletePatient = () => {
    setCompletePatientOpen(true);
    handleCloseActions();
  };

  const handleCompletePatient = async () => {
    if (!actionPatient) return;

    try {
      await apiClient.patch(`/api/patients/${actionPatient.id}/`, {
        status: 'discharged',
        discharge_date: new Date().toISOString().split('T')[0],
      });

      setPatients(prev => prev.map(patient => (
        patient.id === actionPatient.id
          ? { ...patient, status: 'discharged' }
          : patient
      )));

      setSnackbar({ open: true, message: 'Patient marked complete (sessions complete)', severity: 'success' });
    } catch {
      setSnackbar({ open: true, message: 'Failed to mark patient complete', severity: 'error' });
    } finally {
      setCompletePatientOpen(false);
      setActionPatient(null);
    }
  };

  const getStatusColor = (status: string): 'success' | 'default' => {
    return status === 'active' ? 'success' : 'default';
  };

  const handleCreatePatient = async () => {
    try {
      setIsLoading(true);
      setFormErrors({});

      const errors: Record<string, string> = {};
      if (!newPatientData.first_name.trim()) errors.first_name = 'Required';
      if (!newPatientData.last_name.trim()) errors.last_name = 'Required';
      if (!newPatientData.email.trim()) {
        errors.email = 'Required';
      } else {
        // Email validation regex
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(newPatientData.email)) {
          errors.email = 'Invalid email format';
        }
      }
      
      // Date of birth validation
      if (newPatientData.date_of_birth) {
        const dob = new Date(newPatientData.date_of_birth);
        const today = new Date();
        if (dob > today) {
          errors.date_of_birth = 'Date of birth cannot be in the future';
        }
      }

      if (Object.keys(errors).length > 0) {
        setFormErrors(errors);
        setIsLoading(false);
        return;
      }

      // Generate username from email or name with timestamp to ensure uniqueness
      const generateUsername = (email: string, firstName: string, lastName: string): string => {
        const timestamp = Date.now().toString().slice(-6);
        if (email && email.includes('@')) {
          const emailPrefix = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '_');
          return `${emailPrefix}_${timestamp}`;
        }
        return `${firstName}.${lastName}_${timestamp}`.toLowerCase().replace(/[^a-z0-9_.]/g, '_');
      };

      const username = generateUsername(
        newPatientData.email,
        newPatientData.first_name,
        newPatientData.last_name
      );

      // Use correct field names matching backend API
      const patientData = {
        username,
        email: newPatientData.email.toLowerCase().trim(),
        firstName: newPatientData.first_name.trim(),
        lastName: newPatientData.last_name.trim(),
        phoneNumber: newPatientData.phone.trim() || undefined,
        dateOfBirth: newPatientData.date_of_birth || undefined,
        assignedTherapistId: newPatientData.assigned_therapist || undefined,
        medicalHistory: newPatientData.diagnosis.trim() || undefined,
      };

      console.log('Creating patient:', patientData);

      const response = await apiClient.post('/api/patients/', patientData);
      console.log('Patient created:', response.data);

      setSnackbar({ open: true, message: 'Patient added successfully. Registration email sent.', severity: 'success' });
      setAddPatientOpen(false);
      setNewPatientData({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        date_of_birth: '',
        diagnosis: '',
        assigned_therapist: '',
      });
      
      // Refresh the patient list to show the new patient
      await loadPatients();
    } catch (error: unknown) {
      console.error('Failed to add patient:', error);

      if (axios.isAxiosError(error) && error.response?.data && typeof error.response.data === 'object') {
        const backendErrors = error.response.data as Record<string, unknown>;
        const formattedErrors: Record<string, string> = {};

        Object.keys(backendErrors).forEach((key) => {
          const errorValue = backendErrors[key];
          if (Array.isArray(errorValue) && errorValue.length > 0) {
            formattedErrors[key] = String(errorValue[0]);
          } else if (typeof errorValue === 'string') {
            formattedErrors[key] = errorValue;
          }
        });

        setFormErrors(formattedErrors);
        
        // Extract error message from backend
        let errorMessage = 'Failed to add patient';
        if (typeof backendErrors.error === 'string') {
          errorMessage = backendErrors.error;
        } else if (typeof backendErrors.detail === 'string') {
          errorMessage = backendErrors.detail;
        } else if (typeof backendErrors.message === 'string') {
          errorMessage = backendErrors.message;
        }
        
        setSnackbar({
          open: true,
          message: errorMessage,
          severity: 'error',
        });
      } else {
        setSnackbar({ 
          open: true, 
          message: axios.isAxiosError(error) && error.message 
            ? `Failed to add patient: ${error.message}` 
            : 'Failed to add patient', 
          severity: 'error' 
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'center' }, gap: 1.5, mb: 3 }}>
        <Typography variant="h4" component="h1">
          Patient Management
        </Typography>
        <Button 
          variant="contained" 
          startIcon={<Add />}
          onClick={() => setAddPatientOpen(true)}
          fullWidth={isMobile}
        >
          Add New Patient
        </Button>
      </Box>

      {/* Search Bar */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <TextField
          fullWidth
          placeholder="Search patients by name or diagnosis..."
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
      </Paper>

      {/* Patient Statistics */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="primary">{stats.totalPatients}</Typography>
              <Typography variant="body2">Total Patients</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="success.main">{stats.activePatients}</Typography>
              <Typography variant="body2">Active</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="warning.main">{stats.thisWeek}</Typography>
              <Typography variant="body2">This Week</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="info.main">{stats.nextWeek}</Typography>
              <Typography variant="body2">Next Week</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Patients List */}
      {isMobile ? (
        <Box sx={{ display: 'grid', gap: 1.5 }}>
          {filteredPatients.length === 0 ? (
            <Paper sx={{ p: 2.5, textAlign: 'center' }}>
              <Typography color="text.secondary">No patients found.</Typography>
            </Paper>
          ) : (
            filteredPatients.map((patient) => (
              <Card key={patient.id}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Avatar>{patient.name.charAt(0)}</Avatar>
                      <Box>
                        <Typography variant="subtitle1">{patient.name}</Typography>
                        <Typography variant="caption" color="text.secondary">Age: {patient.age}</Typography>
                      </Box>
                    </Box>
                    <IconButton size="small" onClick={(event) => handleOpenActions(event, patient)}>
                      <MoreVert />
                    </IconButton>
                  </Box>

                  <Chip
                    label={patient.status}
                    color={getStatusColor(patient.status)}
                    size="small"
                    variant="outlined"
                    sx={{ mb: 1.25 }}
                  />

                  <Typography variant="body2"><strong>Diagnosis:</strong> {patient.diagnosis || 'Not specified'}</Typography>
                  <Typography variant="body2"><strong>Phone:</strong> {patient.phone || 'N/A'}</Typography>
                  <Typography variant="body2"><strong>Email:</strong> {patient.email || 'N/A'}</Typography>
                  <Typography variant="body2"><strong>Last Visit:</strong> {patient.lastVisit || 'N/A'}</Typography>
                  <Typography variant="body2"><strong>Next Appointment:</strong> {patient.nextAppointment || 'Not scheduled'}</Typography>
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
                  <TableCell>Contact</TableCell>
                  <TableCell>Last Visit</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Primary Diagnosis</TableCell>
                  <TableCell>Next Appointment</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredPatients.map((patient) => (
                  <TableRow key={patient.id}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar>{patient.name.charAt(0)}</Avatar>
                        <Box>
                          <Typography variant="subtitle2">{patient.name}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Age: {patient.age}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{patient.phone}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {patient.email}
                      </Typography>
                    </TableCell>
                    <TableCell>{patient.lastVisit}</TableCell>
                    <TableCell>
                      <Chip
                        label={patient.status}
                        color={getStatusColor(patient.status)}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>{patient.diagnosis}</TableCell>
                    <TableCell>{patient.nextAppointment || 'Not scheduled'}</TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        onClick={(event) => handleOpenActions(event, patient)}
                      >
                        <MoreVert />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      <Menu
        anchorEl={actionAnchorEl}
        open={Boolean(actionAnchorEl)}
        onClose={handleCloseActions}
      >
        <MenuItem onClick={() => void handleResendEmail()}>
          <ListItemIcon>
            <EmailOutlined fontSize="small" />
          </ListItemIcon>
          <ListItemText>Resend Email</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleOpenEditPatient}>
          <ListItemIcon>
            <Edit fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit Patient</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleOpenAssignTherapist}>
          <ListItemIcon>
            <AssignmentInd fontSize="small" color="primary" />
          </ListItemIcon>
          <ListItemText>Assign Therapist</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleOpenCompletePatient}>
          <ListItemIcon>
            <CheckCircleOutline fontSize="small" />
          </ListItemIcon>
          <ListItemText>Complete</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleOpenRemovePatient} sx={{ color: 'error.main' }}>
          <ListItemIcon>
            <DeleteOutline fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Remove Patient</ListItemText>
        </MenuItem>
      </Menu>

      {/* Assign Therapist Dialog */}
      <Dialog
        open={assignTherapistOpen}
        onClose={() => setAssignTherapistOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Assign Therapist — {actionPatient?.name}</DialogTitle>
        <DialogContent dividers>
          <FormControl fullWidth>
            <InputLabel>Select Therapist</InputLabel>
            <Select
              value={selectedTherapistId}
              label="Select Therapist"
              onChange={(e) => setSelectedTherapistId(e.target.value)}
            >
              <MenuItem value=""><em>None (remove assignment)</em></MenuItem>
              {therapists.map((therapist) => (
                <MenuItem key={therapist.id} value={therapist.id}>
                  {therapist.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignTherapistOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => void handleSaveAssignTherapist()}
            disabled={assigningTherapist}
            startIcon={assigningTherapist ? <CircularProgress size={16} /> : <AssignmentInd />}
          >
            {assigningTherapist ? 'Saving...' : 'Assign'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Patient Details Dialog */}
      <Dialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Patient Details - {selectedPatient?.name}
        </DialogTitle>
        <DialogContent>
          <Tabs value={tabValue} onChange={(_event: React.SyntheticEvent, newValue: number) => setTabValue(newValue)}>
            <Tab label="Overview" />
            <Tab label="Medical History" />
            <Tab label="Treatment Plan" />
            <Tab label="Notes" />
          </Tabs>

          {tabValue === 0 && selectedPatient && (
            <Box sx={{ mt: 3 }}>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        <Person sx={{ mr: 1, verticalAlign: 'middle' }} />
                        Personal Information
                      </Typography>
                      <Typography><strong>Name:</strong> {selectedPatient.name}</Typography>
                      <Typography><strong>Age:</strong> {selectedPatient.age}</Typography>
                      <Typography><strong>Status:</strong> {selectedPatient.status}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        <Phone sx={{ mr: 1, verticalAlign: 'middle' }} />
                        Contact Information
                      </Typography>
                      <Typography><strong>Phone:</strong> {selectedPatient.phone}</Typography>
                      <Typography><strong>Email:</strong> {selectedPatient.email}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        <MedicalServices sx={{ mr: 1, verticalAlign: 'middle' }} />
                        Clinical Information
                      </Typography>
                      <Typography><strong>Primary Diagnosis:</strong> {selectedPatient.diagnosis}</Typography>
                      <Typography><strong>Last Visit:</strong> {selectedPatient.lastVisit}</Typography>
                      <Typography><strong>Next Appointment:</strong> {selectedPatient.nextAppointment || 'Not scheduled'}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          )}

          {tabValue === 1 && (
            <Box sx={{ mt: 3 }}>
              <Typography>Medical history details would be displayed here...</Typography>
            </Box>
          )}

          {tabValue === 2 && (
            <Box sx={{ mt: 3 }}>
              <Typography>Treatment plan details would be displayed here...</Typography>
            </Box>
          )}

          {tabValue === 3 && (
            <Box sx={{ mt: 3 }}>
              <Typography>Clinical notes would be displayed here...</Typography>
            </Box>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={editPatientOpen}
        onClose={() => setEditPatientOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit Patient</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'grid', gap: 2 }}>
            <TextField
              fullWidth
              label="Full Name"
              value={editPatientData.name}
              onChange={(e) => setEditPatientData(prev => ({ ...prev, name: e.target.value }))}
            />
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={editPatientData.email}
              onChange={(e) => setEditPatientData(prev => ({ ...prev, email: e.target.value }))}
            />
            <TextField
              fullWidth
              label="Phone"
              value={editPatientData.phone}
              onChange={(e) => setEditPatientData(prev => ({ ...prev, phone: e.target.value }))}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditPatientOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => void handleSaveEditPatient()}>Save</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={removePatientOpen}
        onClose={() => setRemovePatientOpen(false)}
      >
        <DialogTitle>Remove Patient</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to remove {actionPatient?.name || 'this patient'}?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRemovePatientOpen(false)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={() => void handleRemovePatient()}>
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
            Mark {actionPatient?.name || 'this patient'} as complete? This will set status to discharged.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCompletePatientOpen(false)}>Cancel</Button>
          <Button color="success" variant="contained" onClick={() => void handleCompletePatient()}>
            Complete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add New Patient Dialog */}
      <Dialog 
        open={addPatientOpen} 
        onClose={() => setAddPatientOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Add New Patient</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="First Name"
                  value={newPatientData.first_name}
                  onChange={(e) => setNewPatientData(prev => ({ ...prev, first_name: e.target.value }))}
                  error={!!formErrors.first_name}
                  helperText={formErrors.first_name}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Last Name"
                  value={newPatientData.last_name}
                  onChange={(e) => setNewPatientData(prev => ({ ...prev, last_name: e.target.value }))}
                  error={!!formErrors.last_name}
                  helperText={formErrors.last_name}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Email"
                  type="email"
                  value={newPatientData.email}
                  onChange={(e) => setNewPatientData(prev => ({ ...prev, email: e.target.value }))}
                  error={!!formErrors.email}
                  helperText={formErrors.email}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Phone Number"
                  value={newPatientData.phone}
                  onChange={(e) => setNewPatientData(prev => ({ ...prev, phone: e.target.value }))}
                  error={!!formErrors.phone}
                  helperText={formErrors.phone}
                  placeholder="(555) 123-4567"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Date of Birth"
                  type="date"
                  value={newPatientData.date_of_birth}
                  onChange={(e) => setNewPatientData(prev => ({ ...prev, date_of_birth: e.target.value }))}
                  error={!!formErrors.date_of_birth}
                  helperText={formErrors.date_of_birth}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Primary Diagnosis"
                  value={newPatientData.diagnosis}
                  onChange={(e) => setNewPatientData(prev => ({ ...prev, diagnosis: e.target.value }))}
                  error={!!formErrors.diagnosis}
                  helperText={formErrors.diagnosis}
                />
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth error={!!formErrors.assigned_therapist}>
                  <InputLabel>Assigned Therapist (Optional)</InputLabel>
                  <Select
                    value={newPatientData.assigned_therapist}
                    label="Assigned Therapist (Optional)"
                    onChange={(e) => setNewPatientData(prev => ({ ...prev, assigned_therapist: e.target.value }))}
                  >
                    <MenuItem value="">None</MenuItem>
                    {therapists.map((therapist) => (
                      <MenuItem key={therapist.id} value={therapist.id}>
                        {therapist.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            <Box sx={{ mt: 2, p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
              <Typography variant="body2">
                <strong>Note:</strong> A registration link will be emailed to the patient so they can create their own username and password.
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setAddPatientOpen(false);
            setNewPatientData({
              first_name: '',
              last_name: '',
              email: '',
              phone: '',
              date_of_birth: '',
              diagnosis: '',
              assigned_therapist: '',
            });
            setFormErrors({});
          }}>
            Cancel
          </Button>
          <Button 
            variant="contained"
            onClick={() => {
              void handleCreatePatient();
            }}
            disabled={isLoading}
            startIcon={isLoading ? <CircularProgress size={20} /> : <Add />}
          >
            {isLoading ? 'Adding...' : 'Add Patient'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={6000} 
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default PatientManagement;