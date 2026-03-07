import React, { useState, useEffect, useRef } from 'react';
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
import { useParams, useNavigate } from 'react-router-dom';
import { useNotification } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';
import { apiClient } from '../../services/apiClient';

const VideoSession: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotification();
  const { state } = useAuth();
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
  const [sessionData, setSessionData] = useState<any>(null);

  // Media controls
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);

  // Recording and Transcription (therapist/staff/admin only)
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptText, setTranscriptText] = useState<string[]>([]);
  const [showTranscript, setShowTranscript] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isSpeechDetected, setIsSpeechDetected] = useState(false);
  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const participantCountRef = useRef(0);
  const isInitiatorRef = useRef(false);
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const lastIceRestartAtRef = useRef(0);
  const iceRestartAttemptsRef = useRef(0);

  // Dialogs
  const [showEndDialog, setShowEndDialog] = useState(false);

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
    
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
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

  const toggleRecording = async () => {
    if (!sessionId) return;
    
    try {
      if (!isRecording) {
        // Start recording using MediaRecorder
        if (localStreamRef.current) {
          const mediaRecorder = new MediaRecorder(localStreamRef.current);
          const chunks: BlobPart[] = [];
          
          mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
              chunks.push(e.data);
            }
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
          
          mediaRecorder.start(1000); // Collect data every second
          mediaRecorderRef.current = mediaRecorder;
          setIsRecording(true);
          showSuccess('Recording started');
        }
      } else {
        // Stop recording
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
        // Start transcription using Web Speech API
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        
        if (!SpeechRecognition) {
          showError('Speech recognition not supported in this browser');
          return;
        }
        
        // Create a mixed audio stream from both local and remote
        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;
        const destination = audioContext.createMediaStreamDestination();
        
        // Add local audio
        if (localStreamRef.current) {
          const localAudioTracks = localStreamRef.current.getAudioTracks();
          if (localAudioTracks.length > 0) {
            const localSource = audioContext.createMediaStreamSource(new MediaStream([localAudioTracks[0]]));
            localSource.connect(destination);
            console.log('[TRANSCRIBE] Added local audio to mixer');
          }
        }
        
        // Add remote audio
        if (remoteStreamRef.current) {
          const remoteAudioTracks = remoteStreamRef.current.getAudioTracks();
          if (remoteAudioTracks.length > 0) {
            const remoteSource = audioContext.createMediaStreamSource(new MediaStream([remoteAudioTracks[0]]));
            remoteSource.connect(destination);
            console.log('[TRANSCRIBE] Added remote audio to mixer');
          }
        }
        
        // Note: Web Speech API uses default microphone, mixed stream for future enhancement
        console.log('[TRANSCRIBE] Audio context created for mixed audio');
        
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        recognition.maxAlternatives = 1;
        
        recognition.onstart = () => {
          console.log('[TRANSCRIBE] Speech recognition started');
          showSuccess('Transcription started - speak into your microphone');
        };
        
        recognition.onresult = (event: any) => {
          console.log('[TRANSCRIBE] Got result:', event.results);
          let interimText = '';
          let finalText = '';
          
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            console.log(`[TRANSCRIBE] Result ${i}:`, transcript, 'isFinal:', event.results[i].isFinal);
            
            if (event.results[i].isFinal) {
              finalText += transcript + ' ';
            } else {
              interimText += transcript;
            }
          }
          
          // Update interim transcript for live display
          setInterimTranscript(interimText);
          
          if (finalText) {
            const timestamp = new Date().toLocaleTimeString();
            const entry = `[${timestamp}] [${speakerLabel}] ${finalText.trim()}`;
            console.log('[TRANSCRIBE] Adding to transcript:', entry);
            setTranscriptText(prev => [...prev, entry]);
            setInterimTranscript(''); // Clear interim when final text is added
          }
        };
        
        recognition.onaudiostart = () => {
          console.log('[TRANSCRIBE] Audio capture started');
        };
        
        recognition.onaudioend = () => {
          console.log('[TRANSCRIBE] Audio capture ended');
        };
        
        recognition.onsoundstart = () => {
          console.log('[TRANSCRIBE] Sound detected');
        };
        
        recognition.onsoundend = () => {
          console.log('[TRANSCRIBE] Sound ended');
        };
        
        recognition.onspeechstart = () => {
          console.log('[TRANSCRIBE] Speech detected');
          setIsSpeechDetected(true);
        };
        
        recognition.onspeechend = () => {
          console.log('[TRANSCRIBE] Speech ended');
          setIsSpeechDetected(false);
        };
        
        recognition.onerror = (event: any) => {
          console.error('[TRANSCRIBE] Speech recognition error:', event.error);
          if (event.error === 'no-speech') {
            console.log('[TRANSCRIBE] No speech detected - waiting...');
          } else if (event.error === 'audio-capture') {
            showError('Microphone access error - check permissions');
          } else if (event.error === 'not-allowed') {
            showError('Microphone permission denied');
            setIsTranscribing(false);
            recognitionRef.current = null;
          } else {
            showError(`Transcription error: ${event.error}`);
          }
        };
        
        recognition.onend = () => {
          console.log('[TRANSCRIBE] Recognition ended, isTranscribing:', isTranscribing);
          // Auto-restart if still transcribing
          if (isTranscribing && recognitionRef.current) {
            console.log('[TRANSCRIBE] Auto-restarting...');
            try {
              setTimeout(() => {
                if (recognitionRef.current) {
                  recognitionRef.current.start();
                }
              }, 100);
            } catch (error) {
              console.error('[TRANSCRIBE] Failed to restart recognition:', error);
            }
          }
        };
        
        try {
          recognition.start();
          console.log('[TRANSCRIBE] Started recognition');
        } catch (error) {
          console.error('[TRANSCRIBE] Failed to start:', error);
          throw error;
        }
        
        recognitionRef.current = recognition;
        setIsTranscribing(true);
        setShowTranscript(true);
      } else {
        // Stop transcription
        if (recognitionRef.current) {
          recognitionRef.current.stop();
          recognitionRef.current = null;
        }
        
        // Close audio context
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }
        
        // Save transcript to backend
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

  const endSession = () => {
    cleanupSession();
    showSuccess('Session ended');
    navigate('/telehealth/dashboard');
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
          <Box>
            <Typography variant="h6">
              {sessionData?.title || 'Telehealth Session'}
            </Typography>
            {user && ['admin', 'therapist', 'staff'].includes(user.role) && sessionData?.patient_details && (
              <Typography variant="caption" sx={{ opacity: 0.8 }}>
                Patient: {sessionData.patient_details.first_name} {sessionData.patient_details.last_name}
              </Typography>
            )}
          </Box>
          <Chip
            label={formatDuration(sessionDuration)}
            color="error"
            size="small"
            icon={<FiberManualRecord />}
          />
          {user && ['admin', 'therapist', 'staff'].includes(user.role) && sessionData?.is_emergency && (
            <Chip label="Emergency" color="error" size="small" />
          )}
          {isRemoteVideoReady && (
            <Chip label="Connected" color="success" size="small" />
          )}
        </Box>
      </Paper>

      {/* Main Video Area */}
      <Box sx={{ flex: 1, position: 'relative', bgcolor: '#000', display: 'flex' }}>
        {/* Remote Video (Main) */}
        <Box sx={{ flex: 1, position: 'relative' }}>
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            onLoadedMetadata={() => {
              if (!remoteVideoRef.current) return;
              remoteVideoRef.current.play().then(() => {
                setIsRemotePlaybackBlocked(false);
              }).catch((error) => {
                console.warn('[VIDEO] Remote video still blocked on metadata load:', error);
                setIsRemotePlaybackBlocked(true);
              });
            }}
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
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center',
                color: 'white',
              }}
            >
              <Typography variant="h6">Waiting for other participant...</Typography>
            </Box>
          )}

          {isRemoteVideoReady && isRemotePlaybackBlocked && (
            <Box
              sx={{
                position: 'absolute',
                bottom: 20,
                left: '50%',
                transform: 'translateX(-50%)',
                textAlign: 'center',
              }}
            >
              <Button
                variant="contained"
                onClick={() => {
                  remoteVideoRef.current?.play().then(() => {
                    setIsRemotePlaybackBlocked(false);
                  }).catch(() => {
                    setIsRemotePlaybackBlocked(true);
                  });
                }}
              >
                Tap to start remote audio/video
              </Button>
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
                  color: 'white',
                }}
              >
                <VideocamOff />
              </Box>
            )}
          </Paper>
        </Box>
      </Box>

      {/* Controls */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          bgcolor: 'rgba(0, 0, 0, 0.9)',
          display: 'flex',
          justifyContent: 'center',
          gap: 2,
        }}
      >
        <IconButton
          onClick={toggleMic}
          sx={{
            bgcolor: isMicOn ? 'rgba(255,255,255,0.1)' : 'error.main',
            color: 'white',
            '&:hover': {
              bgcolor: isMicOn ? 'rgba(255,255,255,0.2)' : 'error.dark',
            },
          }}
        >
          {isMicOn ? <Mic /> : <MicOff />}
        </IconButton>

        <IconButton
          onClick={toggleCamera}
          sx={{
            bgcolor: isCameraOn ? 'rgba(255,255,255,0.1)' : 'error.main',
            color: 'white',
            '&:hover': {
              bgcolor: isCameraOn ? 'rgba(255,255,255,0.2)' : 'error.dark',
            },
          }}
        >
          {isCameraOn ? <Videocam /> : <VideocamOff />}
        </IconButton>

        {/* Recording and Transcription - Only for therapists, staff, and admins */}
        {user && ['admin', 'therapist', 'staff'].includes(user.role) && (
          <>
            <IconButton
              onClick={toggleRecording}
              sx={{
                bgcolor: isRecording ? 'error.main' : 'rgba(255,255,255,0.1)',
                color: 'white',
                '&:hover': {
                  bgcolor: isRecording ? 'error.dark' : 'rgba(255,255,255,0.2)',
                },
              }}
              title={isRecording ? 'Stop Recording' : 'Start Recording'}
            >
              {isRecording ? <StopCircle /> : <FiberManualRecord />}
            </IconButton>

            <IconButton
              onClick={toggleTranscription}
              sx={{
                bgcolor: isTranscribing ? 'primary.main' : 'rgba(255,255,255,0.1)',
                color: 'white',
                '&:hover': {
                  bgcolor: isTranscribing ? 'primary.dark' : 'rgba(255,255,255,0.2)',
                },
              }}
              title={isTranscribing ? 'Stop Transcription' : 'Start Transcription'}
            >
              <Transcribe />
            </IconButton>
          </>
        )}

        <IconButton
          onClick={() => setShowEndDialog(true)}
          sx={{
            bgcolor: 'error.main',
            color: 'white',
            '&:hover': {
              bgcolor: 'error.dark',
            },
          }}
        >
          <CallEnd />
        </IconButton>

        {mediaInitFailed && (
          <Button
            onClick={retryMediaAccess}
            disabled={isRetryingMedia}
            variant="contained"
            color="warning"
            sx={{ ml: 1 }}
          >
            {isRetryingMedia ? 'Retrying camera...' : 'Retry Camera'}
          </Button>
        )}
      </Paper>

      {/* End Session Dialog */}
      <Dialog open={showEndDialog} onClose={() => setShowEndDialog(false)}>
        <DialogTitle>End Session</DialogTitle>
        <DialogContent>
          <Alert severity="warning">
            Are you sure you want to end this session? This action cannot be undone.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowEndDialog(false)}>Cancel</Button>
          <Button onClick={endSession} color="error" variant="contained">
            End Session
          </Button>
        </DialogActions>
      </Dialog>

      {/* Transcript Drawer */}
      <Drawer
        anchor="left"
        open={showTranscript}
        onClose={() => setShowTranscript(false)}
        sx={{
          '& .MuiDrawer-paper': {
            width: 400,
            p: 2,
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
          },
        }}
      >
        <Box sx={{ mb: 2 }}>
          <Typography variant="h6">
            Session Transcript
          </Typography>
          {isTranscribing && (
            <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: isSpeechDetected ? 'success.main' : 'grey.400',
                  animation: isSpeechDetected ? 'pulse 1.5s infinite' : 'none',
                  '@keyframes pulse': {
                    '0%, 100%': { opacity: 1 },
                    '50%': { opacity: 0.5 },
                  },
                }}
              />
              <Typography variant="caption" color="text.secondary">
                {isSpeechDetected ? 'Detecting speech...' : 'Listening...'}
              </Typography>
            </Box>
          )}
        </Box>
        <Divider sx={{ mb: 2 }} />
        
        <Box sx={{ flex: 1, overflow: 'auto', mb: 2 }}>
          {transcriptText.length === 0 && !interimTranscript ? (
            <Typography color="text.secondary">
              {isTranscribing ? 'Speak into your microphone to start transcribing...' : 'No transcript available'}
            </Typography>
          ) : (
            <List>
              {transcriptText.map((entry, index) => (
                <React.Fragment key={index}>
                  <ListItem>
                    <ListItemText
                      primary={entry}
                      sx={{
                        '& .MuiListItemText-primary': {
                          fontSize: '0.875rem',
                          whiteSpace: 'pre-wrap',
                        },
                      }}
                    />
                  </ListItem>
                  {index < transcriptText.length - 1 && <Divider />}
                </React.Fragment>
              ))}
              
              {/* Show interim transcript in real-time */}
              {interimTranscript && (
                <ListItem>
                  <ListItemText
                    primary={`[Live] ${interimTranscript}`}
                    sx={{
                      '& .MuiListItemText-primary': {
                        fontSize: '0.875rem',
                        fontStyle: 'italic',
                        color: 'text.secondary',
                        whiteSpace: 'pre-wrap',
                      },
                    }}
                  />
                </ListItem>
              )}
            </List>
          )}
        </Box>
        
        <Box>
          <Button
            fullWidth
            variant="outlined"
            onClick={() => setShowTranscript(false)}
          >
            Close
          </Button>
        </Box>
      </Drawer>
    </Box>
  );
};

export default VideoSession;
