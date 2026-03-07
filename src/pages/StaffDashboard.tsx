import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Fab,
  Tabs,
  Tab,
  Alert
} from '@mui/material';
import {
  Schedule as ScheduleIcon,
  Person as PatientIcon,
  Assignment as NotesIcon,
  Videocam as TelehealthIcon,
  Message as MessageIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
  AccessTime,
  Today
} from '@mui/icons-material';

interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  date_of_birth: string;
  insurance_number: string;
  emergency_contact: string;
  last_session: string;
  next_appointment?: string;
  diagnosis: string;
  treatment_plan: string;
  status: 'active' | 'inactive' | 'discharged';
}

interface Appointment {
  id: string;
  patient: Patient;
  date: string;
  time: string;
  duration: number;
  type: 'in-person' | 'telehealth';
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled' | 'no-show';
  notes?: string;
  session_type: 'individual' | 'group' | 'family' | 'assessment';
}

interface SOAPNote {
  id: string;
  patient_id: string;
  appointment_id: string;
  date: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  therapist_signature?: string;
  signed_at?: string;
  status: 'draft' | 'signed' | 'archived';
}

const StaffDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [, _setSelectedDate] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [, _setSoapNotes] = useState<SOAPNote[]>([]);
  const [, _setLoading] = useState(false);
  const [, setSelectedPatient] = useState<Patient | null>(null);
  const [, setDialogOpen] = useState<'patient' | 'appointment' | 'notes' | null>(null);
  const [stats, setStats] = useState({
    todayAppointments: 0,
    activePatients: 0,
    pendingNotes: 0,
    newMessages: 0
  });

  // Load data from API
  useEffect(() => {
    const loadData = async () => {
      try {
        // TODO: Load from actual API
        // const patientsResponse = await apiClient.get('/patients/');
        // const appointmentsResponse = await apiClient.get('/appointments/');
        // const soapNotesResponse = await apiClient.get('/soap-notes/?status=pending');
        // const messagesResponse = await apiClient.get('/messages/?unread=true');
        
        setPatients([]);
        setAppointments([]);
        setStats({
          todayAppointments: 0,
          activePatients: 0,
          pendingNotes: 0,
          newMessages: 0
        });
      } catch (error) {
        console.error('Failed to load data:', error);
      }
    };
    loadData();
  }, []);

  const DashboardOverview = () => {
    const todaysAppointments = appointments.filter(apt => 
      new Date(apt.date).toDateString() === new Date().toDateString()
    );

    return (
      <Box>
        <Typography variant="h5" sx={{ mb: 3 }}>
          Today's Overview
        </Typography>

        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Today color="primary" />
                  <Box sx={{ ml: 2 }}>
                    <Typography variant="h6">{stats.todayAppointments}</Typography>
                    <Typography variant="body2" color="textSecondary">
                      Today's Appointments
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <PatientIcon color="success" />
                  <Box sx={{ ml: 2 }}>
                    <Typography variant="h6">{stats.activePatients}</Typography>
                    <Typography variant="body2" color="textSecondary">
                      Active Patients
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <NotesIcon color="warning" />
                  <Box sx={{ ml: 2 }}>
                    <Typography variant="h6">{stats.pendingNotes}</Typography>
                    <Typography variant="body2" color="textSecondary">
                      Pending Notes
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <MessageIcon color="info" />
                  <Box sx={{ ml: 2 }}>
                    <Typography variant="h6">{stats.newMessages}</Typography>
                    <Typography variant="body2" color="textSecondary">
                      New Messages
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Today's Schedule */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Today's Schedule
          </Typography>
          {todaysAppointments.length === 0 ? (
            <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>
              No appointments scheduled for today
            </Typography>
          ) : (
            <List>
              {todaysAppointments.map(appointment => (
                <ListItem key={appointment.id} divider>
                  <ListItemIcon>
                    <Avatar sx={{ bgcolor: appointment.type === 'telehealth' ? 'primary.main' : 'success.main' }}>
                      {appointment.type === 'telehealth' ? <TelehealthIcon /> : <PatientIcon />}
                    </Avatar>
                  </ListItemIcon>
                  <ListItemText
                    primary={`${appointment.patient.first_name} ${appointment.patient.last_name}`}
                    secondary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Typography variant="body2">
                          {appointment.time} - {appointment.duration} min
                        </Typography>
                        <Chip 
                          label={appointment.session_type} 
                          size="small" 
                          variant="outlined"
                        />
                        <Chip 
                          label={appointment.type} 
                          size="small" 
                          color={appointment.type === 'telehealth' ? 'primary' : 'success'}
                        />
                      </Box>
                    }
                  />
                  <IconButton>
                    <ViewIcon />
                  </IconButton>
                </ListItem>
              ))}
            </List>
          )}
        </Paper>
      </Box>
    );
  };

  const ScheduleTab = () => (
    <Box>
      <Typography variant="h6" sx={{ mb: 3 }}>
        Schedule Management
      </Typography>
      
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Patient</TableCell>
              <TableCell>Date & Time</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Session</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {appointments.map(appointment => (
              <TableRow key={appointment.id}>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Avatar sx={{ mr: 2 }}>
                      {appointment.patient.first_name[0]}
                    </Avatar>
                    <Box>
                      <Typography variant="subtitle2">
                        {appointment.patient.first_name} {appointment.patient.last_name}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        {appointment.patient.diagnosis}
                      </Typography>
                    </Box>
                  </Box>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {new Date(appointment.date).toLocaleDateString()}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    {appointment.time} ({appointment.duration} min)
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip 
                    label={appointment.type}
                    color={appointment.type === 'telehealth' ? 'primary' : 'success'}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Chip 
                    label={appointment.session_type}
                    variant="outlined"
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Chip 
                    label={appointment.status}
                    color={
                      appointment.status === 'completed' ? 'success' :
                      appointment.status === 'in-progress' ? 'warning' :
                      appointment.status === 'cancelled' ? 'error' : 'default'
                    }
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <IconButton size="small">
                    <ViewIcon />
                  </IconButton>
                  <IconButton size="small">
                    <EditIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Fab 
        color="primary" 
        sx={{ position: 'fixed', bottom: 16, right: 16 }}
        onClick={() => setDialogOpen('appointment')}
      >
        <AddIcon />
      </Fab>
    </Box>
  );

  const PatientsTab = () => (
    <Box>
      <Typography variant="h6" sx={{ mb: 3 }}>
        Patient Management
      </Typography>
      
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Patient</TableCell>
              <TableCell>Contact</TableCell>
              <TableCell>Diagnosis</TableCell>
              <TableCell>Last Session</TableCell>
              <TableCell>Next Appointment</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {patients.map(patient => (
              <TableRow key={patient.id}>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Avatar sx={{ mr: 2 }}>
                      {patient.first_name[0]}
                    </Avatar>
                    <Box>
                      <Typography variant="subtitle2">
                        {patient.first_name} {patient.last_name}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        DOB: {new Date(patient.date_of_birth).toLocaleDateString()}
                      </Typography>
                    </Box>
                  </Box>
                </TableCell>
                <TableCell>
                  <Box>
                    <Typography variant="body2">{patient.email}</Typography>
                    <Typography variant="body2" color="textSecondary">
                      {patient.phone}
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{patient.diagnosis}</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {new Date(patient.last_session).toLocaleDateString()}
                  </Typography>
                </TableCell>
                <TableCell>
                  {patient.next_appointment ? (
                    <Typography variant="body2">
                      {new Date(patient.next_appointment).toLocaleDateString()}
                    </Typography>
                  ) : (
                    <Typography variant="body2" color="textSecondary">
                      No upcoming appointment
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Chip 
                    label={patient.status}
                    color={patient.status === 'active' ? 'success' : 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <IconButton 
                    size="small"
                    onClick={() => setSelectedPatient(patient)}
                  >
                    <ViewIcon />
                  </IconButton>
                  <IconButton size="small">
                    <EditIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );

  const NotesTab = () => (
    <Box>
      <Typography variant="h6" sx={{ mb: 3 }}>
        SOAP Notes
      </Typography>
      <Paper sx={{ p: 3 }}>
        <Alert severity="info">
          SOAP Notes functionality will be implemented with digital signature capabilities
        </Alert>
      </Paper>
    </Box>
  );

  const tabPanels = [
    { label: 'Dashboard', icon: <ScheduleIcon />, component: <DashboardOverview /> },
    { label: 'Schedule', icon: <AccessTime />, component: <ScheduleTab /> },
    { label: 'Patients', icon: <PatientIcon />, component: <PatientsTab /> },
    { label: 'Notes', icon: <NotesIcon />, component: <NotesTab /> },
    { label: 'Messages', icon: <MessageIcon />, component: <div>Messages Coming Soon</div> },
  ];

  return (
    <Box sx={{ flexGrow: 1 }}>
      <Paper sx={{ width: '100%' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs 
            value={activeTab} 
            onChange={(_event: React.SyntheticEvent, newValue: number) => setActiveTab(newValue)}
            variant="scrollable"
            scrollButtons="auto"
          >
            {tabPanels.map((panel, index) => (
              <Tab 
                key={index} 
                label={panel.label}
                icon={panel.icon}
                iconPosition="start"
              />
            ))}
          </Tabs>
        </Box>

        <Box sx={{ p: 3 }}>
          {tabPanels[activeTab]?.component}
        </Box>
      </Paper>
    </Box>
  );
};

export default StaffDashboard;