import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Paper,
  IconButton,
  Button,
  Typography,
  Chip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Drawer,
  List,
  ListItem,
  ListItemText,
  Divider,
} from '@mui/material';
import {
  Videocam,
  VideocamOff,
  Mic,
  MicOff,
  CallEnd,
  FiberManualRecord,
  Transcribe,
  StopCircle,
} from '@mui/icons-material';
import PeopleIcon from '@mui/icons-material/People';
import { useParams, useNavigate } from 'react-router-dom';
import { useNotification } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';
import { apiClient } from '../../services/apiClient';
import { useTelehealthMedia } from '../../hooks/telehealth/useTelehealthMedia';
import { useWebRTC } from '../../hooks/telehealth/useWebRTC';
import { webSocketService, WebSocketMessage } from '../../services/webSocketService';
import { SessionDetails } from '../../types';

const VideoSession: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotification();
  const { state } = useAuth();
  const user = state.user;

  // Session state
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [sessionDuration, setSessionDuration] = useState(0);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<SessionDetails | null>(null);
  const [sessionError, setSessionError] = useState<'not_found' | 'forbidden' | 'not_started' | null>(null);

  // Recording and Transcription
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptText, setTranscriptText] = useState<string[]>([]);
  const [showTranscript, setShowTranscript] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isSpeechDetected, setIsSpeechDetected] = useState(false);
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const participantCountRef = useRef(0);
  // webSocketService is a module-level singleton – no ref needed
  const isInitiatorRef = useRef(false);
  
  // Participant tracking
  const [participantCount, setParticipantCount] = useState(1); // Start at 1 for self
  const [participantName, setParticipantName] = useState<string>('');

  // Dialogs
  const [showEndDialog, setShowEndDialog] = useState(false);

  // --- Hooks ---
  const {
    localVideoRef,
    localStream,
    isCameraOn,
    isMicOn,
    mediaInitFailed,
    isRetryingMedia,
    startLocalMedia,
    stopLocalMedia,
    toggleCamera,
    toggleMicrophone,
    retryMediaAccess,
  } = useTelehealthMedia(showError);

  const sendMessage = useCallback((msg: WebSocketMessage) => {
    webSocketService.sendMessage(msg);
  }, []);

  const {
    remoteVideoRef,
    isRemoteVideoReady,
    isRemotePlaybackBlocked,
    remoteStream,
    initializePeerConnection,
    createOffer,
    handleOffer,
    handleAnswer,
    addIceCandidate,
    closePeerConnection,
  } = useWebRTC({
    sendMessage,
    onError: showError,
  });

  // Fetch session details
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const response = await apiClient.get(`/telehealth/sessions/${sessionId}/`);
        const session = response.data as SessionDetails;
        // Block entry if session hasn't started (still scheduled)
        if (session.status === 'scheduled') {
          setSessionError('not_started');
          return;
        }
        setRoomId(session.room_id);
        setSessionData(session);
        console.log('[VIDEO] Session loaded:', session);
      } catch (error: unknown) {
        const status = (error as { response?: { status?: number } })?.response?.status;
        if (status === 404) {
          setSessionError('not_found');
        } else if (status === 403) {
          setSessionError('forbidden');
        } else {
          setSessionError('not_found');
          console.error('[VIDEO] Error fetching session:', error);
        }
      }
    };

    if (sessionId) {
      fetchSession().catch(console.error);
    }
  }, [sessionId]);

  // Session timer
  useEffect(() => {
    if (sessionStartTime) {
      const interval = setInterval(() => {
        const now = new Date();
        const diff = Math.floor((now.getTime() - sessionStartTime.getTime()) / 1000);
        setSessionDuration(diff);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [sessionStartTime]);

  const connectWebSocket = useCallback(async () => {
    if (!roomId || !user) return;

    const token = localStorage.getItem('access_token') || localStorage.getItem('token') || '';

    try {
      await webSocketService.connect(sessionId ?? roomId, user.id, {
        token,
        displayName: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || 'Participant',
        role: (user.role as string) ?? 'client',
      });
    } catch (err) {
      console.error('[VIDEO] Socket.io connection error:', err);
      showError('Failed to connect to session server');
      return;
    }

    // Join the signaling room using the roomId from the session record
    webSocketService.joinRoom(roomId, sessionId ?? undefined);

    // ── Inbound signaling handlers ──────────────────────────────────────────

    webSocketService.on('participant-joined', (data) => {
      const name = (data.displayName as string) || 'A participant';
      console.log('[VIDEO] Participant joined:', name);
      showSuccess(`${name} joined the session`);
      participantCountRef.current += 1;
      setParticipantCount(participantCountRef.current + 1);
      setParticipantName(name);
      isInitiatorRef.current = true;
      setTimeout(() => { void createOffer(); }, 500);
    });

    webSocketService.on('offer', async (data) => {
      const offer = data.offer as RTCSessionDescriptionInit | undefined;
      if (localStream && offer) {
        await handleOffer(offer, localStream);
      } else {
        console.warn('[VIDEO] Received offer but local stream is not ready');
      }
    });

    webSocketService.on('answer', async (data) => {
      const answer = data.answer as RTCSessionDescriptionInit | undefined;
      if (answer) await handleAnswer(answer);
    });

    webSocketService.on('ice-candidate', async (data) => {
      const candidate = data.candidate as RTCIceCandidateInit | undefined;
      if (candidate) await addIceCandidate(candidate);
    });

    webSocketService.on('participant-left', () => {
      console.log('[VIDEO] Participant left');
      showError('Other participant left the session');
      participantCountRef.current = Math.max(0, participantCountRef.current - 1);
      setParticipantCount(participantCountRef.current + 1);
      setParticipantName('');
      closePeerConnection();
    });

    webSocketService.on('disconnected', () => {
      showError('Connection to session server lost');
    });

    showSuccess('Connected to session server');
  }, [roomId, sessionId, user, showSuccess, showError, createOffer, handleOffer, handleAnswer, addIceCandidate, closePeerConnection, localStream]);

  // Start Session Effect
  useEffect(() => {
    const initSession = async () => {
      if (roomId && !localStream) {
        const stream = await startLocalMedia();
        if (stream) {
          // Once media is ready, connect signaling
          await connectWebSocket();
          // Initialize PC (as non-initiator by default, until participant joins)
          await initializePeerConnection(stream, false); 
          setSessionStartTime(new Date());
        }
      }
    };

    initSession().catch(console.error);

    return () => {
      stopLocalMedia();
      closePeerConnection();
      webSocketService.disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]); 
  // Dependency on connectWebSocket and hooks is intentionally omitted to run once per roomId change
  // Note: Added localStream check to prevent re-running if stream exists

  const cleanupSession = useCallback(() => {
    stopLocalMedia();
    closePeerConnection();
    webSocketService.disconnect();
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
  }, [stopLocalMedia, closePeerConnection]);

  const endSession = () => {
    cleanupSession();
    showSuccess('Session ended');
    navigate('/telehealth/dashboard');
  };

  const toggleRecording = async () => {
    if (!sessionId) return;
    try {
      if (!isRecording) {
        if (localStream) {
          const mediaRecorder = new MediaRecorder(localStream);
          const chunks: BlobPart[] = [];
          
          mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunks.push(e.data);
          };
          
          mediaRecorder.onstop = async () => {
            const blob = new Blob(chunks, { type: 'video/webm' });
            const formData = new FormData();
            formData.append('recording', blob, 'session-recording.webm');
            try {
              await apiClient.post(`/telehealth/sessions/${sessionId}/upload_recording/`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
              });
              showSuccess('Recording saved successfully');
            } catch (error) {
              console.error('Failed to save recording:', error);
              showError('Failed to save recording');
            }
          };
          
          mediaRecorder.start(1000);
          mediaRecorderRef.current = mediaRecorder;
          setIsRecording(true);
          showSuccess('Recording started');
        }
      } else {
        if (mediaRecorderRef.current) {
          mediaRecorderRef.current.stop();
          mediaRecorderRef.current = null;
        }
        setIsRecording(false);
        showSuccess('Recording stopped');
      }
    } catch (error) {
      console.error('Recording error:', error);
      showError('Failed to toggle recording');
    }
  };

  const toggleTranscription = async () => {
    if (!sessionId) return;
    const speakerLabel = user?.role === 'client' ? 'Patient' : 'Therapist';
    
    try {
      if (!isTranscribing) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
          showError('Speech recognition not supported in this browser');
          return;
        }
        
        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;
        const destination = audioContext.createMediaStreamDestination();
        
        if (localStream) {
          const localAudioTracks = localStream.getAudioTracks();
          if (localAudioTracks.length > 0) {
            const localSource = audioContext.createMediaStreamSource(new MediaStream([localAudioTracks[0]]));
            localSource.connect(destination);
          }
        }
        
        if (remoteStream) {
          const remoteAudioTracks = remoteStream.getAudioTracks();
          if (remoteAudioTracks.length > 0) {
            const remoteSource = audioContext.createMediaStreamSource(new MediaStream([remoteAudioTracks[0]]));
            remoteSource.connect(destination);
          }
        }
        
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        
        recognition.onresult = (event: SpeechRecognitionEvent) => {
          let interimText = '';
          let finalText = '';
          
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalText += transcript + ' ';
            } else {
              interimText += transcript;
            }
          }
          
          setInterimTranscript(interimText);
          
          if (finalText) {
            const timestamp = new Date().toLocaleTimeString();
            const entry = `[${timestamp}] [${speakerLabel}] ${finalText.trim()}`;
            setTranscriptText(prev => [...prev, entry]);
            setInterimTranscript('');
          }
        };

        recognition.onspeechstart = () => setIsSpeechDetected(true);
        recognition.onspeechend = () => setIsSpeechDetected(false);
        
        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          console.error('[TRANSCRIBE] Error:', event.error);
          if (event.error === 'not-allowed') {
             setIsTranscribing(false);
             recognitionRef.current = null;
          }
        };

        recognition.start();
        recognitionRef.current = recognition;
        setIsTranscribing(true);
        setShowTranscript(true);
      } else {
        if (recognitionRef.current) {
          recognitionRef.current.stop();
          recognitionRef.current = null;
        }
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }
        
        if (transcriptText.length > 0) {
            try {
                await apiClient.post(`/telehealth/sessions/${sessionId}/save_transcript/`, {
                  transcript: transcriptText.join('\n')
                });
                showSuccess('Transcript saved');
            } catch (error) {
                console.error('Failed to save transcript:', error);
                showError('Failed to save transcript');
            }
        }
        setIsTranscribing(false);
        showSuccess('Transcription stopped');
      }
    } catch (error) {
      console.error('Transcription error:', error);
      showError('Failed to toggle transcription');
    }
  };
  
  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Full-screen error state for invalid / inaccessible sessions
  if (sessionError) {
    const errorConfig = {
      not_found: {
        title: 'Session Not Found',
        message: 'This telehealth session does not exist or has been removed. Please check the link or contact your provider.',
        color: '#ef4444',
      },
      forbidden: {
        title: 'Access Denied',
        message: 'You are not authorized to join this session.',
        color: '#f97316',
      },
      not_started: {
        title: 'Meeting Not Started',
        message: 'This session is scheduled but has not started yet. Please wait in the waiting room or come back at your appointment time.',
        color: '#3b82f6',
      },
    }[sessionError];

    return (
      <Box sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#1a1a1a' }}>
        <Box sx={{ textAlign: 'center', maxWidth: 480, p: 4 }}>
          <Box sx={{ width: 80, height: 80, borderRadius: '50%', bgcolor: errorConfig.color, display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 3 }}>
            <Typography variant="h3" sx={{ color: 'white' }}>
              {sessionError === 'not_started' ? '⏳' : '✕'}
            </Typography>
          </Box>
          <Typography variant="h5" sx={{ color: 'white', fontWeight: 700, mb: 2 }}>
            {errorConfig.title}
          </Typography>
          <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.7)', mb: 4 }}>
            {errorConfig.message}
          </Typography>
          <Button
            variant="contained"
            onClick={() => navigate('/telehealth')}
            sx={{ bgcolor: errorConfig.color, '&:hover': { bgcolor: errorConfig.color, opacity: 0.85 } }}
          >
            Back to Telehealth
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#1a1a1a' }}>
      {/* Header */}
      <Paper elevation={0} sx={{ p: 2, bgcolor: 'rgba(0, 0, 0, 0.8)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box>
            <Typography variant="h6">{sessionData?.title || 'Telehealth Session'}</Typography>
            {user && ['admin', 'therapist', 'staff'].includes(user.role) && sessionData?.patient_details && (
              <Typography variant="caption" sx={{ opacity: 0.8 }}>
                Patient: {sessionData.patient_details.first_name} {sessionData.patient_details.last_name}
              </Typography>
            )}
          </Box>
          <Chip label={formatDuration(sessionDuration)} color="error" size="small" icon={<FiberManualRecord />} />
          <Chip 
            label={`${participantCount} Participant${participantCount !== 1 ? 's' : ''}`} 
            color={participantCount > 1 ? "success" : "default"} 
            size="small" 
            icon={<PeopleIcon />} 
          />
          {isRemoteVideoReady && <Chip label="Connected" color="success" size="small" />}
          {participantName && <Chip label={participantName} size="small" variant="outlined" sx={{ color: 'white', borderColor: 'white' }} />}
        </Box>
      </Paper>

      {/* Main Video Area */}
      <Box sx={{ flex: 1, position: 'relative', bgcolor: '#000', display: 'flex' }}>
        <Box sx={{ flex: 1, position: 'relative' }}>
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            style={{ width: '100%', height: '100%', objectFit: 'cover', backgroundColor: '#000' }}
          />
          {!isRemoteVideoReady && (
            <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', color: 'white' }}>
              <Typography variant="h6">
                {participantCount > 1 
                  ? `Establishing connection with ${participantName || 'participant'}...`
                  : 'Waiting for other participant to join...'}
              </Typography>
              <Typography variant="body2" sx={{ mt: 1, opacity: 0.7 }}>
                {participantCount > 1 
                  ? 'Setting up video and audio...'
                  : 'Share the session link or wait for them to connect'}
              </Typography>
            </Box>
          )}
          {isRemoteVideoReady && isRemotePlaybackBlocked && (
            <Box sx={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)' }}>
              <Button variant="contained" onClick={() => remoteVideoRef.current?.play()}>Tap to start video</Button>
            </Box>
          )}

          {/* Local Video */}
          <Paper elevation={4} sx={{ position: 'absolute', bottom: 20, right: 20, width: 240, height: 180, overflow: 'hidden', bgcolor: '#000' }}>
            <video ref={localVideoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
            {!isCameraOn && (
              <Box sx={{ position: 'absolute', insert: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(0,0,0,0.8)', color: 'white', width: '100%', height: '100%' }}>
                <VideocamOff />
              </Box>
            )}
          </Paper>
        </Box>
      </Box>

      {/* Controls */}
      <Paper elevation={0} sx={{ p: 2, bgcolor: 'rgba(0, 0, 0, 0.9)', display: 'flex', justifyContent: 'center', gap: 2 }}>
        <IconButton onClick={toggleMicrophone} sx={{ bgcolor: isMicOn ? 'rgba(255,255,255,0.1)' : 'error.main', color: 'white' }}>
          {isMicOn ? <Mic /> : <MicOff />}
        </IconButton>
        <IconButton onClick={toggleCamera} sx={{ bgcolor: isCameraOn ? 'rgba(255,255,255,0.1)' : 'error.main', color: 'white' }}>
          {isCameraOn ? <Videocam /> : <VideocamOff />}
        </IconButton>
        
        {user && ['admin', 'therapist', 'staff'].includes(user.role) && (
          <>
            <IconButton onClick={toggleRecording} sx={{ bgcolor: isRecording ? 'error.main' : 'rgba(255,255,255,0.1)', color: 'white' }}>
              {isRecording ? <StopCircle /> : <FiberManualRecord />}
            </IconButton>
            <IconButton onClick={toggleTranscription} sx={{ bgcolor: isTranscribing ? 'primary.main' : 'rgba(255,255,255,0.1)', color: 'white' }}>
              <Transcribe />
            </IconButton>
          </>
        )}

        <IconButton onClick={() => setShowEndDialog(true)} sx={{ bgcolor: 'error.main', color: 'white' }}>
          <CallEnd />
        </IconButton>
        
        {mediaInitFailed && (
          <Button onClick={retryMediaAccess} disabled={isRetryingMedia} variant="contained" color="warning" sx={{ ml: 1 }}>
            {isRetryingMedia ? 'Retrying...' : 'Retry Camera'}
          </Button>
        )}
      </Paper>
      
      {/* End Dialog */}
      <Dialog open={showEndDialog} onClose={() => setShowEndDialog(false)}>
        <DialogTitle>End Session</DialogTitle>
        <DialogContent><Alert severity="warning">Are you sure you want to end this session?</Alert></DialogContent>
        <DialogActions>
          <Button onClick={() => setShowEndDialog(false)}>Cancel</Button>
          <Button onClick={endSession} color="error" variant="contained">End Session</Button>
        </DialogActions>
      </Dialog>
      
      {/* Transcript Drawer */}
      <Drawer anchor="left" open={showTranscript} onClose={() => setShowTranscript(false)} sx={{ '& .MuiDrawer-paper': { width: 400, p: 2 } }}>
        <Typography variant="h6" sx={{ mb: 2 }}>Session Transcript</Typography>
        <Box sx={{ flex: 1, overflow: 'auto', mb: 2 }}>
          {isTranscribing && isSpeechDetected && <Typography variant="caption" color="success.main">Listening...</Typography>}
          <List>
            {transcriptText.map((entry, idx) => (
              <React.Fragment key={idx}>
                <ListItem><ListItemText primary={entry} sx={{ whiteSpace: 'pre-wrap' }} /></ListItem>
                <Divider />
              </React.Fragment>
            ))}
            {interimTranscript && <ListItem><ListItemText primary={`[Live] ${interimTranscript}`} sx={{ fontStyle: 'italic', color: 'text.secondary' }} /></ListItem>}
          </List>
        </Box>
        <Button fullWidth variant="outlined" onClick={() => setShowTranscript(false)}>Close</Button>
      </Drawer>
    </Box>
  );
};

export default VideoSession;
