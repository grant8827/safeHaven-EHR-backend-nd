import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Divider,
  Tab,
  Tabs,
  Alert,
  CircularProgress,
  Tooltip,
  Paper,
  FormControl,
  InputLabel,
  Select,
} from '@mui/material';
import {
  VideoCall,
  Add,
  Schedule,
  People,
  History,
  PlayArrow,
  Edit,
  Delete,
  ContentCopy,
  AccessTime,
  CalendarMonth,
  Person,
  EventAvailable,
  Pending,
  CheckCircle,
  Cancel,
  Transcribe,
  RecordVoiceOver,
  Warning,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { apiClient } from '../../services/apiClient';
import { format, parseISO } from 'date-fns';
import EmergencySessionDialog from '../../components/Telehealth/EmergencySessionDialog';

interface TelehealthSession {
  id: string;
  title: string;
  patient: {
    id: string;
    name: string;
    avatar?: string;
  };
  therapist: {
    id: string;
    name: string;
  };
  scheduledAt: string;
  duration: number;
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
  isEmergency: boolean;
  sessionUrl?: string;
  hasRecording: boolean;
  hasTranscript: boolean;
  notes?: string;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div hidden={value !== index} {...other}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

const TelehealthDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { state } = useAuth();
  const { showSuccess, showError } = useNotification();
  const user = state.user;

  const [tabValue, setTabValue] = useState(0);
  const [sessions, setSessions] = useState<TelehealthSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [openNewSessionDialog, setOpenNewSessionDialog] = useState(false);
  const [openEmergencyDialog, setOpenEmergencyDialog] = useState(false);
  const [patients, setPatients] = useState<any[]>([]);

  // New session form state
  const [newSession, setNewSession] = useState({
    title: '',
    patientId: '',
    scheduledAt: '',
    duration: 30,
    notes: '',
  });

  // Mock data - replace with actual API calls
  useEffect(() => {
    loadSessions();
    loadPatients();
  }, []);

  const loadPatients = async () => {
    try {
      const response = await apiClient.get('/patients/');
      const patientList = response.data?.results || response.data || [];
      setPatients(patientList);
    } catch (error) {
      console.error('Failed to load patients:', error);
    }
  };

  const loadSessions = async () => {
    setLoading(true);
    try {
      // Fetch sessions from real API - use my_sessions (underscore not hyphen)
      let response;
      try {
        response = await apiClient.get('/telehealth/sessions/my_sessions/');
      } catch (error: any) {
        if (error.response?.status === 404) {
          // Fallback to base endpoint
          console.log('my_sessions endpoint not found, using base endpoint');
          response = await apiClient.get('/telehealth/sessions/');
        } else {
          throw error;
        }
      }
      
      console.log('Sessions response:', response);
      
      const sessionData = response.data.results || response.data || [];
      console.log('Session data:', sessionData);
      
      // Map backend status to frontend status
      const mapStatus = (backendStatus: string): 'scheduled' | 'in-progress' | 'completed' | 'cancelled' => {
        switch (backendStatus) {
          case 'scheduled':
          case 'waiting_room':
            return 'scheduled';
          case 'connecting':
          case 'active':
          case 'on_hold':
            return 'in-progress';
          case 'ended':
            return 'completed';
          case 'cancelled':
          case 'failed':
            return 'cancelled';
          default:
            return 'scheduled';
        }
      };
      
      // Transform backend data to frontend format
      const transformedSessions: TelehealthSession[] = sessionData.map((session: any) => ({
        id: session.id,
        title: session.title || 'Telehealth Session',
        patient: {
          id: session.patient,
          name: session.patient_details 
            ? `${session.patient_details.first_name || ''} ${session.patient_details.last_name || ''}`.trim()
            : 'Unknown Patient',
          avatar: undefined
        },
        therapist: {
          id: session.therapist || '',
          name: session.therapist_details
            ? `${session.therapist_details.first_name || ''} ${session.therapist_details.last_name || ''}`.trim()
            : 'Not Assigned'
        },
        scheduledAt: session.scheduled_at,
        duration: session.duration,
        status: mapStatus(session.status),
        isEmergency: session.is_emergency || false,
        sessionUrl: session.session_url,
        hasRecording: session.has_recording || false,
        hasTranscript: session.has_transcript || false,
        notes: session.notes
      }));
      
      console.log('Transformed sessions:', transformedSessions);
      setSessions(transformedSessions);
    } catch (error: any) {
      console.error('Failed to load sessions:', error);
      console.error('Error response:', error.response);
      showError('Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSession = async () => {
    try {
      // Validate form
      if (!newSession.title || !newSession.patientId || !newSession.scheduledAt) {
        showError('Please fill in all required fields');
        return;
      }

      // Create session via API
      const sessionData = {
        title: newSession.title,
        patientId: newSession.patientId,
        therapistId: user?.id,
        scheduledAt: new Date(newSession.scheduledAt).toISOString(),
        scheduledDuration: newSession.duration,
        notes: newSession.notes,
      };

      await apiClient.post('/telehealth/sessions/', sessionData);
      
      showSuccess('Telehealth session scheduled successfully');
      setOpenNewSessionDialog(false);
      
      // Reset form
      setNewSession({
        title: '',
        patientId: '',
        scheduledAt: '',
        duration: 30,
        notes: '',
      });
      
      // Reload sessions
      await loadSessions();
    } catch (error: any) {
      console.error('Failed to create session:', error);
      const errorMsg = error.response?.data?.scheduled_at?.[0] || 
                       error.response?.data?.detail ||
                       'Failed to create session';
      showError(errorMsg);
    }
  };

  const handleJoinSession = (sessionId: string) => {
    // Go through the Waiting Room so presence is checked before entering
    navigate(`/telehealth/waiting/${sessionId}`);
  };

  const handleOpenTranscriptsPage = (sessionId?: string) => {
    if (sessionId) {
      navigate(`/telehealth/transcripts?sessionId=${encodeURIComponent(sessionId)}`);
      return;
    }
    navigate('/telehealth/transcripts');
  };

  const handleCopySessionLink = (session: TelehealthSession) => {
    const link = `${window.location.origin}${session.sessionUrl}`;
    navigator.clipboard.writeText(link);
    showSuccess('Session link copied to clipboard');
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!window.confirm('Are you sure you want to cancel this session?')) {
      return;
    }
    
    try {
      await apiClient.post(`/telehealth/sessions/${sessionId}/cancel/`);
      showSuccess('Session cancelled successfully');
      await loadSessions();
    } catch (error) {
      console.error('Failed to cancel session:', error);
      showError('Failed to cancel session');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'info';
      case 'in-progress': return 'success';
      case 'completed': return 'default';
      case 'cancelled': return 'error';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'scheduled': return <Pending />;
      case 'in-progress': return <PlayArrow />;
      case 'completed': return <CheckCircle />;
      case 'cancelled': return <Cancel />;
      default: return null;
    }
  };

  const filterSessions = (status?: string) => {
    if (!status) return sessions;
    return sessions.filter(s => s.status === status);
  };

  const upcomingSessions = filterSessions('scheduled');
  const completedSessions = filterSessions('completed');
  const emergencySessions = sessions.filter(s => s.isEmergency);

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Telehealth Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {user?.role === 'client' 
              ? 'View your scheduled telehealth sessions'
              : 'Manage video sessions, recordings, and transcripts'
            }
          </Typography>
        </Box>
        {/* Only show New Session and Emergency Session buttons for admin, therapist, and staff */}
        {user && ['admin', 'therapist', 'staff'].includes(user.role) && (
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              color="error"
              startIcon={<Warning />}
              onClick={() => setOpenEmergencyDialog(true)}
              size="large"
            >
              Emergency Session
            </Button>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setOpenNewSessionDialog(true)}
              size="large"
            >
              New Session
            </Button>
          </Box>
        )}
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <EventAvailable color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">{upcomingSessions.length}</Typography>
              </Box>
              <Typography color="text.secondary" variant="body2">
                Upcoming Sessions
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <CheckCircle color="success" sx={{ mr: 1 }} />
                <Typography variant="h6">{completedSessions.length}</Typography>
              </Box>
              <Typography color="text.secondary" variant="body2">
                Completed Sessions
              </Typography>
              {user && ['admin', 'therapist'].includes(user.role) && (
                <Button
                  size="small"
                  variant="text"
                  startIcon={<Transcribe />}
                  onClick={() => handleOpenTranscriptsPage()}
                  sx={{ mt: 1, px: 0 }}
                >
                  Transcripts
                </Button>
              )}
            </CardContent>
          </Card>
        </Grid>
        {user && ['admin', 'therapist'].includes(user.role) && (
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Transcribe color="info" sx={{ mr: 1 }} />
                  <Typography variant="h6">
                    {sessions.filter(s => s.hasTranscript).length}
                  </Typography>
                </Box>
                <Typography color="text.secondary" variant="body2">
                  Transcripts Available
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        )}
        {user && ['admin', 'therapist', 'staff'].includes(user.role) && (
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <RecordVoiceOver color="warning" sx={{ mr: 1 }} />
                  <Typography variant="h6">
                    {sessions.filter(s => s.hasRecording).length}
                  </Typography>
                </Box>
                <Typography color="text.secondary" variant="body2">
                  Recordings Saved
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={(_e, v) => setTabValue(v)}>
          <Tab icon={<Schedule />} label="Upcoming" iconPosition="start" />
          <Tab icon={<History />} label="Past Sessions" iconPosition="start" />
          <Tab icon={<Warning />} label="Emergency Session" iconPosition="start" />
          <Tab icon={<People />} label="All Sessions" iconPosition="start" />
        </Tabs>
      </Paper>

      {/* Tab Panels */}
      <TabPanel value={tabValue} index={0}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : upcomingSessions.length === 0 ? (
          <Alert severity="info">No upcoming sessions scheduled</Alert>
        ) : (
          <Grid container spacing={3}>
            {upcomingSessions.map((session) => (
              <Grid item xs={12} md={6} lg={4} key={session.id}>
                <Card elevation={2} sx={session.isEmergency ? { borderLeft: 4, borderColor: 'error.main' } : {}}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                      <Typography variant="h6" noWrap>
                        {session.title}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        {session.isEmergency && (
                          <Chip
                            icon={<Warning />}
                            label="Emergency"
                            color="error"
                            size="small"
                          />
                        )}
                        <Chip
                          icon={getStatusIcon(session.status) || undefined}
                          label={session.status}
                          color={getStatusColor(session.status) as any}
                          size="small"
                        />
                      </Box>
                    </Box>

                    <Box sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <Person fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                        <Typography variant="body2">
                          {user?.id === session.patient.id 
                            ? `Therapist: ${session.therapist.name}`
                            : `Patient: ${session.patient.name}`
                          }
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <CalendarMonth fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                        <Typography variant="body2">
                          {format(parseISO(session.scheduledAt), 'PPp')}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <AccessTime fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                        <Typography variant="body2">{session.duration} minutes</Typography>
                      </Box>
                    </Box>

                    {user && ['admin', 'therapist', 'staff'].includes(user.role) && (
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {session.hasRecording && (
                          <Chip label="Recording" size="small" color="success" variant="outlined" />
                        )}
                        {session.hasTranscript && (
                          <Chip label="Transcript" size="small" color="info" variant="outlined" />
                        )}
                      </Box>
                    )}
                  </CardContent>

                  <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
                    <Box>
                      <Tooltip title="Copy session link">
                        <IconButton size="small" onClick={() => handleCopySessionLink(session)}>
                          <ContentCopy fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit session">
                        <IconButton size="small">
                          <Edit fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete session">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteSession(session.id)}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                    <Button
                      variant="contained"
                      startIcon={<VideoCall />}
                      onClick={() => handleJoinSession(session.id)}
                      size="small"
                    >
                      Join
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        {completedSessions.length === 0 ? (
          <Alert severity="info">No completed sessions</Alert>
        ) : (
          <Grid container spacing={3}>
            {completedSessions.map((session) => (
              <Grid item xs={12} md={6} lg={4} key={session.id}>
                <Card elevation={2}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                      <Typography variant="h6" noWrap>
                        {session.title}
                      </Typography>
                      <Chip
                        icon={<CheckCircle />}
                        label="Completed"
                        color="success"
                        size="small"
                      />
                    </Box>

                    <Box sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <Person fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                        <Typography variant="body2">
                          {user?.id === session.patient.id 
                            ? `Therapist: ${session.therapist.name}`
                            : `Patient: ${session.patient.name}`
                          }
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <CalendarMonth fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                        <Typography variant="body2">
                          {format(parseISO(session.scheduledAt), 'PPp')}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <AccessTime fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                        <Typography variant="body2">{session.duration} minutes</Typography>
                      </Box>
                    </Box>

                    {session.notes && (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {session.notes}
                      </Typography>
                    )}

                    {user && ['admin', 'therapist', 'staff'].includes(user.role) && (
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {session.hasRecording && (
                          <Chip label="Recording Available" size="small" color="success" />
                        )}
                        {session.hasTranscript && (
                          <Chip label="Transcript Available" size="small" color="info" />
                        )}
                      </Box>
                    )}
                  </CardContent>

                  <CardActions sx={{ px: 2, pb: 2 }}>
                    <Button size="small" startIcon={<PlayArrow />}>
                      View Recording
                    </Button>
                    <Button
                      size="small"
                      startIcon={<Transcribe />}
                      onClick={() => handleOpenTranscriptsPage(session.id)}
                    >
                      View Transcript
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        {emergencySessions.length === 0 ? (
          <Alert severity="info">No emergency sessions</Alert>
        ) : (
          <Grid container spacing={3}>
            {emergencySessions.map((session) => (
              <Grid item xs={12} md={6} lg={4} key={session.id}>
                <Card elevation={2} sx={{ borderLeft: 4, borderColor: 'error.main' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                      <Typography variant="h6" noWrap>
                        {session.title}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        <Chip
                          icon={<Warning />}
                          label="Emergency"
                          color="error"
                          size="small"
                        />
                        <Chip
                          icon={getStatusIcon(session.status) || undefined}
                          label={session.status}
                          color={getStatusColor(session.status) as any}
                          size="small"
                        />
                      </Box>
                    </Box>

                    <Box sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <Person fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                        <Typography variant="body2">
                          {user?.id === session.patient.id 
                            ? `Therapist: ${session.therapist.name}`
                            : `Patient: ${session.patient.name}`
                          }
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <CalendarMonth fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                        <Typography variant="body2">
                          {format(parseISO(session.scheduledAt), 'PPp')}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <AccessTime fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                        <Typography variant="body2">{session.duration} minutes</Typography>
                      </Box>
                    </Box>

                    {user && ['admin', 'therapist', 'staff'].includes(user.role) && (
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {session.hasRecording && (
                          <Chip label="Recording" size="small" color="success" variant="outlined" />
                        )}
                        {session.hasTranscript && (
                          <Chip label="Transcript" size="small" color="info" variant="outlined" />
                        )}
                      </Box>
                    )}
                  </CardContent>

                  <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
                    <Box>
                      <Tooltip title="Copy session link">
                        <IconButton size="small" onClick={() => handleCopySessionLink(session)}>
                          <ContentCopy fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {user && ['admin', 'therapist', 'staff'].includes(user.role) && (
                        <>
                          <Tooltip title="Edit session">
                            <IconButton size="small">
                              <Edit fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete session">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDeleteSession(session.id)}
                            >
                              <Delete fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                    </Box>
                    <Button
                      variant="contained"
                      color="error"
                      startIcon={<VideoCall />}
                      onClick={() => handleJoinSession(session.id)}
                      size="small"
                    >
                      Join
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </TabPanel>

      <TabPanel value={tabValue} index={3}>
        <List>
          {sessions.map((session, index) => (
            <React.Fragment key={session.id}>
              <ListItem
                secondaryAction={
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<VideoCall />}
                      onClick={() => handleJoinSession(session.id)}
                    >
                      {session.status === 'completed' ? 'View' : 'Join'}
                    </Button>
                  </Box>
                }
              >
                <ListItemAvatar>
                  <Avatar>
                    <VideoCall />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {session.title}
                      {session.isEmergency && (
                        <Chip
                          icon={<Warning />}
                          label="Emergency"
                          size="small"
                          color="error"
                        />
                      )}
                      <Chip
                        label={session.status}
                        size="small"
                        color={getStatusColor(session.status) as any}
                      />
                    </Box>
                  }
                  secondary={
                    <>
                      {session.patient.name} •{' '}
                      {format(parseISO(session.scheduledAt), 'PPp')} •{' '}
                      {session.duration} min
                    </>
                  }
                />
              </ListItem>
              {index < sessions.length - 1 && <Divider />}
            </React.Fragment>
          ))}
        </List>
      </TabPanel>

      {/* New Session Dialog */}
      <Dialog
        open={openNewSessionDialog}
        onClose={() => setOpenNewSessionDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Schedule New Telehealth Session</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Session Title"
              value={newSession.title}
              onChange={(e) => setNewSession({ ...newSession, title: e.target.value })}
              fullWidth
              required
            />

            <FormControl fullWidth required>
              <InputLabel>Patient</InputLabel>
              <Select
                value={newSession.patientId}
                onChange={(e) => setNewSession({ ...newSession, patientId: e.target.value })}
                label="Patient"
              >
                {patients.map((patient) => (
                  <MenuItem key={patient.id} value={patient.id}>
                    {patient.first_name || patient.firstName || ''} {patient.last_name || patient.lastName || ''} ({patient.email})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Scheduled Date & Time"
              type="datetime-local"
              value={newSession.scheduledAt}
              onChange={(e) => setNewSession({ ...newSession, scheduledAt: e.target.value })}
              fullWidth
              required
              InputLabelProps={{ shrink: true }}
            />

            <FormControl fullWidth>
              <InputLabel>Duration (minutes)</InputLabel>
              <Select
                value={newSession.duration}
                onChange={(e) => setNewSession({ ...newSession, duration: Number(e.target.value) })}
                label="Duration (minutes)"
              >
                <MenuItem value={15}>15 minutes</MenuItem>
                <MenuItem value={30}>30 minutes</MenuItem>
                <MenuItem value={45}>45 minutes</MenuItem>
                <MenuItem value={50}>50 minutes</MenuItem>
                <MenuItem value={60}>60 minutes</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Session Notes (Optional)"
              value={newSession.notes}
              onChange={(e) => setNewSession({ ...newSession, notes: e.target.value })}
              fullWidth
              multiline
              rows={3}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenNewSessionDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateSession}>
            Create Session
          </Button>
        </DialogActions>
      </Dialog>

      {/* Emergency Session Dialog */}
      <EmergencySessionDialog
        open={openEmergencyDialog}
        onClose={() => setOpenEmergencyDialog(false)}
        onSessionCreated={() => {
          loadSessions();
          showSuccess('Emergency session created and email sent to patient!');
        }}
      />
    </Box>
  );
};

export default TelehealthDashboard;
