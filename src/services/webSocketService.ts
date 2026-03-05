import { io, Socket } from 'socket.io-client';

export interface WebSocketMessage {
  type: 'ice-candidate' | 'offer' | 'answer' | 'join' | 'leave' | 'chat' | 'recording-start' | 'recording-stop' | 'participant-update' | 'transcription';
  sessionId: string;
  participantId?: string;
  data?: Record<string, unknown>;
  timestamp: Date;
}

type EventCallback = (data: Record<string, unknown>) => void;

class WebSocketService {
  private socket: Socket | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private listeners: Map<string, EventCallback[]> = new Map();
  private isConnected = false;
  private sessionId: string | null = null;
  private participantId: string | null = null;
  private currentRoomId: string | null = null;

  /**
   * Connect to Socket.io signaling server
   */
  connect(
    sessionId: string,
    participantId: string,
    auth?: { token: string; displayName?: string; role?: string }
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.sessionId = sessionId;
        this.participantId = participantId;

        const apiBase = (import.meta as { env: Record<string, string> }).env.VITE_API_BASE_URL ?? '';
        const backendUrl =
          apiBase
            ? apiBase.replace(/\/api\/?$/, '').replace(/\/$/, '')
            : window.location.hostname === 'localhost'
            ? 'http://localhost:8000'
            : window.location.origin;

        this.socket = io(backendUrl, {
          auth: {
            userId: participantId,
            token: auth?.token ?? '',
            displayName: auth?.displayName ?? 'Participant',
            role: auth?.role ?? 'client',
          },
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
        });

        this.socket.on('connect', () => {
          console.log('[Socket.io] Connected:', this.socket?.id);
          this.isConnected = true;
          this._startHeartbeat();
          resolve();
        });

        this.socket.on('connect_error', (err: Error) => {
          console.error('[Socket.io] Connection error:', err);
          reject(err);
        });

        this.socket.on('disconnect', (reason: string) => {
          console.log('[Socket.io] Disconnected:', reason);
          this.isConnected = false;
          this._stopHeartbeat();
          this._emit('disconnect', { reason });
        });

        // Forward all signaling events to local listeners
        const signalingEvents = [
          'room-joined',
          'participant-joined',
          'participant-left',
          'offer',
          'answer',
          'ice-candidate',
          'buffered-candidates',
        ];
        signalingEvents.forEach((event) => {
          this.socket!.on(event, (data: Record<string, unknown>) => {
            this._emit(event, data);
          });
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Join a signaling room
   */
  joinRoom(roomId: string, sessionId?: string): void {
    this.currentRoomId = roomId;
    if (this.socket && this.isConnected) {
      this.socket.emit('join-room', {
        roomId,
        sessionId: sessionId ?? this.sessionId,
      });
    } else {
      console.warn('[Socket.io] Cannot join room — not connected');
    }
  }

  /**
   * Disconnect from Socket.io
   */
  disconnect(): void {
    this._stopHeartbeat();
    if (this.socket) {
      if (this.sessionId) {
        this.socket.emit('leave-room', { roomId: this.sessionId });
      }
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnected = false;
    this.sessionId = null;
    this.participantId = null;
  }

  /**
   * Route a WebSocketMessage to the appropriate Socket.io emit.
   * Keeps backward-compat with consumers (e.g. useWebRTC hook) that call sendMessage().
   */
  sendMessage(message: WebSocketMessage): void {
    if (!this.socket || !this.isConnected) {
      console.warn('[Socket.io] Not connected, dropping message:', message.type);
      return;
    }
    const msg = message as any;
    const roomId = this.currentRoomId;
    switch (message.type) {
      case 'offer':
        this.socket.emit('offer', { offer: msg.offer, roomId });
        break;
      case 'answer':
        this.socket.emit('answer', { answer: msg.answer, roomId });
        break;
      case 'ice-candidate':
        this.socket.emit('ice-candidate', { candidate: msg.candidate, roomId });
        break;
      case 'join':
        this.joinRoom(message.sessionId);
        break;
      case 'leave':
        this.socket.emit('leave-room', { roomId: message.sessionId });
        break;
      default:
        console.log('[Socket.io] Unhandled message type:', message.type);
    }
  }

  /** Add event listener */
  on(event: string, callback: EventCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  /** Remove event listener */
  off(event: string, callback: EventCallback): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /** Send WebRTC offer via Socket.io */
  sendOffer(offer: RTCSessionDescriptionInit, targetParticipantId: string): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('offer', { offer, to: targetParticipantId, from: this.participantId });
    }
  }

  /** Send WebRTC answer via Socket.io */
  sendAnswer(answer: RTCSessionDescriptionInit, targetParticipantId: string): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('answer', { answer, to: targetParticipantId, from: this.participantId });
    }
  }

  /** Send ICE candidate via Socket.io */
  sendIceCandidate(candidate: RTCIceCandidateInit, targetParticipantId: string): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('ice-candidate', { candidate, to: targetParticipantId, from: this.participantId });
    }
  }

  /** Send chat message */
  sendChatMessage(content: string, isPrivate = false, recipientId?: string): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('chat', { content, isPrivate, recipientId, from: this.participantId });
    }
  }

  sendRecordingStart(): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('recording-start', { sessionId: this.sessionId });
    }
  }

  sendRecordingStop(): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('recording-stop', { sessionId: this.sessionId });
    }
  }

  private _startHeartbeat(): void {
    this._stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.socket && this.isConnected) {
        this.socket.emit('heartbeat', { userId: this.participantId });
      }
    }, 60_000);
  }

  private _stopHeartbeat(): void {
    if (this.heartbeatInterval !== null) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /** Internal: dispatch to local listeners */
  private _emit(event: string, data: Record<string, unknown>): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((cb) => {
        try {
          cb(data);
        } catch (err) {
          console.error('[Socket.io] Error in event callback:', err);
        }
      });
    }
  }

  getConnectionStatus(): 'connected' | 'connecting' | 'disconnected' {
    if (!this.socket) return 'disconnected';
    return this.socket.connected ? 'connected' : 'connecting';
  }

  isWebSocketConnected(): boolean {
    return this.isConnected;
  }
}

export const webSocketService = new WebSocketService();