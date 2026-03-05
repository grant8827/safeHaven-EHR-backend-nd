import { 
  TelehealthSession, 
  ChatMessage,
  TelehealthTechnicalCheck,
  DeviceInfo,
  ApiResponse,
  SessionFeatures, // Added import
  SessionAction,
  SessionActionType,
  ParticipantRole,
  SessionControl,
  PatientSessionInfo,
  SessionInvitation,
  SessionInitiationRequest,
  RecordingState,
  RecordingQuality,
  TranscriptionSettings,
  TranscriptionState,
  SessionTranscript,
  TranscriptEntry,
  RecordingControls,
  BrowserInfo,
  DeviceCapabilities,
  NetworkTest,
  MediaPermissions,
  PermissionState,
  TechnicalStatus
} from '../types';

import {
  ConnectionStats
} from '../types/telehealth';
import { apiService } from './apiService';
import { webSocketService } from './webSocketService';

class TelehealthService {
  private baseUrl = '/api/telehealth';
  private webRtcPeerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private listeners: Map<string, ((data: any) => void)[]> = new Map();

  public on(event: string, callback: (data: any) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  public off(event: string, callback: (data: any) => void) {
    if (this.listeners.has(event)) {
      const filteredCallbacks = this.listeners.get(event)!.filter(cb => cb !== callback);
      this.listeners.set(event, filteredCallbacks);
    }
  }

  private emit(event: string, data: any) {
    if (this.listeners.has(event)) {
      this.listeners.get(event)!.forEach(callback => callback(data));
    }
  }


  /**
   * Get telehealth session by ID
   */
  async getSession(sessionId: string): Promise<ApiResponse<TelehealthSession>> {
    try {
      // Cast the response to the expected type since apiService methods return generic types
      const response = await apiService.get<TelehealthSession>(`${this.baseUrl}/sessions/${sessionId}`);
      return response;
    } catch (error) {
      console.error('Error fetching telehealth session:', error);
      return {
        success: false,
        message: 'Failed to fetch session',
        errors: ['Session not found or access denied'],
      };
    }
  }

  /**
   * Create a new telehealth session
   */
  async createSession(
    appointmentId: string,
    features: Partial<SessionFeatures> = {}
  ): Promise<ApiResponse<TelehealthSession>> {
    try {
      const response = await apiService.post<TelehealthSession>(`${this.baseUrl}/sessions`, {
        appointmentId,
        features,
      });
      return response;
    } catch (error) {
      console.error('Error creating telehealth session:', error);
      return {
        success: false,
        message: 'Failed to create session',
        errors: ['Session creation failed'],
      };
    }
  }

  /**
   * Join a telehealth session
   */
  async joinSession(
    sessionId: string,
    deviceInfo: DeviceInfo
  ): Promise<ApiResponse<{ participantId: string; iceServers: RTCIceServer[] }>> {
    try {
      const response = await apiService.post<{ participantId: string; iceServers: RTCIceServer[] }>(`${this.baseUrl}/sessions/${sessionId}/join`, {
        deviceInfo,
      });
      
      if (response.success && response.data) {
        // Connect to WebSocket for real-time communication
        await webSocketService.connect(sessionId, response.data.participantId);
        this.setupWebSocketListeners();
      }
      
      return response;
    } catch (error) {
      console.error('Error joining telehealth session:', error);
      return {
        success: false,
        message: 'Failed to join session',
        errors: ['Unable to join session at this time'],
      };
    }
  }

  /**
   * Leave a telehealth session
   */
  async leaveSession(sessionId: string): Promise<ApiResponse<void>> {
    try {
      const response = await apiService.post<void>(`${this.baseUrl}/sessions/${sessionId}/leave`);
      
      // Disconnect WebSocket
      webSocketService.disconnect();
      
      this.cleanup();
      return response;
    } catch (error) {
      console.error('Error leaving telehealth session:', error);
      return {
        success: false,
        message: 'Failed to leave session',
        errors: ['Error leaving session'],
      };
    }
  }

  // Note: Recording and transcription methods are implemented at the end of the class

  /**
   * Send chat message
   */
  async sendChatMessage(
    sessionId: string,
    content: string,
    isPrivate = false,
    recipientId?: string
  ): Promise<ApiResponse<ChatMessage>> {
    try {
      const response = await apiService.post<ChatMessage>(`${this.baseUrl}/sessions/${sessionId}/chat`, {
        content,
        isPrivate,
        recipientId,
      });
      return response;
    } catch (error) {
      console.error('Error sending chat message:', error);
      return {
        success: false,
        message: 'Failed to send message',
        errors: ['Message send failed'],
      };
    }
  }

  /**
   * Get chat history
   */
  async getChatHistory(sessionId: string): Promise<ApiResponse<ChatMessage[]>> {
    try {
      const response = await apiService.get<ChatMessage[]>(`${this.baseUrl}/sessions/${sessionId}/chat`);
      return response;
    } catch (error) {
      console.error('Error fetching chat history:', error);
      return {
        success: false,
        message: 'Failed to fetch chat',
        errors: ['Chat history unavailable'],
      };
    }
  }

  /**
   * Perform technical check
   */
  async performTechnicalCheck(): Promise<ApiResponse<TelehealthTechnicalCheck>> {
    try {
      const checkResult = await this.runDiagnostics();
      const response = await apiService.post<TelehealthTechnicalCheck>(`${this.baseUrl}/technical-check`, checkResult);
      return response;
    } catch (error) {
      console.error('Error performing technical check:', error);
      return {
        success: false,
        message: 'Technical check failed',
        errors: ['Unable to complete system check'],
      };
    }
  }

  /**
   * Get available devices
   */
  async getAvailableDevices(): Promise<DeviceInfo> {
    const devices: DeviceInfo = {
      camera: null,
      microphone: null,
      speakers: null,
      cameraEnabled: false,
      microphoneEnabled: false,
      speakersEnabled: false,
    };

    try {
      const mediaDevices = await navigator.mediaDevices.enumerateDevices();
      
      const cameras = mediaDevices.filter(device => device.kind === 'videoinput');
      const microphones = mediaDevices.filter(device => device.kind === 'audioinput');
      const speakers = mediaDevices.filter(device => device.kind === 'audiooutput');

      if (cameras.length > 0) devices.camera = cameras[0];
      if (microphones.length > 0) devices.microphone = microphones[0];
      if (speakers.length > 0) devices.speakers = speakers[0];

    } catch (error) {
      console.error('Error getting devices:', error);
    }

    return devices;
  }

  /**
   * Request media permissions and get user media
   */
  async getUserMedia(constraints: MediaStreamConstraints = { video: true, audio: true }): Promise<MediaStream | null> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.localStream = stream;
      return stream;
    } catch (error) {
      console.error('Error getting user media:', error);
      return null;
    }
  }

  /**
   * Initialize WebRTC connection
   */
  initializeWebRTC(iceServers: RTCIceServer[]): RTCPeerConnection {
    const configuration: RTCConfiguration = {
      iceServers,
      iceCandidatePoolSize: 10,
    };

    this.webRtcPeerConnection = new RTCPeerConnection(configuration);
    
    // Set up event handlers
    this.webRtcPeerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        // Send ICE candidate to remote peer through signaling server
        this.sendSignalingMessage('ice-candidate', event.candidate);
      }
    };

    this.webRtcPeerConnection.ontrack = (event) => {
      this.remoteStream = event.streams[0];
    };

    this.webRtcPeerConnection.ondatachannel = (event) => {
      const channel = event.channel;
      channel.onmessage = (event) => {
        // Handle data channel message
        console.log('Data channel message:', event.data);
      };
    };

    return this.webRtcPeerConnection;
  }

  /**
   * Create WebRTC offer
   */
  async createOffer(): Promise<RTCSessionDescriptionInit | null> {
    if (!this.webRtcPeerConnection) return null;

    try {
      const offer = await this.webRtcPeerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      
      await this.webRtcPeerConnection.setLocalDescription(offer);
      return offer;
    } catch (error) {
      console.error('Error creating offer:', error);
      return null;
    }
  }

  /**
   * Create WebRTC answer
   */
  async createAnswer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit | null> {
    if (!this.webRtcPeerConnection) return null;

    try {
      await this.webRtcPeerConnection.setRemoteDescription(offer);
      const answer = await this.webRtcPeerConnection.createAnswer();
      await this.webRtcPeerConnection.setLocalDescription(answer);
      return answer;
    } catch (error) {
      console.error('Error creating answer:', error);
      return null;
    }
  }

  /**
   * Add ICE candidate
   */
  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.webRtcPeerConnection) return;

    try {
      await this.webRtcPeerConnection.addIceCandidate(candidate);
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  }

  /**
   * Toggle camera
   */
  toggleCamera(): boolean {
    if (!this.localStream) return false;

    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      return videoTrack.enabled;
    }
    return false;
  }

  /**
   * Toggle microphone
   */
  toggleMicrophone(): boolean {
    if (!this.localStream) return false;

    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      return audioTrack.enabled;
    }
    return false;
  }

  /**
   * Start screen sharing
   */
  async startScreenShare(): Promise<MediaStream | null> {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      if (this.webRtcPeerConnection && this.localStream) {
        const videoTrack = screenStream.getVideoTracks()[0];
        const sender = this.webRtcPeerConnection.getSenders().find(s => 
          s.track && s.track.kind === 'video'
        );
        
        if (sender) {
          await sender.replaceTrack(videoTrack);
        }
      }

      return screenStream;
    } catch (error) {
      console.error('Error starting screen share:', error);
      return null;
    }
  }

  /**
   * Stop screen sharing
   */
  async stopScreenShare(): Promise<void> {
    if (!this.webRtcPeerConnection || !this.localStream) return;

    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      const sender = this.webRtcPeerConnection.getSenders().find(s => 
        s.track && s.track.kind === 'video'
      );
      
      if (sender) {
        await sender.replaceTrack(videoTrack);
      }
    }
  }

  /**
   * Get connection statistics
   */
  async getConnectionStats(): Promise<ConnectionStats | null> {
    if (!this.webRtcPeerConnection) return null;

    try {
      const stats = await this.webRtcPeerConnection.getStats();
      return this.parseStats(stats);
    } catch (error) {
      console.error('Error getting connection stats:', error);
      return null;
    }
  }

  /**
   * Run system diagnostics
   */
  private async runDiagnostics(): Promise<TelehealthTechnicalCheck> {
    const diagnostics = {
      browserInfo: this.getBrowserInfo(),
      deviceCapabilities: await this.getDeviceCapabilities(),
      networkTest: await this.performNetworkTest(),
    };

    // Calculate overall status based on network test results
    let overallStatus: TechnicalStatus = TechnicalStatus.GOOD;
    const recommendations: string[] = [];

    if (diagnostics.networkTest.latency > 200) {
      overallStatus = TechnicalStatus.FAIR;
      recommendations.push('High latency detected. Consider a wired connection.');
    }
    if (diagnostics.networkTest.packetLoss > 5) {
      overallStatus = TechnicalStatus.POOR;
      recommendations.push('High packet loss. Check your network connection.');
    }
    if (!diagnostics.browserInfo.webRtcSupported) {
      overallStatus = TechnicalStatus.FAILED;
      recommendations.push('WebRTC not supported. Please update your browser.');
    }

    // Return with required TelehealthTechnicalCheck fields
    return {
      id: `check-${Date.now()}`,
      userId: 'current-user',
      timestamp: new Date(),
      overallStatus,
      recommendations,
      ...diagnostics,
    };
  }

  /**
   * Get browser information
   */
  private getBrowserInfo(): BrowserInfo {
    const userAgent = navigator.userAgent;
    const browser = this.detectBrowser(userAgent);
    
    return {
      name: browser.name,
      version: browser.version,
      webRtcSupported: !!window.RTCPeerConnection,
      webCamSupported: !!navigator.mediaDevices?.getUserMedia,
      microphoneSupported: !!navigator.mediaDevices?.getUserMedia,
      screenShareSupported: !!navigator.mediaDevices?.getDisplayMedia,
    };
  }

  /**
   * Detect browser from user agent
   */
  private detectBrowser(userAgent: string): { name: string; version: string } {
    const browsers = [
      { name: 'Chrome', regex: /Chrome\/(\d+)/ },
      { name: 'Firefox', regex: /Firefox\/(\d+)/ },
      { name: 'Safari', regex: /Safari\/(\d+)/ },
      { name: 'Edge', regex: /Edg\/(\d+)/ },
    ];

    for (const browser of browsers) {
      const match = userAgent.match(browser.regex);
      if (match) {
        return { name: browser.name, version: match[1] };
      }
    }

    return { name: 'Unknown', version: '0' };
  }

  /**
   * Get device capabilities
   */
  private async getDeviceCapabilities(): Promise<DeviceCapabilities> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      return {
        cameras: devices.filter(d => d.kind === 'videoinput'),
        microphones: devices.filter(d => d.kind === 'audioinput'),
        speakers: devices.filter(d => d.kind === 'audiooutput'),
        permissions: await this.checkPermissions(),
      };
    } catch (error) {
      console.error('Error getting device capabilities:', error);
      return {
        cameras: [],
        microphones: [],
        speakers: [],
        permissions: {
          camera: PermissionState.UNKNOWN,
          microphone: PermissionState.UNKNOWN,
          screenShare: PermissionState.UNKNOWN,
        },
      };
    }
  }

  /**
   * Check media permissions
   */
  private async checkPermissions(): Promise<MediaPermissions> {
    const permissions: MediaPermissions = {
      camera: PermissionState.PROMPT,
      microphone: PermissionState.PROMPT,
      screenShare: PermissionState.PROMPT,
    };

    try {
      if (navigator.permissions) {
        // Note: 'camera' and 'microphone' are not standard PermissionName values in TypeScript yet
        // Casting to PermissionName to avoid type errors
        try {
          const camera = await navigator.permissions.query({ name: 'camera' as PermissionName });
          permissions.camera = this.mapPermissionState(camera.state);
        } catch (e) {
          // Firefox doesn't support querying camera permission
        }

        try {
          const microphone = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          permissions.microphone = this.mapPermissionState(microphone.state);
        } catch (e) {
          // Firefox doesn't support querying microphone permission
        }
      }
    } catch (error) {
      console.error('Error checking permissions:', error);
    }

    return permissions;
  }

  /**
   * Map browser PermissionState to our enum
   */
  private mapPermissionState(state: globalThis.PermissionState): PermissionState {
    switch (state) {
      case 'granted':
        return PermissionState.GRANTED;
      case 'denied':
        return PermissionState.DENIED;
      case 'prompt':
        return PermissionState.PROMPT;
      default:
        return PermissionState.UNKNOWN;
    }
  }

  /**
   * Perform network speed test
   */
  private async performNetworkTest(): Promise<NetworkTest> {
    const startTime = Date.now();
    
    try {
      // Simple network test - in production, use a more sophisticated test
      // Mock endpoint since actual endpoint might not exist yet
      try {
        await fetch('/api/network-test', {
            method: 'POST',
            body: new Blob(['x'.repeat(1024)]), // 1KB test
        });
      } catch (e) {
          // Ignore network errors for mock implementation
      }
      
      const endTime = Date.now();
      const latency = endTime - startTime;
      
      const connection = (navigator as unknown as { connection?: { effectiveType?: string } }).connection;

      return {
        downloadSpeed: 0, // Would be calculated in a real implementation
        uploadSpeed: 0, // Would be calculated in a real implementation
        latency,
        jitter: 0, // Would be calculated in a real implementation
        packetLoss: 0,
        connectionType: connection?.effectiveType || 'unknown',
      };
    } catch (error) {
      return {
        downloadSpeed: 0,
        uploadSpeed: 0,
        latency: 999,
        jitter: 999,
        packetLoss: 100,
        connectionType: 'unknown',
      };
    }
  }

  /**
   * Parse WebRTC statistics
   */
  private parseStats(stats: RTCStatsReport): ConnectionStats {
    const parsed: ConnectionStats = {
      bytesReceived: 0,
      bytesSent: 0,
      packetsReceived: 0,
      packetsSent: 0,
      packetsLost: 0,
      jitter: 0,
      roundTripTime: 0,
    };

    stats.forEach((report) => {
      if (report.type === 'inbound-rtp') {
        parsed.bytesReceived += report.bytesReceived || 0;
        parsed.packetsReceived += report.packetsReceived || 0;
        parsed.packetsLost += report.packetsLost || 0;
        parsed.jitter = Math.max(parsed.jitter, report.jitter || 0);
      } else if (report.type === 'outbound-rtp') {
        parsed.bytesSent += report.bytesSent || 0;
        parsed.packetsSent += report.packetsSent || 0;
      } else if (report.type === 'candidate-pair' && report.state === 'succeeded') {
        parsed.roundTripTime = report.currentRoundTripTime || 0;
      }
    });

    return parsed;
  }

  /**
   * Send signaling message through WebSocket
   */
  private sendSignalingMessage(type: string, data: unknown): void {
    if (type === 'ice-candidate' && data) {
      webSocketService.sendIceCandidate(data as RTCIceCandidate, 'all'); // Send to all participants
    }
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach(track => track.stop());
      this.remoteStream = null;
    }

    if (this.webRtcPeerConnection) {
      this.webRtcPeerConnection.close();
      this.webRtcPeerConnection = null;
    }

    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
  }

  /**
   * Get local stream
   */
  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  /**
   * Get remote stream
   */
  getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  /**
   * Setup WebSocket event listeners
   */
  private setupWebSocketListeners(): void {
    webSocketService.on('offer', async (data: Record<string, unknown>) => {
      const offerData = data as { offer: RTCSessionDescriptionInit; targetParticipantId: string };
      if (this.webRtcPeerConnection && offerData.offer) {
        const answer = await this.createAnswer(offerData.offer);
        if (answer) {
          webSocketService.sendAnswer(answer, offerData.targetParticipantId);
        }
      }
    });

    webSocketService.on('answer', async (data: Record<string, unknown>) => {
      const answerData = data as { answer: RTCSessionDescriptionInit };
      if (this.webRtcPeerConnection && answerData.answer) {
        await this.webRtcPeerConnection.setRemoteDescription(answerData.answer);
      }
    });

    webSocketService.on('ice-candidate', async (data: Record<string, unknown>) => {
      const candidateData = data as { candidate: RTCIceCandidateInit };
      if (candidateData.candidate) {
        await this.addIceCandidate(candidateData.candidate);
      }
    });

    webSocketService.on('chat-message', (data: Record<string, unknown>) => {
      // Chat messages will be handled by the UI component
      console.log('Chat message received:', data);
    });

    webSocketService.on('participant-joined', (data: Record<string, unknown>) => {
      console.log('Participant joined:', data);
    });

    webSocketService.on('participant-left', (data: Record<string, unknown>) => {
      console.log('Participant left:', data);
    });

    webSocketService.on('recording-started', (data: Record<string, unknown>) => {
      console.log('Recording started:', data);
    });

    webSocketService.on('recording-stopped', (data: Record<string, unknown>) => {
      console.log('Recording stopped:', data);
    });

    webSocketService.on('transcription', (message: Record<string, unknown>) => {
      const wsMessage = message as { type: string; sessionId: string; participantId?: string; data?: Record<string, unknown>; timestamp: Date };
      if (wsMessage.data) {
        const entry: TranscriptEntry = {
          id: `entry-${Date.now()}-${Math.random()}`,
          sessionId: wsMessage.sessionId,
          speakerId: wsMessage.participantId || 'unknown',
          speakerName: `Speaker ${wsMessage.participantId?.substring(0, 4) || 'N/A'}`,
          text: wsMessage.data.text as string,
          startTime: wsMessage.timestamp,
          endTime: new Date(),
          duration: 0,
          confidence: wsMessage.data.confidence as number,
          isInterim: !wsMessage.data.isFinal,
          keywords: [],
        };
        this.emit('transcription-update', entry);
      }
    });
  }

  // ===== SESSION CONTROL METHODS FOR THERAPISTS AND ADMINS =====

  /**
   * Perform session action (therapist/admin control)
   */
  async performSessionAction(
    sessionId: string,
    actionType: SessionActionType,
    targetId?: string,
    parameters?: Record<string, unknown> | null,
    reason?: string
  ): Promise<ApiResponse<SessionAction>> {
    try {
      const response = await apiService.post<SessionAction>(`${this.baseUrl}/sessions/${sessionId}/actions`, {
        actionType,
        targetId,
        parameters,
        reason,
      });
      return response;
    } catch (error) {
      console.error('Error performing session action:', error);
      return {
        success: false,
        message: 'Failed to perform action',
        errors: ['Action could not be completed'],
      };
    }
  }

  /**
   * Mute participant (therapist/admin only)
   */
  async muteParticipant(sessionId: string, participantId: string, reason?: string): Promise<ApiResponse<SessionAction>> {
    return this.performSessionAction(sessionId, SessionActionType.MUTE_PARTICIPANT, participantId, null, reason);
  }

  /**
   * Unmute participant (therapist/admin only)
   */
  async unmuteParticipant(sessionId: string, participantId: string): Promise<ApiResponse<SessionAction>> {
    return this.performSessionAction(sessionId, SessionActionType.UNMUTE_PARTICIPANT, participantId);
  }

  /**
   * Disable participant video (therapist/admin only)
   */
  async disableParticipantVideo(sessionId: string, participantId: string, reason?: string): Promise<ApiResponse<SessionAction>> {
    return this.performSessionAction(sessionId, SessionActionType.DISABLE_VIDEO, participantId, null, reason);
  }

  /**
   * Enable participant video (therapist/admin only)
   */
  async enableParticipantVideo(sessionId: string, participantId: string): Promise<ApiResponse<SessionAction>> {
    return this.performSessionAction(sessionId, SessionActionType.ENABLE_VIDEO, participantId);
  }

  /**
   * Remove participant from session (therapist/admin only)
   */
  async removeParticipant(sessionId: string, participantId: string, reason: string): Promise<ApiResponse<SessionAction>> {
    return this.performSessionAction(sessionId, SessionActionType.REMOVE_PARTICIPANT, participantId, null, reason);
  }

  /**
   * Admit participant from waiting room (therapist/admin only)
   */
  async admitFromWaiting(sessionId: string, participantId: string): Promise<ApiResponse<SessionAction>> {
    return this.performSessionAction(sessionId, SessionActionType.ADMIT_FROM_WAITING, participantId);
  }

  /**
   * Send participant to waiting room (therapist/admin only)
   */
  async sendToWaiting(sessionId: string, participantId: string, reason?: string): Promise<ApiResponse<SessionAction>> {
    return this.performSessionAction(sessionId, SessionActionType.SEND_TO_WAITING, participantId, null, reason);
  }

  /**
   * Assign role to participant (admin only)
   */
  async assignRole(sessionId: string, participantId: string, role: ParticipantRole): Promise<ApiResponse<SessionAction>> {
    return this.performSessionAction(sessionId, SessionActionType.ASSIGN_ROLE, participantId, { role });
  }

  /**
   * Lock session (therapist/admin only)
   */
  async lockSession(sessionId: string): Promise<ApiResponse<SessionAction>> {
    return this.performSessionAction(sessionId, SessionActionType.LOCK_SESSION);
  }

  /**
   * Unlock session (therapist/admin only)
   */
  async unlockSession(sessionId: string): Promise<ApiResponse<SessionAction>> {
    return this.performSessionAction(sessionId, SessionActionType.UNLOCK_SESSION);
  }

  /**
   * End session for all participants (therapist/admin only)
   */
  async endSessionForAll(sessionId: string, reason?: string): Promise<ApiResponse<SessionAction>> {
    return this.performSessionAction(sessionId, SessionActionType.END_SESSION, undefined, null, reason);
  }

  /**
   * Extend session duration (therapist/admin only)
   */
  async extendSession(sessionId: string, additionalMinutes: number): Promise<ApiResponse<SessionAction>> {
    return this.performSessionAction(sessionId, SessionActionType.EXTEND_SESSION, undefined, { additionalMinutes });
  }

  /**
   * Pause session (therapist/admin only)
   */
  async pauseSession(sessionId: string, reason?: string): Promise<ApiResponse<SessionAction>> {
    return this.performSessionAction(sessionId, SessionActionType.PAUSE_SESSION, undefined, null, reason);
  }

  /**
   * Resume session (therapist/admin only)
   */
  async resumeSession(sessionId: string): Promise<ApiResponse<SessionAction>> {
    return this.performSessionAction(sessionId, SessionActionType.RESUME_SESSION);
  }

  /**
   * Stop participant screen sharing (therapist/admin only)
   */
  async stopParticipantScreenShare(sessionId: string, participantId: string): Promise<ApiResponse<SessionAction>> {
    return this.performSessionAction(sessionId, SessionActionType.STOP_SCREEN_SHARE, participantId);
  }

  /**
   * Disable chat for session (therapist/admin only)
   */
  async disableChat(sessionId: string): Promise<ApiResponse<SessionAction>> {
    return this.performSessionAction(sessionId, SessionActionType.DISABLE_CHAT);
  }

  /**
   * Enable chat for session (therapist/admin only)
   */
  async enableChat(sessionId: string): Promise<ApiResponse<SessionAction>> {
    return this.performSessionAction(sessionId, SessionActionType.ENABLE_CHAT);
  }

  /**
   * Delete chat message (therapist/admin only)
   */
  async deleteChatMessage(sessionId: string, messageId: string, reason?: string): Promise<ApiResponse<SessionAction>> {
    return this.performSessionAction(sessionId, SessionActionType.DELETE_MESSAGE, messageId, null, reason);
  }

  /**
   * Warn participant (therapist/admin only)
   */
  async warnParticipant(sessionId: string, participantId: string, message: string): Promise<ApiResponse<SessionAction>> {
    return this.performSessionAction(sessionId, SessionActionType.WARN_PARTICIPANT, participantId, { message });
  }

  /**
   * Force participant reconnection (admin only)
   */
  async forceReconnect(sessionId: string, participantId: string): Promise<ApiResponse<SessionAction>> {
    return this.performSessionAction(sessionId, SessionActionType.FORCE_RECONNECT, participantId);
  }

  /**
   * Get session control permissions for current user
   */
  async getSessionControls(sessionId: string): Promise<ApiResponse<SessionControl>> {
    try {
      const response = await apiService.get(`${this.baseUrl}/sessions/${sessionId}/controls`);
      return response as any;
    } catch (error) {
      console.error('Error fetching session controls:', error);
      return {
        success: false,
        message: 'Failed to fetch controls',
        errors: ['Unable to retrieve session controls'],
      };
    }
  }

  /**
   * Get session actions history (therapist/admin only)
   */
  async getSessionActions(sessionId: string): Promise<ApiResponse<SessionAction[]>> {
    try {
      const response = await apiService.get(`${this.baseUrl}/sessions/${sessionId}/actions`);
      return response as any;
    } catch (error) {
      console.error('Error fetching session actions:', error);
      return {
        success: false,
        message: 'Failed to fetch actions',
        errors: ['Unable to retrieve session actions'],
      };
    }
  }

  /**
   * Emergency session shutdown (admin only)
   */
  async emergencyShutdown(sessionId: string, reason: string): Promise<ApiResponse<void>> {
    try {
      const response = await apiService.post(`${this.baseUrl}/sessions/${sessionId}/emergency-shutdown`, {
        reason,
        timestamp: new Date().toISOString(),
      });
      
      // Immediately cleanup local resources
      this.cleanup();
      webSocketService.disconnect();
      
      return response as any;
    } catch (error) {
      console.error('Error performing emergency shutdown:', error);
      return {
        success: false,
        message: 'Emergency shutdown failed',
        errors: ['Unable to perform emergency shutdown'],
      };
    }
  }

  // Patient Management and Session Initiation Methods

  /**
   * Get list of patients assigned to therapist for session initiation
   */
  async getAssignedPatients(therapistId: string): Promise<ApiResponse<PatientSessionInfo[]>> {
    try {
      const response = await apiService.get(`${this.baseUrl}/therapists/${therapistId}/patients`);
      return response as any;
    } catch (error) {
      console.error('Error fetching assigned patients:', error);
      return {
        success: false,
        message: 'Failed to fetch patients',
        errors: ['Unable to load patient list'],
      };
    }
  }

  /**
   * Get all patients (for admin users)
   */
  async getAllPatients(): Promise<ApiResponse<PatientSessionInfo[]>> {
    try {
      const response = await apiService.get(`${this.baseUrl}/patients`);
      return response as any;
    } catch (error) {
      console.error('Error fetching all patients:', error);
      return {
        success: false,
        message: 'Failed to fetch patients',
        errors: ['Unable to load patient list'],
      };
    }
  }

  /**
   * Initiate a telehealth session with a specific patient
   */
  async initiateSessionWithPatient(
    request: SessionInitiationRequest
  ): Promise<ApiResponse<{ session: TelehealthSession; invitation: SessionInvitation }>> {
    try {
      const response = await apiService.post(`${this.baseUrl}/sessions/initiate`, request);
      return response as any;
    } catch (error) {
      console.error('Error initiating session:', error);
      return {
        success: false,
        message: 'Failed to initiate session',
        errors: ['Unable to start session with patient'],
      };
    }
  }

  /**
   * Send session invitation to patient
   */
  async sendSessionInvitation(
    patientId: string,
    sessionId: string,
    message?: string
  ): Promise<ApiResponse<SessionInvitation>> {
    try {
      const response = await apiService.post(`${this.baseUrl}/sessions/${sessionId}/invite`, {
        patientId,
        message,
      });
      return response as any;
    } catch (error) {
      console.error('Error sending invitation:', error);
      return {
        success: false,
        message: 'Failed to send invitation',
        errors: ['Unable to send session invitation'],
      };
    }
  }

  /**
   * Join session via invitation (for patients)
   */
  async joinSessionViaInvitation(
    invitationId: string,
    accessCode?: string
  ): Promise<ApiResponse<{ sessionId: string; participantId: string; iceServers: RTCIceServer[] }>> {
    try {
      const response = await apiService.post(`${this.baseUrl}/invitations/${invitationId}/join`, {
        accessCode,
      });

      if (response.success) {
        const joinData = response.data as { sessionId: string; participantId: string; iceServers: RTCIceServer[] };
        await webSocketService.connect(joinData.sessionId, joinData.participantId);
        this.setupWebSocketListeners();
      }

      return response as any;
    } catch (error) {
      console.error('Error joining via invitation:', error);
      return {
        success: false,
        message: 'Failed to join session',
        errors: ['Invalid invitation or session expired'],
      };
    }
  }

  /**
   * Get patient's pending invitations
   */
  async getPatientInvitations(patientId: string): Promise<ApiResponse<SessionInvitation[]>> {
    try {
      const response = await apiService.get(`${this.baseUrl}/patients/${patientId}/invitations`);
      return response as any;
    } catch (error) {
      console.error('Error fetching invitations:', error);
      return {
        success: false,
        message: 'Failed to fetch invitations',
        errors: ['Unable to load session invitations'],
      };
    }
  }

  /**
   * Cancel session invitation
   */
  async cancelInvitation(invitationId: string): Promise<ApiResponse<void>> {
    try {
      const response = await apiService.delete(`${this.baseUrl}/invitations/${invitationId}`);
      return response as any;
    } catch (error) {
      console.error('Error cancelling invitation:', error);
      return {
        success: false,
        message: 'Failed to cancel invitation',
        errors: ['Unable to cancel invitation'],
      };
    }
  }

  /**
   * Get session status for patient
   */
  async getPatientSessionStatus(patientId: string): Promise<ApiResponse<{
    hasActiveSession: boolean;
    activeSessionId?: string;
    pendingInvitations: SessionInvitation[];
  }>> {
    try {
      const response = await apiService.get(`${this.baseUrl}/patients/${patientId}/session-status`);
      return response as any;
    } catch (error) {
      console.error('Error fetching patient session status:', error);
      return {
        success: false,
        message: 'Failed to fetch session status',
        errors: ['Unable to check session status'],
      };
    }
  }

  // ===== RECORDING AND TRANSCRIPTION METHODS =====

  private mediaRecorder: MediaRecorder | null = null;
  private recordingChunks: Blob[] = [];
  private transcriptionService: any = null; // Will be initialized based on provider

  /**
   * Start recording session
   */
  async startRecording(
    sessionId: string, 
    quality: RecordingQuality = RecordingQuality.HIGH,
    includeTranscription: boolean = true
  ): Promise<ApiResponse<RecordingState>> {
    try {
      // Get combined audio/video stream
      const stream = await this.getCombinedStream();
      
      if (!stream) {
        throw new Error('No media stream available');
      }

      // Configure recording options based on quality
      const options = this.getRecordingOptions(quality);
      
      this.mediaRecorder = new MediaRecorder(stream, options);
      this.recordingChunks = [];

      // Set up recording event handlers
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordingChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = async () => {
        await this.handleRecordingComplete(sessionId);
      };

      // Start recording
      this.mediaRecorder.start(1000); // Collect data every second

      // Start transcription if enabled
      if (includeTranscription) {
        await this.startTranscription(sessionId);
      }

      // Notify backend
      const response = await apiService.post(`${this.baseUrl}/sessions/${sessionId}/recording/start`, {
        quality,
        includeTranscription,
      });

      return response as any;
    } catch (error) {
      console.error('Error starting recording:', error);
      return {
        success: false,
        message: 'Failed to start recording',
        errors: ['Recording initialization failed'],
      };
    }
  }

  /**
   * Stop recording session
   */
  async stopRecording(sessionId: string): Promise<ApiResponse<{ filePath: string; duration: number }>> {
    try {
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      }

      // Stop transcription
      await this.stopTranscription(sessionId);

      const response = await apiService.post(`${this.baseUrl}/sessions/${sessionId}/recording/stop`);
      return response as any;
    } catch (error) {
      console.error('Error stopping recording:', error);
      return {
        success: false,
        message: 'Failed to stop recording',
        errors: ['Recording stop failed'],
      };
    }
  }

  /**
   * Pause recording
   */
  async pauseRecording(sessionId: string): Promise<ApiResponse<void>> {
    try {
      if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.pause();
      }

      const response = await apiService.post(`${this.baseUrl}/sessions/${sessionId}/recording/pause`);
      return response as any;
    } catch (error) {
      console.error('Error pausing recording:', error);
      return {
        success: false,
        message: 'Failed to pause recording',
        errors: ['Recording pause failed'],
      };
    }
  }

  /**
   * Resume recording
   */
  async resumeRecording(sessionId: string): Promise<ApiResponse<void>> {
    try {
      if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
        this.mediaRecorder.resume();
      }

      const response = await apiService.post(`${this.baseUrl}/sessions/${sessionId}/recording/resume`);
      return response as any;
    } catch (error) {
      console.error('Error resuming recording:', error);
      return {
        success: false,
        message: 'Failed to resume recording',
        errors: ['Recording resume failed'],
      };
    }
  }

  /**
   * Get recording state
   */
  async getRecordingState(sessionId: string): Promise<ApiResponse<RecordingState>> {
    try {
      const response = await apiService.get<RecordingState>(`${this.baseUrl}/sessions/${sessionId}/recording/state`);
      return response;
    } catch (error) {
      console.error('Error fetching recording state:', error);
      return {
        success: false,
        message: 'Failed to get recording state',
        errors: ['Unable to fetch recording information'],
      };
    }
  }

  /**
   * Start real-time transcription
   */
  async startTranscription(sessionId: string, settings?: TranscriptionSettings): Promise<ApiResponse<TranscriptionState>> {
    try {
      // Initialize speech recognition
      if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.transcriptionService = new SpeechRecognition();
        
        this.transcriptionService.continuous = true;
        this.transcriptionService.interimResults = true;
        this.transcriptionService.lang = settings?.language || 'en-US';

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.transcriptionService.onresult = (event: any) => {
          this.handleTranscriptionResult(event, sessionId);
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.transcriptionService.onerror = (event: any) => {
          console.error('Transcription error:', event.error);
        };

        this.transcriptionService.start();
      }

      const response = await apiService.post<TranscriptionState>(`${this.baseUrl}/sessions/${sessionId}/transcription/start`, settings);
      return response;
    } catch (error) {
      console.error('Error starting transcription:', error);
      return {
        success: false,
        message: 'Failed to start transcription',
        errors: ['Transcription service unavailable'],
      };
    }
  }

  /**
   * Stop transcription
   */
  async stopTranscription(sessionId: string): Promise<ApiResponse<SessionTranscript>> {
    try {
      if (this.transcriptionService) {
        this.transcriptionService.stop();
        this.transcriptionService = null;
      }

      const response = await apiService.post<SessionTranscript>(`${this.baseUrl}/sessions/${sessionId}/transcription/stop`);
      return response;
    } catch (error) {
      console.error('Error stopping transcription:', error);
      return {
        success: false,
        message: 'Failed to stop transcription',
        errors: ['Transcription stop failed'],
      };
    }
  }

  /**
   * Get session transcript
   */
  async getSessionTranscript(sessionId: string): Promise<ApiResponse<SessionTranscript>> {
    try {
      const response = await apiService.get<SessionTranscript>(`${this.baseUrl}/sessions/${sessionId}/transcript`);
      return response;
    } catch (error) {
      console.error('Error fetching transcript:', error);
      return {
        success: false,
        message: 'Failed to fetch transcript',
        errors: ['Transcript not available'],
      };
    }
  }

  /**
   * Get real-time transcription entries
   */
  async getTranscriptionEntries(sessionId: string, since?: Date): Promise<ApiResponse<TranscriptEntry[]>> {
    try {
      const url = since 
        ? `${this.baseUrl}/sessions/${sessionId}/transcription/entries?since=${since.toISOString()}`
        : `${this.baseUrl}/sessions/${sessionId}/transcription/entries`;
      const response = await apiService.get<TranscriptEntry[]>(url);
      return response;
    } catch (error) {
      console.error('Error fetching transcription entries:', error);
      return {
        success: false,
        message: 'Failed to fetch transcription entries',
        errors: ['Transcription data unavailable'],
      };
    }
  }

  /**
   * Export session transcript
   */
  async exportTranscript(
    sessionId: string, 
    format: 'pdf' | 'docx' | 'txt' | 'json' = 'pdf'
  ): Promise<ApiResponse<{ downloadUrl: string; fileName: string }>> {
    try {
      const response = await apiService.post<{ downloadUrl: string; fileName: string }>(`${this.baseUrl}/sessions/${sessionId}/transcript/export`, {
        format,
      });
      return response;
    } catch (error) {
      console.error('Error exporting transcript:', error);
      return {
        success: false,
        message: 'Failed to export transcript',
        errors: ['Export operation failed'],
      };
    }
  }

  /**
   * Get recording download URL
   */
  async getRecordingDownloadUrl(sessionId: string): Promise<ApiResponse<{ downloadUrl: string; expiresAt: Date }>> {
    try {
      const response = await apiService.get<{ downloadUrl: string; expiresAt: Date }>(`${this.baseUrl}/sessions/${sessionId}/recording/download`);
      return response;
    } catch (error) {
      console.error('Error getting download URL:', error);
      return {
        success: false,
        message: 'Failed to get download URL',
        errors: ['Download not available'],
      };
    }
  }

  /**
   * Delete session recording
   */
  async deleteRecording(sessionId: string): Promise<ApiResponse<void>> {
    try {
      const response = await apiService.delete<void>(`${this.baseUrl}/sessions/${sessionId}/recording`);
      return response;
    } catch (error) {
      console.error('Error deleting recording:', error);
      return {
        success: false,
        message: 'Failed to delete recording',
        errors: ['Deletion operation failed'],
      };
    }
  }

  /**
   * Get recording controls based on user permissions
   */
  async getRecordingControls(sessionId: string): Promise<ApiResponse<RecordingControls>> {
    try {
      const response = await apiService.get<RecordingControls>(`${this.baseUrl}/sessions/${sessionId}/recording/controls`);
      return response;
    } catch (error) {
      console.error('Error fetching recording controls:', error);
      return {
        success: false,
        message: 'Failed to get recording controls',
        errors: ['Permission check failed'],
      };
    }
  }

  // ===== PRIVATE HELPER METHODS =====

  private async getCombinedStream(): Promise<MediaStream | null> {
    try {
      // Combine local and remote streams if available
      if (this.localStream) {
        return this.localStream;
      }
      return null;
    } catch (error) {
      console.error('Error getting combined stream:', error);
      return null;
    }
  }

  private getRecordingOptions(quality: RecordingQuality): MediaRecorderOptions {
    switch (quality) {
      case RecordingQuality.LOW:
        return {
          mimeType: 'video/webm;codecs=vp8,opus',
          videoBitsPerSecond: 500000,
          audioBitsPerSecond: 32000,
        };
      case RecordingQuality.MEDIUM:
        return {
          mimeType: 'video/webm;codecs=vp9,opus',
          videoBitsPerSecond: 1000000,
          audioBitsPerSecond: 64000,
        };
      case RecordingQuality.HIGH:
        return {
          mimeType: 'video/webm;codecs=vp9,opus',
          videoBitsPerSecond: 2500000,
          audioBitsPerSecond: 128000,
        };
      case RecordingQuality.ULTRA:
        return {
          mimeType: 'video/webm;codecs=vp9,opus',
          videoBitsPerSecond: 5000000,
          audioBitsPerSecond: 256000,
        };
      default:
        return {
          mimeType: 'video/webm;codecs=vp9,opus',
          videoBitsPerSecond: 2500000,
          audioBitsPerSecond: 128000,
        };
    }
  }

  private async handleRecordingComplete(sessionId: string): Promise<void> {
    try {
      if (this.recordingChunks.length > 0) {
        const recordedBlob = new Blob(this.recordingChunks, { type: 'video/webm' });
        
        // Upload recording to server
        const formData = new FormData();
        formData.append('recording', recordedBlob, `session-${sessionId}.webm`);
        
        await apiService.post(`${this.baseUrl}/sessions/${sessionId}/recording/upload`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        this.recordingChunks = [];
      }
    } catch (error) {
      console.error('Error handling recording completion:', error);
    }
  }

  private handleTranscriptionResult(event: SpeechRecognitionEvent, sessionId: string): void {
    try {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        const confidence = result[0].confidence;
        const isFinal = result.isFinal;

        // Send transcription data to backend
        webSocketService.sendMessage({
          type: 'transcription',
          sessionId,
          data: {
            text: transcript,
            confidence,
            isFinal,
          },
          timestamp: new Date(),
        });
      }
    } catch (error) {
      console.error('Error handling transcription result:', error);
    }
  }
}

export const telehealthService = new TelehealthService();