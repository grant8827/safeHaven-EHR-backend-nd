import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Button,
  TextField,
  Switch,
  FormControlLabel,
  Tab,
  Tabs,
  Divider,
  Avatar,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Person,
  Notifications,
  Security,
  AdminPanelSettings,
  Camera,
  Save,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { apiClient } from '../../services/apiClient';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const AdminSettings: React.FC = () => {
  const { state } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { showSuccess, showError } = useNotification();
  const [searchParams] = useSearchParams();
  const editUserId = searchParams.get('userId');
  
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(!!editUserId);
  const [editingUser, setEditingUser] = useState<any>(null);
  
  const [profileData, setProfileData] = useState({
    firstName: state.user?.firstName || '',
    lastName: state.user?.lastName || '',
    email: state.user?.email || '',
    phone: '',
    title: 'System Administrator',
  });

  // Load user data if editing another user
  useEffect(() => {
    const loadUserData = async () => {
      if (editUserId) {
        try {
          setLoading(true);
          const response = await apiClient.get(`/auth/${editUserId}/`);
          const userData = response.data;
          setEditingUser(userData);
          setProfileData({
            firstName: userData.first_name || '',
            lastName: userData.last_name || '',
            email: userData.email || '',
            phone: userData.phone_number || '',
            title: userData.role === 'therapist' ? 'Therapist' : 
                   userData.role === 'staff' ? 'Staff' :
                   userData.role === 'client' ? 'Client' : 'Administrator',
          });
        } catch (error) {
          console.error('Error loading user data:', error);
          showError('Failed to load user data');
        } finally {
          setLoading(false);
        }
      }
    };
    
    loadUserData();
  }, [editUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  const [systemSettings, setSystemSettings] = useState({
    maintenanceMode: false,
    userRegistration: true,
    emailVerification: true,
    twoFactorRequired: false,
    sessionTimeout: 30,
  });

  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    smsNotifications: false,
    systemAlerts: true,
    securityAlerts: true,
    backupAlerts: true,
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [passwordErrors, setPasswordErrors] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const handleSaveProfile = async () => {
    try {
      const userId = editUserId || state.user?.id;
      if (!userId) {
        showError('User ID not found');
        return;
      }

      const updateData = {
        first_name: profileData.firstName,
        last_name: profileData.lastName,
        email: profileData.email,
        phone_number: profileData.phone,
      };

      await apiClient.patch(`/auth/${userId}/`, updateData);
      showSuccess(editUserId ? 'User updated successfully' : 'Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      showError('Failed to update profile');
    }
  };

  const handleUpdatePassword = async () => {
    // Reset errors
    setPasswordErrors({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });

    // Validate fields
    let hasError = false;
    const errors = {
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    };

    if (!passwordData.currentPassword) {
      errors.currentPassword = 'Current password is required';
      hasError = true;
    }

    if (!passwordData.newPassword) {
      errors.newPassword = 'New password is required';
      hasError = true;
    } else if (passwordData.newPassword.length < 8) {
      errors.newPassword = 'Password must be at least 8 characters';
      hasError = true;
    }

    if (!passwordData.confirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
      hasError = true;
    } else if (passwordData.newPassword !== passwordData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
      hasError = true;
    }

    if (hasError) {
      setPasswordErrors(errors);
      return;
    }

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/api/auth/password/change/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        body: JSON.stringify({
          current_password: passwordData.currentPassword,
          new_password: passwordData.newPassword,
          new_password_confirm: passwordData.confirmPassword
        })
      });

      if (response.ok) {
        showSuccess('Password updated successfully');
        // Clear form
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
      } else {
        const data = await response.json();
        if (data.current_password) {
          setPasswordErrors(prev => ({ ...prev, currentPassword: data.current_password[0] || data.current_password }));
        } else if (data.new_password) {
          setPasswordErrors(prev => ({ ...prev, newPassword: Array.isArray(data.new_password) ? data.new_password.join(' ') : data.new_password }));
        } else if (data.new_password_confirm) {
          setPasswordErrors(prev => ({ ...prev, confirmPassword: data.new_password_confirm[0] || data.new_password_confirm }));
        } else {
          showError(data.detail || 'Failed to update password');
        }
      }
    } catch (error) {
      showError('Failed to update password');
    }
  };

  const handleSaveSystemSettings = () => {
    try {
      // TODO: Implement API call to save system settings
      showSuccess('System settings updated successfully');
    } catch (error) {
      showError('Failed to update system settings');
    }
  };

  const handleSaveNotifications = () => {
    try {
      // TODO: Implement API call to save notification settings
      showSuccess('Notification settings updated successfully');
    } catch (error) {
      showError('Failed to update notification settings');
    }
  };

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        {editUserId ? `Edit User: ${profileData.firstName} ${profileData.lastName}` : 'Administrator Settings'}
      </Typography>
      {editUserId && (
        <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mb: 2 }}>
          Editing user account: {editingUser?.email} ({editingUser?.role})
        </Typography>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      ) : (
        <>
          <Paper sx={{ mb: 3 }}>
            <Tabs
              value={activeTab}
              onChange={(_, newValue) => setActiveTab(newValue)}
              aria-label="settings tabs"
              variant={isMobile ? 'scrollable' : 'standard'}
              scrollButtons={isMobile ? 'auto' : false}
              allowScrollButtonsMobile
            >
              <Tab icon={<Person />} label="Profile" />
              {!editUserId && <Tab icon={<AdminPanelSettings />} label="System" />}
              {!editUserId && <Tab icon={<Notifications />} label="Notifications" />}
              {!editUserId && <Tab icon={<Security />} label="Security" />}
            </Tabs>
          </Paper>

          {/* Profile Tab */}
      <TabPanel value={activeTab} index={0}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: 'center', mb: 3, gap: 1.5 }}>
              <Avatar
                sx={{ width: 100, height: 100, mr: { xs: 0, sm: 3 } }}
                src=""
                alt={`${profileData.firstName} ${profileData.lastName}`}
              >
                {profileData.firstName.charAt(0)}{profileData.lastName.charAt(0)}
              </Avatar>
              <Box>
                <IconButton color="primary" component="label">
                  <Camera />
                  <input hidden accept="image/*" type="file" />
                </IconButton>
                <Typography variant="body2" color="text.secondary">
                  Upload new photo
                </Typography>
              </Box>
            </Box>

            <Divider sx={{ mb: 3 }} />

            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="First Name"
                  value={profileData.firstName}
                  onChange={(e) => setProfileData({ ...profileData, firstName: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Last Name"
                  value={profileData.lastName}
                  onChange={(e) => setProfileData({ ...profileData, lastName: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Email"
                  type="email"
                  value={profileData.email}
                  onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Phone"
                  value={profileData.phone}
                  onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Job Title"
                  value={profileData.title}
                  onChange={(e) => setProfileData({ ...profileData, title: e.target.value })}
                />
              </Grid>
            </Grid>

            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="contained"
                startIcon={<Save />}
                onClick={handleSaveProfile}
                fullWidth={isMobile}
              >
                Save Profile
              </Button>
            </Box>
          </CardContent>
        </Card>
      </TabPanel>

      {/* System Settings Tab */}
      <TabPanel value={activeTab} index={1}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              System Settings
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Configure system-wide settings and preferences
            </Typography>

            <Grid container spacing={3}>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={systemSettings.maintenanceMode}
                      onChange={(e) => setSystemSettings({
                        ...systemSettings,
                        maintenanceMode: e.target.checked
                      })}
                    />
                  }
                  label="Maintenance Mode"
                />
                <Typography variant="body2" color="text.secondary" sx={{ ml: 4 }}>
                  Disable user access for system maintenance
                </Typography>
              </Grid>

              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={systemSettings.userRegistration}
                      onChange={(e) => setSystemSettings({
                        ...systemSettings,
                        userRegistration: e.target.checked
                      })}
                    />
                  }
                  label="User Registration"
                />
                <Typography variant="body2" color="text.secondary" sx={{ ml: 4 }}>
                  Allow new users to register
                </Typography>
              </Grid>

              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={systemSettings.emailVerification}
                      onChange={(e) => setSystemSettings({
                        ...systemSettings,
                        emailVerification: e.target.checked
                      })}
                    />
                  }
                  label="Email Verification Required"
                />
                <Typography variant="body2" color="text.secondary" sx={{ ml: 4 }}>
                  Require email verification for new accounts
                </Typography>
              </Grid>

              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={systemSettings.twoFactorRequired}
                      onChange={(e) => setSystemSettings({
                        ...systemSettings,
                        twoFactorRequired: e.target.checked
                      })}
                    />
                  }
                  label="Require Two-Factor Authentication"
                />
                <Typography variant="body2" color="text.secondary" sx={{ ml: 4 }}>
                  Enforce 2FA for all users
                </Typography>
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Session Timeout (minutes)</InputLabel>
                  <Select
                    value={systemSettings.sessionTimeout}
                    label="Session Timeout (minutes)"
                    onChange={(e) => setSystemSettings({
                      ...systemSettings,
                      sessionTimeout: Number(e.target.value)
                    })}
                  >
                    <MenuItem value={15}>15 minutes</MenuItem>
                    <MenuItem value={30}>30 minutes</MenuItem>
                    <MenuItem value={60}>1 hour</MenuItem>
                    <MenuItem value={120}>2 hours</MenuItem>
                    <MenuItem value={240}>4 hours</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="contained"
                startIcon={<Save />}
                onClick={handleSaveSystemSettings}
                fullWidth={isMobile}
              >
                Save System Settings
              </Button>
            </Box>
          </CardContent>
        </Card>
      </TabPanel>

      {/* Notifications Tab */}
      <TabPanel value={activeTab} index={2}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Notification Preferences
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Manage how and when you receive notifications
            </Typography>

            <Grid container spacing={2}>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={notificationSettings.emailNotifications}
                      onChange={(e) => setNotificationSettings({
                        ...notificationSettings,
                        emailNotifications: e.target.checked
                      })}
                    />
                  }
                  label="Email Notifications"
                />
              </Grid>

              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={notificationSettings.smsNotifications}
                      onChange={(e) => setNotificationSettings({
                        ...notificationSettings,
                        smsNotifications: e.target.checked
                      })}
                    />
                  }
                  label="SMS Notifications"
                />
              </Grid>

              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle1" gutterBottom>
                  Alert Types
                </Typography>
              </Grid>

              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={notificationSettings.systemAlerts}
                      onChange={(e) => setNotificationSettings({
                        ...notificationSettings,
                        systemAlerts: e.target.checked
                      })}
                    />
                  }
                  label="System Alerts"
                />
              </Grid>

              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={notificationSettings.securityAlerts}
                      onChange={(e) => setNotificationSettings({
                        ...notificationSettings,
                        securityAlerts: e.target.checked
                      })}
                    />
                  }
                  label="Security Alerts"
                />
              </Grid>

              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={notificationSettings.backupAlerts}
                      onChange={(e) => setNotificationSettings({
                        ...notificationSettings,
                        backupAlerts: e.target.checked
                      })}
                    />
                  }
                  label="Backup & Maintenance Alerts"
                />
              </Grid>
            </Grid>

            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="contained"
                startIcon={<Save />}
                onClick={handleSaveNotifications}
                fullWidth={isMobile}
              >
                Save Preferences
              </Button>
            </Box>
          </CardContent>
        </Card>
      </TabPanel>

      {/* Security Tab */}
      <TabPanel value={activeTab} index={3}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Security Settings
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Manage your password and security preferences
            </Typography>

            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  type="password"
                  label="Current Password"
                  placeholder="Enter current password"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                  error={!!passwordErrors.currentPassword}
                  helperText={passwordErrors.currentPassword}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  type="password"
                  label="New Password"
                  placeholder="Enter new password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                  error={!!passwordErrors.newPassword}
                  helperText={passwordErrors.newPassword}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  type="password"
                  label="Confirm New Password"
                  placeholder="Re-enter new password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  error={!!passwordErrors.confirmPassword}
                  helperText={passwordErrors.confirmPassword}
                />
              </Grid>
            </Grid>

            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="contained" startIcon={<Security />} onClick={handleUpdatePassword} fullWidth={isMobile}>
                Update Password
              </Button>
            </Box>

            <Divider sx={{ my: 3 }} />

            <Typography variant="h6" gutterBottom>
              Two-Factor Authentication
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Add an extra layer of security to your account
            </Typography>
            <Button variant="outlined" fullWidth={isMobile}>
              Enable Two-Factor Authentication
            </Button>
          </CardContent>
        </Card>
      </TabPanel>
        </>
      )}
    </Box>
  );
};

export default AdminSettings;
