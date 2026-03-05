import { useRef, useState, useCallback, useEffect } from 'react';

interface UseWebRTCProps {
  sendMessage: (message: any) => void;
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
  onError: (message: string) => void;
}

interface UseWebRTCResult {
  remoteVideoRef: React.RefObject<HTMLVideoElement>;
  isRemoteVideoReady: boolean;
  isRemotePlaybackBlocked: boolean;
  initializePeerConnection: (localStream: MediaStream, isInitiator: boolean) => Promise<void>;
  createOffer: (isRestart?: boolean) => Promise<void>;
  handleOffer: (offer: RTCSessionDescriptionInit, localStream: MediaStream) => Promise<void>;
  handleAnswer: (answer: RTCSessionDescriptionInit) => Promise<void>;
  addIceCandidate: (candidate: RTCIceCandidateInit) => Promise<void>;
  closePeerConnection: () => void;
  connectionState: RTCPeerConnectionState;
  remoteStream: MediaStream | null;
}

export const useWebRTC = ({
  sendMessage,
  onConnectionStateChange,
  onError,
}: UseWebRTCProps): UseWebRTCResult => {
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  
  const [isRemoteVideoReady, setIsRemoteVideoReady] = useState(false);
  const [isRemotePlaybackBlocked, setIsRemotePlaybackBlocked] = useState(false);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>('new');
  
  const iceRestartAttemptsRef = useRef(0);
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      closePeerConnection();
    };
  }, []);

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
      if (configuredTurnUrls) {
        servers.push({
          urls: configuredTurnUrls,
          username: turnUsername,
          credential: turnCredential,
        });
      }
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

    return {
      iceServers: servers,
      iceCandidatePoolSize: 10,
      iceTransportPolicy: forceRelay ? 'relay' : 'all',
    };
  };

  const closePeerConnection = useCallback(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.ontrack = null;
      peerConnectionRef.current.onicecandidate = null;
      peerConnectionRef.current.onconnectionstatechange = null;
      peerConnectionRef.current.oniceconnectionstatechange = null;
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    setRemoteStream(null);
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    setIsRemoteVideoReady(false);
    setIsRemotePlaybackBlocked(false);
    setConnectionState('closed');
  }, []);

  const initializePeerConnection = useCallback(async (localStream: MediaStream, isInitiator: boolean) => {
    if (peerConnectionRef.current) {
      console.warn('[useWebRTC] PeerConnection already exists, closing it.');
      closePeerConnection();
    }

    console.log('[useWebRTC] Initializing RTCPeerConnection');
    const pc = new RTCPeerConnection(buildIceConfiguration());
    peerConnectionRef.current = pc;

    // Add local tracks
    localStream.getTracks().forEach((track) => {
      pc.addTrack(track, localStream);
    });

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendMessage({
          type: 'ice_candidate',
          candidate: event.candidate,
        });
      }
    };

    // Handle Connection State
    pc.onconnectionstatechange = () => {
      console.log('[useWebRTC] Connection state:', pc.connectionState);
      setConnectionState(pc.connectionState);
      if (onConnectionStateChange) {
        onConnectionStateChange(pc.connectionState);
      }

      if (pc.connectionState === 'failed') {
        // Simple retry logic
        if (iceRestartAttemptsRef.current < 3) {
          console.warn('[useWebRTC] Connection failed, attempting ICE restart...');
          iceRestartAttemptsRef.current++;
          // Trigger restart via createOffer(true)
          if (isInitiator) { // Only initiator should restart? Or whoever detects it?
             // Logic to restart can be complex.
          }
        } else {
            onError('Connection failed and could not be restored.');
        }
      } else if (pc.connectionState === 'connected') {
        iceRestartAttemptsRef.current = 0;
      }
    };

    // Handle Remote Track
    pc.ontrack = (event) => {
      console.log('[useWebRTC] Received remote track:', event.track.kind);
      
      const stream = event.streams[0] || new MediaStream();
      if (!event.streams[0]) {
        stream.addTrack(event.track);
      }

      setRemoteStream(stream);

      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
        
        const playPromise = remoteVideoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            console.warn('[useWebRTC] Remote autoplay blocked:', err);
            setIsRemotePlaybackBlocked(true);
          });
        }
      }
      setIsRemoteVideoReady(true);
    };

    // Process any pending candidates
    if (pendingIceCandidatesRef.current.length > 0) {
        console.log(`[useWebRTC] Adding ${pendingIceCandidatesRef.current.length} pending candidates`);
        for (const candidate of pendingIceCandidatesRef.current) {
            try {
                await pc.addIceCandidate(candidate);
            } catch (e) {
                console.error('[useWebRTC] Error adding pending candidate', e);
            }
        }
        pendingIceCandidatesRef.current = [];
    }
  }, [closePeerConnection, sendMessage, onConnectionStateChange, onError]);

  const createOffer = useCallback(async (isRestart = false) => {
    if (!peerConnectionRef.current) {
      console.error('[useWebRTC] Cannot create offer: PeerConnection is null');
      return;
    }
    try {
      console.log('[useWebRTC] Creating offer...');
      const offer = await peerConnectionRef.current.createOffer({ iceRestart: isRestart });
      await peerConnectionRef.current.setLocalDescription(offer);
      console.log('[useWebRTC] Offer created, sending to peer');
      sendMessage({
        type: 'offer',
        offer,
      });
    } catch (err: any) {
      console.error('[useWebRTC] Error creating offer:', err);
      onError('Failed to create connection offer.');
    }
  }, [sendMessage, onError]);

  const handleOffer = useCallback(async (offer: RTCSessionDescriptionInit, localStream: MediaStream) => {
    console.log('[useWebRTC] Handling offer from peer');
    // If we haven't initialized yet, do so (as responder)
    if (!peerConnectionRef.current) {
      console.log('[useWebRTC] No peer connection, initializing as responder');
      await initializePeerConnection(localStream, false);
    }
    
    if (!peerConnectionRef.current) {
      console.error('[useWebRTC] Failed to initialize peer connection');
      return;
    }

    try {
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offer));
      console.log('[useWebRTC] Remote description set, creating answer');
      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);
      console.log('[useWebRTC] Answer created, sending to peer');
      sendMessage({
        type: 'answer',
        answer,
      });
      
      // Process pending candidates now that we have remote description
      if (pendingIceCandidatesRef.current.length > 0) {
         console.log(`[useWebRTC] Processing ${pendingIceCandidatesRef.current.length} pending candidates`);
         for (const candidate of pendingIceCandidatesRef.current) {
             await peerConnectionRef.current.addIceCandidate(candidate);
         }
         pendingIceCandidatesRef.current = [];
      }

    } catch (err: any) {
      console.error('[useWebRTC] Error handling offer:', err);
      onError('Failed to handle connection offer.');
    }
  }, [initializePeerConnection, sendMessage, onError]);

  const handleAnswer = useCallback(async (answer: RTCSessionDescriptionInit) => {
    if (!peerConnectionRef.current) {
      console.error('[useWebRTC] Cannot handle answer: PeerConnection is null');
      return;
    }
    try {
      console.log('[useWebRTC] Handling answer from peer');
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      console.log('[useWebRTC] Remote description (answer) set successfully');
    } catch (err: any) {
        console.error('[useWebRTC] Error handling answer:', err);
        onError('Failed to establish connection (answer error).');
    }
  }, [onError]);

  const addIceCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    if (!peerConnectionRef.current || !peerConnectionRef.current.remoteDescription) {
      console.log('[useWebRTC] Buffering ICE candidate (no remote description)');
      pendingIceCandidatesRef.current.push(candidate);
      return;
    }
    try {
      console.log('[useWebRTC] Adding ICE candidate');
      await peerConnectionRef.current.addIceCandidate(candidate);
    } catch (err: any) {
       console.error('[useWebRTC] Error adding ICE candidate:', err);
    }
  }, []);

  return {
    remoteVideoRef,
    isRemoteVideoReady,
    isRemotePlaybackBlocked,
    initializePeerConnection,
    createOffer,
    handleOffer,
    handleAnswer,
    addIceCandidate,
    closePeerConnection,
    connectionState,
    remoteStream,
  };
};
