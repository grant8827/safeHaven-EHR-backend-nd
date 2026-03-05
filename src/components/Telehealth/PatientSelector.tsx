import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  TextField,
  InputAdornment,
  Typography,
  Box,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider
} from '@mui/material';
import {
  Search,
  Person,
  VideoCall,
  History,
  Phone,
  Email,
  Close
} from '@mui/icons-material';
import { 
  PatientSessionInfo, 
  SessionInitiationRequest, 
  InvitationStatus
} from '../../types';
import { telehealthService } from '../../services/telehealthService';
import { apiClient } from '../../services/apiClient';
import { useAuth } from '../../contexts/AuthContext';

interface PatientSelectorProps {
  open: boolean;
  onClose: () => void;
  onSessionInitiated: (sessionId: string, patientId: string) => void;
}

const PatientSelector: React.FC<PatientSelectorProps> = ({
  open,
  onClose,
  onSessionInitiated
}) => {
  const { state } = useAuth();
  const user = state.user;
  const [patients, setPatients] = useState<PatientSessionInfo[]>([]);
  const [filteredPatients, setFilteredPatients] = useState<PatientSessionInfo[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<PatientSessionInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [initiatingSession, setInitiatingSession] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Session details
  const [sessionTitle, setSessionTitle] = useState('');
  const [sessionDescription, setSessionDescription] = useState('');
  const [estimatedDuration, setEstimatedDuration] = useState(60);
  const [notifyPatient] = useState(true);

  useEffect(() => {
    if (open) {
      loadPatients();
    } else {
      // Reset form when dialog closes
      setSelectedPatient(null);
      setSessionTitle('');
      setSessionDescription('');
      setEstimatedDuration(60);
      setSearchTerm('');
      setError(null);
    }
  }, [open, user]);

  useEffect(() => {
    // Filter patients based on search term
    if (searchTerm.trim()) {
      const filtered = patients.filter(patientInfo => {
        const patient = patientInfo.patient;
        const fullName = `${patient.firstName} ${patient.lastName}`.toLowerCase();
        const email = patient.email.toLowerCase();
        const search = searchTerm.toLowerCase();
        return fullName.includes(search) || email.includes(search);
      });
      setFilteredPatients(filtered);
    } else {
      setFilteredPatients(patients);
    }
  }, [searchTerm, patients]);

  const loadPatients = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch real users from database
      const response = await apiClient.get('/auth/');
      const allUsers = Array.isArray(response.data) ? response.data : (response.data?.results || []);
      
      // Convert users to PatientSessionInfo format
      const patientInfoList: PatientSessionInfo[] = allUsers.map((dbUser: any) => ({
        patient: {
          id: dbUser.id,
          firstName: dbUser.first_name || dbUser.firstName || '',
          lastName: dbUser.last_name || dbUser.lastName || '',
          email: dbUser.email,
          phone: dbUser.phone || dbUser.phone_number || '',
          role: dbUser.role,
        },
        sessionHistory: {
          totalSessions: 0,
          lastSessionDate: undefined,
          averageDuration: 0
        },
        canStartSession: dbUser.is_active !== false,
        activeInvitation: undefined
      }));

      setPatients(patientInfoList);
      setFilteredPatients(patientInfoList);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error loading users');
      console.error('Error loading users:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePatientSelect = (patientInfo: PatientSessionInfo) => {
    setSelectedPatient(patientInfo);
    setSessionTitle(`Therapy Session - ${patientInfo.patient.firstName} ${patientInfo.patient.lastName}`);
  };

  const initiateSession = async () => {
    if (!selectedPatient || !user) return;

    setInitiatingSession(true);
    setError(null);

    try {
      const request: SessionInitiationRequest = {
        patientId: selectedPatient.patient.id,
        therapistId: user.id,
        title: sessionTitle || `Therapy Session - ${selectedPatient.patient.firstName}`,
        description: sessionDescription,
        estimatedDuration,
        notifyPatient,
        requiresConfirmation: true
      };

      const result = await telehealthService.initiateSessionWithPatient(request);

      if (result.success && result.data) {
        onSessionInitiated(result.data.session.id, selectedPatient.patient.id);
        onClose();
      } else {
        setError(result.message || 'Failed to initiate session');
      }
    } catch (err) {
      setError('Error initiating session');
      console.error('Error initiating session:', err);
    } finally {
      setInitiatingSession(false);
    }
  };

  const formatLastSession = (date?: Date) => {
    if (!date) return 'No previous sessions';
    return `Last session: ${new Date(date).toLocaleDateString()}`;
  };

  const getPatientStatus = (patientInfo: PatientSessionInfo) => {
    if (patientInfo.activeInvitation) {
      const status = patientInfo.activeInvitation.status;
      if (status === InvitationStatus.PENDING) {
        return { color: 'warning' as const, text: 'Invitation Pending' };
      } else if (status === InvitationStatus.ACCEPTED) {
        return { color: 'success' as const, text: 'Ready to Join' };
      }
    }
    
    if (!patientInfo.canStartSession) {
      return { color: 'error' as const, text: 'Unavailable' };
    }
    
    return { color: 'default' as const, text: 'Available' };
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: '70vh' }
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">Start Telehealth Session</Typography>
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {!selectedPatient ? (
          <Box>
            <TextField
              fullWidth
              placeholder="Search patients by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 2 }}
            />

            {loading ? (
              <Box display="flex" justifyContent="center" py={4}>
                <CircularProgress />
              </Box>
            ) : (
              <List>
                {filteredPatients.length === 0 ? (
                  <ListItem>
                    <ListItemText 
                      primary="No patients found"
                      secondary={searchTerm ? "Try adjusting your search terms" : "No patients assigned"}
                    />
                  </ListItem>
                ) : (
                  filteredPatients.map((patientInfo) => {
                    const patient = patientInfo.patient;
                    const status = getPatientStatus(patientInfo);
                    
                    return (
                      <ListItem
                        key={patient.id}
                        button
                        onClick={() => handlePatientSelect(patientInfo)}
                        disabled={!patientInfo.canStartSession}
                      >
                        <ListItemAvatar>
                          <Avatar>
                            <Person />
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={
                            <Box display="flex" alignItems="center" gap={1}>
                              <Typography variant="body1">
                                {patient.firstName} {patient.lastName}
                              </Typography>
                              <Chip 
                                label={status.text} 
                                color={status.color}
                                size="small"
                              />
                            </Box>
                          }
                          secondary={
                            <Box>
                              <Typography variant="body2" color="textSecondary">
                                {patient.email}
                              </Typography>
                              <Typography variant="caption" color="textSecondary">
                                {formatLastSession(patientInfo.lastSession)}
                              </Typography>
                            </Box>
                          }
                        />
                        <Box display="flex" alignItems="center" gap={1}>
                          <Tooltip title="Contact">
                            <IconButton size="small">
                              <Phone fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Email">
                            <IconButton size="small">
                              <Email fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="History">
                            <IconButton size="small">
                              <History fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </ListItem>
                    );
                  })
                )}
              </List>
            )}
          </Box>
        ) : (
          <Box>
            {/* Selected Patient Info */}
            <Box display="flex" alignItems="center" gap={2} mb={3}>
              <Avatar sx={{ width: 56, height: 56 }}>
                <Person />
              </Avatar>
              <Box flex={1}>
                <Typography variant="h6">
                  {selectedPatient.patient.firstName} {selectedPatient.patient.lastName}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  {selectedPatient.patient.email}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  {formatLastSession(selectedPatient.lastSession)}
                </Typography>
              </Box>
              <Button
                variant="outlined"
                size="small"
                onClick={() => setSelectedPatient(null)}
              >
                Change Patient
              </Button>
            </Box>

            <Divider sx={{ mb: 3 }} />

            {/* Session Details Form */}
            <Box display="flex" flexDirection="column" gap={2}>
              <TextField
                fullWidth
                label="Session Title"
                value={sessionTitle}
                onChange={(e) => setSessionTitle(e.target.value)}
                required
              />

              <TextField
                fullWidth
                label="Session Description (Optional)"
                value={sessionDescription}
                onChange={(e) => setSessionDescription(e.target.value)}
                multiline
                rows={2}
              />

              <FormControl fullWidth>
                <InputLabel>Estimated Duration</InputLabel>
                <Select
                  value={estimatedDuration}
                  label="Estimated Duration"
                  onChange={(e) => setEstimatedDuration(e.target.value as number)}
                >
                  <MenuItem value={30}>30 minutes</MenuItem>
                  <MenuItem value={45}>45 minutes</MenuItem>
                  <MenuItem value={60}>60 minutes</MenuItem>
                  <MenuItem value={90}>90 minutes</MenuItem>
                  <MenuItem value={120}>2 hours</MenuItem>
                </Select>
              </FormControl>

              {selectedPatient.activeInvitation && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  <Typography variant="body2">
                    This patient has a pending invitation. Starting a new session will cancel the previous invitation.
                  </Typography>
                </Alert>
              )}
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={initiatingSession}>
          Cancel
        </Button>
        {selectedPatient && (
          <Button
            variant="contained"
            onClick={initiateSession}
            disabled={initiatingSession || !sessionTitle.trim()}
            startIcon={initiatingSession ? <CircularProgress size={20} /> : <VideoCall />}
          >
            {initiatingSession ? 'Starting Session...' : 'Start Session'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default PatientSelector;