import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  IconButton,
  Button,
  Typography,
  Chip,
  List,
  ListItem,
  ListItemText,
  TextField,
  Badge,
  Avatar,
  Switch,
  FormControlLabel,
  Grid,
  Alert,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
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
  ClosedCaption,
  FiberManualRecord,
  Stop,
  Send,
  People,
  Settings,
  Download,
  Replay,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { apiClient } from '../../services/apiClient';
import { SessionDetails } from '../../types';

interface Participant {
  id: string;
  name: string;
  role: 'therapist' | 'patient';
  avatar?: string;
  isMuted: boolean;
  isVideoOff: boolean;
}

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  message: string;
  timestamp: Date;
}

interface TranscriptEntry {
  id: string;
  speaker: string;
  text: string;
  timestamp: Date;
  confidence: number;
}

const VideoSession: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { state } = useAuth();
  const { showSuccess, showError, showInfo } = useNotification();
  const user = state.user;

  // Video refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const websocketRef = useRef<WebSocket | null>(null);

  // Session state
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [sessionDuration, setSessionDuration] = useState(0);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [isRemoteVideoReady, setIsRemoteVideoReady] = useState(false);
  const [isRemotePlaybackBlocked, setIsRemotePlaybackBlocked] = useState(false);
  const [mediaInitFailed, setMediaInitFailed] = useState(false);
  const [isRetryingMedia, setIsRetryingMedia] = useState(false);
  const [, setSessionData] = useState<SessionDetails | null>(null);

  // Media controls
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  // Features
  const [showChat, setShowChat] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [autoTranscribe, setAutoTranscribe] = useState(true);

  // Data
  const [participants] = useState<Participant[]>([
    {
      id: '1',
      name: 'Dr. Sarah Smith',
      role: 'therapist',
      isMuted: false,
      isVideoOff: false,
    },
    {
      id: '2',
      name: 'John Doe',
      role: 'patient',
      isMuted: false,
      isVideoOff: false,
    },
  ]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);

  // Dialogs
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [, setShowSettingsDialog] = useState(false);

  // WebRTC state
  const participantCountRef = useRef(0);
  const isInitiatorRef = useRef(false);
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const lastIceRestartAtRef = useRef(0);
  const iceRestartAttemptsRef = useRef(0);

  const buildIceConfiguration = (): RTCConfiguration => {
    const configuredStunUrls = (import.meta.env.VITE_STUN_URLS as string | undefined)
      ?.split(',')
      .map((url) => url.trim())
      .filter(Boolean);

    const configuredTurnUrls = (import.meta.env.VITE_TURN_URLS as string | undefined)
      ?.split(',')
      .map((url) => url.trim())
      .filter(Boolean);

    const turnUsername = (import.meta.env.VITE_TURN_USERNAME as string | undefined)?.trim();
    const turnCredential = (import.meta.env.VITE_TURN_CREDENTIAL as string | undefined)?.trim();

    const stunUrls = configuredStunUrls && configuredStunUrls.length > 0
      ? configuredStunUrls
      : [
          'stun:stun.l.google.com:19302',
          'stun:stun1.l.google.com:19302',
          'stun:stun2.l.google.com:19302',
          'stun:stun.cloudflare.com:3478',
        ];

    const servers: RTCIceServer[] = stunUrls.map((url) => ({ urls: url }));

    const hasDedicatedTurn = Boolean(
      configuredTurnUrls && configuredTurnUrls.length > 0 && turnUsername && turnCredential
    );

    if (hasDedicatedTurn) {
      servers.push({
        urls: configuredTurnUrls!,
        username: turnUsername,
        credential: turnCredential,
      });
    } else {
      servers.push({
        urls: [
          'turn:openrelay.metered.ca:80?transport=tcp',
          'turn:openrelay.metered.ca:443?transport=tcp',
          'turn:openrelay.metered.ca:443?transport=udp',
          'turn:openrelay.metered.ca:3478?transport=udp',
          'turns:openrelay.metered.ca:443?transport=tcp',
        ],
        username: 'openrelayproject',
        credential: 'openrelayproject',
      });
    }

    const wantsRelay = (import.meta.env.VITE_WEBRTC_FORCE_RELAY as string | undefined) === 'true';
    const forceRelay = wantsRelay && hasDedicatedTurn;

    if (wantsRelay && !hasDedicatedTurn) {
      console.warn('[VIDEO] VITE_WEBRTC_FORCE_RELAY=true ignored because dedicated TURN credentials are not configured. Falling back to mixed ICE (all).');
    }

    return {
      iceServers: servers,
      iceCandidatePoolSize: 10,
      iceTransportPolicy: forceRelay ? 'relay' : 'all',
    };
  };

  // Fetch session details and get room_id
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const response = await apiClient.get(`/telehealth/sessions/${sessionId}/`);
        const session = response.data;
        setRoomId(session.room_id);
        setSessionData(session);
        console.log('[VIDEO] Session loaded:', session);
      } catch (error) {
        console.error('[VIDEO] Error fetching session:', error);
        showError('Failed to load session');
      }
    };

    if (sessionId) {
      fetchSession();
    }
  }, [sessionId]);

  // Initialize session when room_id is available
  useEffect(() => {
    if (roomId) {
      startSession();
    }
    return () => {
      cleanupSession();
    };
  }, [roomId]);

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

  // Simulated transcript updates
  useEffect(() => {
    if (isTranscribing && autoTranscribe) {
      const interval = setInterval(() => {
        const speakers = ['Dr. Sarah Smith', 'John Doe'];
        const sampleTexts = [
          "How have you been feeling this week?",
          "I've been feeling much better, thank you.",
          "That's great to hear. Let's discuss your progress.",
          "I've been practicing the techniques we talked about.",
          "Excellent. Can you tell me more about that?",
        ];
        
        const newEntry: TranscriptEntry = {
          id: Math.random().toString(36).substr(2, 9),
          speaker: speakers[Math.floor(Math.random() * speakers.length)],
          text: sampleTexts[Math.floor(Math.random() * sampleTexts.length)],
          timestamp: new Date(),
          confidence: 0.85 + Math.random() * 0.15,
        };
        
        setTranscript(prev => [...prev, newEntry]);
      }, 8000);
      return () => clearInterval(interval);
    }
  }, [isTranscribing, autoTranscribe]);

  const getMediaStreamWithFallback = async () => {
    const attempts: MediaStreamConstraints[] = [
      {
        video: {
          facingMode: 'user',
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      },
      {
        video: {
          facingMode: 'user',
        },
        audio: true,
      },
      {
        video: true,
        audio: true,
      },
      {
        video: true,
        audio: false,
      },
    ];

    let lastError: any = null;

    for (let index = 0; index < attempts.length; index += 1) {
      try {
        console.log(`[VIDEO] getUserMedia attempt ${index + 1}/${attempts.length}`);
        const stream = await navigator.mediaDevices.getUserMedia(attempts[index]);
        console.log(`[VIDEO] getUserMedia succeeded on attempt ${index + 1}`);
        return stream;
      } catch (error: any) {
        lastError = error;
        console.warn(`[VIDEO] getUserMedia attempt ${index + 1} failed:`, error?.name, error?.message);

        // Permission denial should not retry with other constraints
        if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') {
          throw error;
        }
      }
    }

    throw lastError;
  };

  const startSession = async () => {
    try {
      console.log('[VIDEO] Starting session with room_id:', roomId);
      setMediaInitFailed(false);

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showError('Camera/microphone is not supported in this browser. Please use a modern browser.');
        return;
      }

      // Check for secure context (HTTPS or localhost)
      if (!window.isSecureContext) {
        showError('Camera/microphone requires HTTPS. Please access this page using https://');
        return;
      }
      
      // Request media permissions with fallback constraints for mobile reliability
      const stream = await getMediaStreamWithFallback();
      
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.muted = true;
        const playPromise = localVideoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch((playError) => {
            console.warn('[VIDEO] Local preview autoplay blocked:', playError);
          });
        }
      }
      
      console.log('[VIDEO] Local stream obtained');
      setMediaInitFailed(false);
      
      // Initialize WebRTC peer connection
      initializePeerConnection();
      
      // Connect to WebSocket signaling server
      connectWebSocket();
      
      setSessionStartTime(new Date());
      showSuccess('Connected to session');
      
      // Auto-start transcription if enabled
      if (autoTranscribe) {
        setIsTranscribing(true);
      }
    } catch (error: any) {
      console.error('[VIDEO] Media error:', error);
      setMediaInitFailed(true);
      if (error?.name === 'NotAllowedError') {
        showError('Camera/microphone permission denied. On mobile, also allow Camera/Microphone in browser and OS Settings, then reload this page.');
      } else if (error?.name === 'NotFoundError') {
        showError('No camera or microphone found. Please connect a camera/microphone and try again.');
      } else if (error?.name === 'NotReadableError') {
        showError('Camera/microphone is in use by another app, or blocked by the device. Close other apps (Zoom/FaceTime/Meet), then retry.');
      } else if (error?.name === 'OverconstrainedError') {
        showError('Camera constraints not supported on this mobile device. We retried with fallback settings, please refresh and try again.');
      } else if (error?.name === 'NotSupportedError') {
        showError('Camera/microphone not supported. Please use HTTPS or check device compatibility.');
      } else {
        showError(`Failed to access camera/microphone: ${error?.message || 'Unknown error'}`);
      }
    }
  };

  const retryMediaAccess = async () => {
    try {
      setIsRetryingMedia(true);
      setMediaInitFailed(false);

      const stream = await getMediaStreamWithFallback();

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }

      localStreamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.muted = true;
        const playPromise = localVideoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch((playError) => {
            console.warn('[VIDEO] Local preview autoplay blocked after retry:', playError);
          });
        }
      }

      if (peerConnectionRef.current) {
        const senders = peerConnectionRef.current.getSenders();
        const videoTrack = stream.getVideoTracks()[0] || null;
        const audioTrack = stream.getAudioTracks()[0] || null;

        const videoSender = senders.find((sender) => sender.track?.kind === 'video');
        const audioSender = senders.find((sender) => sender.track?.kind === 'audio');

        if (videoSender) {
          await videoSender.replaceTrack(videoTrack);
        }
        if (audioSender) {
          await audioSender.replaceTrack(audioTrack);
        }
      }

      setIsCameraOn((stream.getVideoTracks()[0]?.enabled ?? false));
      setIsMicOn((stream.getAudioTracks()[0]?.enabled ?? false));
      showSuccess('Camera/microphone reconnected');
    } catch (error: any) {
      console.error('[VIDEO] Retry media error:', error);
      setMediaInitFailed(true);
      showError('Retry failed. Please verify browser + phone camera/microphone permissions and try again.');
    } finally {
      setIsRetryingMedia(false);
    }
  };

  const initializePeerConnection = () => {
    console.log('[VIDEO] Initializing peer connection');
    
    const peerConnection = new RTCPeerConnection(buildIceConfiguration());
    peerConnectionRef.current = peerConnection;
    
    // Add local stream tracks to peer connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStreamRef.current!);
        console.log('[VIDEO] Added track to peer connection:', track.kind);
      });
    }
    
    // Handle incoming tracks from remote peer
    peerConnection.ontrack = (event) => {
      console.log('[VIDEO] Received remote track:', event.track.kind, event.streams);
      
      // Use the stream from the event if available
      if (event.streams && event.streams[0]) {
        if (remoteVideoRef.current) {
          if (remoteVideoRef.current.srcObject !== event.streams[0]) {
            remoteVideoRef.current.srcObject = event.streams[0];
          }
          remoteStreamRef.current = event.streams[0];
          setIsRemoteVideoReady(true);
          
          // Handle mobile autoplay restrictions
          const playPromise = remoteVideoRef.current.play();
          if (playPromise !== undefined) {
            playPromise.catch((playError) => {
              console.warn('[VIDEO] Remote autoplay blocked, user interaction required:', playError);
              setIsRemotePlaybackBlocked(true);
              // Add click handler to play on user interaction
              const playOnClick = () => {
                remoteVideoRef.current?.play().then(() => {
                  setIsRemotePlaybackBlocked(false);
                }).catch(() => {
                  setIsRemotePlaybackBlocked(true);
                });
                document.removeEventListener('click', playOnClick);
              };
              document.addEventListener('click', playOnClick);
            });
          }
          console.log('[VIDEO] Remote video stream set from event.streams');
        }
      } else {
        // Fallback: manually create stream and add tracks
        if (!remoteStreamRef.current) {
          remoteStreamRef.current = new MediaStream();
        }
        remoteStreamRef.current.addTrack(event.track);
        
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStreamRef.current;
          setIsRemoteVideoReady(true);
          
          // Handle mobile autoplay restrictions
          const playPromise = remoteVideoRef.current.play();
          if (playPromise !== undefined) {
            playPromise.catch((playError) => {
              console.warn('[VIDEO] Remote autoplay blocked, user interaction required:', playError);
              setIsRemotePlaybackBlocked(true);
              const playOnClick = () => {
                remoteVideoRef.current?.play().then(() => {
                  setIsRemotePlaybackBlocked(false);
                }).catch(() => {
                  setIsRemotePlaybackBlocked(true);
                });
                document.removeEventListener('click', playOnClick);
              };
              document.addEventListener('click', playOnClick);
            });
          }
          console.log('[VIDEO] Remote video stream set manually');
        }
      }
    };

    peerConnection.onicecandidateerror = (event) => {
      console.warn('[VIDEO] ICE candidate error:', event.errorCode, event.errorText, event.url);
    };
    
    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate && websocketRef.current) {
        console.log('[VIDEO] Sending ICE candidate');
        websocketRef.current.send(JSON.stringify({
          type: 'ice_candidate',
          candidate: event.candidate,
        }));
      }
    };
    
    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      console.log('[VIDEO] Connection state:', peerConnection.connectionState);
      if (peerConnection.connectionState === 'connected') {
        iceRestartAttemptsRef.current = 0;
        showSuccess('Connected to other participant');
      } else if (peerConnection.connectionState === 'disconnected') {
        showError('Participant disconnected');
      } else if (peerConnection.connectionState === 'failed') {
        showError('Connection failed - trying to reconnect...');
        console.error('[VIDEO] Connection failed, attempting ICE restart');
        const now = Date.now();
        const canRestart = iceRestartAttemptsRef.current < 3;
        if (isInitiatorRef.current && canRestart && now - lastIceRestartAtRef.current > 8000) {
          lastIceRestartAtRef.current = now;
          iceRestartAttemptsRef.current += 1;
          setTimeout(() => {
            console.log('[VIDEO] Attempting ICE restart', iceRestartAttemptsRef.current);
            void createOffer(true);
          }, 1000);
        } else if (!canRestart) {
          showError('Connection could not be restored. Please rejoin session or configure dedicated TURN server.');
        }
      }
    };
    
    // Handle ICE connection state changes
    peerConnection.oniceconnectionstatechange = () => {
      console.log('[VIDEO] ICE connection state:', peerConnection.iceConnectionState);
      if (peerConnection.iceConnectionState === 'failed') {
        console.error('[VIDEO] ICE connection failed');
      }
    };
    
    // Handle ICE gathering state changes
    peerConnection.onicegatheringstatechange = () => {
      console.log('[VIDEO] ICE gathering state:', peerConnection.iceGatheringState);
    };
  };

  const resetPeerConnectionForNextParticipant = () => {
    console.log('[VIDEO] Resetting peer connection for next participant');
    pendingIceCandidatesRef.current = [];
    isInitiatorRef.current = false;

    if (peerConnectionRef.current) {
      try {
        peerConnectionRef.current.ontrack = null;
        peerConnectionRef.current.onicecandidate = null;
        peerConnectionRef.current.onconnectionstatechange = null;
        peerConnectionRef.current.oniceconnectionstatechange = null;
        peerConnectionRef.current.onicegatheringstatechange = null;
        peerConnectionRef.current.close();
      } catch (error) {
        console.warn('[VIDEO] Error closing previous peer connection:', error);
      }
    }

    remoteStreamRef.current = null;
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    setIsRemoteVideoReady(false);
    setIsRemotePlaybackBlocked(false);

    initializePeerConnection();
  };

  const connectWebSocket = () => {
    if (!roomId) {
      console.error('[VIDEO] No room_id available');
      return;
    }
    
    // Resolve WebSocket URL with explicit base URL first, then API URL, then host fallback
    const configuredWsBaseUrl = import.meta.env.VITE_WS_BASE_URL as string | undefined;
    const configuredWsHost = import.meta.env.VITE_WS_HOST as string | undefined;
    const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;

    let wsProtocol: 'ws' | 'wss' = window.location.protocol === 'https:' ? 'wss' : 'ws';
    let wsHost = window.location.host;

    if (configuredWsBaseUrl) {
      try {
        const wsBase = new URL(configuredWsBaseUrl);
        wsProtocol = wsBase.protocol === 'wss:' ? 'wss' : 'ws';
        wsHost = wsBase.host;
      } catch (urlError) {
        console.warn('[VIDEO] Invalid VITE_WS_BASE_URL:', urlError);
      }
    } else if (configuredApiBaseUrl) {
      try {
        const apiUrl = new URL(configuredApiBaseUrl);
        wsProtocol = apiUrl.protocol === 'https:' ? 'wss' : 'ws';
        wsHost = apiUrl.host;
      } catch (urlError) {
        console.warn('[VIDEO] Invalid VITE_API_BASE_URL for WS fallback:', urlError);
      }
    } else if (configuredWsHost) {
      wsHost = configuredWsHost;
    }

    const wsUrl = `${wsProtocol}://${wsHost}/ws/video/${roomId}/`;
    
    console.log('[VIDEO] Connecting to WebSocket:', wsUrl);
    
    const ws = new WebSocket(wsUrl);
    websocketRef.current = ws;
    
    ws.onopen = () => {
      console.log('[VIDEO] WebSocket connected');
      showSuccess('Connected to session server');
      
      // Notify server that we joined
      ws.send(JSON.stringify({
        type: 'participant_joined',
        user_id: user?.id,
        user_name: user?.firstName + ' ' + user?.lastName
      }));
    };
    
    ws.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      console.log('[VIDEO] WebSocket message:', data.type, data);
      
      switch (data.type) {
        case 'participant_joined':
          console.log('[VIDEO] Another participant joined');
          showSuccess('Another participant joined');
          participantCountRef.current += 1;
          
          // Always create offer when another participant joins
          // This ensures connection is established regardless of join order
          console.log('[VIDEO] Creating offer for new participant');
          isInitiatorRef.current = true;
          setTimeout(() => {
            void createOffer();
          }, 500);
          break;
          
        case 'offer':
          console.log('[VIDEO] Received offer - I am the responder');
          await handleOffer(data.offer);
          break;
          
        case 'answer':
          console.log('[VIDEO] Received answer');
          await handleAnswer(data.answer);
          break;
          
        case 'ice_candidate':
          console.log('[VIDEO] Received ICE candidate');
          await handleIceCandidate(data.candidate);
          break;
          
        case 'participant_left':
          console.log('[VIDEO] Participant left');
          resetPeerConnectionForNextParticipant();
          showError('Other participant left the session');
          break;
      }
    };
    
    ws.onerror = (error) => {
      console.error('[VIDEO] WebSocket error:', error);
      showError('Failed to connect to session server');
    };
    
    ws.onclose = (event) => {
      console.log('[VIDEO] WebSocket closed:', event.code, event.reason);
      if (event.code !== 1000) { // Not a normal closure
        showError('Connection to session server lost');
      }
    };
  };

  const createOffer = async (iceRestart = false) => {
    if (!peerConnectionRef.current || !websocketRef.current) return;
    
    try {
      const offer = await peerConnectionRef.current.createOffer({ iceRestart });
      await peerConnectionRef.current.setLocalDescription(offer);
      
      console.log('[VIDEO] Sending offer');
      websocketRef.current.send(JSON.stringify({
        type: 'offer',
        offer: offer,
      }));
    } catch (error) {
      console.error('[VIDEO] Error creating offer:', error);
    }
  };

  const handleOffer = async (offer: RTCSessionDescriptionInit) => {
    if (!peerConnectionRef.current || !websocketRef.current) {
      console.error('[VIDEO] Cannot handle offer - missing peer connection or websocket');
      return;
    }
    
    try {
      console.log('[VIDEO] Setting remote description from offer');
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offer));
      await flushPendingIceCandidates();
      
      console.log('[VIDEO] Creating answer');
      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);
      
      console.log('[VIDEO] Sending answer');
      websocketRef.current.send(JSON.stringify({
        type: 'answer',
        answer: answer,
      }));
    } catch (error) {
      console.error('[VIDEO] Error handling offer:', error);
      showError('Failed to establish connection');
    }
  };

  const handleAnswer = async (answer: RTCSessionDescriptionInit) => {
    if (!peerConnectionRef.current) {
      console.error('[VIDEO] Cannot handle answer - missing peer connection');
      return;
    }
    
    try {
      console.log('[VIDEO] Setting remote description from answer');
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      await flushPendingIceCandidates();
      console.log('[VIDEO] Answer applied successfully');
    } catch (error) {
      console.error('[VIDEO] Error handling answer:', error);
      showError('Failed to complete connection');
    }
  };

  const handleIceCandidate = async (candidate: RTCIceCandidateInit) => {
    if (!peerConnectionRef.current) {
      console.error('[VIDEO] Cannot handle ICE candidate - missing peer connection');
      return;
    }
    
    try {
      // Always queue candidates if remote description isn't set yet
      if (!peerConnectionRef.current.remoteDescription) {
        console.warn('[VIDEO] Received ICE candidate before remote description, queuing');
        pendingIceCandidatesRef.current.push(candidate);
      } else {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        console.log('[VIDEO] ICE candidate added successfully');
      }
    } catch (error) {
      console.error('[VIDEO] Error adding ICE candidate:', error);
    }
  };

  const flushPendingIceCandidates = async () => {
    if (!peerConnectionRef.current || !peerConnectionRef.current.remoteDescription) {
      return;
    }

    while (pendingIceCandidatesRef.current.length > 0) {
      const nextCandidate = pendingIceCandidatesRef.current.shift();
      if (!nextCandidate) {
        continue;
      }
      try {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(nextCandidate));
      } catch (error) {
        console.error('[VIDEO] Error applying queued ICE candidate:', error);
      }
    }
  };

  const cleanupSession = () => {
    console.log('[VIDEO] Cleaning up session');
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    
    if (websocketRef.current) {
      websocketRef.current.close();
    }
    
    pendingIceCandidatesRef.current = [];
    participantCountRef.current = 0;
    isInitiatorRef.current = false;
    iceRestartAttemptsRef.current = 0;
    setIsRemotePlaybackBlocked(false);
  };

  const toggleCamera = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraOn(videoTrack.enabled);
      }
    }
  };

  const toggleMic = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicOn(audioTrack.enabled);
      }
    }
  };

  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
        });
        setIsScreenSharing(true);
        showInfo('Screen sharing started');
        
        screenStream.getVideoTracks()[0].onended = () => {
          setIsScreenSharing(false);
          showInfo('Screen sharing stopped');
        };
      } catch (error) {
        showError('Failed to share screen');
      }
    } else {
      setIsScreenSharing(false);
    }
  };

  const toggleRecording = () => {
    if (!isRecording) {
      setIsRecording(true);
      showSuccess('Recording started');
    } else {
      setIsRecording(false);
      showSuccess('Recording stopped and saved');
    }
  };

  const toggleTranscription = () => {
    setIsTranscribing(!isTranscribing);
    if (!isTranscribing) {
      showSuccess('Transcription started');
    } else {
      showInfo('Transcription paused');
    }
  };

  const sendMessage = () => {
    if (newMessage.trim()) {
      const message: ChatMessage = {
        id: Math.random().toString(36).substr(2, 9),
        senderId: user?.id || '',
        senderName: user?.email?.split('@')[0] || 'Me',
        message: newMessage,
        timestamp: new Date(),
      };
      setChatMessages([...chatMessages, message]);
      setNewMessage('');
    }
  };

  const endSession = () => {
    cleanupSession();
    showSuccess('Session ended');
    navigate('/telehealth/dashboard');
  };

  const downloadTranscript = () => {
    const content = transcript
      .map(entry => `[${entry.timestamp.toLocaleTimeString()}] ${entry.speaker}: ${entry.text}`)
      .join('\n\n');
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript-${sessionId}-${new Date().toISOString()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showSuccess('Transcript downloaded');
  };

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#1a1a1a' }}>
      {/* Header */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          bgcolor: 'rgba(0, 0, 0, 0.8)',
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h6">Telehealth Session</Typography>
          <Chip
            label={formatDuration(sessionDuration)}
            color="error"
            size="small"
            icon={isRecording ? <FiberManualRecord /> : undefined}
          />
          {isRecording && (
            <Chip label="Recording" color="error" size="small" />
          )}
          {isTranscribing && (
            <Chip label="Transcribing" color="success" size="small" />
          )}
        </Box>
        <Box>
          <IconButton color="inherit" onClick={() => setShowSettingsDialog(true)}>
            <Settings />
          </IconButton>
        </Box>
      </Paper>

      {/* Main Video Area */}
      <Box sx={{ flex: 1, position: 'relative', bgcolor: '#000' }}>
        <Grid container sx={{ height: '100%' }}>
          {/* Remote Video (Main) */}
          <Grid item xs={12} md={showChat || showTranscript ? 9 : 12}>
            <Box sx={{ height: '100%', position: 'relative' }}>
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
              {!isRemoteVideoReady && (
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
                    bgcolor: 'rgba(0,0,0,0.8)',
                    color: 'white',
                  }}
                >
                  <Typography>Waiting for other participant to join...</Typography>
                </Box>
              )}
              {isRemotePlaybackBlocked && (
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
                    bgcolor: 'rgba(0,0,0,0.8)',
                    color: 'white',
                    cursor: 'pointer',
                  }}
                  onClick={() => remoteVideoRef.current?.play()}
                >
                  <Typography>Click to play video</Typography>
                </Box>
              )}
              
              {/* Local Video (Picture-in-Picture) */}
              <Paper
                elevation={4}
                sx={{
                  position: 'absolute',
                  bottom: 20,
                  right: 20,
                  width: 240,
                  height: 180,
                  overflow: 'hidden',
                  bgcolor: '#000',
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
                    transform: 'scaleX(-1)',
                  }}
                />
                {!isCameraOn && (
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
                      bgcolor: 'rgba(0,0,0,0.8)',
                    }}
                  >
                    <Avatar sx={{ width: 80, height: 80 }}>
                      {user?.email?.charAt(0).toUpperCase() || 'U'}
                    </Avatar>
                  </Box>
                )}
              </Paper>

              {/* Session Info Overlay */}
              <Paper
                elevation={2}
                sx={{
                  position: 'absolute',
                  top: 20,
                  left: 20,
                  p: 2,
                  bgcolor: 'rgba(0, 0, 0, 0.7)',
                  color: 'white',
                }}
              >
                <Typography variant="subtitle2">Participants: {participants.length}</Typography>
                {mediaInitFailed && (
                  <Alert
                    severity="error"
                    action={
                      <Button color="inherit" size="small" onClick={retryMediaAccess} disabled={isRetryingMedia}>
                        <Replay />
                      </Button>
                    }
                  >
                    Media access failed.
                  </Alert>
                )}
              </Paper>
            </Box>
          </Grid>

          {/* Side Panel (Chat or Transcript) */}
          {(showChat || showTranscript) && (
            <Grid item xs={12} md={3}>
              <Paper
                elevation={0}
                sx={{
                  height: '100%',
                  bgcolor: '#f5f5f5',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {showChat && (
                  <>
                    <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                      <Typography variant="h6">Chat</Typography>
                    </Box>
                    <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
                      <List>
                        {chatMessages.map((msg) => (
                          <ListItem key={msg.id} sx={{ px: 0 }}>
                            <ListItemText
                              primary={msg.senderName}
                              secondary={
                                <>
                                  <Typography variant="body2">{msg.message}</Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {msg.timestamp.toLocaleTimeString()}
                                  </Typography>
                                </>
                              }
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
                          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                        />
                        <IconButton color="primary" onClick={sendMessage}>
                          <Send />
                        </IconButton>
                      </Box>
                    </Box>
                  </>
                )}

                {showTranscript && (
                  <>
                    <Box
                      sx={{
                        p: 2,
                        borderBottom: 1,
                        borderColor: 'divider',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <Typography variant="h6">Live Transcript</Typography>
                      <IconButton size="small" onClick={downloadTranscript}>
                        <Download />
                      </IconButton>
                    </Box>
                    <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
                      {transcript.length === 0 ? (
                        <Alert severity="info">
                          {isTranscribing
                            ? 'Waiting for speech...'
                            : 'Start transcription to see live captions'}
                        </Alert>
                      ) : (
                        <List>
                          {transcript.map((entry) => (
                            <ListItem key={entry.id} sx={{ px: 0, alignItems: 'flex-start' }}>
                              <ListItemText
                                primary={
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Typography variant="subtitle2" color="primary">
                                      {entry.speaker}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      {entry.timestamp.toLocaleTimeString()}
                                    </Typography>
                                  </Box>
                                }
                                secondary={
                                  <>
                                    <Typography variant="body2">{entry.text}</Typography>
                                    <LinearProgress
                                      variant="determinate"
                                      value={entry.confidence * 100}
                                      sx={{ mt: 0.5, height: 2 }}
                                    />
                                  </>
                                }
                              />
                            </ListItem>
                          ))}
                        </List>
                      )}
                    </Box>
                    <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={autoTranscribe}
                            onChange={(e) => setAutoTranscribe(e.target.checked)}
                          />
                        }
                        label="Auto-transcribe"
                      />
                    </Box>
                  </>
                )}
              </Paper>
            </Grid>
          )}
        </Grid>
      </Box>

      {/* Controls Bar */}
      <Paper
        elevation={8}
        sx={{
          p: 2,
          bgcolor: 'rgba(0, 0, 0, 0.9)',
          color: 'white',
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {/* Left Controls */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title={isCameraOn ? 'Turn off camera' : 'Turn on camera'}>
              <IconButton
                onClick={toggleCamera}
                sx={{
                  bgcolor: isCameraOn ? 'transparent' : 'error.main',
                  color: 'white',
                  '&:hover': { bgcolor: isCameraOn ? 'rgba(255,255,255,0.1)' : 'error.dark' },
                }}
              >
                {isCameraOn ? <Videocam /> : <VideocamOff />}
              </IconButton>
            </Tooltip>

            <Tooltip title={isMicOn ? 'Mute microphone' : 'Unmute microphone'}>
              <IconButton
                onClick={toggleMic}
                sx={{
                  bgcolor: isMicOn ? 'transparent' : 'error.main',
                  color: 'white',
                  '&:hover': { bgcolor: isMicOn ? 'rgba(255,255,255,0.1)' : 'error.dark' },
                }}
              >
                {isMicOn ? <Mic /> : <MicOff />}
              </IconButton>
            </Tooltip>

            <Tooltip title={isScreenSharing ? 'Stop sharing' : 'Share screen'}>
              <IconButton
                onClick={toggleScreenShare}
                sx={{
                  bgcolor: isScreenSharing ? 'primary.main' : 'transparent',
                  color: 'white',
                  '&:hover': { bgcolor: isScreenSharing ? 'primary.dark' : 'rgba(255,255,255,0.1)' },
                }}
              >
                {isScreenSharing ? <StopScreenShare /> : <ScreenShare />}
              </IconButton>
            </Tooltip>
          </Box>

          {/* Center Controls */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title={isRecording ? 'Stop recording' : 'Start recording'}>
              <IconButton
                onClick={toggleRecording}
                sx={{
                  bgcolor: isRecording ? 'error.main' : 'transparent',
                  color: 'white',
                  '&:hover': { bgcolor: isRecording ? 'error.dark' : 'rgba(255,255,255,0.1)' },
                }}
              >
                {isRecording ? <Stop /> : <FiberManualRecord />}
              </IconButton>
            </Tooltip>

            <Tooltip title={isTranscribing ? 'Stop transcription' : 'Start transcription'}>
              <IconButton
                onClick={toggleTranscription}
                sx={{
                  bgcolor: isTranscribing ? 'success.main' : 'transparent',
                  color: 'white',
                  '&:hover': { bgcolor: isTranscribing ? 'success.dark' : 'rgba(255,255,255,0.1)' },
                }}
              >
                <ClosedCaption />
              </IconButton>
            </Tooltip>

            <Tooltip title="Chat">
              <IconButton
                onClick={() => {
                  setShowChat(!showChat);
                  setShowTranscript(false);
                }}
                sx={{
                  bgcolor: showChat ? 'primary.main' : 'transparent',
                  color: 'white',
                  '&:hover': { bgcolor: showChat ? 'primary.dark' : 'rgba(255,255,255,0.1)' },
                }}
              >
                <Badge badgeContent={chatMessages.length} color="error">
                  <Chat />
                </Badge>
              </IconButton>
            </Tooltip>

            <Tooltip title="Transcript">
              <IconButton
                onClick={() => {
                  setShowTranscript(!showTranscript);
                  setShowChat(false);
                }}
                sx={{
                  bgcolor: showTranscript ? 'primary.main' : 'transparent',
                  color: 'white',
                  '&:hover': { bgcolor: showTranscript ? 'primary.dark' : 'rgba(255,255,255,0.1)' },
                }}
              >
                <ClosedCaption />
              </IconButton>
            </Tooltip>

            <Tooltip title="Participants">
              <IconButton
                onClick={() => setShowParticipants(!showParticipants)}
                sx={{ color: 'white' }}
              >
                <Badge badgeContent={participants.length} color="primary">
                  <People />
                </Badge>
              </IconButton>
            </Tooltip>
          </Box>

          {/* Right Controls */}
          <Box>
            <Button
              variant="contained"
              color="error"
              startIcon={<CallEnd />}
              onClick={() => setShowEndDialog(true)}
              size="large"
            >
              End Session
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* End Session Dialog */}
      <Dialog open={showEndDialog} onClose={() => setShowEndDialog(false)}>
        <DialogTitle>End Telehealth Session?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to end this session? The recording and transcript will be saved.
          </Typography>
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Session Duration: {formatDuration(sessionDuration)}
            </Typography>
            {isRecording && (
              <Alert severity="info" sx={{ mt: 1 }}>
                Recording will be saved automatically
              </Alert>
            )}
            {transcript.length > 0 && (
              <Alert severity="info" sx={{ mt: 1 }}>
                {transcript.length} transcript entries will be saved
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowEndDialog(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={endSession}>
            End Session
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default VideoSession;
