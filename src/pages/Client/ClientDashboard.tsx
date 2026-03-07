import React, { useState, useEffect } from 'react';
import { 
  Typography, 
  Box, 
  Grid, 
  Card, 
  CardContent, 
  CardActions,
  Button,
  Avatar,
  Chip,
  Divider,
  CircularProgress
} from '@mui/material';
import { 
  Event, 
  Message, 
  VideoCall, 
  Receipt,
  Schedule,
  Notifications,
  Settings as SettingsIcon
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const ClientDashboard: React.FC = () => {
  const { state } = useAuth();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(true);
  const [nextAppointment, setNextAppointment] = useState<any | null>(null);

  // Load appointments on mount and set up auto-refresh
  useEffect(() => {
    const loadAppointments = async () => {
      try {
        // TODO: Replace with actual API call
        // const response = await apiClient.get('/appointments/');
        // const allAppointments = response.data;
        
        // For now, show empty state
        const userAppointments: any[] = [];
      
        // Filter to upcoming appointments only
      const now = new Date();
      const upcoming = userAppointments.filter(apt => {
        const appointmentDate = new Date(`${apt.date}T${apt.time}`);
        return appointmentDate >= now && apt.status === 'scheduled';
      }).sort((a, b) => {
        const dateA = new Date(`${a.date}T${a.time}`);
        const dateB = new Date(`${b.date}T${b.time}`);
        return dateA.getTime() - dateB.getTime();
      });

      setAppointments(upcoming);
      setNextAppointment(upcoming[0] || null);
      setLoadingAppointments(false);
      } catch (error) {
        console.error('Failed to load appointments:', error);
        setAppointments([]);
        setNextAppointment(null);
        setLoadingAppointments(false);
      }
    };

    loadAppointments();

    // Refresh appointments every 30 seconds for realtime updates
    const intervalId = setInterval(loadAppointments, 30000);

    return () => clearInterval(intervalId);
  }, [state.user?.id, state.user?.firstName, state.user?.lastName]);

  // Format date/time for display
  const formatAppointmentTime = (date: string, time: string) => {
    const appointmentDate = new Date(`${date}T${time}`);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const isToday = appointmentDate.toDateString() === today.toDateString();
    const isTomorrow = appointmentDate.toDateString() === tomorrow.toDateString();

    const timeStr = appointmentDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    if (isToday) return `Today at ${timeStr}`;
    if (isTomorrow) return `Tomorrow at ${timeStr}`;
    
    return `${appointmentDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })} at ${timeStr}`;
  };

  return (
    <Box>
      {/* Welcome Section */}
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Avatar sx={{ width: 64, height: 64, bgcolor: 'primary.main', fontSize: '1.5rem' }}>
          {(state.user?.firstName || (state.user as any)?.first_name)?.charAt(0) || 'P'}
        </Avatar>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 0.5 }}>
            Welcome, {state.user ? `${state.user.firstName || (state.user as any)?.first_name || ''} ${state.user.lastName || (state.user as any)?.last_name || ''}`.trim() || 'Patient' : 'Patient'}!
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Your personal health portal - manage appointments, messages, and access care.
          </Typography>
        </Box>
      </Box>

      {/* Quick Actions Grid */}
      <Grid container spacing={3}>
        {/* Next Appointment */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Event color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">Next Appointment</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Your upcoming scheduled session
              </Typography>
              
              {loadingAppointments ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                  <CircularProgress size={24} />
                </Box>
              ) : nextAppointment ? (
                <Box>
                  <Chip 
                    icon={<Schedule />} 
                    label={formatAppointmentTime(nextAppointment.date, nextAppointment.time)}
                    color="success" 
                    variant="outlined"
                    sx={{ mb: 1 }}
                  />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {nextAppointment.type} with {nextAppointment.therapistName}
                  </Typography>
                  {appointments.length > 1 && (
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                      You have {appointments.length} upcoming appointments
                    </Typography>
                  )}
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No upcoming appointments scheduled
                </Typography>
              )}
            </CardContent>
            <CardActions>
              <Button 
                size="small" 
                onClick={() => navigate('/appointments')}
                startIcon={<Event />}
              >
                {appointments.length > 0 ? 'Manage Appointments' : 'Schedule Appointment'}
              </Button>
            </CardActions>
          </Card>
        </Grid>

        {/* Messages */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Message color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">Messages</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Communicate with your care team
              </Typography>
              <Chip 
                icon={<Notifications />} 
                label="2 unread messages" 
                color="warning" 
                variant="outlined" 
              />
            </CardContent>
            <CardActions>
              <Button 
                size="small" 
                onClick={() => navigate('/messages')}
                startIcon={<Message />}
              >
                Open Messages
              </Button>
            </CardActions>
          </Card>
        </Grid>

        {/* Telehealth */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <VideoCall color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">Telehealth</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Join virtual therapy sessions
              </Typography>
              <Chip 
                label="Ready for your session" 
                color="primary" 
                variant="outlined" 
              />
            </CardContent>
            <CardActions>
              <Button 
                size="small" 
                onClick={() => navigate('/telehealth')}
                startIcon={<VideoCall />}
              >
                Join Session
              </Button>
            </CardActions>
          </Card>
        </Grid>

        {/* Documents */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Receipt color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">My Documents</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Access treatment plans, forms, and records
              </Typography>
              <Chip 
                label="5 documents available" 
                color="info" 
                variant="outlined" 
              />
            </CardContent>
            <CardActions>
              <Button 
                size="small" 
                onClick={() => navigate('/client/documents')}
                startIcon={<Receipt />}
              >
                View Documents
              </Button>
            </CardActions>
          </Card>
        </Grid>

        {/* Settings */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <SettingsIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">Account Settings</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Manage your profile, notifications, and preferences
              </Typography>
              <Chip 
                label="Profile complete" 
                color="success" 
                variant="outlined" 
              />
            </CardContent>
            <CardActions>
              <Button 
                size="small" 
                onClick={() => navigate('/client/settings')}
                startIcon={<SettingsIcon />}
              >
                Manage Settings
              </Button>
            </CardActions>
          </Card>
        </Grid>

        {/* Billing */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Receipt color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">Billing & Insurance</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                View statements and manage payment methods
              </Typography>
              <Chip 
                label="Account current" 
                color="success" 
                variant="outlined" 
              />
            </CardContent>
            <CardActions>
              <Button 
                size="small" 
                onClick={() => navigate('/billing')}
                startIcon={<Receipt />}
              >
                View Billing
              </Button>
            </CardActions>
          </Card>
        </Grid>
      </Grid>

      <Divider sx={{ my: 4 }} />

      {/* Additional Information */}
      <Box>
        <Typography variant="h6" gutterBottom>
          Quick Tips for Your Care
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          • Use the Messages section to communicate with your therapist between sessions
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          • Join Telehealth sessions 5 minutes before your appointment time
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          • Review your documents regularly to stay informed about your treatment plan
        </Typography>
        <Typography variant="body2" color="text.secondary">
          • Contact our support team if you need technical assistance
        </Typography>
      </Box>
    </Box>
  );
};

export default ClientDashboard;