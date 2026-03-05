import React, { useState, useEffect } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Divider,
  Button,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  IconButton,
  Avatar,
  Badge,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Snackbar,
  Alert,
} from '@mui/material';
import {
  TrendingUp,
  People,
  Event,
  AttachMoney,
  Warning,
  Analytics,
  Security,
  Settings,
  CloudUpload,
  PersonAdd,
  Assessment,
  Notifications,
  Schedule,
  Receipt,
  Message,
  AdminPanelSettings,
  Visibility,
  Edit,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../services/apiClient';

const AdminDashboard: React.FC = () => {
  const { state } = useAuth();
  const navigate = useNavigate();
  
  // Dialog state
  const [openDialog, setOpenDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  
  // Form state
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    password_confirm: '',
    first_name: '',
    last_name: '',
    role: 'client' as 'client' | 'staff' | 'therapist',
    phone_number: '',
  });
  
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Mock data - would come from API in real implementation
  const dashboardStats = {
    totalPatients: 1247,
    activeTherapists: 23,
    appointmentsToday: 67,
    monthlyRevenue: 125430,
    pendingClaims: 15,
    unreadMessages: 8,
    systemUptime: '99.8%',
    dataBackupStatus: 'Completed 2 hours ago',
    licenseExpirations: 3,
    securityAlerts: 2,
  };

  const recentActivity = [
    { id: 1, type: 'patient_registered', message: 'New patient registration: Sarah Johnson', time: '2 hours ago', icon: <PersonAdd color="success" /> },
    { id: 2, type: 'appointment_scheduled', message: 'Appointment scheduled with Dr. Smith', time: '3 hours ago', icon: <Schedule color="primary" /> },
    { id: 3, type: 'claim_processed', message: 'Insurance claim #12345 processed', time: '5 hours ago', icon: <Receipt color="info" /> },
    { id: 4, type: 'billing_alert', message: 'Payment overdue: Invoice #INV-001', time: '1 day ago', icon: <Warning color="warning" /> },
    { id: 5, type: 'user_login', message: 'Dr. Martinez logged in', time: '1 day ago', icon: <Security color="info" /> },
  ];

  const alerts = [
    { id: 1, severity: 'warning', message: '15 insurance claims pending review', action: 'Review Claims' },
    { id: 2, severity: 'info', message: '3 therapist licenses expiring this month', action: 'View Licenses' },
    { id: 3, severity: 'error', message: '2 failed payment transactions require attention', action: 'View Payments' },
    { id: 4, severity: 'warning', message: 'System backup due in 2 days', action: 'Configure Backup' },
  ];

  // Load real users from API
  const [recentUsers, setRecentUsers] = useState<any[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);

  // Load users from backend
  useEffect(() => {
    const loadUsers = async () => {
      try {
        setIsLoadingUsers(true);
        console.log('Loading users for admin dashboard...');
        const response = await apiClient.get('/auth/');
        console.log('Users API response:', response.data);
        
        const users = (response.data.results || response.data).map((user: any) => ({
          id: user.id,
          name: user.full_name || user.username || 'Unknown User',
          role: user.role === 'admin' ? 'Admin' : user.role === 'therapist' ? 'Therapist' : user.role === 'client' ? 'Patient' : 'Staff',
          status: user.is_online ? 'Online' : 'Offline',
          avatar: (user.full_name || user.username || 'U').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2),
          lastActive: user.last_login ? new Date(user.last_login).toLocaleString() : 'Never',
        }));
        
        console.log('Loaded users:', users);
        setRecentUsers(users);
      } catch (error) {
        console.error('Failed to load users:', error);
        setRecentUsers([]);
      } finally {
        setIsLoadingUsers(false);
      }
    };

    loadUsers();
  }, []);

  return (
    <Box>
      {/* Header Section */}
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Avatar sx={{ width: 64, height: 64, bgcolor: 'error.main', fontSize: '1.5rem' }}>
          <AdminPanelSettings fontSize="large" />
        </Avatar>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 0.5 }}>
            Admin Dashboard
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Welcome, {state.user?.firstName || (state.user as any)?.first_name || 'Administrator'}! Manage your SafeHaven EHR system efficiently.
          </Typography>
        </Box>
      </Box>

      {/* System Overview Stats */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <People color="primary" sx={{ mr: 1 }} />
                <Typography color="text.secondary" gutterBottom>
                  Total Patients
                </Typography>
              </Box>
              <Typography variant="h4" component="div">
                {dashboardStats.totalPatients.toLocaleString()}
              </Typography>
              <Box display="flex" alignItems="center" mt={1}>
                <TrendingUp color="success" fontSize="small" sx={{ mr: 0.5 }} />
                <Typography variant="body2" color="success.main">
                  +12% this month
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <Event color="primary" sx={{ mr: 1 }} />
                <Typography color="text.secondary" gutterBottom>
                  Appointments Today
                </Typography>
              </Box>
              <Typography variant="h4" component="div">
                {dashboardStats.appointmentsToday}
              </Typography>
              <LinearProgress 
                variant="determinate" 
                value={(dashboardStats.appointmentsToday / 80) * 100} 
                sx={{ mt: 1 }}
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <AttachMoney color="primary" sx={{ mr: 1 }} />
                <Typography color="text.secondary" gutterBottom>
                  Monthly Revenue
                </Typography>
              </Box>
              <Typography variant="h4" component="div">
                ${dashboardStats.monthlyRevenue.toLocaleString()}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {dashboardStats.pendingClaims} claims pending
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <People color="primary" sx={{ mr: 1 }} />
                <Typography color="text.secondary" gutterBottom>
                  Active Staff
                </Typography>
              </Box>
              <Typography variant="h4" component="div">
                {dashboardStats.activeTherapists}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Therapists & Staff
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* System Health Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Analytics color="info" sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h4" color="info.main">
                {dashboardStats.systemUptime}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                System Uptime
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <CloudUpload color="success" sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h6" color="success.main">
                Completed
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {dashboardStats.dataBackupStatus}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Badge badgeContent={dashboardStats.licenseExpirations} color="warning">
                <Assessment color="warning" sx={{ fontSize: 40, mb: 1 }} />
              </Badge>
              <Typography variant="h4" color="warning.main">
                {dashboardStats.licenseExpirations}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                License Expiring
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Badge badgeContent={dashboardStats.securityAlerts} color="error">
                <Security color="error" sx={{ fontSize: 40, mb: 1 }} />
              </Badge>
              <Typography variant="h4" color="error.main">
                {dashboardStats.securityAlerts}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Security Alerts
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* System Alerts */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6" component="h2">
                  System Alerts
                </Typography>
                <Badge badgeContent={alerts.length} color="error">
                  <Notifications color="warning" />
                </Badge>
              </Box>
              <List>
                {alerts.map((alert, index) => (
                  <React.Fragment key={alert.id}>
                    <ListItem sx={{ px: 0, alignItems: 'flex-start' }}>
                      <ListItemText
                        primary={
                          <Box display="flex" alignItems="center" justifyContent="space-between">
                            <Box display="flex" alignItems="center">
                              <Chip 
                                label={alert.severity} 
                                color={alert.severity === 'error' ? 'error' : alert.severity === 'warning' ? 'warning' : 'info'}
                                size="small" 
                                sx={{ mr: 1 }} 
                              />
                              <Typography variant="body2">
                                {alert.message}
                              </Typography>
                            </Box>
                            <Button size="small" variant="text" color="primary">
                              {alert.action}
                            </Button>
                          </Box>
                        }
                      />
                    </ListItem>
                    {index < alerts.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
              <Box mt={2}>
                <Button variant="outlined" size="small">
                  View All Alerts
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Activity */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" component="h2" gutterBottom>
                Recent System Activity
              </Typography>
              <List>
                {recentActivity.map((activity, index) => (
                  <React.Fragment key={activity.id}>
                    <ListItem sx={{ px: 0 }}>
                      <Box sx={{ mr: 2, display: 'flex', alignItems: 'center' }}>
                        {activity.icon}
                      </Box>
                      <ListItemText
                        primary={activity.message}
                        secondary={activity.time}
                      />
                    </ListItem>
                    {index < recentActivity.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
              <Box mt={2}>
                <Button variant="outlined" size="small">
                  View Activity Log
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* User Management Section */}
      <Grid container spacing={3} sx={{ mt: 2 }}>
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6" component="h2">
                  Recent User Activity
                </Typography>
                <Button 
                  variant="outlined" 
                  startIcon={<Visibility />}
                  onClick={() => navigate('/admin/patients')}
                >
                  View All Users
                </Button>
              </Box>
              <Paper>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>User</TableCell>
                      <TableCell>Role</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Last Active</TableCell>
                      <TableCell align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {isLoadingUsers ? (
                      <TableRow>
                        <TableCell colSpan={5} align="center">
                          <CircularProgress size={24} />
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            Loading users...
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : recentUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} align="center">
                          <Typography variant="body2" color="text.secondary">
                            No users found
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      recentUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <Box display="flex" alignItems="center" gap={2}>
                            <Avatar sx={{ bgcolor: 'primary.main' }}>
                              {user.avatar}
                            </Avatar>
                            <Typography variant="subtitle2">
                              {user.name}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={user.role} 
                            size="small"
                            color={user.role === 'Admin' ? 'error' : user.role === 'Therapist' ? 'primary' : 'default'}
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={user.status}
                            size="small"
                            color={user.status === 'Online' ? 'success' : user.status === 'Away' ? 'warning' : 'default'}
                          />
                        </TableCell>
                        <TableCell>{user.lastActive}</TableCell>
                        <TableCell align="center">
                          <IconButton 
                            size="small" 
                            color="primary"
                            onClick={() => navigate(`/admin/patients`)}
                            title="View Details"
                          >
                            <Visibility />
                          </IconButton>
                          <IconButton 
                            size="small" 
                            color="info"
                            onClick={() => {
                              // Edit user - you can implement a dialog or navigate to edit page
                              console.log('Edit user:', user);
                              // For now, navigate to user management
                              navigate('/admin/patients');
                            }}
                            title="Edit User"
                          >
                            <Edit />
                          </IconButton>
                          <IconButton 
                            size="small" 
                            color="success"
                            onClick={() => navigate('/messages')}
                            title="Send Message"
                          >
                            <Message />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                    )}
                  </TableBody>
                </Table>
              </Paper>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Management Quick Actions */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" component="h2" gutterBottom>
            Administrative Quick Actions
          </Typography>
          <Grid container spacing={3}>
            {/* User Management */}
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1" gutterBottom color="primary">
                User Management
              </Typography>
              <Grid container spacing={1}>
                <Grid item xs={12} sm={6}>
                  <Button 
                    variant="contained" 
                    color="primary" 
                    fullWidth
                    startIcon={<PersonAdd />}
                    onClick={() => setOpenDialog(true)}
                  >
                    Add New User
                  </Button>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Button 
                    variant="outlined" 
                    fullWidth
                    startIcon={<People />}
                    onClick={() => navigate('/admin/patients')}
                  >
                    Manage Users
                  </Button>
                </Grid>
              </Grid>
            </Grid>

            {/* Appointment Management */}
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1" gutterBottom color="primary">
                Appointment Management
              </Typography>
              <Grid container spacing={1}>
                <Grid item xs={12} sm={6}>
                  <Button 
                    variant="outlined" 
                    fullWidth
                    startIcon={<Schedule />}
                    onClick={() => navigate('/admin/appointments')}
                  >
                    Schedule Appointments
                  </Button>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Button 
                    variant="outlined" 
                    fullWidth
                    startIcon={<Event />}
                    onClick={() => navigate('/admin/appointments')}
                  >
                    View Calendar
                  </Button>
                </Grid>
              </Grid>
            </Grid>

            {/* System Management */}
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1" gutterBottom color="primary">
                System Management
              </Typography>
              <Grid container spacing={1}>
                <Grid item xs={12} sm={6}>
                  <Button 
                    variant="outlined" 
                    fullWidth
                    startIcon={<Settings />}
                  >
                    System Settings
                  </Button>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Button 
                    variant="outlined" 
                    fullWidth
                    startIcon={<CloudUpload />}
                  >
                    Backup Data
                  </Button>
                </Grid>
              </Grid>
            </Grid>

            {/* Reports & Analytics */}
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1" gutterBottom color="primary">
                Reports & Analytics
              </Typography>
              <Grid container spacing={1}>
                <Grid item xs={12} sm={6}>
                  <Button 
                    variant="outlined" 
                    fullWidth
                    startIcon={<Assessment />}
                    onClick={() => navigate('/admin/reports')}
                  >
                    Generate Report
                  </Button>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Button 
                    variant="outlined" 
                    fullWidth
                    startIcon={<Analytics />}
                  >
                    View Analytics
                  </Button>
                </Grid>
              </Grid>
            </Grid>

            {/* Financial Management */}
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1" gutterBottom color="primary">
                Financial Management
              </Typography>
              <Grid container spacing={1}>
                <Grid item xs={12} sm={6}>
                  <Button 
                    variant="outlined" 
                    fullWidth
                    startIcon={<Receipt />}
                    onClick={() => navigate('/admin/billing')}
                  >
                    Billing Overview
                  </Button>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Button 
                    variant="outlined" 
                    fullWidth
                    startIcon={<AttachMoney />}
                  >
                    Revenue Reports
                  </Button>
                </Grid>
              </Grid>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Add User Dialog */}
      <Dialog open={openDialog} onClose={() => !isLoading && setOpenDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Add New User</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="First Name"
                  value={formData.first_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                  error={!!formErrors.first_name}
                  helperText={formErrors.first_name}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Last Name"
                  value={formData.last_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                  error={!!formErrors.last_name}
                  helperText={formErrors.last_name}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Username"
                  value={formData.username}
                  onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                  error={!!formErrors.username}
                  helperText={formErrors.username}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  error={!!formErrors.email}
                  helperText={formErrors.email}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Phone Number"
                  value={formData.phone_number}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone_number: e.target.value }))}
                  error={!!formErrors.phone_number}
                  helperText={formErrors.phone_number}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth required error={!!formErrors.role}>
                  <InputLabel>Role</InputLabel>
                  <Select
                    value={formData.role}
                    label="Role"
                    onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as any }))}
                  >
                    <MenuItem value="client">Patient</MenuItem>
                    <MenuItem value="therapist">Therapist</MenuItem>
                    <MenuItem value="staff">Staff</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  error={!!formErrors.password}
                  helperText={formErrors.password}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Confirm Password"
                  type="password"
                  value={formData.password_confirm}
                  onChange={(e) => setFormData(prev => ({ ...prev, password_confirm: e.target.value }))}
                  error={!!formErrors.password_confirm}
                  helperText={formErrors.password_confirm}
                  required
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={async () => {
              try {
                setIsLoading(true);
                setFormErrors({});
                
                // Validate
                const errors: Record<string, string> = {};
                if (!formData.first_name.trim()) errors.first_name = 'Required';
                if (!formData.last_name.trim()) errors.last_name = 'Required';
                if (!formData.username.trim()) errors.username = 'Required';
                if (!formData.email.trim()) errors.email = 'Required';
                if (!formData.password) errors.password = 'Required';
                if (formData.password !== formData.password_confirm) errors.password_confirm = 'Passwords do not match';
                
                if (Object.keys(errors).length > 0) {
                  setFormErrors(errors);
                  setIsLoading(false);
                  return;
                }
                
// Create user - map phone_number to phone for backend
                const { phone_number, ...userDataWithoutPhone } = formData;
                const userData = {
                  ...userDataWithoutPhone,
                  phone: phone_number || ''
                };
                
                console.log('Sending user data:', userData);
                
                const response = await apiClient.post('/auth/register/', userData);
                console.log('User created:', response.data);
                
                // Reload users list after successful creation
                const usersResponse = await apiClient.get('/auth/');
                const users = (usersResponse.data.results || usersResponse.data).map((user: any) => ({
                  id: user.id,
                  name: user.full_name || user.username || 'Unknown User',
                  role: user.role === 'admin' ? 'Admin' : user.role === 'therapist' ? 'Therapist' : user.role === 'client' ? 'Patient' : 'Staff',
                  status: user.is_online ? 'Online' : 'Offline',
                  avatar: (user.full_name || user.username || 'U').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2),
                  lastActive: user.last_login ? new Date(user.last_login).toLocaleString() : 'Never',
                }));
                setRecentUsers(users);
                
                setSnackbar({ open: true, message: 'User created successfully!', severity: 'success' });
                setOpenDialog(false);
                setFormData({
                  username: '',
                  email: '',
                  password: '',
                  password_confirm: '',
                  first_name: '',
                  last_name: '',
                  role: 'client',
                  phone_number: '',
                });
              } catch (error: any) {
                console.error('Failed to create user:', error);
                console.error('Error response:', error.response?.data);
                
                // Handle validation errors from backend
                if (error.response?.data) {
                  const backendErrors = error.response.data;
                  const formattedErrors: Record<string, string> = {};
                  
                  // Format backend errors for display
                  Object.keys(backendErrors).forEach(key => {
                    const errorValue = backendErrors[key];
                    if (Array.isArray(errorValue)) {
                      formattedErrors[key] = errorValue[0];
                    } else if (typeof errorValue === 'string') {
                      formattedErrors[key] = errorValue;
                    }
                  });
                  
                  setFormErrors(formattedErrors);
                }
                
                const errorMsg = error.response?.data?.message || error.message || 'Failed to create user';
                setSnackbar({ open: true, message: errorMsg, severity: 'error' });
              } finally {
                setIsLoading(false);
              }
            }}
            disabled={isLoading}
            startIcon={isLoading ? <CircularProgress size={20} /> : <PersonAdd />}
          >
            {isLoading ? 'Creating...' : 'Create User'}
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

export default AdminDashboard;