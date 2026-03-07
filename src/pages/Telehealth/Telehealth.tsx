import React, { useState, useEffect, useRef } from 'react';
import {
  Typography,
  Paper,
  Box,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Badge,
  Divider,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import {
  Videocam,
  VideocamOff,
  Mic,
  MicOff,
  ScreenShare,
  StopScreenShare,
  CallEnd,
  Chat,
  Settings,
  FiberManualRecord,
  Stop,
  People,
  VolumeUp,
  FullscreenExit,
  Fullscreen,
  AdminPanelSettings,
  Block,
  PersonRemove,
  VolumeOff as MuteIcon,
  PlayArrow,
  Pause,
  Lock,
  LockOpen,
  AccessTime,
  Warning,
  PersonAdd,
  Notifications,
  VideoCall,
} from '@mui/icons-material';
import { telehealthService } from '../../services/telehealthService';
import PatientSelector from '../../components/Telehealth/PatientSelector';
import PatientInvitations from '../../components/Telehealth/PatientInvitations';
import RecordingTranscriptionPanel from '../../components/Telehealth/RecordingTranscriptionPanel';
import { 
  TelehealthSession, 
  DeviceInfo, 
  ChatMessage, 
  TelehealthTechnicalCheck,
  SessionParticipant,
  ParticipantRole,
  SessionAction,
  SessionActionType,
  UserRole
} from '../../types';
import { useAuth } from '../../contexts/AuthContext';

interface TelehealthProps {}

const Telehealth: React.FC<TelehealthProps> = () => {
  const { state } = useAuth();
  const user = state.user;

  // Core session state
  const [session, setSession] = useState<TelehealthSession | null>(null);
  const [sessionId, setSessionId] = useState<string>('');
  const [isInSession, setIsInSession] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');

  // Patient selection and invitation state
  const [showPatientSelector, setShowPatientSelector] = useState(false);
  const [showInvitations, setShowInvitations] = useState(false);

  // Recording and transcription state
  const [showRecordingPanel, setShowRecordingPanel] = useState(false);
  const [recordingActive, setRecordingActive] = useState(false);

  // Media controls state
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [microphoneEnabled, setMicrophoneEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [volume, setVolume] = useState(50);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Device and technical state
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [technicalCheck, setTechnicalCheck] = useState<TelehealthTechnicalCheck | null>(null);
  const [connectionStats, setConnectionStats] = useState<any>(null);

  // UI state
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  
  // Session control state (therapist/admin)
  const [userRole, setUserRole] = useState<ParticipantRole>(ParticipantRole.PATIENT);
  const [participants, setParticipants] = useState<SessionParticipant[]>([]);
  const [sessionActions, setSessionActions] = useState<SessionAction[]>([]);
  const [showControlPanel, setShowControlPanel] = useState(false);
  const [selectedParticipant] = useState<string | null>(null);
  const [sessionLocked, setSessionLocked] = useState(false);
  const [sessionPaused, setSessionPaused] = useState(false);

  // Video refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize component
  useEffect(() => {
    initializeDevices();
    performTechnicalCheck();
  }, []);

  // Update video streams
  useEffect(() => {
    const localStream = telehealthService.getLocalStream();
    const remoteStream = telehealthService.getRemoteStream();

    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }

    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [isInSession]);

  // Connection stats monitoring
  useEffect(() => {
    if (isInSession && connectionStatus === 'connected') {
      const interval = setInterval(async () => {
        const stats = await telehealthService.getConnectionStats();
        setConnectionStats(stats);
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [isInSession, connectionStatus]);

  const initializeDevices = async () => {
    try {
      const devices = await telehealthService.getAvailableDevices();
      setDeviceInfo(devices);
    } catch (error) {
      console.error('Failed to initialize devices:', error);
    }
  };

  const performTechnicalCheck = async () => {
    try {
      const result = await telehealthService.performTechnicalCheck();
      if (result.success && result.data) {
        setTechnicalCheck(result.data);
      }
    } catch (error) {
      console.error('Technical check failed:', error);
    }
  };

  const startSession = async () => {
    if (!sessionId) {
      alert('Please enter a session ID');
      return;
    }

    setIsConnecting(true);
    setConnectionStatus('connecting');

    try {
      // Get user media first
      const stream = await telehealthService.getUserMedia({ video: true, audio: true });
      if (!stream) {
        throw new Error('Failed to get user media');
      }

      // Join session
      const result = await telehealthService.joinSession(sessionId, deviceInfo!);
      if (result.success && result.data) {
        // Initialize WebRTC
        await telehealthService.initializeWebRTC(result.data.iceServers);
        
        setIsInSession(true);
        setConnectionStatus('connected');
        
        // Load session data
        const sessionResult = await telehealthService.getSession(sessionId);
        if (sessionResult.success && sessionResult.data) {
          setSession(sessionResult.data);
        }

        // Load chat history
        const chatResult = await telehealthService.getChatHistory(sessionId);
        if (chatResult.success && chatResult.data) {
          setChatMessages(chatResult.data);
        }

        // Load session controls for therapists/admins
        await loadSessionControls();
        
        // Update participants list
        if (sessionResult.success && sessionResult.data?.participants) {
          setParticipants(sessionResult.data.participants);
        }
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error('Failed to start session:', error);
      setConnectionStatus('disconnected');
      alert('Failed to join session. Please check your connection and try again.');
    } finally {
      setIsConnecting(false);
    }
  };

  const endSession = async () => {
    try {
      await telehealthService.leaveSession(sessionId);
      setIsInSession(false);
      setConnectionStatus('disconnected');
      setSession(null);
      setChatMessages([]);
      setIsRecording(false);
      setIsScreenSharing(false);
    } catch (error) {
      console.error('Failed to end session:', error);
    }
  };

  const toggleCamera = () => {
    const enabled = telehealthService.toggleCamera();
    setCameraEnabled(enabled);
  };

  const toggleMicrophone = () => {
    const enabled = telehealthService.toggleMicrophone();
    setMicrophoneEnabled(enabled);
  };

  const toggleScreenShare = async () => {
    try {
      if (isScreenSharing) {
        await telehealthService.stopScreenShare();
        setIsScreenSharing(false);
      } else {
        const screenStream = await telehealthService.startScreenShare();
        if (screenStream) {
          setIsScreenSharing(true);
        }
      }
    } catch (error) {
      console.error('Failed to toggle screen share:', error);
    }
  };

  const toggleRecording = async () => {
    try {
      if (isRecording) {
        const result = await telehealthService.stopRecording(sessionId);
        if (result.success) {
          setIsRecording(false);
          alert(`Recording saved: ${result.data?.filePath || 'Recording completed'}`);
        }
      } else {
        const result = await telehealthService.startRecording(sessionId);
        if (result.success) {
          setIsRecording(true);
        }
      }
    } catch (error) {
      console.error('Failed to toggle recording:', error);
    }
  };

  const sendChatMessage = async () => {
    if (!newMessage.trim() || !sessionId) return;

    try {
      const result = await telehealthService.sendChatMessage(sessionId, newMessage);
      if (result.success && result.data) {
        setChatMessages(prev => [...prev, result.data!]);
        setNewMessage('');
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const getConnectionQuality = () => {
    if (!connectionStats) return 'unknown';
    
    const { connection } = connectionStats;
    if (connection?.roundTripTime < 100) return 'excellent';
    if (connection?.roundTripTime < 200) return 'good';
    if (connection?.roundTripTime < 300) return 'fair';
    return 'poor';
  };

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'excellent': return 'success';
      case 'good': return 'info';
      case 'fair': return 'warning';
      case 'poor': return 'error';
      default: return 'default';
    }
  };

  // ===== PATIENT SELECTION AND SESSION MANAGEMENT =====

  const handleSessionInitiated = (newSessionId: string, _patientId: string) => {
    setSessionId(newSessionId);
    setShowPatientSelector(false);
    // Automatically start the session for the therapist
    setTimeout(() => {
      startSession();
    }, 1000);
  };

  const handleJoinSessionFromInvitation = (newSessionId: string) => {
    setSessionId(newSessionId);
    setShowInvitations(false);
    // Automatically join the session for the patient
    setTimeout(() => {
      startSession();
    }, 1000);
  };

  const canSelectPatients = () => {
    return user && (user.role === UserRole.THERAPIST || user.role === UserRole.ADMIN);
  };

  const isPatient = () => {
    return user && user.role === UserRole.CLIENT;
  };

  // ===== SESSION CONTROL FUNCTIONS (THERAPIST/ADMIN) =====

  const loadSessionControls = async () => {
    if (!sessionId) return;
    
    try {
      const result = await telehealthService.getSessionControls(sessionId);
      if (result.success && result.data) {
        setUserRole(result.data.controllerRole);
      }

      const actionsResult = await telehealthService.getSessionActions(sessionId);
      if (actionsResult.success && actionsResult.data) {
        setSessionActions(actionsResult.data);
      }
    } catch (error) {
      console.error('Failed to load session controls:', error);
    }
  };

  const handleParticipantAction = async (action: SessionActionType, participantId: string, reason?: string) => {
    try {
      let result;
      
      switch (action) {
        case SessionActionType.MUTE_PARTICIPANT:
          result = await telehealthService.muteParticipant(sessionId, participantId, reason);
          break;
        case SessionActionType.UNMUTE_PARTICIPANT:
          result = await telehealthService.unmuteParticipant(sessionId, participantId);
          break;
        case SessionActionType.DISABLE_VIDEO:
          result = await telehealthService.disableParticipantVideo(sessionId, participantId, reason);
          break;
        case SessionActionType.ENABLE_VIDEO:
          result = await telehealthService.enableParticipantVideo(sessionId, participantId);
          break;
        case SessionActionType.REMOVE_PARTICIPANT:
          result = await telehealthService.removeParticipant(sessionId, participantId, reason || 'Removed by moderator');
          break;
        case SessionActionType.SEND_TO_WAITING:
          result = await telehealthService.sendToWaiting(sessionId, participantId, reason);
          break;
        case SessionActionType.ADMIT_FROM_WAITING:
          result = await telehealthService.admitFromWaiting(sessionId, participantId);
          break;
        case SessionActionType.WARN_PARTICIPANT:
          result = await telehealthService.warnParticipant(sessionId, participantId, reason || 'Please follow session guidelines');
          break;
        default:
          console.warn('Unknown participant action:', action);
          return;
      }

      if (result.success) {
        // Refresh session data
        await loadSessionControls();
        alert(`Action completed successfully`);
      } else {
        alert(`Failed to perform action: ${result.message}`);
      }
    } catch (error) {
      console.error('Failed to perform participant action:', error);
      alert('Action failed. Please try again.');
    }
  };

  const handleSessionAction = async (action: SessionActionType, parameters?: any) => {
    try {
      let result;
      
      switch (action) {
        case SessionActionType.LOCK_SESSION:
          result = await telehealthService.lockSession(sessionId);
          setSessionLocked(true);
          break;
        case SessionActionType.UNLOCK_SESSION:
          result = await telehealthService.unlockSession(sessionId);
          setSessionLocked(false);
          break;
        case SessionActionType.PAUSE_SESSION:
          result = await telehealthService.pauseSession(sessionId, parameters?.reason);
          setSessionPaused(true);
          break;
        case SessionActionType.RESUME_SESSION:
          result = await telehealthService.resumeSession(sessionId);
          setSessionPaused(false);
          break;
        case SessionActionType.END_SESSION:
          result = await telehealthService.endSessionForAll(sessionId, parameters?.reason);
          break;
        case SessionActionType.EXTEND_SESSION:
          result = await telehealthService.extendSession(sessionId, parameters?.minutes || 15);
          break;
        case SessionActionType.DISABLE_CHAT:
          result = await telehealthService.disableChat(sessionId);
          break;
        case SessionActionType.ENABLE_CHAT:
          result = await telehealthService.enableChat(sessionId);
          break;
        default:
          console.warn('Unknown session action:', action);
          return;
      }

      if (result.success) {
        await loadSessionControls();
        alert(`Session action completed successfully`);
      } else {
        alert(`Failed to perform action: ${result.message}`);
      }
    } catch (error) {
      console.error('Failed to perform session action:', error);
      alert('Action failed. Please try again.');
    }
  };

  const emergencyEndSession = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to immediately end this session for all participants? This action cannot be undone.'
    );
    
    if (confirmed) {
      try {
        const result = await telehealthService.emergencyShutdown(sessionId, 'Emergency termination by moderator');
        if (result.success) {
          setIsInSession(false);
          setConnectionStatus('disconnected');
          alert('Session ended immediately for all participants.');
        }
      } catch (error) {
        console.error('Emergency shutdown failed:', error);
        alert('Failed to end session. Please try again.');
      }
    }
  };

  const isTherapistOrAdmin = () => {
    return userRole === ParticipantRole.THERAPIST || 
           userRole === ParticipantRole.HOST || 
           userRole === ParticipantRole.SUPERVISOR;
  };

  // Recording and transcription handlers
  const handleToggleRecordingPanel = () => {
    setShowRecordingPanel(!showRecordingPanel);
  };

  if (!isInSession) {
    return (
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          Telehealth Session
        </Typography>

        <Grid container spacing={3}>
          {/* Session Setup */}
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Join Telehealth Session
                </Typography>
                
                <Box sx={{ mb: 3 }}>
                  <TextField
                    fullWidth
                    label="Session ID"
                    value={sessionId}
                    onChange={(e) => setSessionId(e.target.value)}
                    placeholder="Enter session ID or appointment ID"
                    margin="normal"
                  />
                </Box>

                {deviceInfo && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Device Status
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <Chip
                        icon={<Videocam />}
                        label={deviceInfo.camera ? 'Camera Ready' : 'No Camera'}
                        color={deviceInfo.camera ? 'success' : 'error'}
                        size="small"
                      />
                      <Chip
                        icon={<Mic />}
                        label={deviceInfo.microphone ? 'Microphone Ready' : 'No Microphone'}
                        color={deviceInfo.microphone ? 'success' : 'error'}
                        size="small"
                      />
                      <Chip
                        icon={<VolumeUp />}
                        label={deviceInfo.speakers ? 'Speakers Ready' : 'No Speakers'}
                        color={deviceInfo.speakers ? 'success' : 'error'}
                        size="small"
                      />
                    </Box>
                  </Box>
                )}
              </CardContent>
              
              <CardActions>
                <Button
                  variant="contained"
                  onClick={startSession}
                  disabled={isConnecting || !sessionId}
                  startIcon={isConnecting ? <CircularProgress size={20} /> : <Videocam />}
                >
                  {isConnecting ? 'Joining...' : 'Join Session'}
                </Button>
                
                <Button
                  onClick={performTechnicalCheck}
                  startIcon={<Settings />}
                >
                  Technical Check
                </Button>
              </CardActions>
            </Card>
          </Grid>

          {/* Technical Check Results */}
          {technicalCheck && (
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    System Check
                  </Typography>
                  
                  <List dense>
                    <ListItem>
                      <ListItemText
                        primary="Browser"
                        secondary={`${technicalCheck.browserInfo.name} ${technicalCheck.browserInfo.version}`}
                      />
                      <Chip
                        size="small"
                        label={technicalCheck.browserInfo.webRtcSupported ? 'Supported' : 'Not Supported'}
                        color={technicalCheck.browserInfo.webRtcSupported ? 'success' : 'error'}
                      />
                    </ListItem>
                    
                    <ListItem>
                      <ListItemText
                        primary="Camera"
                        secondary={`${technicalCheck.deviceCapabilities.cameras.length} camera(s) found`}
                      />
                      <Chip
                        size="small"
                        label={technicalCheck.deviceCapabilities.permissions.camera === 'granted' ? 'Granted' : 'Denied'}
                        color={technicalCheck.deviceCapabilities.permissions.camera === 'granted' ? 'success' : 'error'}
                      />
                    </ListItem>
                    
                    <ListItem>
                      <ListItemText
                        primary="Microphone"
                        secondary={`${technicalCheck.deviceCapabilities.microphones.length} microphone(s) found`}
                      />
                      <Chip
                        size="small"
                        label={technicalCheck.deviceCapabilities.permissions.microphone === 'granted' ? 'Granted' : 'Denied'}
                        color={technicalCheck.deviceCapabilities.permissions.microphone === 'granted' ? 'success' : 'error'}
                      />
                    </ListItem>

                    <ListItem>
                      <ListItemText
                        primary="Network"
                        secondary={`${technicalCheck.networkTest.latency}ms latency`}
                      />
                      <Chip
                        size="small"
                        label={technicalCheck.networkTest.downloadSpeed > 1 ? 'Good' : 'Slow'}
                        color={technicalCheck.networkTest.downloadSpeed > 1 ? 'success' : 'warning'}
                      />
                    </ListItem>
                  </List>
                </CardContent>
              </Card>
            </Grid>
          )}

          {/* Patient Invitations Section (for patients only) */}
          {isPatient() && (
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <PatientInvitations onJoinSession={handleJoinSessionFromInvitation} />
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>

        {/* Instructions */}
        <Box sx={{ mt: 3 }}>
          <Alert severity="info">
            <Typography variant="body2">
              <strong>Before joining:</strong> Make sure your camera and microphone are working, 
              and you have a stable internet connection. Run the technical check if you encounter any issues.
            </Typography>
          </Alert>
        </Box>
      </Paper>
    );
  }

  return (
    <Box ref={containerRef} sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header with session info and controls */}
      <Paper sx={{ p: 2, borderRadius: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="h6">
              Telehealth Session
            </Typography>
            
            {session && (
              <Chip
                label={`Session: ${session.id.substring(0, 8)}`}
                size="small"
              />
            )}

            <Chip
              label={connectionStatus}
              color={getQualityColor(getConnectionQuality()) as any}
              size="small"
            />

            {isRecording && (
              <Chip
                icon={<FiberManualRecord sx={{ color: 'red' }} />}
                label="Recording"
                color="error"
                size="small"
              />
            )}
          </Box>

          <Box sx={{ display: 'flex', gap: 1 }}>
            {/* Patient Selection for Therapists/Admins */}
            {canSelectPatients() && !isInSession && (
              <Button
                variant="contained"
                startIcon={<PersonAdd />}
                onClick={() => setShowPatientSelector(true)}
                size="small"
              >
                Select Patient
              </Button>
            )}

            {/* Patient Invitations for Patients */}
            {isPatient() && !isInSession && (
              <Button
                variant="outlined"
                startIcon={<Notifications />}
                onClick={() => setShowInvitations(true)}
                size="small"
              >
                View Invitations
              </Button>
            )}

            <IconButton onClick={() => setShowControlPanel(true)}>
              <Badge badgeContent={session?.participants?.length || 0} color="primary">
                <People />
              </Badge>
            </IconButton>

            <IconButton onClick={() => setShowChat(!showChat)}>
              <Badge badgeContent={chatMessages.length} color="primary">
                <Chat />
              </Badge>
            </IconButton>

            <IconButton onClick={toggleFullscreen}>
              {isFullscreen ? <FullscreenExit /> : <Fullscreen />}
            </IconButton>

            <IconButton onClick={() => setShowSettings(true)}>
              <Settings />
            </IconButton>

            {isTherapistOrAdmin() && (
              <IconButton 
                onClick={() => setShowControlPanel(true)}
                color="primary"
                sx={{ backgroundColor: 'primary.light' }}
              >
                <AdminPanelSettings />
              </IconButton>
            )}
          </Box>
        </Box>
      </Paper>

      {/* Main video area */}
      <Box sx={{ flex: 1, display: 'flex', position: 'relative', bg: 'black' }}>
        {/* Remote video (main) */}
        <Box sx={{ flex: 1, position: 'relative' }}>
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              backgroundColor: '#000',
            }}
          />
          
          {!remoteVideoRef.current?.srcObject && (
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(0,0,0,0.7)',
                color: 'white',
              }}
            >
              <Typography variant="h6">
                Waiting for other participants...
              </Typography>
            </Box>
          )}
        </Box>

        {/* Local video (picture-in-picture) */}
        <Box
          sx={{
            position: 'absolute',
            top: 16,
            right: showChat ? 320 : 16,
            width: 200,
            height: 150,
            borderRadius: 1,
            overflow: 'hidden',
            border: '2px solid white',
            transition: 'right 0.3s ease',
          }}
        >
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: 'scaleX(-1)', // Mirror local video
            }}
          />
          
          {!cameraEnabled && (
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(0,0,0,0.8)',
                color: 'white',
              }}
            >
              <VideocamOff />
            </Box>
          )}
        </Box>

        {/* Chat sidebar */}
        {showChat && (
          <Paper
            sx={{
              width: 300,
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 0,
            }}
          >
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="h6">Chat</Typography>
            </Box>
            
            <Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>
              <List dense>
                {chatMessages.map((message, index) => (
                  <ListItem key={index} alignItems="flex-start">
                    <ListItemAvatar>
                      <Avatar sx={{ width: 32, height: 32 }}>
                        {message.senderName?.[0] || 'U'}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="subtitle2">
                            {message.senderName || 'Unknown'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {new Date(message.timestamp).toLocaleTimeString()}
                          </Typography>
                        </Box>
                      }
                      secondary={message.content}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
            
            <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                />
                <Button onClick={sendChatMessage} disabled={!newMessage.trim()}>
                  Send
                </Button>
              </Box>
            </Box>
          </Paper>
        )}

        {/* Recording and Transcription Panel */}
        {showRecordingPanel && (
          <Box sx={{ 
            position: 'absolute', 
            top: 0, 
            right: showChat ? 300 : 0, 
            width: 400, 
            height: '100%',
            zIndex: 1000 
          }}>
            <RecordingTranscriptionPanel
              sessionId={sessionId || ''}
              onRecordingStateChange={setRecordingActive}
              onTranscriptionUpdate={(entries) => {
                console.log('Transcription updated:', entries);
              }}
            />
          </Box>
        )}
      </Box>

      {/* Bottom controls */}
      <Paper sx={{ p: 2, borderRadius: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
          <Tooltip title={cameraEnabled ? 'Turn off camera' : 'Turn on camera'}>
            <IconButton
              onClick={toggleCamera}
              color={cameraEnabled ? 'primary' : 'error'}
              sx={{ 
                backgroundColor: cameraEnabled ? 'primary.light' : 'error.light',
                '&:hover': {
                  backgroundColor: cameraEnabled ? 'primary.main' : 'error.main',
                },
              }}
            >
              {cameraEnabled ? <Videocam /> : <VideocamOff />}
            </IconButton>
          </Tooltip>

          <Tooltip title={microphoneEnabled ? 'Mute microphone' : 'Unmute microphone'}>
            <IconButton
              onClick={toggleMicrophone}
              color={microphoneEnabled ? 'primary' : 'error'}
              sx={{ 
                backgroundColor: microphoneEnabled ? 'primary.light' : 'error.light',
                '&:hover': {
                  backgroundColor: microphoneEnabled ? 'primary.main' : 'error.main',
                },
              }}
            >
              {microphoneEnabled ? <Mic /> : <MicOff />}
            </IconButton>
          </Tooltip>

          <Tooltip title={isScreenSharing ? 'Stop sharing' : 'Share screen'}>
            <IconButton
              onClick={toggleScreenShare}
              color={isScreenSharing ? 'secondary' : 'default'}
            >
              {isScreenSharing ? <StopScreenShare /> : <ScreenShare />}
            </IconButton>
          </Tooltip>

          <Tooltip title={isRecording ? 'Stop recording' : 'Start recording'}>
            <IconButton
              onClick={toggleRecording}
              color={isRecording ? 'error' : 'default'}
            >
              {isRecording ? <Stop /> : <FiberManualRecord />}
            </IconButton>
          </Tooltip>

          <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

          <Tooltip title="End session">
            <IconButton
              onClick={endSession}
              color="error"
              sx={{ 
                backgroundColor: 'error.light',
                '&:hover': {
                  backgroundColor: 'error.main',
                },
              }}
            >
              <CallEnd />
            </IconButton>
          </Tooltip>
        </Box>
      </Paper>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onClose={() => setShowSettings(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Session Settings</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <FormControlLabel
              control={<Switch checked={cameraEnabled} onChange={() => toggleCamera()} />}
              label="Camera"
            />
            
            <FormControlLabel
              control={<Switch checked={microphoneEnabled} onChange={() => toggleMicrophone()} />}
              label="Microphone"
            />
            
            <Box sx={{ mt: 2 }}>
              <Typography gutterBottom>Speaker Volume</Typography>
              <input
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(e) => setVolume(parseInt(e.target.value))}
                style={{ width: '100%' }}
              />
            </Box>

            {connectionStats && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Connection Statistics
                </Typography>
                <Typography variant="body2">
                  Round Trip Time: {connectionStats.connection?.roundTripTime || 0}ms
                </Typography>
                <Typography variant="body2">
                  Video Packets Received: {connectionStats.video?.packetsReceived || 0}
                </Typography>
                <Typography variant="body2">
                  Audio Packets Received: {connectionStats.audio?.packetsReceived || 0}
                </Typography>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSettings(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Session Control Panel (Therapist/Admin) */}
      <Dialog 
        open={showControlPanel} 
        onClose={() => setShowControlPanel(false)} 
        maxWidth="lg" 
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AdminPanelSettings />
            Session Control Panel
            <Chip 
              label={userRole} 
              color="primary" 
              size="small" 
              sx={{ ml: 1 }}
            />
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Grid container spacing={3}>
            {/* Session Controls */}
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>
                Session Management
              </Typography>
              
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                <Button
                  variant="outlined"
                  startIcon={sessionLocked ? <LockOpen /> : <Lock />}
                  onClick={() => handleSessionAction(
                    sessionLocked ? SessionActionType.UNLOCK_SESSION : SessionActionType.LOCK_SESSION
                  )}
                  color={sessionLocked ? 'warning' : 'info'}
                >
                  {sessionLocked ? 'Unlock Session' : 'Lock Session'}
                </Button>

                <Button
                  variant="outlined"
                  startIcon={sessionPaused ? <PlayArrow /> : <Pause />}
                  onClick={() => handleSessionAction(
                    sessionPaused ? SessionActionType.RESUME_SESSION : SessionActionType.PAUSE_SESSION
                  )}
                  color={sessionPaused ? 'success' : 'warning'}
                >
                  {sessionPaused ? 'Resume Session' : 'Pause Session'}
                </Button>

                <Button
                  variant="outlined"
                  startIcon={<AccessTime />}
                  onClick={() => handleSessionAction(SessionActionType.EXTEND_SESSION, { minutes: 15 })}
                  color="info"
                >
                  Extend +15min
                </Button>

                <Button
                  variant="outlined"
                  startIcon={<CallEnd />}
                  onClick={() => handleSessionAction(SessionActionType.END_SESSION)}
                  color="error"
                >
                  End Session
                </Button>

                <Button
                  variant="contained"
                  startIcon={<Warning />}
                  onClick={emergencyEndSession}
                  color="error"
                  sx={{ ml: 2 }}
                >
                  Emergency End
                </Button>
              </Box>

              <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
                Recording & Chat Controls
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <Button
                  variant={showRecordingPanel ? "contained" : "outlined"}
                  startIcon={<VideoCall />}
                  onClick={handleToggleRecordingPanel}
                  color={recordingActive ? "error" : "primary"}
                >
                  {showRecordingPanel ? 'Hide Recording' : 'Show Recording'}
                </Button>

                <Button
                  variant="outlined"
                  startIcon={<Chat />}
                  onClick={() => handleSessionAction(SessionActionType.DISABLE_CHAT)}
                  color="warning"
                >
                  Disable Chat
                </Button>

                <Button
                  variant="outlined"
                  startIcon={<Chat />}
                  onClick={() => handleSessionAction(SessionActionType.ENABLE_CHAT)}
                  color="success"
                >
                  Enable Chat
                </Button>
              </Box>
            </Grid>

            {/* Participant Management */}
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>
                Participant Management
              </Typography>
              
              <List dense sx={{ maxHeight: 300, overflow: 'auto' }}>
                {participants.map((participant) => (
                  <ListItem 
                    key={participant.id}
                    sx={{ 
                      border: 1, 
                      borderColor: 'divider', 
                      borderRadius: 1, 
                      mb: 1,
                      backgroundColor: selectedParticipant === participant.id ? 'action.selected' : 'background.paper'
                    }}
                  >
                    <ListItemAvatar>
                      <Avatar>
                        {participant.userName?.[0] || 'U'}
                      </Avatar>
                    </ListItemAvatar>
                    
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {participant.userName}
                          <Chip 
                            label={participant.role} 
                            size="small" 
                            color={participant.role === ParticipantRole.THERAPIST ? 'primary' : 'default'}
                          />
                          <Chip 
                            label={participant.connectionQuality} 
                            size="small" 
                            color={getQualityColor(participant.connectionQuality) as any}
                          />
                        </Box>
                      }
                      secondary={`Status: ${participant.status} • Joined: ${participant.joinedAt ? new Date(participant.joinedAt).toLocaleTimeString() : 'Unknown'}`}
                    />
                    
                    {participant.role !== ParticipantRole.THERAPIST && participant.role !== ParticipantRole.HOST && (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        <IconButton
                          size="small"
                          onClick={() => handleParticipantAction(SessionActionType.MUTE_PARTICIPANT, participant.id)}
                          title="Mute Participant"
                        >
                          <MuteIcon />
                        </IconButton>
                        
                        <IconButton
                          size="small"
                          onClick={() => handleParticipantAction(SessionActionType.DISABLE_VIDEO, participant.id)}
                          title="Disable Video"
                        >
                          <VideocamOff />
                        </IconButton>
                        
                        <IconButton
                          size="small"
                          onClick={() => handleParticipantAction(SessionActionType.SEND_TO_WAITING, participant.id)}
                          title="Send to Waiting Room"
                          color="warning"
                        >
                          <Block />
                        </IconButton>
                        
                        <IconButton
                          size="small"
                          onClick={() => handleParticipantAction(
                            SessionActionType.REMOVE_PARTICIPANT, 
                            participant.id, 
                            'Removed by moderator'
                          )}
                          title="Remove Participant"
                          color="error"
                        >
                          <PersonRemove />
                        </IconButton>
                      </Box>
                    )}
                  </ListItem>
                ))}
              </List>
            </Grid>

            {/* Recent Actions Log */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Recent Session Actions
              </Typography>
              
              <Box sx={{ maxHeight: 200, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1, p: 1 }}>
                {sessionActions.length > 0 ? (
                  sessionActions.slice(-10).reverse().map((action, index) => (
                    <Box 
                      key={index}
                      sx={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        py: 0.5,
                        borderBottom: index < 9 ? '1px solid' : 'none',
                        borderColor: 'divider'
                      }}
                    >
                      <Typography variant="body2">
                        <strong>{action.type.replace(/_/g, ' ')}</strong>
                        {action.targetId && ` → ${participants.find(p => p.id === action.targetId)?.userName || 'Unknown'}`}
                        {action.reason && ` (${action.reason})`}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(action.timestamp).toLocaleTimeString()}
                      </Typography>
                    </Box>
                  ))
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                    No actions recorded yet
                  </Typography>
                )}
              </Box>
            </Grid>
          </Grid>
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setShowControlPanel(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Patient Selection Dialog (Therapists/Admins) */}
      <PatientSelector
        open={showPatientSelector}
        onClose={() => setShowPatientSelector(false)}
        onSessionInitiated={handleSessionInitiated}
      />

      {/* Patient Invitations Component (Patients) */}
      {showInvitations && (
        <Dialog
          open={showInvitations}
          onClose={() => setShowInvitations(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Typography variant="h6">Session Invitations</Typography>
              <IconButton onClick={() => setShowInvitations(false)} size="small">
                <CallEnd />
              </IconButton>
            </Box>
          </DialogTitle>
          <DialogContent>
            <PatientInvitations onJoinSession={handleJoinSessionFromInvitation} />
          </DialogContent>
        </Dialog>
      )}
    </Box>
  );
};

export default Telehealth;