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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Badge
} from '@mui/material';
import { 
  Event, 
  Message, 
  VideoCall, 
  Assignment,
  People,
  Schedule,
  Notifications,
  Psychology,
  Edit,
  Today
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
// import { apiClient } from '../../services/apiClient';

const TherapistDashboard: React.FC = () => {
  const { state } = useAuth();
  const navigate = useNavigate();
  
  const [todayAppointments, setTodayAppointments] = useState<any[]>([]);
  const [recentMessages, setRecentMessages] = useState<any[]>([]);
  const [stats, setStats] = useState({
    todayAppointments: 0,
    activePatients: 0,
    unreadMessages: 0,
    pendingSoapNotes: 0
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // TODO: Replace with actual API endpoints
      // const appointmentsRes = await apiClient.get('/appointments/?today=true');
      // const patientsRes = await apiClient.get('/patients/?status=active');
      // const messagesRes = await apiClient.get('/messages/?unread=true');
      // const soapNotesRes = await apiClient.get('/soap-notes/?status=pending');
      
      // setTodayAppointments(appointmentsRes.data);
      // setStats({
      //   todayAppointments: appointmentsRes.data.length,
      //   activePatients: patientsRes.data.length,
      //   unreadMessages: messagesRes.data.length,
      //   pendingSoapNotes: soapNotesRes.data.length
      // });
      
      setTodayAppointments([]);
      setRecentMessages([]);
      setStats({
        todayAppointments: 0,
        activePatients: 0,
        unreadMessages: 0,
        pendingSoapNotes: 0
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'success';
      case 'pending': return 'warning';
      case 'cancelled': return 'error';
      default: return 'default';
    }
  };

  return (
    <Box>
      {/* Welcome Section */}
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Avatar sx={{ width: 64, height: 64, bgcolor: 'primary.main', fontSize: '1.5rem' }}>
          <Psychology />
        </Avatar>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 0.5 }}>
            Welcome, Dr. {state.user?.lastName || (state.user as any)?.last_name || 'Therapist'}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage your patients, appointments, and clinical notes efficiently.
          </Typography>
        </Box>
      </Box>

      {/* Quick Stats */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Today color="primary" sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h4" color="primary">
                {stats.todayAppointments}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Today's Appointments
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <People color="info" sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h4" color="info.main">
                {stats.activePatients}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Active Patients
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Badge badgeContent={stats.unreadMessages} color="error">
                <Message color="warning" sx={{ fontSize: 40, mb: 1 }} />
              </Badge>
              <Typography variant="h4" color="warning.main">
                {stats.unreadMessages}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Unread Messages
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Assignment color="success" sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h4" color="success.main">
                {stats.pendingSoapNotes}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Pending SOAP Notes
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Today's Schedule */}
        <Grid item xs={12} lg={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Schedule color="primary" />
                Today's Schedule
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Time</TableCell>
                      <TableCell>Patient</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {todayAppointments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} align="center">
                          <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                            No appointments scheduled for today
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      todayAppointments.map((appointment) => (
                        <TableRow key={appointment.id}>
                          <TableCell>{appointment.time}</TableCell>
                          <TableCell>{appointment.patient}</TableCell>
                          <TableCell>{appointment.type}</TableCell>
                          <TableCell>
                            <Chip 
                              label={appointment.status} 
                              color={getStatusColor(appointment.status) as any}
                              size="small"
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell align="center">
                            <IconButton size="small" color="primary">
                              <Edit />
                            </IconButton>
                            <IconButton size="small" color="success">
                              <VideoCall />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
            <CardActions>
              <Button 
                size="small" 
                onClick={() => navigate('/appointments')}
                startIcon={<Event />}
              >
                View Full Schedule
              </Button>
            </CardActions>
          </Card>
        </Grid>

        {/* Quick Actions & Messages */}
        <Grid item xs={12} lg={4}>
          {/* Quick Actions */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Quick Actions
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Button
                    variant="outlined"
                    fullWidth
                    startIcon={<People />}
                    onClick={() => navigate('/therapist/patients')}
                  >
                    Manage Patients
                  </Button>
                </Grid>
                <Grid item xs={12}>
                  <Button
                    variant="outlined"
                    fullWidth
                    startIcon={<Assignment />}
                    onClick={() => navigate('/therapist/soap-notes')}
                  >
                    SOAP Notes
                  </Button>
                </Grid>
                <Grid item xs={12}>
                  <Button
                    variant="outlined"
                    fullWidth
                    startIcon={<VideoCall />}
                    onClick={() => navigate('/telehealth')}
                  >
                    Start Session
                  </Button>
                </Grid>
                <Grid item xs={12}>
                  <Button
                    variant="outlined"
                    fullWidth
                    startIcon={<Event />}
                    onClick={() => navigate('/appointments')}
                  >
                    New Appointment
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Recent Messages */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Message color="primary" />
                Recent Messages
              </Typography>
              <Box>
                {recentMessages.map((message) => (
                  <Box key={message.id} sx={{ mb: 2, p: 1, bgcolor: message.unread ? 'action.hover' : 'transparent', borderRadius: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: message.unread ? 'bold' : 'normal' }}>
                          {message.from}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" noWrap>
                          {message.subject}
                        </Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        {message.time}
                      </Typography>
                    </Box>
                    {message.unread && (
                      <Chip size="small" label="New" color="primary" sx={{ mt: 0.5 }} />
                    )}
                  </Box>
                ))}
              </Box>
            </CardContent>
            <CardActions>
              <Button 
                size="small" 
                onClick={() => navigate('/messages')}
                startIcon={<Message />}
              >
                View All Messages
              </Button>
            </CardActions>
          </Card>
        </Grid>
      </Grid>

      <Divider sx={{ my: 4 }} />

      {/* Clinical Reminders */}
      <Box>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Notifications color="warning" />
          Clinical Reminders
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" color="warning.main">
                  SOAP Notes Pending
                </Typography>
                <Typography variant="body2">
                  3 sessions require documentation completion
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" color="info.main">
                  Treatment Plans Review
                </Typography>
                <Typography variant="body2">
                  2 patients due for plan updates this week
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" color="success.main">
                  Continuing Education
                </Typography>
                <Typography variant="body2">
                  Next CEU deadline: March 15, 2025
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
};

export default TherapistDashboard;