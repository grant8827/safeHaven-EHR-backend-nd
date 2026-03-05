import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  Badge,
  Menu,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  PersonAdd as PersonAddIcon,
  Settings as SettingsIcon,
  Assessment as ReportsIcon,
  AttachMoney as BillingIcon,
  SecurityOutlined as SecurityIcon,
  Notifications as NotificationsIcon,
  Edit as EditIcon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
  MoreVert as MoreIcon,
  TrendingUp,
  TrendingDown,
  Warning,
  CheckCircle,
  Schedule,
  Group,
  Delete as DeleteIcon,
  Block as BlockIcon,
} from '@mui/icons-material';
import { User, Patient, Appointment } from '../types';
import ReportsSection from '../components/Reports/ReportsSection';
import { apiClient } from '../services/apiClient';
// import { authService } from '../../services/authService_new';

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalPatients: number;
  activePatients: number;
  todayAppointments: number;
  pendingAppointments: number;
  totalRevenue: number;
  monthlyRevenue: number;
  systemAlerts: number;
  failedLogins: number;
  activeStaff?: number;
}

interface SystemAlert {
  id: string;
  type: 'warning' | 'error' | 'success' | 'info';
  title: string;
  description: string;
  timestamp: string;
}

interface ActivityLog {
  id: string;
  type: 'user' | 'patient' | 'appointment' | 'system';
  action: string;
  description: string;
  timestamp: string;
  user?: string;
}

interface AdminDashboardProps {
  user: User;
}

interface UserUpdateData {
  first_name?: string;
  last_name?: string;
  email?: string;
  username?: string;
  password?: string;
  password_confirm?: string;
  role?: string;
  phone_number?: string;
  is_active?: boolean;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ user: _user }) => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [_users, _setUsers] = useState<User[]>([]);
  const [_patients, _setPatients] = useState<Patient[]>([]);
  const [_appointments, _setAppointments] = useState<Appointment[]>([]);
  const [_selectedUser, _setSelectedUser] = useState<User | null>(null);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editUserData, setEditUserData] = useState<UserUpdateData>({});
  const [systemAlerts, setSystemAlerts] = useState<SystemAlert[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityLog[]>([]);
  const [userMenuAnchorEl, setUserMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedMenuUserId, setSelectedMenuUserId] = useState<string | null>(null);

  // Load dashboard data
  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch real data from API
      const usersRes = await apiClient.get('/auth/');
      const patientsRes = await apiClient.get('/patients/');
      
      // Handle both paginated and non-paginated responses
      const allUsers = Array.isArray(usersRes.data) ? usersRes.data : (usersRes.data?.results || []);
      const allPatients = Array.isArray(patientsRes.data) ? patientsRes.data : (patientsRes.data?.results || []);
      
      console.log('Users from API:', allUsers);
      console.log('Patients from API:', allPatients);
      
      // Calculate stats from real data
      const activeUsers = allUsers.filter((u: any) => u.is_active === true).length;
      const activePatients = allPatients.filter((p: any) => p.status === 'active').length;
      const activeStaff = allUsers.filter((u: any) => 
        u.is_active === true && (u.role === 'therapist' || u.role === 'staff')
      ).length;
      
      console.log('Active staff count:', activeStaff);
      console.log('Staff breakdown:', {
        therapists: allUsers.filter((u: any) => u.is_active && u.role === 'therapist').length,
        staff: allUsers.filter((u: any) => u.is_active && u.role === 'staff').length,
      });
      
      // Get today's date for filtering appointments
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      // Note: Appointments endpoint may not be fully implemented yet
      let todayAppointments = 0;
      let pendingAppointments = 0;
      try {
        const appointmentsRes = await apiClient.get('/appointments/');
        const allAppointments = Array.isArray(appointmentsRes.data) 
          ? appointmentsRes.data 
          : (appointmentsRes.data?.results || []);
        
        console.log('Appointments from API:', allAppointments);
        
        todayAppointments = allAppointments.filter((apt: any) => {
          const aptDate = new Date(apt.start_datetime);
          return aptDate >= today && aptDate < tomorrow;
        }).length;
        
        pendingAppointments = allAppointments.filter((apt: any) => 
          apt.status === 'scheduled' || apt.status === 'confirmed'
        ).length;
      } catch (aptErr) {
        console.warn('Appointments endpoint not available:', aptErr);
      }
      
      const dashboardStats: DashboardStats = {
        totalUsers: allUsers.length,
        activeUsers: activeUsers,
        totalPatients: allPatients.length,
        activePatients: activePatients,
        todayAppointments: todayAppointments,
        pendingAppointments: pendingAppointments,
        totalRevenue: 0, // No revenue data yet
        monthlyRevenue: 0, // No revenue data yet
        systemAlerts: 0, // No alerts yet
        failedLogins: 0, // No failed logins tracked yet
        activeStaff: activeStaff,
      };

      console.log('Dashboard stats calculated:', dashboardStats);

      setStats(dashboardStats);
      setSystemAlerts([]);
      
      // Mock recent activity data for testing
      const mockActivity: ActivityLog[] = [
        {
          id: '1',
          type: 'user',
          action: 'New user registered',
          description: 'Toni Grant registered as therapist',
          timestamp: new Date().toISOString(),
          user: 'System'
        },
        {
          id: '2',
          type: 'patient',
          action: 'Patient record updated',
          description: 'Medical history updated for patient',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          user: 'Dr. Grant'
        },
        {
          id: '3',
          type: 'appointment',
          action: 'Appointment scheduled',
          description: 'New appointment created for tomorrow',
          timestamp: new Date(Date.now() - 7200000).toISOString(),
          user: 'Reception'
        },
        {
          id: '4',
          type: 'system',
          action: 'Security update',
          description: 'Password policy updated',
          timestamp: new Date(Date.now() - 86400000).toISOString(),
          user: 'Admin'
        }
      ];
      setRecentActivity(mockActivity);

      // Load recent users, patients, appointments for display
      _setUsers(allUsers.slice(0, 10));
      _setPatients(allPatients.slice(0, 10));
      _setAppointments([]);
    } catch (err: any) {
      console.error('Error loading dashboard data:', err);
      setError(err.response?.data?.detail || err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveUser = async () => {
    try {
      console.log('Current logged in user:', _user);
      console.log('User being edited:', _selectedUser);
      
      if (_selectedUser) {
        // Update existing user - include all editable fields
        const updateData: any = {};
        
        // Only include fields that have actually changed
        if (editUserData.first_name !== undefined) updateData.first_name = editUserData.first_name;
        if (editUserData.last_name !== undefined) updateData.last_name = editUserData.last_name;
        if (editUserData.email !== undefined) updateData.email = editUserData.email;
        if (editUserData.role !== undefined) updateData.role = editUserData.role;
        if (editUserData.is_active !== undefined) updateData.is_active = editUserData.is_active;
        if (editUserData.phone_number !== undefined) updateData.phone_number = editUserData.phone_number;
        
        console.log('Updating user with data:', updateData);
        
        // Use PATCH for partial update
        await apiClient.patch(`/auth/${_selectedUser.id}/`, updateData);
      } else {
        // Create new user - validate passwords match
        if (editUserData.password !== editUserData.password_confirm) {
          setError('Passwords do not match');
          return;
        }
        
        // Prepare data for registration - backend expects 'phone' not 'phone_number'
        const createData = {
          username: editUserData.username,
          email: editUserData.email,
          password: editUserData.password,
          password_confirm: editUserData.password_confirm,
          first_name: editUserData.first_name || '',
          last_name: editUserData.last_name || '',
          role: editUserData.role || 'client',
          phone: editUserData.phone_number || '',
        };
        
        console.log('Creating user with data:', createData);
        await apiClient.post('/auth/register/', createData);
      }
      setUserDialogOpen(false);
      _setSelectedUser(null);
      setEditUserData({});
      await loadDashboardData();
    } catch (err: any) {
      console.error('Save user error:', err);
      console.error('Error response:', err.response);
      console.error('Error data:', err.response?.data);
      
      // Show specific error message to user
      if (err.response?.status === 403) {
        setError('Permission denied: You do not have permission to edit this user.');
      } else if (err.response?.data) {
        const errorMsg = typeof err.response.data === 'string' 
          ? err.response.data 
          : JSON.stringify(err.response.data);
        setError(`Failed to save user: ${errorMsg}`);
      } else {
        setError('Failed to save user. Please try again.');
      }
      
      // Better error message formatting
      let errorMsg = 'Failed to save user';
      if (err.response?.data) {
        const data = err.response.data;
        if (typeof data === 'object') {
          // Format validation errors
          const errors = Object.entries(data)
            .map(([field, messages]: [string, any]) => {
              const msgArray = Array.isArray(messages) ? messages : [messages];
              return `${field}: ${msgArray.join(', ')}`;
            })
            .join('\n');
          errorMsg = errors || JSON.stringify(data);
        } else {
          errorMsg = data.detail || data.error || String(data);
        }
      }
      setError(errorMsg);
    }
  };

  const handleUserAction = async (action: string, userId: string) => {
    try {
      switch (action) {
        case 'edit':
          // Admin can edit any user - navigate to admin settings with userId parameter
          navigate(`/admin/settings?userId=${userId}`);
          break;
        case 'lock':
          // Suspend user account (prevent login)
          if (window.confirm('Are you sure you want to suspend this user account?')) {
            await apiClient.patch(`/auth/${userId}/`, { is_active: false });
            await loadDashboardData();
          }
          break;
        case 'unlock':
          // Unsuspend user account (allow login)
          await apiClient.patch(`/auth/${userId}/`, { is_active: true });
          await loadDashboardData();
          break;
        case 'delete':
          // Soft delete - remove from view but keep in database
          if (window.confirm('Are you sure you want to delete this user? They will be removed from the list but data will be preserved.')) {
            await apiClient.delete(`/auth/${userId}/`);
            await loadDashboardData();
          }
          break;
      }
    } catch (err: any) {
      console.error('Action error:', err);
      setError(err.response?.data?.detail || err.message || 'Action failed');
    }
  };

  const StatsCard: React.FC<{
    title: string;
    value: number | string;
    trend?: 'up' | 'down';
    trendValue?: string;
    color?: 'primary' | 'secondary' | 'error' | 'warning' | 'success' | 'info';
    icon: React.ReactNode;
  }> = ({ title, value, trend, trendValue, color = 'primary', icon }) => (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Avatar sx={{ bgcolor: `${color}.main`, mr: 2 }}>
            {icon}
          </Avatar>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6" component="div">
              {title}
            </Typography>
            <Typography variant="h4" color={`${color}.main`}>
              {typeof value === 'number' ? value.toLocaleString() : value}
            </Typography>
          </Box>
        </Box>
        {trend && trendValue && (
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {trend === 'up' ? (
              <TrendingUp color="success" fontSize="small" />
            ) : (
              <TrendingDown color="error" fontSize="small" />
            )}
            <Typography
              variant="body2"
              color={trend === 'up' ? 'success.main' : 'error.main'}
              sx={{ ml: 0.5 }}
            >
              {trendValue}
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );

  const DashboardOverview = () => (
    <Box>
      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={6} sm={6} md={3}>
          <StatsCard
            title="Total Users"
            value={stats?.totalUsers || 0}
            color="primary"
            icon={<PeopleIcon />}
          />
        </Grid>
        <Grid item xs={6} sm={6} md={3}>
          <StatsCard
            title="Active Patients"
            value={stats?.activePatients || 0}
            color="success"
            icon={<Group />}
          />
        </Grid>
        <Grid item xs={6} sm={6} md={3}>
          <StatsCard
            title="Today's Appointments"
            value={stats?.todayAppointments || 0}
            color="warning"
            icon={<Schedule />}
          />
        </Grid>
        <Grid item xs={6} sm={6} md={3}>
          <StatsCard
            title="Monthly Revenue"
            value={`$${(stats?.monthlyRevenue || 0).toLocaleString()}`}
            color="success"
            icon={<BillingIcon />}
          />
        </Grid>
      </Grid>

      {/* Secondary Stats */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={6} sm={6} md={3}>
          <StatsCard
            title="Active Staff"
            value={stats?.activeStaff || 0}
            color="info"
            icon={<PeopleIcon />}
          />
        </Grid>
        <Grid item xs={6} sm={6} md={3}>
          <StatsCard
            title="Total Revenue"
            value={`$${(stats?.totalRevenue || 0).toLocaleString()}`}
            color="success"
            icon={<BillingIcon />}
          />
        </Grid>
        <Grid item xs={6} sm={6} md={3}>
          <StatsCard
            title="System Alerts"
            value={stats?.systemAlerts || 0}
            color="error"
            icon={<NotificationsIcon />}
          />
        </Grid>
        <Grid item xs={6} sm={6} md={3}>
          <StatsCard
            title="Pending Appointments"
            value={stats?.pendingAppointments || 0}
            color="warning"
            icon={<Schedule />}
          />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* System Alerts */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: { xs: 'auto', md: '400px' } }}>
            <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
              <NotificationsIcon sx={{ mr: 1 }} />
              System Alerts
              <Badge badgeContent={stats?.systemAlerts || 0} color="error" sx={{ ml: 2 }}>
                <Box />
              </Badge>
            </Typography>
            {systemAlerts.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                No active alerts
              </Typography>
            ) : (
              isMobile ? (
                <Box sx={{ display: 'grid', gap: 1.5 }}>
                  {systemAlerts.map((alert) => (
                    <Card key={alert.id} variant="outlined">
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          {alert.type === 'error' && <SecurityIcon color="error" />}
                          {alert.type === 'warning' && <Warning color="warning" />}
                          {alert.type === 'success' && <CheckCircle color="success" />}
                          {alert.type === 'info' && <NotificationsIcon color="info" />}
                          <Typography variant="subtitle2">{alert.title}</Typography>
                        </Box>
                        <Typography variant="body2" color="text.secondary">{alert.description}</Typography>
                      </CardContent>
                    </Card>
                  ))}
                </Box>
              ) : (
                <List>
                  {systemAlerts.map((alert) => (
                    <ListItem key={alert.id}>
                      <ListItemIcon>
                        {alert.type === 'error' && <SecurityIcon color="error" />}
                        {alert.type === 'warning' && <Warning color="warning" />}
                        {alert.type === 'success' && <CheckCircle color="success" />}
                        {alert.type === 'info' && <NotificationsIcon color="info" />}
                      </ListItemIcon>
                      <ListItemText
                        primary={alert.title}
                        secondary={alert.description}
                      />
                    </ListItem>
                  ))}
                </List>
              )
            )}
          </Paper>
        </Grid>

        {/* Recent Activity */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: { xs: 'auto', md: '400px' } }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Recent Activity
            </Typography>
            {recentActivity.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                No recent activity
              </Typography>
            ) : (
              isMobile ? (
                <Box sx={{ display: 'grid', gap: 1.5 }}>
                  {recentActivity.map((activity) => (
                    <Card key={activity.id} variant="outlined">
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          {activity.type === 'user' && <PersonAddIcon color="primary" />}
                          {activity.type === 'patient' && <EditIcon color="info" />}
                          {activity.type === 'appointment' && <Schedule color="warning" />}
                          {activity.type === 'system' && <SecurityIcon color="error" />}
                          <Typography variant="subtitle2">{activity.action}</Typography>
                        </Box>
                        <Typography variant="body2" color="text.secondary">{activity.description}</Typography>
                      </CardContent>
                    </Card>
                  ))}
                </Box>
              ) : (
                <List>
                  {recentActivity.map((activity) => (
                    <ListItem
                      key={activity.id}
                      secondaryAction={
                        <IconButton
                          edge="end"
                          aria-label="view"
                          onClick={() => {
                            if (activity.type === 'user') {
                              setActiveTab(1);
                            } else if (activity.type === 'patient') {
                              console.log('View patient:', activity);
                            } else if (activity.type === 'appointment') {
                              console.log('View appointment:', activity);
                            }
                          }}
                        >
                          <EditIcon />
                        </IconButton>
                      }
                    >
                      <ListItemIcon>
                        {activity.type === 'user' && <PersonAddIcon color="primary" />}
                        {activity.type === 'patient' && <EditIcon color="info" />}
                        {activity.type === 'appointment' && <Schedule color="warning" />}
                        {activity.type === 'system' && <SecurityIcon color="error" />}
                      </ListItemIcon>
                      <ListItemText
                        primary={activity.action}
                        secondary={activity.description}
                      />
                    </ListItem>
                  ))}
                </List>
              )
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );

  const UserManagement = () => (
    <Box>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', gap: 1.5, mb: 3 }}>
        <Typography variant="h5">User Management</Typography>
        <Button
          variant="contained"
          startIcon={<PersonAddIcon />}
          onClick={() => {
            _setSelectedUser(null);
            setEditUserData({});
            setUserDialogOpen(true);
          }}
          fullWidth={isMobile}
        >
          Add User
        </Button>
      </Box>

      {isMobile ? (
        <Box sx={{ display: 'grid', gap: 1.5 }}>
          {_users.length === 0 ? (
            <Paper sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">No users found</Typography>
            </Paper>
          ) : (
            _users.map((user: any) => (
              <Card key={user.id}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                    <Avatar>
                      {user.full_name
                        ? user.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase()
                        : user.username.substring(0, 2).toUpperCase()}
                    </Avatar>
                    <Box>
                      <Typography variant="subtitle1">{user.full_name || user.username}</Typography>
                      <Typography variant="caption" color="text.secondary">{user.email}</Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                    <Chip
                      label={user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                      color={user.role === 'admin' ? 'primary' : user.role === 'therapist' ? 'info' : 'default'}
                      size="small"
                    />
                    <Chip
                      label={user.is_active ? 'Active' : 'Inactive'}
                      color={user.is_active ? 'success' : 'default'}
                      size="small"
                    />
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Last login: {user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}
                  </Typography>
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <IconButton onClick={() => handleUserAction('edit', user.id)} size="small">
                      <EditIcon />
                    </IconButton>
                    <IconButton onClick={() => handleUserAction('lock', user.id)} size="small">
                      <LockIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        setUserMenuAnchorEl(e.currentTarget);
                        setSelectedMenuUserId(user.id);
                      }}
                    >
                      <MoreIcon />
                    </IconButton>
                  </Box>
                </CardContent>
              </Card>
            ))
          )}
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>User</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Last Login</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {_users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                      No users found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                _users.map((user: any) => {
                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Avatar sx={{ mr: 2 }}>
                            {user.full_name
                              ? user.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase()
                              : user.username.substring(0, 2).toUpperCase()}
                          </Avatar>
                          <Box>
                            <Typography variant="subtitle2">{user.full_name || user.username}</Typography>
                            <Typography variant="body2" color="textSecondary">
                              {user.email}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                          color={user.role === 'admin' ? 'primary' : user.role === 'therapist' ? 'info' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={user.is_active ? 'Active' : 'Inactive'}
                          color={user.is_active ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}
                      </TableCell>
                      <TableCell>
                        <IconButton onClick={() => handleUserAction('edit', user.id)} size="small">
                          <EditIcon />
                        </IconButton>
                        <IconButton onClick={() => handleUserAction('lock', user.id)} size="small">
                          <LockIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            setUserMenuAnchorEl(e.currentTarget);
                            setSelectedMenuUserId(user.id);
                          }}
                        >
                          <MoreIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      
      {/* User action menu - rendered outside the map loop */}
      {userMenuAnchorEl && (
        <Menu
          anchorEl={userMenuAnchorEl}
          open={Boolean(userMenuAnchorEl)}
          onClose={() => {
            setUserMenuAnchorEl(null);
            setSelectedMenuUserId(null);
          }}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
        >
        <MenuItem 
          onClick={() => {
            if (selectedMenuUserId) {
              handleUserAction('delete', selectedMenuUserId);
            }
            setUserMenuAnchorEl(null);
            setSelectedMenuUserId(null);
          }}
        >
          <ListItemIcon>
            <DeleteIcon fontSize="small" sx={{ color: 'error.main' }} />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
        <MenuItem 
          onClick={() => {
            if (selectedMenuUserId) {
              const user = _users.find(u => u.id === selectedMenuUserId);
              handleUserAction((user as any)?.is_active ? 'lock' : 'unlock', selectedMenuUserId);
            }
            setUserMenuAnchorEl(null);
            setSelectedMenuUserId(null);
          }}
        >
          <ListItemIcon>
            {(_users.find(u => u.id === selectedMenuUserId) as any)?.is_active ? (
              <BlockIcon fontSize="small" sx={{ color: 'warning.main' }} />
            ) : (
              <LockOpenIcon fontSize="small" sx={{ color: 'success.main' }} />
            )}
          </ListItemIcon>
          <ListItemText>
            {(_users.find(u => u.id === selectedMenuUserId) as any)?.is_active ? 'Suspend' : 'Unsuspend'}
          </ListItemText>
        </MenuItem>
      </Menu>
      )}
    </Box>
  );

  const SystemSettings = () => (
    <Box>
      <Typography variant="h5" sx={{ mb: 3 }}>
        System Settings
      </Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Security Settings
            </Typography>
            <List>
              <ListItem>
                <ListItemText primary="Require password change" secondary="Force users to change passwords every 90 days" />
                <ListItemSecondaryAction>
                  <Switch defaultChecked />
                </ListItemSecondaryAction>
              </ListItem>
              <ListItem>
                <ListItemText primary="Two-factor authentication" secondary="Require 2FA for all admin users" />
                <ListItemSecondaryAction>
                  <Switch defaultChecked />
                </ListItemSecondaryAction>
              </ListItem>
              <ListItem>
                <ListItemText primary="Session timeout" secondary="Automatically log out inactive users" />
                <ListItemSecondaryAction>
                  <Switch defaultChecked />
                </ListItemSecondaryAction>
              </ListItem>
            </List>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              System Maintenance
            </Typography>
            <List>
              <ListItem>
                <ListItemText primary="Database backup" secondary="Last backup: 6 hours ago" />
                <ListItemSecondaryAction>
                  <Button variant="outlined" size="small" fullWidth={isMobile}>
                    Backup Now
                  </Button>
                </ListItemSecondaryAction>
              </ListItem>
              <ListItem>
                <ListItemText primary="System logs" secondary="View and download system logs" />
                <ListItemSecondaryAction>
                  <Button variant="outlined" size="small" fullWidth={isMobile}>
                    View Logs
                  </Button>
                </ListItemSecondaryAction>
              </ListItem>
              <ListItem>
                <ListItemText primary="Audit trail" secondary="HIPAA compliance audit logs" />
                <ListItemSecondaryAction>
                  <Button variant="outlined" size="small" fullWidth={isMobile}>
                    Generate Report
                  </Button>
                </ListItemSecondaryAction>
              </ListItem>
            </List>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {error}
      </Alert>
    );
  }

  const tabPanels = [
    { label: 'Dashboard', icon: <DashboardIcon />, component: <DashboardOverview /> },
    { label: 'Users', icon: <PeopleIcon />, component: <UserManagement /> },
    { label: 'Settings', icon: <SettingsIcon />, component: <SystemSettings /> },
    { label: 'Reports', icon: <ReportsIcon />, component: <ReportsSection /> },
  ];

  return (
    <Box sx={{ width: '100%' }}>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Admin Dashboard
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(_event: React.SyntheticEvent, newValue: number) => setActiveTab(newValue)}
          variant={isMobile ? 'scrollable' : 'standard'}
          scrollButtons={isMobile ? 'auto' : false}
          allowScrollButtonsMobile
        >
          {tabPanels.map((panel, index) => (
            <Tab
              key={index}
              icon={panel.icon}
              label={panel.label}
              iconPosition="start"
            />
          ))}
        </Tabs>
      </Box>

      {tabPanels[activeTab]?.component}

      {/* Add/Edit User Dialog */}
      <Dialog open={userDialogOpen} onClose={() => {
        setUserDialogOpen(false);
        _setSelectedUser(null);
        setEditUserData({});
      }} maxWidth="md" fullWidth>
        <DialogTitle>{_selectedUser ? 'Edit User' : 'Add New User'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="First Name"
                variant="outlined"
                value={editUserData.first_name || ''}
                onChange={(e) => setEditUserData({ ...editUserData, first_name: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Last Name"
                variant="outlined"
                value={editUserData.last_name || ''}
                onChange={(e) => setEditUserData({ ...editUserData, last_name: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                variant="outlined"
                value={editUserData.email || ''}
                onChange={(e) => setEditUserData({ ...editUserData, email: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Username"
                variant="outlined"
                value={editUserData.username || ''}
                onChange={(e) => setEditUserData({ ...editUserData, username: e.target.value })}
                disabled={!!_selectedUser}
              />
            </Grid>
            {!_selectedUser && (
              <>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Password"
                    type="password"
                    variant="outlined"
                    value={editUserData.password || ''}
                    onChange={(e) => setEditUserData({ ...editUserData, password: e.target.value })}
                    required
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Confirm Password"
                    type="password"
                    variant="outlined"
                    value={editUserData.password_confirm || ''}
                    onChange={(e) => setEditUserData({ ...editUserData, password_confirm: e.target.value })}
                    required
                    error={editUserData.password !== editUserData.password_confirm && !!editUserData.password_confirm}
                    helperText={editUserData.password !== editUserData.password_confirm && !!editUserData.password_confirm ? 'Passwords do not match' : ''}
                  />
                </Grid>
              </>
            )}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Role</InputLabel>
                <Select 
                  label="Role"
                  value={editUserData.role || ''}
                  onChange={(e) => setEditUserData({ ...editUserData, role: e.target.value as any })}
                >
                  <MenuItem value="admin">Admin</MenuItem>
                  <MenuItem value="therapist">Therapist</MenuItem>
                  <MenuItem value="staff">Staff</MenuItem>
                  <MenuItem value="client">Client</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Phone Number"
                variant="outlined"
                value={editUserData.phone_number || ''}
                onChange={(e) => setEditUserData({ ...editUserData, phone_number: e.target.value })}
              />
            </Grid>
            {_selectedUser && (
              <Grid item xs={12}>
                <FormControl component="fieldset">
                  <Box display="flex" alignItems="center">
                    <Typography>Active Status:</Typography>
                    <Switch
                      checked={editUserData.is_active ?? true}
                      onChange={(e) => setEditUserData({ ...editUserData, is_active: e.target.checked })}
                    />
                    <Typography>{editUserData.is_active ? 'Active' : 'Inactive'}</Typography>
                  </Box>
                </FormControl>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setUserDialogOpen(false);
            _setSelectedUser(null);
            setEditUserData({});
          }}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveUser}>
            {_selectedUser ? 'Save Changes' : 'Create User'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminDashboard;