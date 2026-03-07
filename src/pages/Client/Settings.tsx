import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Button,
  TextField,
  Switch,
  FormControlLabel,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tab,
  Tabs,
  Divider,
  CircularProgress,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  RadioGroup,
  Radio,
  FormLabel,
  Checkbox,
  FormGroup,
} from '@mui/material';
import {
  Person,
  Notifications,
  Security,
  Palette,
  Accessibility,
  Camera,
  Delete,
  Save,
  Visibility,
  VisibilityOff,
  Lock,
  Shield,
} from '@mui/icons-material';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
// import { settingsService } from '../../services/settingsService';
import {
  PatientSettings,
  ProfileSettings,
  NotificationSettings,
  PrivacySettings,
  UserPreferences,
  SecuritySettings,
  AccessibilitySettings,
  ThemePreference,
  FontSize,
  ColorScheme,
  ContactMethod,
  ReminderFrequency,
  TwoFactorMethod,
  ComplianceLevel,
} from '../../types';

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

const Settings: React.FC = () => {
  const { state } = useAuth();
  const { showSuccess, showError } = useNotification();
  
  // State
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [, setSettings] = useState<PatientSettings | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordDialog, setPasswordDialog] = useState(false);
  const [, setTwoFactorDialog] = useState(false);
  const [, setPhotoUpload] = useState(false);

  // Form states
  const [profileForm, setProfileForm] = useState<Partial<ProfileSettings>>({});
  const [notificationForm, setNotificationForm] = useState<Partial<NotificationSettings>>({});
  const [privacyForm, setPrivacyForm] = useState<Partial<PrivacySettings>>({});
  const [preferencesForm, setPreferencesForm] = useState<Partial<UserPreferences>>({});
  const [securityForm, setSecurityForm] = useState<Partial<SecuritySettings>>({});
  const [accessibilityForm, setAccessibilityForm] = useState<Partial<AccessibilitySettings>>({});
  
  // Password form
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Mock data for development
  const mockSettings: PatientSettings = {
    id: '1',
    patientId: state.user?.id || '',
    profile: {
      firstName: state.user?.firstName || 'John',
      lastName: state.user?.lastName || 'Doe',
      email: state.user?.email || 'john.doe@example.com',
      phone: '+1 (555) 123-4567',
      dateOfBirth: new Date('1990-01-15'),
      address: {
        street: '123 Main St',
        city: 'Anytown',
        state: 'CA',
        zipCode: '12345',
        country: 'US',
      },
      emergencyContact: {
          name: 'Jane Doe',
          relationship: 'Spouse',
          phone: '+1 (555) 987-6543',
          email: 'jane.doe@example.com',
          role: '',
          emailAddress: '',
          priority: 0
      },
      preferredName: 'John',
      pronouns: 'he/him',
      language: 'en',
      timezone: 'America/Los_Angeles',
    },
    notifications: {
      email: {
        enabled: true,
        appointments: true,
        appointmentReminders: true,
        messages: true,
        documentUpdates: false,
        treatmentPlanUpdates: true,
        billingUpdates: true,
        promotionalEmails: false,
        weeklyReports: true,
        reminderFrequency: ReminderFrequency.ONE_HOUR,
      },
      sms: {
        enabled: true,
        appointments: true,
        appointmentReminders: true,
        emergencyAlerts: true,
        reminderFrequency: ReminderFrequency.THIRTY_MINUTES,
      },
      push: {
        enabled: true,
        appointments: true,
        messages: true,
        documentUpdates: false,
        emergencyAlerts: true,
      },
      inApp: {
        enabled: true,
        sound: true,
        desktop: true,
        showPreviews: true,
      },
      quietHours: {
        enabled: true,
        startTime: '22:00',
        endTime: '08:00',
        timezone: 'America/Los_Angeles',
        weekendsOnly: false,
      },
    },
    privacy: {
      profileVisibility: 'care_team_only' as any,
      dataSharing: {
        shareWithCareTeam: true,
        shareWithInsurance: true,
        shareForResearch: false,
        shareAnonymizedData: false,
        marketingCommunications: false,
      },
      communicationPreferences: {
        preferredContactMethod: ContactMethod.EMAIL,
        allowAfterHoursContact: false,
        shareContactWithEmergencyServices: true,
      },
      recordAccess: {
        allowFamilyAccess: false,
        familyAccessLevel: 'none' as any,
        authorizedUsers: [],
        accessLogging: true,
      },
    },
    preferences: {
      theme: ThemePreference.LIGHT,
      dashboard: {
        layout: 'cards' as any,
        widgets: [],
        defaultView: 'dashboard',
        showWelcomeMessage: true,
        compactMode: false,
      },
      appointments: {
        defaultDuration: 60,
        preferredTimeSlots: [],
        autoConfirm: false,
        rescheduleNotice: 24,
        preferredAppointmentType: 'therapy_session' as any,
        telehealthPreferences: {
          defaultPlatform: 'zoom',
          cameraEnabled: true,
          microphoneEnabled: true,
          screenSharing: false,
          recordingSessions: false,
          qualityPreference: 'auto' as any,
        },
      },
      documents: {
        defaultView: 'grid' as any,
        autoDownload: false,
        showPreviews: true,
        sortBy: 'date_created' as any,
        sortOrder: 'desc' as any,
      },
      billing: {
        paperlessStatements: true,
        autoPayEnabled: false,
        paymentMethod: {
          id: '1',
          type: 'credit_card' as any,
          isDefault: true,
          lastFour: '1234',
        },
        billingCycle: 'monthly' as any,
        reminderDays: [7, 3, 1],
      },
    },
    security: {
        twoFactorAuth: {
            enabled: false,
            method: TwoFactorMethod.SMS,
            backupCodes: [],
            trustedDevices: [],
        },
        loginAlerts: {
            enabled: true,
            newDeviceAlert: true,
            suspiciousLocationAlert: true,
            multipleFailedAttempts: true,
            emailAlerts: true,
            smsAlerts: false,
        },
        sessionManagement: {
            sessionTimeout: 30,
            concurrentSessions: 3,
            autoLogoutInactive: true,
            rememberDevice: true,
            rememberDuration: 30,
        },
        passwordPolicy: {
            requireComplexPassword: true,
            minimumLength: 8,
            requireSpecialCharacters: true,
            requireNumbers: true,
            requireUppercase: true,
            requireLowercase: true,
            passwordExpiryDays: 90,
            preventReuse: 5,
        },
        encryptionEnabled: true,
        passwordProtected: true,
        waitingRoomEnabled: false,
        allowAnonymousJoin: false,
        requireApproval: false,
        sessionLockEnabled: false,
        endToEndEncryption: false,
        complianceLevel: ComplianceLevel.BASIC
    },
    accessibility: {
      fontSize: FontSize.MEDIUM,
      colorScheme: ColorScheme.NORMAL,
      animations: {
        reducedMotion: false,
        autoplayVideos: true,
        transitionSpeed: 'normal' as any,
      },
      keyboard: {
        keyboardNavigation: false,
        stickyKeys: false,
        slowKeys: false,
        bounceKeys: false,
        mouseKeys: false,
      },
      screen: {
        enabled: false,
        verbosity: 'normal' as any,
        speakPasswords: false,
        speakTyping: false,
        announceNotifications: true,
      },
      motor: {
        clickDelay: 0,
        hoverDelay: 500,
        largeClickTargets: false,
        gestureAlternatives: false,
      },
    },
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date(),
  };

  // Load settings
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      // In a real app: const response = await settingsService.getPatientSettings(state.user?.id);
      // For now, use mock data
      setSettings(mockSettings);
      setProfileForm(mockSettings.profile);
      setNotificationForm(mockSettings.notifications);
      setPrivacyForm(mockSettings.privacy);
      setPreferencesForm(mockSettings.preferences);
      setSecurityForm(mockSettings.security);
      setAccessibilityForm(mockSettings.accessibility);
    } catch (error) {
      showError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      // await settingsService.updateProfileSettings(state.user?.id!, profileForm);
      showSuccess('Profile updated successfully');
    } catch (error) {
      showError('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNotifications = async () => {
    setSaving(true);
    try {
      // await settingsService.updateNotificationSettings(state.user?.id!, notificationForm);
      showSuccess('Notification settings updated successfully');
    } catch (error) {
      showError('Failed to update notification settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePrivacy = async () => {
    setSaving(true);
    try {
      // await settingsService.updatePrivacySettings(state.user?.id!, privacyForm);
      showSuccess('Privacy settings updated successfully');
    } catch (error) {
      showError('Failed to update privacy settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePreferences = async () => {
    setSaving(true);
    try {
      // await settingsService.updateUserPreferences(state.user?.id!, preferencesForm);
      showSuccess('Preferences updated successfully');
    } catch (error) {
      showError('Failed to update preferences');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSecurity = async () => {
    setSaving(true);
    try {
      // await settingsService.updateSecuritySettings(state.user?.id!, securityForm);
      showSuccess('Security settings updated successfully');
    } catch (error) {
      showError('Failed to update security settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAccessibility = async () => {
    setSaving(true);
    try {
      // await settingsService.updateAccessibilitySettings(state.user?.id!, accessibilityForm);
      showSuccess('Accessibility settings updated successfully');
    } catch (error) {
      showError('Failed to update accessibility settings');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      showError('Passwords do not match');
      return;
    }
    
    setSaving(true);
    try {
      // await settingsService.changePassword(
      //   passwordData.currentPassword,
      //   passwordData.newPassword,
      //   passwordData.confirmPassword
      // );
      showSuccess('Password changed successfully');
      setPasswordDialog(false);
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      showError('Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Account Settings
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage your profile, privacy, and preferences.
        </Typography>
      </Box>

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab icon={<Person />} label="Profile" />
          <Tab icon={<Notifications />} label="Notifications" />
          <Tab icon={<Shield />} label="Privacy" />
          <Tab icon={<Palette />} label="Preferences" />
          <Tab icon={<Security />} label="Security" />
          <Tab icon={<Accessibility />} label="Accessibility" />
        </Tabs>
      </Paper>

      {/* Profile Tab */}
      <TabPanel value={activeTab} index={0}>
        <Grid container spacing={3}>
          {/* Profile Photo */}
          <Grid item xs={12}>
            <Card>
              <CardHeader title="Profile Photo" />
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Avatar sx={{ width: 80, height: 80 }}>
                    {profileForm.firstName?.charAt(0)}
                  </Avatar>
                  <Box>
                    <Button
                      variant="outlined"
                      startIcon={<Camera />}
                      onClick={() => setPhotoUpload(true)}
                      sx={{ mr: 2 }}
                    >
                      Change Photo
                    </Button>
                    <Button
                      variant="outlined"
                      color="error"
                      startIcon={<Delete />}
                    >
                      Remove
                    </Button>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Personal Information */}
          <Grid item xs={12}>
            <Card>
              <CardHeader title="Personal Information" />
              <CardContent>
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="First Name"
                      value={profileForm.firstName || ''}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, firstName: e.target.value }))}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Last Name"
                      value={profileForm.lastName || ''}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, lastName: e.target.value }))}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Preferred Name"
                      value={profileForm.preferredName || ''}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, preferredName: e.target.value }))}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Pronouns"
                      value={profileForm.pronouns || ''}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, pronouns: e.target.value }))}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      type="email"
                      label="Email Address"
                      value={profileForm.email || ''}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, email: e.target.value }))}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Phone Number"
                      value={profileForm.phone || ''}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, phone: e.target.value }))}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <DatePicker
                      label="Date of Birth"
                      value={profileForm.dateOfBirth || null}
                      onChange={(newValue) => setProfileForm(prev => ({ ...prev, dateOfBirth: newValue || undefined }))}
                      slotProps={{ textField: { fullWidth: true } }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel>Language</InputLabel>
                      <Select
                        value={profileForm.language || 'en'}
                        label="Language"
                        onChange={(e) => setProfileForm(prev => ({ ...prev, language: e.target.value }))}
                      >
                        <MenuItem value="en">English</MenuItem>
                        <MenuItem value="es">Spanish</MenuItem>
                        <MenuItem value="fr">French</MenuItem>
                        <MenuItem value="de">German</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
                <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    variant="contained"
                    startIcon={<Save />}
                    onClick={handleSaveProfile}
                    disabled={saving}
                  >
                    Save Profile
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Emergency Contact */}
          <Grid item xs={12}>
            <Card>
              <CardHeader title="Emergency Contact" />
              <CardContent>
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Contact Name"
                      value={profileForm.emergencyContact?.name || ''}
                      onChange={(e) => setProfileForm(prev => ({
                        ...prev,
                        emergencyContact: { ...prev.emergencyContact!, name: e.target.value }
                      }))}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Relationship"
                      value={profileForm.emergencyContact?.relationship || ''}
                      onChange={(e) => setProfileForm(prev => ({
                        ...prev,
                        emergencyContact: { ...prev.emergencyContact!, relationship: e.target.value }
                      }))}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Phone Number"
                      value={profileForm.emergencyContact?.phone || ''}
                      onChange={(e) => setProfileForm(prev => ({
                        ...prev,
                        emergencyContact: { ...prev.emergencyContact!, phone: e.target.value }
                      }))}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      type="email"
                      label="Email Address"
                      value={profileForm.emergencyContact?.email || ''}
                      onChange={(e) => setProfileForm(prev => ({
                        ...prev,
                        emergencyContact: { ...prev.emergencyContact!, email: e.target.value }
                      }))}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Notifications Tab */}
      <TabPanel value={activeTab} index={1}>
        <Grid container spacing={3}>
          {/* Email Notifications */}
          <Grid item xs={12}>
            <Card>
              <CardHeader
                title="Email Notifications"
                action={
                  <FormControlLabel
                    control={
                      <Switch
                        checked={notificationForm.email?.enabled || false}
                        onChange={(e) => setNotificationForm(prev => ({
                          ...prev,
                          email: { ...prev.email!, enabled: e.target.checked }
                        }))}
                      />
                    }
                    label=""
                  />
                }
              />
              <CardContent>
                <FormGroup>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={notificationForm.email?.appointments || false}
                        onChange={(e) => setNotificationForm(prev => ({
                          ...prev,
                          email: { ...prev.email!, appointments: e.target.checked }
                        }))}
                      />
                    }
                    label="Appointment confirmations"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={notificationForm.email?.appointmentReminders || false}
                        onChange={(e) => setNotificationForm(prev => ({
                          ...prev,
                          email: { ...prev.email!, appointmentReminders: e.target.checked }
                        }))}
                      />
                    }
                    label="Appointment reminders"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={notificationForm.email?.messages || false}
                        onChange={(e) => setNotificationForm(prev => ({
                          ...prev,
                          email: { ...prev.email!, messages: e.target.checked }
                        }))}
                      />
                    }
                    label="New messages"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={notificationForm.email?.documentUpdates || false}
                        onChange={(e) => setNotificationForm(prev => ({
                          ...prev,
                          email: { ...prev.email!, documentUpdates: e.target.checked }
                        }))}
                      />
                    }
                    label="Document updates"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={notificationForm.email?.treatmentPlanUpdates || false}
                        onChange={(e) => setNotificationForm(prev => ({
                          ...prev,
                          email: { ...prev.email!, treatmentPlanUpdates: e.target.checked }
                        }))}
                      />
                    }
                    label="Treatment plan updates"
                  />
                </FormGroup>
                <Box sx={{ mt: 2 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Reminder Frequency</InputLabel>
                    <Select
                      value={notificationForm.email?.reminderFrequency || ReminderFrequency.ONE_HOUR}
                      label="Reminder Frequency"
                      onChange={(e) => setNotificationForm(prev => ({
                        ...prev,
                        email: { ...prev.email!, reminderFrequency: e.target.value as ReminderFrequency }
                      }))}
                    >
                      <MenuItem value={ReminderFrequency.FIFTEEN_MINUTES}>15 minutes</MenuItem>
                      <MenuItem value={ReminderFrequency.THIRTY_MINUTES}>30 minutes</MenuItem>
                      <MenuItem value={ReminderFrequency.ONE_HOUR}>1 hour</MenuItem>
                      <MenuItem value={ReminderFrequency.TWO_HOURS}>2 hours</MenuItem>
                      <MenuItem value={ReminderFrequency.ONE_DAY}>1 day</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
                <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    variant="contained"
                    startIcon={<Save />}
                    onClick={handleSaveNotifications}
                    disabled={saving}
                  >
                    Save Notification Settings
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Quiet Hours */}
          <Grid item xs={12}>
            <Card>
              <CardHeader
                title="Quiet Hours"
                subheader="Don't send notifications during these hours"
                action={
                  <FormControlLabel
                    control={
                      <Switch
                        checked={notificationForm.quietHours?.enabled || false}
                        onChange={(e) => setNotificationForm(prev => ({
                          ...prev,
                          quietHours: { ...prev.quietHours!, enabled: e.target.checked }
                        }))}
                      />
                    }
                    label=""
                  />
                }
              />
              <CardContent>
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6}>
                    <TimePicker
                      label="Start Time"
                      value={null}
                      onChange={() => {}}
                      slotProps={{ textField: { fullWidth: true } }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TimePicker
                      label="End Time"
                      value={null}
                      onChange={() => {}}
                      slotProps={{ textField: { fullWidth: true } }}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={notificationForm.quietHours?.weekendsOnly || false}
                          onChange={(e) => setNotificationForm(prev => ({
                            ...prev,
                            quietHours: { ...prev.quietHours!, weekendsOnly: e.target.checked }
                          }))}
                        />
                      }
                      label="Apply only on weekends"
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Privacy Tab */}
      <TabPanel value={activeTab} index={2}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <CardHeader title="Data Sharing Preferences" />
              <CardContent>
                <FormGroup>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={privacyForm.dataSharing?.shareWithCareTeam || false}
                        onChange={(e) => setPrivacyForm(prev => ({
                          ...prev,
                          dataSharing: { ...prev.dataSharing!, shareWithCareTeam: e.target.checked }
                        }))}
                      />
                    }
                    label="Share data with care team"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={privacyForm.dataSharing?.shareWithInsurance || false}
                        onChange={(e) => setPrivacyForm(prev => ({
                          ...prev,
                          dataSharing: { ...prev.dataSharing!, shareWithInsurance: e.target.checked }
                        }))}
                      />
                    }
                    label="Share data with insurance provider"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={privacyForm.dataSharing?.shareForResearch || false}
                        onChange={(e) => setPrivacyForm(prev => ({
                          ...prev,
                          dataSharing: { ...prev.dataSharing!, shareForResearch: e.target.checked }
                        }))}
                      />
                    }
                    label="Share anonymized data for research"
                  />
                </FormGroup>
                <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    variant="contained"
                    startIcon={<Save />}
                    onClick={handleSavePrivacy}
                    disabled={saving}
                  >
                    Save Privacy Settings
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Preferences Tab */}
      <TabPanel value={activeTab} index={3}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <CardHeader title="Theme and Display" />
              <CardContent>
                <FormControl fullWidth sx={{ mb: 3 }}>
                  <FormLabel>Theme Preference</FormLabel>
                  <RadioGroup
                    value={preferencesForm.theme || ThemePreference.LIGHT}
                    onChange={(e) => setPreferencesForm(prev => ({
                      ...prev,
                      theme: e.target.value as ThemePreference
                    }))}
                  >
                    <FormControlLabel value={ThemePreference.LIGHT} control={<Radio />} label="Light" />
                    <FormControlLabel value={ThemePreference.DARK} control={<Radio />} label="Dark" />
                    <FormControlLabel value={ThemePreference.AUTO} control={<Radio />} label="Auto (system)" />
                  </RadioGroup>
                </FormControl>
                <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    variant="contained"
                    startIcon={<Save />}
                    onClick={handleSavePreferences}
                    disabled={saving}
                  >
                    Save Preferences
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Security Tab */}
      <TabPanel value={activeTab} index={4}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <CardHeader title="Password & Authentication" />
              <CardContent>
                <Button
                  variant="outlined"
                  startIcon={<Lock />}
                  onClick={() => setPasswordDialog(true)}
                  sx={{ mb: 2 }}
                >
                  Change Password
                </Button>
                <Divider sx={{ my: 2 }} />
                <FormControlLabel
                  control={
                    <Switch
                      checked={securityForm.twoFactorAuth?.enabled || false}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setTwoFactorDialog(true);
                        } else {
                          setSecurityForm(prev => ({
                            ...prev,
                            twoFactorAuth: { ...prev.twoFactorAuth!, enabled: false }
                          }));
                        }
                      }}
                    />
                  }
                  label="Enable Two-Factor Authentication"
                />
                <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    variant="contained"
                    startIcon={<Save />}
                    onClick={handleSaveSecurity}
                    disabled={saving}
                  >
                    Save Security Settings
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Accessibility Tab */}
      <TabPanel value={activeTab} index={5}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <CardHeader title="Display and Text" />
              <CardContent>
                <FormControl fullWidth sx={{ mb: 3 }}>
                  <InputLabel>Font Size</InputLabel>
                  <Select
                    value={accessibilityForm.fontSize || FontSize.MEDIUM}
                    label="Font Size"
                    onChange={(e) => setAccessibilityForm(prev => ({
                      ...prev,
                      fontSize: e.target.value as FontSize
                    }))}
                  >
                    <MenuItem value={FontSize.SMALL}>Small</MenuItem>
                    <MenuItem value={FontSize.MEDIUM}>Medium</MenuItem>
                    <MenuItem value={FontSize.LARGE}>Large</MenuItem>
                    <MenuItem value={FontSize.EXTRA_LARGE}>Extra Large</MenuItem>
                  </Select>
                </FormControl>
                <FormControlLabel
                  control={
                    <Switch
                      checked={accessibilityForm.animations?.reducedMotion || false}
                      onChange={(e) => setAccessibilityForm(prev => ({
                        ...prev,
                        animations: { ...prev.animations!, reducedMotion: e.target.checked }
                      }))}
                    />
                  }
                  label="Reduce motion and animations"
                />
                <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    variant="contained"
                    startIcon={<Save />}
                    onClick={handleSaveAccessibility}
                    disabled={saving}
                  >
                    Save Accessibility Settings
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Password Change Dialog */}
      <Dialog open={passwordDialog} onClose={() => setPasswordDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Change Password</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            type={showPassword ? 'text' : 'password'}
            label="Current Password"
            value={passwordData.currentPassword}
            onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
            sx={{ mb: 2, mt: 1 }}
            InputProps={{
              endAdornment: (
                <IconButton onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              )
            }}
          />
          <TextField
            fullWidth
            type={showPassword ? 'text' : 'password'}
            label="New Password"
            value={passwordData.newPassword}
            onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            type={showPassword ? 'text' : 'password'}
            label="Confirm New Password"
            value={passwordData.confirmPassword}
            onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPasswordDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleChangePassword}
            disabled={saving}
          >
            Change Password
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Settings;