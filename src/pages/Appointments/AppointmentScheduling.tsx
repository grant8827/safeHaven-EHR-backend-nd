import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Grid,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Avatar,
  Badge,
  Divider,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Menu,
  ListItemIcon,
  Tooltip,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Add,
  Event,
  Schedule,
  VideoCall,
  Phone,
  LocationOn,
  Edit,
  Cancel,
  CheckCircle,
  Warning,
  Refresh,
  AccessTime,
  MoreVert,
  Print,
  Message,
  Today,
  NavigateNext,
  NavigateBefore,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { useAuth } from '../../contexts/AuthContext';
import { apiClient } from '../../services/apiClient';

// Appointment interfaces
interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  therapistId: string;
  therapistName: string;
  date: string;
  time: string;
  duration: number; // in minutes
  type: 'initial' | 'follow-up' | 'group' | 'assessment' | 'emergency';
  format: 'in-person' | 'telehealth' | 'phone';
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no-show' | 'rescheduled';
  notes: string;
  location?: string;
  meetingLink?: string;
  reminderSent: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface Patient {
  id: string;
  username: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
}

interface Therapist {
  id: string;
  username: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
}

interface TimeSlot {
  time: string;
  available: boolean;
  appointmentId?: string;
}

interface AppointmentFormData {
  patientId: string;
  therapistId: string;
  date: Date | null;
  time: Date | null;
  duration: number;
  type: Appointment['type'];
  format: Appointment['format'];
  notes: string;
  location: string;
  reminderEnabled: boolean;
}

const AppointmentScheduling: React.FC = () => {
  const { state } = useAuth();
  const isPatient = state.user?.role === 'client';
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  // Store all appointments in state, filter for display
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoadingPatients, setIsLoadingPatients] = useState(true);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [isLoadingTherapists, setIsLoadingTherapists] = useState(true);
  const [appointmentTypes, setAppointmentTypes] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [tabValue, setTabValue] = useState(0);
  
  // Load all patients from API
  React.useEffect(() => {
    const loadPatients = async () => {
      try {
        setIsLoadingPatients(true);
        const response = await apiClient.get('/patients/');
        console.log('Patients API Response:', response.data);
        
        const allPatients = Array.isArray(response.data.results) 
          ? response.data.results 
          : Array.isArray(response.data) 
          ? response.data 
          : [];
        
        // Map patients to include full_name field (already snake_case from backend)
        const patientsList = allPatients.map((patient: any) => ({
          ...patient,
          full_name: `${patient.first_name || ''} ${patient.last_name || ''}`.trim() || patient.email
        }));
        
        console.log('Loaded patients:', patientsList);
        setPatients(patientsList);
      } catch (error) {
        console.error('Failed to load patients:', error);
        setPatients([]);
      } finally {
        setIsLoadingPatients(false);
      }
    };

    loadPatients();
  }, []);
  
  // Load therapists from API
  React.useEffect(() => {
    const loadTherapists = async () => {
      try {
        setIsLoadingTherapists(true);
        const response = await apiClient.get('/users/therapists/');
        console.log('Therapists API Response:', response.data);
        
        const allUsers = Array.isArray(response.data.results) 
          ? response.data.results 
          : Array.isArray(response.data) 
          ? response.data 
          : [];
        
        // Map users to include full_name field
        const therapistUsers = allUsers.map((user: any) => ({
          ...user,
          full_name: `${user.first_name || user.firstName || ''} ${user.last_name || user.lastName || ''}`.trim() || user.username
        }));
        
        console.log('Filtered therapists:', therapistUsers);
        setTherapists(therapistUsers);
      } catch (error) {
        console.error('Failed to load therapists:', error);
        setTherapists([]);
      } finally {
        setIsLoadingTherapists(false);
      }
    };

    loadTherapists();
  }, []);

  // Load appointment types from API
  React.useEffect(() => {
    const loadAppointmentTypes = async () => {
      try {
        console.log('Fetching appointment types from /appointments/types/...');
        const response = await apiClient.get('/appointments/types/');
        console.log('Appointment types response:', response.data);
        const types = Array.isArray(response.data.results) 
          ? response.data.results 
          : Array.isArray(response.data) 
          ? response.data 
          : [];
        console.log('Loaded appointment types:', types);
        setAppointmentTypes(types);
      } catch (error: any) {
        console.error('Failed to load appointment types:', error);
        console.error('Error response:', error.response?.data);
        console.error('Error status:', error.response?.status);
        // Set empty array on error so form doesn't get stuck
        setAppointmentTypes([]);
      }
    };

    loadAppointmentTypes();
  }, []);
  
  // Filter appointments based on user role for display
  // Enhanced filtering: match by ID OR by patient name (for mock data compatibility)
  const filteredAppointments = isPatient 
    ? appointments.filter(apt => {
        // Match by patient ID (strict match)
        if (apt.patientId === state.user?.id) return true;
        
        // Fallback: Match by patient name (for demo/mock data)
        const fullName = `${state.user?.firstName} ${state.user?.lastName}`.trim();
        if (apt.patientName === fullName) return true;
        
        return false;
      })
    : appointments;
  
  // Dialog states
  const [appointmentDialogOpen, setAppointmentDialogOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [appointmentMenuAnchor, setAppointmentMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  
  // Form data
  const [formData, setFormData] = useState<AppointmentFormData>({
    patientId: '',
    therapistId: '',
    date: new Date(),
    time: new Date(),
    duration: 60,
    type: 'follow-up',
    format: 'in-person',
    notes: '',
    location: '',
    reminderEnabled: true,
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Filter appointments by selected date (use filteredAppointments for role-based access)
  const todaysAppointments = filteredAppointments.filter(
    apt => apt.date === selectedDate.toISOString().split('T')[0]
  );

  const upcomingAppointments = filteredAppointments.filter(
    apt => new Date(apt.date) >= new Date() && apt.status !== 'cancelled' && apt.status !== 'completed'
  ).sort((a, b) => new Date(`${a.date} ${a.time}`).getTime() - new Date(`${b.date} ${b.time}`).getTime());

  // Generate time slots for the day
  const generateTimeSlots = (): TimeSlot[] => {
    const slots: TimeSlot[] = [];
    const startHour = 8; // 8 AM
    const endHour = 18; // 6 PM
    const interval = 30; // 30-minute intervals

    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += interval) {
        const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const appointment = todaysAppointments.find(apt => apt.time === time);
        
        slots.push({
          time,
          available: !appointment,
          appointmentId: appointment?.id,
        });
      }
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();

  // Form validation
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.patientId) errors.patientId = 'Patient is required';
    if (!formData.therapistId) errors.therapistId = 'Therapist is required';
    if (!formData.date) errors.date = 'Date is required';
    if (!formData.time) errors.time = 'Time is required';
    if (!formData.duration || formData.duration < 15) errors.duration = 'Duration must be at least 15 minutes';
    if (formData.format === 'in-person' && !formData.location) errors.location = 'Location is required for in-person appointments';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle form submission
  const handleSubmitAppointment = async () => {
    if (!validateForm()) return;

    try {
      // Use a default appointment type if none are loaded
      let appointmentTypeId = null;
      if (appointmentTypes.length > 0) {
        appointmentTypeId = appointmentTypes[0].id;
      } else {
        // Try to load appointment types one more time
        console.log('Attempting to reload appointment types...');
        try {
          const response = await apiClient.get('/appointments/types/');
          const types = Array.isArray(response.data.results) 
            ? response.data.results 
            : Array.isArray(response.data) 
            ? response.data 
            : [];
          
          if (types.length > 0) {
            setAppointmentTypes(types);
            appointmentTypeId = types[0].id;
          }
        } catch (reloadError) {
          console.error('Failed to reload appointment types:', reloadError);
        }
        
        // If still no appointment types, use a known ID from database
        if (!appointmentTypeId) {
          // Use the Follow-up Session type ID from the database
          appointmentTypeId = '2d666946-ed73-4981-9fef-946a7c9c1a0e';
          console.log('Using fallback appointment type ID:', appointmentTypeId);
        }
      }

      // Combine date and time into ISO datetime strings
      const startDateTime = new Date(formData.date!);
      const timeDate = new Date(formData.time!);
      startDateTime.setHours(timeDate.getHours(), timeDate.getMinutes(), 0, 0);
      
      const endDateTime = new Date(startDateTime);
      endDateTime.setMinutes(endDateTime.getMinutes() + formData.duration);

      const appointmentPayload = {
        patientId: formData.patientId,
        therapistId: formData.therapistId,
        appointmentType: appointmentTypeId,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        duration: formData.duration,
        status: 'scheduled',
        notes: formData.notes || '',
        telehealthLink: formData.format === 'telehealth' ? 'auto-generate' : null,
        location: formData.format === 'in-person' ? formData.location : null,
      };

      console.log('Appointment payload:', appointmentPayload);

      if (editingAppointment) {
        // Update existing appointment
        await apiClient.put(`/appointments/${editingAppointment.id}/`, appointmentPayload);
        alert('Appointment updated successfully!');
      } else {
        // Create new appointment
        await apiClient.post('/appointments/', appointmentPayload);
        alert('Appointment scheduled successfully!');
      }

      // Reload appointments after save
      await loadAppointments();
      handleCloseDialog();
    } catch (error: any) {
      console.error('Failed to save appointment:', error);
      console.error('Error details:', error.response?.data);
      
      let errorMessage = 'Failed to save appointment. Please try again.';
      
      if (error.response?.data) {
        if (typeof error.response.data === 'string') {
          errorMessage = error.response.data;
        } else if (error.response.data.detail) {
          errorMessage = error.response.data.detail;
        } else if (error.response.data.message) {
          errorMessage = error.response.data.message;
        } else {
          // Handle field-specific errors
          const fieldErrors = [];
          for (const [field, errors] of Object.entries(error.response.data)) {
            if (Array.isArray(errors)) {
              fieldErrors.push(`${field}: ${errors.join(', ')}`);
            } else {
              fieldErrors.push(`${field}: ${errors}`);
            }
          }
          if (fieldErrors.length > 0) {
            errorMessage = fieldErrors.join('\n');
          }
        }
      }
      
      alert(errorMessage);
    }
  };

  // Confirm appointment (patient confirms their appointment)
  const confirmAppointment = async (appointmentId: string) => {
    try {
      await apiClient.patch(`/appointments/${appointmentId}/`, { status: 'confirmed' });
      alert('Appointment confirmed successfully!');
      await loadAppointments(); // Reload to show updated status
    } catch (error: any) {
      console.error('Failed to confirm appointment:', error);
      const errorMessage = error.response?.data?.detail 
        || error.response?.data?.message 
        || 'Failed to confirm appointment. Please try again.';
      alert(errorMessage);
    }
  };

  // Load appointments from API
  const loadAppointments = async () => {
    try {
      console.log('Loading appointments from API...');
      const response = await apiClient.get('/appointments/');
      console.log('Appointments API response:', response.data);
      
      const appointmentsData = Array.isArray(response.data.results) 
        ? response.data.results 
        : Array.isArray(response.data) 
        ? response.data 
        : [];
      
      console.log('Raw appointments data:', appointmentsData);
      
      // Map backend data to frontend format
      const mappedAppointments: Appointment[] = appointmentsData.map((apt: any) => {
        console.log('Mapping appointment:', apt);
        return {
          id: apt.id,
          patientId: apt.patient,
          patientName: apt.patient_name || 'Unknown Patient',
          therapistId: apt.therapist,
          therapistName: apt.therapist_name || 'Unknown Therapist',
          date: apt.start_datetime.split('T')[0],
          time: new Date(apt.start_datetime).toTimeString().substring(0, 5),
          duration: Math.round((new Date(apt.end_datetime).getTime() - new Date(apt.start_datetime).getTime()) / 60000),
          type: 'follow-up' as const, // Map from appointment_type if needed
          format: apt.is_telehealth ? 'telehealth' as const : 'in-person' as const,
          status: apt.status,
          notes: apt.notes || '',
          location: apt.location || '',
          reminderSent: false,
          createdBy: apt.created_by || '',
          createdAt: apt.created_at,
          updatedAt: apt.updated_at,
        };
      });
      
      console.log('Mapped appointments:', mappedAppointments);
      setAppointments(mappedAppointments);
    } catch (error: any) {
      console.error('Failed to load appointments:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      setAppointments([]);
    }
  };

  // Load appointments on component mount
  React.useEffect(() => {
    loadAppointments();
  }, []);

  // Dialog handlers
  const handleOpenDialog = (appointment?: Appointment) => {
    if (appointment) {
      setEditingAppointment(appointment);
      setFormData({
        patientId: appointment.patientId,
        therapistId: appointment.therapistId,
        date: new Date(appointment.date),
        time: new Date(`2025-01-01T${appointment.time}:00`),
        duration: appointment.duration,
        type: appointment.type,
        format: appointment.format,
        notes: appointment.notes,
        location: appointment.location || '',
        reminderEnabled: appointment.reminderSent,
      });
    } else {
      setEditingAppointment(null);
      setFormData({
        patientId: '',
        therapistId: '',
        date: selectedDate,
        time: new Date(),
        duration: 60,
        type: 'follow-up',
        format: 'in-person',
        notes: '',
        location: '',
        reminderEnabled: true,
      });
    }
    setFormErrors({});
    setAppointmentDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setAppointmentDialogOpen(false);
    setEditingAppointment(null);
    setFormErrors({});
  };

  // Menu handlers
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, appointmentId: string) => {
    setAppointmentMenuAnchor(event.currentTarget);
    setSelectedAppointmentId(appointmentId);
  };

  const handleMenuClose = () => {
    setAppointmentMenuAnchor(null);
    setSelectedAppointmentId(null);
  };

  const updateAppointmentStatus = async (appointmentId: string, status: Appointment['status']) => {
    try {
      if (status === 'confirmed') {
        await apiClient.post(`/appointments/${appointmentId}/confirm/`);
      } else if (status === 'cancelled') {
        await apiClient.post(`/appointments/${appointmentId}/cancel/`);
      } else if (status === 'completed') {
        await apiClient.post(`/appointments/${appointmentId}/complete/`);
      }
      
      // Update local state
      setAppointments(prev => prev.map(apt => 
        apt.id === appointmentId 
          ? { ...apt, status, updatedAt: new Date().toISOString() }
          : apt
      ));
      handleMenuClose();
      alert(`Appointment ${status} successfully!`);
    } catch (error: any) {
      console.error(`Failed to ${status} appointment:`, error);
      alert(`Failed to ${status} appointment. Please try again.`);
    }
  };

  const getStatusColor = (status: Appointment['status']) => {
    switch (status) {
      case 'confirmed': return 'success';
      case 'scheduled': return 'primary';
      case 'completed': return 'info';
      case 'cancelled': return 'error';
      case 'no-show': return 'warning';
      case 'rescheduled': return 'secondary';
      default: return 'default';
    }
  };

  const getFormatIcon = (format: Appointment['format']) => {
    switch (format) {
      case 'telehealth': return <VideoCall />;
      case 'phone': return <Phone />;
      case 'in-person': return <LocationOn />;
      default: return <Event />;
    }
  };

  // Navigate dates
  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
    setSelectedDate(newDate);
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'center' }, gap: 1.5, mb: 3 }}>
        <Typography variant="h4" component="h1">
          {isPatient ? 'My Appointments' : 'Appointment Scheduling'}
        </Typography>
        {!isPatient && (
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1 }}>
            <Button variant="outlined" startIcon={<Refresh />}>
              Sync Calendar
            </Button>
            <Button 
              variant="contained" 
              startIcon={<Add />}
              onClick={() => handleOpenDialog()}
              fullWidth={isMobile}
            >
              New Appointment
            </Button>
          </Box>
        )}
      </Box>

      {/* Patient Info Banner */}
      {isPatient && (
        <Paper sx={{ p: 2, mb: 3, bgcolor: 'info.light' }}>
          <Typography variant="body2">
            <strong>Your Appointments:</strong> View and manage your scheduled appointments with your therapist. 
            To schedule a new appointment, please contact your therapist or call our office.
          </Typography>
        </Paper>
      )}

      {/* Quick Stats */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={6} md={isPatient ? 6 : 3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Badge badgeContent={todaysAppointments.length} color="primary">
                <Today sx={{ fontSize: 40, color: 'primary.main' }} />
              </Badge>
              <Typography variant="h4" sx={{ mt: 1 }}>{todaysAppointments.length}</Typography>
              <Typography variant="body2" color="text.secondary">Today's Appointments</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={6} md={isPatient ? 6 : 3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Schedule sx={{ fontSize: 40, color: 'info.main' }} />
              <Typography variant="h4" sx={{ mt: 1 }}>{upcomingAppointments.length}</Typography>
              <Typography variant="body2" color="text.secondary">Upcoming</Typography>
            </CardContent>
          </Card>
        </Grid>
        {/* Hide company-wide stats from patients */}
        {!isPatient && (
          <>
            <Grid item xs={6} sm={6} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <CheckCircle sx={{ fontSize: 40, color: 'success.main' }} />
                  <Typography variant="h4" sx={{ mt: 1 }}>
                    {filteredAppointments.filter(a => a.status === 'completed').length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">Completed</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} sm={6} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Warning sx={{ fontSize: 40, color: 'warning.main' }} />
                  <Typography variant="h4" sx={{ mt: 1 }}>
                    {filteredAppointments.filter(a => a.status === 'no-show').length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">No-Shows</Typography>
                </CardContent>
              </Card>
            </Grid>
          </>
        )}
      </Grid>

      {/* Date Navigation & View Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Box sx={{ p: 2, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'center' }, gap: 1.5 }}>
          {/* Hide date navigation from patients */}
          {!isPatient && (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: { xs: 'space-between', sm: 'flex-start' }, gap: 1 }}>
              <IconButton onClick={() => navigateDate('prev')}>
                <NavigateBefore />
              </IconButton>
              <Typography variant={isMobile ? 'body1' : 'h6'} sx={{ textAlign: 'center', flex: 1 }}>
                {selectedDate.toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </Typography>
              <IconButton onClick={() => navigateDate('next')}>
                <NavigateNext />
              </IconButton>
              <Button 
                size="small" 
                onClick={() => setSelectedDate(new Date())}
                variant="outlined"
                fullWidth={isMobile}
              >
                Today
              </Button>
            </Box>
          )}
          
          <Tabs
            value={tabValue}
            onChange={(_, newValue) => setTabValue(newValue)}
            variant={isMobile ? 'scrollable' : 'standard'}
            scrollButtons={isMobile ? 'auto' : false}
            allowScrollButtonsMobile
          >
            <Tab label="All Appointments" />
            <Tab label="Upcoming" />
            {/* Hide Daily View from patients - they don't need the scheduling grid */}
            {!isPatient && <Tab label="Daily View" />}
          </Tabs>
        </Box>
      </Paper>

      {/* Main Content */}
      {/* Daily View - Admin/Therapist Only - tab 2 */}
      {!isPatient && tabValue === 2 && (
        /* Daily View */
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Paper>
              <Box sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Daily Schedule - {selectedDate.toLocaleDateString()}
                </Typography>
                {isMobile ? (
                  <Box sx={{ display: 'grid', gap: 1.5 }}>
                    {timeSlots.map((slot) => {
                      const appointment = todaysAppointments.find(a => a.time === slot.time);
                      return (
                        <Card key={slot.time} variant="outlined">
                          <CardContent sx={{ pb: '16px !important' }}>
                            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>{slot.time}</Typography>
                            {appointment ? (
                              <>
                                <Typography variant="body2" sx={{ mb: 0.5 }}>{appointment.patientName}</Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                                  {appointment.therapistName}
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                                  <Chip label={appointment.type} size="small" variant="outlined" />
                                  <Chip label={appointment.status} color={getStatusColor(appointment.status) as any} size="small" />
                                </Box>
                                <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                                  <IconButton size="small" onClick={(e) => handleMenuOpen(e, appointment.id)}>
                                    <MoreVert />
                                  </IconButton>
                                </Box>
                              </>
                            ) : (
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => {
                                  const timeDate = new Date();
                                  const [hours, minutes] = slot.time.split(':');
                                  timeDate.setHours(parseInt(hours), parseInt(minutes));
                                  setFormData(prev => ({ ...prev, date: selectedDate, time: timeDate }));
                                  handleOpenDialog();
                                }}
                              >
                                Book
                              </Button>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </Box>
                ) : (
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Time</TableCell>
                          <TableCell>Patient</TableCell>
                          <TableCell>Therapist</TableCell>
                          <TableCell>Type</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell align="center">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {timeSlots.map((slot) => {
                          const appointment = todaysAppointments.find(a => a.time === slot.time);

                          return (
                            <TableRow
                              key={slot.time}
                              sx={{
                                backgroundColor: appointment ? 'action.hover' : 'transparent',
                                '&:hover': { backgroundColor: 'action.selected' }
                              }}
                            >
                              <TableCell>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <AccessTime fontSize="small" />
                                  {slot.time}
                                </Box>
                              </TableCell>
                              <TableCell>
                                {appointment ? (
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Avatar sx={{ width: 32, height: 32 }}>
                                      {appointment.patientName.charAt(0)}
                                    </Avatar>
                                    {appointment.patientName}
                                  </Box>
                                ) : (
                                  <Typography color="text.secondary">Available</Typography>
                                )}
                              </TableCell>
                              <TableCell>
                                {appointment?.therapistName || '-'}
                              </TableCell>
                              <TableCell>
                                {appointment && (
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    {getFormatIcon(appointment.format)}
                                    <Chip
                                      label={appointment.type}
                                      size="small"
                                      variant="outlined"
                                    />
                                  </Box>
                                )}
                              </TableCell>
                              <TableCell>
                                {appointment && (
                                  <Chip
                                    label={appointment.status}
                                    color={getStatusColor(appointment.status) as any}
                                    size="small"
                                  />
                                )}
                              </TableCell>
                              <TableCell align="center">
                                {appointment ? (
                                  <IconButton
                                    size="small"
                                    onClick={(e) => handleMenuOpen(e, appointment.id)}
                                  >
                                    <MoreVert />
                                  </IconButton>
                                ) : (
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    onClick={() => {
                                      const timeDate = new Date();
                                      const [hours, minutes] = slot.time.split(':');
                                      timeDate.setHours(parseInt(hours), parseInt(minutes));
                                      setFormData(prev => ({
                                        ...prev,
                                        date: selectedDate,
                                        time: timeDate
                                      }));
                                      handleOpenDialog();
                                    }}
                                  >
                                    Book
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Box>
            </Paper>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Today's Summary
              </Typography>
              <List>
                {todaysAppointments.map((appointment) => (
                  <ListItem key={appointment.id}>
                    <ListItemText
                      primary={`${appointment.time} - ${appointment.patientName}`}
                      secondary={`${appointment.therapistName} • ${appointment.type}`}
                    />
                    <ListItemSecondaryAction>
                      <Chip 
                        label={appointment.status}
                        color={getStatusColor(appointment.status) as any}
                        size="small"
                      />
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
                {todaysAppointments.length === 0 && (
                  <ListItem>
                    <ListItemText 
                      primary="No appointments scheduled"
                      secondary="Click 'New Appointment' to schedule"
                    />
                  </ListItem>
                )}
              </List>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* Upcoming Appointments - Always tab 1 */}
      {tabValue === 1 && (
        /* Upcoming Appointments */
        <Paper>
          <Box sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Upcoming Appointments
            </Typography>
            {isMobile ? (
              <Box sx={{ display: 'grid', gap: 1.5 }}>
                {upcomingAppointments.map((appointment) => (
                  <Card key={appointment.id} variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle2">
                        {new Date(appointment.date).toLocaleDateString()} • {appointment.time}
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 0.5 }}>{appointment.patientName}</Typography>
                      <Typography variant="caption" color="text.secondary">{appointment.therapistName}</Typography>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
                        <Chip label={appointment.type} size="small" variant="outlined" />
                        <Chip label={appointment.status} color={getStatusColor(appointment.status) as any} size="small" />
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                        {isPatient && appointment.status === 'scheduled' ? (
                          <Button size="small" variant="contained" color="success" onClick={() => confirmAppointment(appointment.id)}>
                            Confirm
                          </Button>
                        ) : (
                          <IconButton size="small" onClick={(e) => handleMenuOpen(e, appointment.id)}>
                            <MoreVert />
                          </IconButton>
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            ) : (
              <TableContainer>
                <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Date & Time</TableCell>
                    <TableCell>Patient</TableCell>
                    <TableCell>Therapist</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Format</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {upcomingAppointments.map((appointment) => (
                    <TableRow key={appointment.id}>
                      <TableCell>
                        <Box>
                          <Typography variant="body2">
                            {new Date(appointment.date).toLocaleDateString()}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {appointment.time}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar sx={{ width: 32, height: 32 }}>
                            {appointment.patientName.charAt(0)}
                          </Avatar>
                          {appointment.patientName}
                        </Box>
                      </TableCell>
                      <TableCell>{appointment.therapistName}</TableCell>
                      <TableCell>
                        <Chip 
                          label={appointment.type} 
                          size="small" 
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {getFormatIcon(appointment.format)}
                          {appointment.format}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={appointment.status}
                          color={getStatusColor(appointment.status) as any}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="center">
                        {isPatient && appointment.status === 'scheduled' ? (
                          <Button 
                            size="small"
                            variant="contained"
                            color="success"
                            onClick={() => confirmAppointment(appointment.id)}
                          >
                            Confirm
                          </Button>
                        ) : (
                          <IconButton 
                            size="small"
                            onClick={(e) => handleMenuOpen(e, appointment.id)}
                          >
                            <MoreVert />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        </Paper>
      )}

      {/* All Appointments - Always tab 0 */}
      {tabValue === 0 && (
        /* All Appointments */
        <Paper>
          <Box sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              All Appointments
            </Typography>
            {isMobile ? (
              <Box sx={{ display: 'grid', gap: 1.5 }}>
                {filteredAppointments
                  .sort((a, b) => new Date(`${b.date} ${b.time}`).getTime() - new Date(`${a.date} ${a.time}`).getTime())
                  .map((appointment) => (
                  <Card key={appointment.id} variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle2">
                        {new Date(appointment.date).toLocaleDateString()} • {appointment.time}
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 0.5 }}>{appointment.patientName}</Typography>
                      <Typography variant="caption" color="text.secondary">{appointment.therapistName}</Typography>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
                        <Chip label={appointment.type} size="small" variant="outlined" />
                        <Chip label={appointment.status} color={getStatusColor(appointment.status) as any} size="small" />
                      </Box>
                      {appointment.notes && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                          {appointment.notes}
                        </Typography>
                      )}
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                        {isPatient ? (
                          appointment.status === 'scheduled' ? (
                            <Button size="small" variant="contained" color="success" onClick={() => updateAppointmentStatus(appointment.id, 'confirmed')}>
                              Confirm
                            </Button>
                          ) : (
                            <Typography variant="body2" color="text.secondary">{appointment.status}</Typography>
                          )
                        ) : (
                          <IconButton size="small" onClick={(e) => handleMenuOpen(e, appointment.id)}>
                            <MoreVert />
                          </IconButton>
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            ) : (
              <TableContainer>
                <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Date & Time</TableCell>
                    <TableCell>Patient</TableCell>
                    <TableCell>Therapist</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Format</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Notes</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredAppointments
                    .sort((a, b) => new Date(`${b.date} ${b.time}`).getTime() - new Date(`${a.date} ${a.time}`).getTime())
                    .map((appointment) => (
                    <TableRow key={appointment.id}>
                      <TableCell>
                        <Box>
                          <Typography variant="body2">
                            {new Date(appointment.date).toLocaleDateString()}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {appointment.time}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar sx={{ width: 32, height: 32 }}>
                            {appointment.patientName.charAt(0)}
                          </Avatar>
                          {appointment.patientName}
                        </Box>
                      </TableCell>
                      <TableCell>{appointment.therapistName}</TableCell>
                      <TableCell>
                        <Chip 
                          label={appointment.type} 
                          size="small" 
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {getFormatIcon(appointment.format)}
                          {appointment.format}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={appointment.status}
                          color={getStatusColor(appointment.status) as any}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Tooltip title={appointment.notes || 'No notes'}>
                          <Typography 
                            variant="body2" 
                            noWrap 
                            sx={{ maxWidth: 150 }}
                          >
                            {appointment.notes || 'No notes'}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell align="center">
                        {isPatient ? (
                          appointment.status === 'scheduled' ? (
                            <Button 
                              size="small"
                              variant="contained"
                              color="success"
                              onClick={() => updateAppointmentStatus(appointment.id, 'confirmed')}
                            >
                              Confirm
                            </Button>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              {appointment.status}
                            </Typography>
                          )
                        ) : (
                          <IconButton 
                            size="small"
                            onClick={(e) => handleMenuOpen(e, appointment.id)}
                          >
                            <MoreVert />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        </Paper>
      )}

      {/* Appointment Actions Menu */}
      <Menu
        anchorEl={appointmentMenuAnchor}
        open={Boolean(appointmentMenuAnchor)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => {
          const appointment = appointments.find(a => a.id === selectedAppointmentId);
          if (appointment) handleOpenDialog(appointment);
        }}>
          <ListItemIcon><Edit /></ListItemIcon>
          Edit Appointment
        </MenuItem>
        <MenuItem onClick={() => updateAppointmentStatus(selectedAppointmentId!, 'confirmed')}>
          <ListItemIcon><CheckCircle color="success" /></ListItemIcon>
          Confirm
        </MenuItem>
        <MenuItem onClick={() => updateAppointmentStatus(selectedAppointmentId!, 'completed')}>
          <ListItemIcon><CheckCircle color="info" /></ListItemIcon>
          Mark Completed
        </MenuItem>
        <MenuItem onClick={() => updateAppointmentStatus(selectedAppointmentId!, 'no-show')}>
          <ListItemIcon><Warning color="warning" /></ListItemIcon>
          Mark No-Show
        </MenuItem>
        <Divider />
        <MenuItem>
          <ListItemIcon><Message /></ListItemIcon>
          Send Reminder
        </MenuItem>
        <MenuItem>
          <ListItemIcon><Print /></ListItemIcon>
          Print Details
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => updateAppointmentStatus(selectedAppointmentId!, 'cancelled')}>
          <ListItemIcon><Cancel color="error" /></ListItemIcon>
          Cancel Appointment
        </MenuItem>
      </Menu>

      {/* New/Edit Appointment Dialog */}
      <Dialog 
        open={appointmentDialogOpen} 
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingAppointment ? 'Edit Appointment' : 'New Appointment'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth error={!!formErrors.patientId}>
                <InputLabel>Patient</InputLabel>
                <Select
                  value={formData.patientId}
                  label="Patient"
                  onChange={(e) => setFormData(prev => ({ ...prev, patientId: e.target.value }))}
                  disabled={isLoadingPatients}
                >
                  {isLoadingPatients ? (
                    <MenuItem disabled>Loading patients...</MenuItem>
                  ) : !Array.isArray(patients) || patients.length === 0 ? (
                    <MenuItem disabled>No patients available</MenuItem>
                  ) : (
                    patients.map((patient) => (
                      <MenuItem key={patient.id} value={patient.id}>
                        {patient.full_name} - {patient.email}
                      </MenuItem>
                    ))
                  )}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth error={!!formErrors.therapistId}>
                <InputLabel>Therapist</InputLabel>
                <Select
                  value={formData.therapistId}
                  label="Therapist"
                  onChange={(e) => setFormData(prev => ({ ...prev, therapistId: e.target.value }))}
                  disabled={isLoadingTherapists}
                >
                  {isLoadingTherapists ? (
                    <MenuItem disabled>Loading therapists...</MenuItem>
                  ) : !Array.isArray(therapists) || therapists.length === 0 ? (
                    <MenuItem disabled>No therapists available</MenuItem>
                  ) : (
                    therapists.map((therapist) => (
                      <MenuItem key={therapist.id} value={therapist.id}>
                        {therapist.full_name} - {therapist.email}
                      </MenuItem>
                    ))
                  )}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <DatePicker
                label="Date"
                value={formData.date}
                onChange={(date) => setFormData(prev => ({ ...prev, date }))}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    error: !!formErrors.date,
                    helperText: formErrors.date
                  }
                }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TimePicker
                label="Time"
                value={formData.time}
                onChange={(time) => setFormData(prev => ({ ...prev, time }))}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    error: !!formErrors.time,
                    helperText: formErrors.time
                  }
                }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Duration (minutes)"
                type="number"
                value={formData.duration}
                onChange={(e) => setFormData(prev => ({ ...prev, duration: parseInt(e.target.value) || 0 }))}
                error={!!formErrors.duration}
                helperText={formErrors.duration}
                InputProps={{ inputProps: { min: 15, max: 180, step: 15 } }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Appointment Type</InputLabel>
                <Select
                  value={formData.type}
                  label="Appointment Type"
                  onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as Appointment['type'] }))}
                >
                  <MenuItem value="initial">Initial Consultation</MenuItem>
                  <MenuItem value="follow-up">Follow-up Session</MenuItem>
                  <MenuItem value="group">Group Therapy</MenuItem>
                  <MenuItem value="assessment">Assessment</MenuItem>
                  <MenuItem value="emergency">Emergency Session</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Format</InputLabel>
                <Select
                  value={formData.format}
                  label="Format"
                  onChange={(e) => setFormData(prev => ({ ...prev, format: e.target.value as Appointment['format'] }))}
                >
                  <MenuItem value="in-person">In-Person</MenuItem>
                  <MenuItem value="telehealth">Telehealth</MenuItem>
                  <MenuItem value="phone">Phone Call</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {formData.format === 'in-person' && (
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Location/Room"
                  value={formData.location}
                  onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                  error={!!formErrors.location}
                  helperText={formErrors.location}
                  placeholder="e.g., Room 101, Building A"
                />
              </Grid>
            )}

            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Session notes, special requirements, etc."
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleSubmitAppointment}
            disabled={!formData.patientId || !formData.therapistId || !formData.date || !formData.time}
          >
            {editingAppointment ? 'Update' : 'Schedule'} Appointment
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AppointmentScheduling;