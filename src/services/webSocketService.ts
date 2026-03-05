// WebSocket types are defined inline to avoid unused imports

export interface WebSocketMessage {
  type: 'ice-candidate' | 'offer' | 'answer' | 'join' | 'leave' | 'chat' | 'recording-start' | 'recording-stop' | 'participant-update' | 'transcription';
  sessionId: string;
  participantId?: string;
  data?: Record<string, unknown>;
  timestamp: Date;
}

type EventCallback = (data: Record<string, unknown>) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private listeners: Map<string, EventCallback[]> = new Map();
  private isConnected = false;
  private sessionId: string | null = null;
  private participantId: string | null = null;

  /**
   * Connect to WebSocket server
   */
  connect(sessionId: string, participantId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.sessionId = sessionId;
        this.participantId = participantId;

        const wsUrl = process.env.NODE_ENV === 'production'
          ? `wss://${window.location.host}/ws/telehealth/${sessionId}/`
          : `ws://localhost:8000/ws/telehealth/${sessionId}/`;

        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          
          // Send join message
          this.sendMessage({
            type: 'join',
            sessionId,
            participantId,
            data: { participantId },
            timestamp: new Date(),
          });

          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data as string) as WebSocketMessage;
            this.handleMessage(message);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        this.ws.onclose = (event) => {
          console.log('WebSocket disconnected:', event.code, event.reason);
          this.isConnected = false;
          
          if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnect();
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        };

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    if (this.ws && this.isConnected) {
      // Send leave message before closing
      if (this.sessionId && this.participantId) {
        this.sendMessage({
          type: 'leave',
          sessionId: this.sessionId,
          participantId: this.participantId,
          timestamp: new Date(),
        });
      }
      
      this.ws.close(1000, 'Client disconnect');
    }
    
    this.isConnected = false;
    this.ws = null;
    this.sessionId = null;
    this.participantId = null;
  }

  /**
   * Send message through WebSocket
   */
  sendMessage(message: WebSocketMessage): void {
    if (this.ws && this.isConnected) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.error('WebSocket not connected');
    }
  }

  /**
   * Add event listener
   */
  on(event: string, callback: EventCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  /**
   * Remove event listener
   */
  off(event: string, callback: EventCallback): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Send WebRTC offer
   */
  sendOffer(offer: RTCSessionDescriptionInit, targetParticipantId: string): void {
    this.sendMessage({
      type: 'offer',
      sessionId: this.sessionId!,
      participantId: this.participantId!,
      data: {
        offer,
        targetParticipantId,
      },
      timestamp: new Date(),
    });
  }

  /**
   * Send WebRTC answer
   */
  sendAnswer(answer: RTCSessionDescriptionInit, targetParticipantId: string): void {
    this.sendMessage({
      type: 'answer',
      sessionId: this.sessionId!,
      participantId: this.participantId!,
      data: {
        answer,
        targetParticipantId,
      },
      timestamp: new Date(),
    });
  }

  /**
   * Send ICE candidate
   */
  sendIceCandidate(candidate: RTCIceCandidateInit, targetParticipantId: string): void {
    this.sendMessage({
      type: 'ice-candidate',
      sessionId: this.sessionId!,
      participantId: this.participantId!,
      data: {
        candidate,
        targetParticipantId,
      },
      timestamp: new Date(),
    });
  }

  /**
   * Send chat message
   */
  sendChatMessage(content: string, isPrivate = false, recipientId?: string): void {
    this.sendMessage({
      type: 'chat',
      sessionId: this.sessionId!,
      participantId: this.participantId!,
      data: {
        content,
        isPrivate,
        recipientId,
      },
      timestamp: new Date(),
    });
  }

  /**
   * Send recording start notification
   */
  sendRecordingStart(): void {
    this.sendMessage({
      type: 'recording-start',
      sessionId: this.sessionId!,
      participantId: this.participantId!,
      timestamp: new Date(),
    });
  }

  /**
   * Send recording stop notification
   */
  sendRecordingStop(): void {
    this.sendMessage({
      type: 'recording-stop',
      sessionId: this.sessionId!,
      participantId: this.participantId!,
      timestamp: new Date(),
    });
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(message: WebSocketMessage): void {
    console.log('Received WebSocket message:', message);

    switch (message.type) {
      case 'offer':
        this.emit('offer', message.data ?? {});
        break;

      case 'answer':
        this.emit('answer', message.data ?? {});
        break;

      case 'ice-candidate':
        this.emit('ice-candidate', message.data ?? {});
        break;

      case 'join':
        this.emit('participant-joined', message.data ?? {});
        break;

      case 'leave':
        this.emit('participant-left', message.data ?? {});
        break;

      case 'chat':
        this.emit('chat-message', message.data ?? {});
        break;

      case 'recording-start':
        this.emit('recording-started', message.data ?? {});
        break;

      case 'recording-stop':
        this.emit('recording-stopped', message.data ?? {});
        break;

      case 'participant-update':
        this.emit('participant-updated', message.data ?? {});
        break;

      case 'transcription':
        this.emit('transcription', message as any); // Pass the whole message
        break;

      default:
        console.warn('Unknown message type:', message.type);
    }
  }

  /**
   * Emit event to listeners
   */
  private emit(event: string, data: Record<string, unknown>): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in event callback:', error);
        }
      });
    }
  }

  /**
   * Reconnect to WebSocket
   */
  private reconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      if (this.sessionId && this.participantId) {
        this.connect(this.sessionId, this.participantId).catch((error) => {
          console.error('Reconnection failed:', error);
        });
      }
    }, delay);
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): 'connected' | 'connecting' | 'disconnected' {
    if (!this.ws) return 'disconnected';
    
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'connecting';
      case WebSocket.OPEN:
        return 'connected';
      default:
        return 'disconnected';
    }
  }

  /**
   * Check if connected
   */
  isWebSocketConnected(): boolean {
    return this.isConnected;
  }
}

export const webSocketService = new WebSocketService();