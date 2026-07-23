/**
 * Telehealth Signaling Server
 * Uses Socket.io + Redis Pub/Sub adapter for scalable real-time signaling.
 *
 * Redis data schema:
 *   user:status:{userId}   STRING  – "online" with 300s TTL
 *   session:{roomId}       HASH    – startTime, hostId, guestId, encryptionToken, status
 *   ice:{roomId}:{userId}  LIST    – buffered ICE candidates (10s TTL reconnection window)
 *   signaling:channel      PUB/SUB – distributes signals across cluster nodes (via adapter)
 */

const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const Redis = require('ioredis');
const WebSocket = require('ws');
const { presenceHelpers, telehealthSessionHelpers } = require('./redis');
const prisma = require('./prisma');

/**
 * Attach a Socket.io signaling server to an existing HTTP server.
 * @param {import('http').Server} httpServer
 * @param {string[]} allowedOrigins
 * @returns {import('socket.io').Server}
 */
const createSignalingServer = (httpServer, allowedOrigins = []) => {
  // One accumulated transcript record per active room. Writes are serialized
  // so simultaneous therapist/client final results cannot overwrite each other.
  const transcriptStateByRoom = new Map();

  const persistTranscriptEntry = (roomId, sessionId, entry) => {
    if (!roomId || !sessionId) return Promise.resolve();
    let state = transcriptStateByRoom.get(roomId);
    if (!state) {
      state = { transcriptId: null, entries: [], writeQueue: Promise.resolve() };
      transcriptStateByRoom.set(roomId, state);
    }

    state.entries.push(entry);
    state.writeQueue = state.writeQueue
      .then(async () => {
        const content = JSON.stringify(state.entries);
        if (!state.transcriptId) {
          const transcript = await prisma.transcript.create({
            data: { sessionId, content, isEncrypted: false },
          });
          state.transcriptId = transcript.id;
        } else {
          await prisma.transcript.update({
            where: { id: state.transcriptId },
            data: { content },
          });
        }
      })
      .catch((error) => {
        console.error(`[Deepgram] Failed to save transcript for session ${sessionId}:`, error.message);
      });

    return state.writeQueue;
  };

  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    // Allow both websocket and polling transports
    transports: ['websocket', 'polling'],
    path: '/socket.io',
  });

  // ------------------------------------------------------------------
  // Redis Pub/Sub adapter (enables multi-instance horizontal scaling)
  // ------------------------------------------------------------------
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    try {
      const pubClient = new Redis(redisUrl);
      const subClient = pubClient.duplicate();
      io.adapter(createAdapter(pubClient, subClient));
      console.log('✅ Socket.io Redis adapter attached (Pub/Sub signaling channel ready)');
    } catch (err) {
      console.error('❌ Failed to attach Redis adapter to Socket.io:', err.message);
      console.warn('⚠️  Running Socket.io without Redis adapter (single instance only)');
    }
  } else {
    console.warn('⚠️  REDIS_URL not set – Socket.io running without Redis adapter');
  }

  // ------------------------------------------------------------------
  // Middleware: Authenticate the connecting socket
  // ------------------------------------------------------------------
  io.use((socket, next) => {
    const userId = socket.handshake.auth?.userId;
    const token = socket.handshake.auth?.token;

    if (!userId || !token) {
      return next(new Error('Authentication required'));
    }

    // Attach identity to socket for later use
    socket.userId = userId;
    socket.displayName = socket.handshake.auth?.displayName || 'Participant';
    socket.userRole = socket.handshake.auth?.role || 'client';
    next();
  });

  // ------------------------------------------------------------------
  // Connection handler
  // ------------------------------------------------------------------
  io.on('connection', async (socket) => {
    const { userId, displayName, userRole } = socket;
    let deepgramSocket = null;
    let deepgramKeepAlive = null;
    let deepgramSpeakerRole = userRole === 'client' ? 'patient' : 'therapist';
    console.log(`[Signaling] 🟢 Connected: ${displayName} (${userId})`);

    const closeDeepgram = () => {
      if (deepgramKeepAlive) {
        clearInterval(deepgramKeepAlive);
        deepgramKeepAlive = null;
      }
      if (deepgramSocket) {
        const connection = deepgramSocket;
        deepgramSocket = null;
        if (connection.readyState === WebSocket.OPEN) {
          connection.send(JSON.stringify({ type: 'Finalize' }));
          connection.close(1000, 'Transcription stopped');
        } else if (connection.readyState === WebSocket.CONNECTING) {
          connection.terminate();
        }
      }
    };

    // Join a personal room named after the userId so socket.to(userId) routing works.
    // This is the standard Socket.io pattern for directed 1-to-1 messaging.
    await socket.join(userId);

    // Mark user as online in Redis
    await presenceHelpers.setOnline(userId);

    // ----------------------------------------------------------------
    // join-room  – patient or therapist enters a session room
    // ----------------------------------------------------------------
    socket.on('join-room', async ({ roomId, sessionId }) => {
      if (!roomId) return;

      // Join the Socket.io room
      socket.roomId = roomId;
      socket.sessionId = sessionId;
      await socket.join(roomId);

      console.log(`[Signaling] ${displayName} joined room: ${roomId}`);

      // Read or initialise session metadata in Redis Hash
      let meta = await telehealthSessionHelpers.getSessionMeta(roomId);
      if (!meta) {
        // First participant – create the Hash
        meta = {
          hostId: userId,
          guestId: '',
          startTime: new Date().toISOString(),
          encryptionToken: require('crypto').randomBytes(16).toString('hex'),
          status: 'waiting',
        };
        await telehealthSessionHelpers.setSessionMeta(roomId, meta);
      } else if (!meta.guestId || meta.guestId === '') {
        // Second participant joins
        await telehealthSessionHelpers.updateSessionField(roomId, 'guestId', userId);
        await telehealthSessionHelpers.updateSessionField(roomId, 'status', 'active');
        meta.guestId = userId;
        meta.status = 'active';
      }

      // Tell the joining user who is already in the room
      const roomSockets = await io.in(roomId).fetchSockets();
      const others = roomSockets
        .filter((s) => s.id !== socket.id)
        .map((s) => ({ userId: s.userId, displayName: s.displayName, role: s.userRole }));

      socket.emit('room-joined', {
        roomId,
        sessionId,
        meta,
        participants: others,
        yourUserId: userId,
      });

      // Notify everyone else in the room
      socket.to(roomId).emit('participant-joined', {
        userId,
        displayName,
        role: userRole,
      });

      // Deliver any buffered ICE candidates from before reconnection
      const buffered = await telehealthSessionHelpers.getBufferedIceCandidates(roomId, userId);
      if (buffered.length > 0) {
        console.log(`[Signaling] Delivering ${buffered.length} buffered ICE candidates to ${displayName}`);
        socket.emit('buffered-candidates', { candidates: buffered });
      }
    });

    // ----------------------------------------------------------------
    // offer – WebRTC offer from initiator → sent to peers in room
    // ----------------------------------------------------------------
    socket.on('offer', ({ roomId: room, offer, targetUserId }) => {
      const dest = room || socket.roomId;
      console.log(`[Signaling] offer from ${displayName} in room ${dest}`);
      if (targetUserId) {
        socket.to(targetUserId).emit('offer', { offer, fromUserId: userId, fromDisplayName: displayName });
      } else if (dest) {
        socket.to(dest).emit('offer', { offer, fromUserId: userId, fromDisplayName: displayName });
      }
    });

    // ----------------------------------------------------------------
    // answer – WebRTC answer from responder → back to initiator
    // ----------------------------------------------------------------
    socket.on('answer', ({ roomId: room, answer, targetUserId }) => {
      const dest = room || socket.roomId;
      console.log(`[Signaling] answer from ${displayName} in room ${dest}`);
      if (targetUserId) {
        socket.to(targetUserId).emit('answer', { answer, fromUserId: userId });
      } else if (dest) {
        socket.to(dest).emit('answer', { answer, fromUserId: userId });
      }
    });

    // ----------------------------------------------------------------
    // ice-candidate – trickle ICE forwarding
    // ----------------------------------------------------------------
    socket.on('ice-candidate', async ({ roomId: room, candidate, targetUserId }) => {
      const dest = room || socket.roomId;
      // Buffer in Redis for the 10-second reconnection window
      if (dest && candidate) {
        await telehealthSessionHelpers.bufferIceCandidate(dest, userId, candidate);
      }

      if (targetUserId) {
        socket.to(targetUserId).emit('ice-candidate', { candidate, fromUserId: userId });
      } else if (dest) {
        socket.to(dest).emit('ice-candidate', { candidate, fromUserId: userId });
      }
    });

    // ----------------------------------------------------------------
    // heartbeat – client sends every 60s to refresh presence TTL
    // ----------------------------------------------------------------
    socket.on('heartbeat', async () => {
      await presenceHelpers.refreshPresence(userId);
    });

    // ----------------------------------------------------------------
    // request-transcription / transcription-response – explicit consent
    // handshake before either participant starts speech recognition
    // ----------------------------------------------------------------
    socket.on('request-transcription', ({ roomId: room }) => {
      const dest = room || socket.roomId;
      if (dest && ['admin', 'therapist', 'staff'].includes(userRole)) {
        socket.to(dest).emit('request-transcription', {
          initiatedBy: userId,
          initiatedByName: displayName,
        });
      }
    });

    socket.on('transcription-response', ({ roomId: room, accepted }) => {
      const dest = room || socket.roomId;
      if (dest) {
        socket.to(dest).emit('transcription-response', {
          accepted: accepted === true,
          respondedBy: userId,
          respondedByName: displayName,
        });
      }
    });

    // ----------------------------------------------------------------
    // Deepgram streaming – each participant sends only their own microphone
    // audio. Results are broadcast to the room with an explicit role label.
    // ----------------------------------------------------------------
    socket.on('start-deepgram-transcription', ({ roomId: room, speakerRole }) => {
      const dest = room || socket.roomId;
      const apiKey = process.env.DEEPGRAM_API_KEY;
      if (!dest || !apiKey) {
        socket.emit('deepgram-error', {
          message: apiKey
            ? 'You must join the session before starting transcription.'
            : 'Deepgram is not configured on the server.',
        });
        return;
      }

      closeDeepgram();
      deepgramSpeakerRole = speakerRole === 'patient' ? 'patient' : 'therapist';

      const params = new URLSearchParams({
        model: 'nova-3',
        language: 'en-US',
        smart_format: 'true',
        interim_results: 'true',
        endpointing: '300',
        vad_events: 'true',
      });
      deepgramSocket = new WebSocket(`wss://api.deepgram.com/v1/listen?${params}`, {
        headers: {
          Authorization: `Token ${apiKey}`,
          'Content-Type': 'audio/webm;codecs=opus',
        },
      });

      deepgramSocket.on('open', () => {
        socket.emit('deepgram-ready');
        deepgramKeepAlive = setInterval(() => {
          if (deepgramSocket?.readyState === WebSocket.OPEN) {
            deepgramSocket.send(JSON.stringify({ type: 'KeepAlive' }));
          }
        }, 8000);
      });

      deepgramSocket.on('message', (raw) => {
        try {
          const result = JSON.parse(raw.toString());
          if (result.type !== 'Results') return;
          const text = result.channel?.alternatives?.[0]?.transcript?.trim();
          if (!text) return;
          const payload = {
            entry: {
              speakerName: displayName,
              speakerRole: deepgramSpeakerRole,
              text,
              timestamp: Date.now(),
              isFinal: result.is_final === true,
            },
          };
          if (payload.entry.isFinal) {
            void persistTranscriptEntry(dest, socket.sessionId, {
              speakerName: payload.entry.speakerName,
              speakerRole: payload.entry.speakerRole,
              text: payload.entry.text,
              timestamp: payload.entry.timestamp,
            });
          }
          // Transcript content is visible only to clinical staff. The client
          // contributes consented audio but does not receive transcript text.
          io.in(dest).fetchSockets()
            .then((roomSockets) => {
              roomSockets
                .filter((participant) => ['admin', 'therapist', 'staff'].includes(participant.userRole))
                .forEach((participant) => participant.emit('deepgram-transcript', payload));
            })
            .catch((error) => console.error('[Deepgram] Failed to route transcript:', error.message));
        } catch (error) {
          console.error('[Deepgram] Failed to process result:', error.message);
        }
      });

      deepgramSocket.on('error', (error) => {
        console.error(`[Deepgram] Stream error for ${displayName}:`, error.message);
        socket.emit('deepgram-error', { message: 'The transcription service connection failed.' });
      });

      deepgramSocket.on('close', (code) => {
        if (deepgramKeepAlive) {
          clearInterval(deepgramKeepAlive);
          deepgramKeepAlive = null;
        }
        deepgramSocket = null;
        socket.emit('deepgram-stopped', { code });
      });
    });

    socket.on('deepgram-audio', ({ audio }) => {
      if (!deepgramSocket || deepgramSocket.readyState !== WebSocket.OPEN || !audio) return;
      deepgramSocket.send(Buffer.from(audio));
    });

    socket.on('stop-deepgram-transcription', closeDeepgram);

    // ----------------------------------------------------------------    // start-transcription – therapist signals all participants to start
    // ----------------------------------------------------------------
    socket.on('start-transcription', ({ roomId: room }) => {
      const dest = room || socket.roomId;
      if (dest) {
        socket.to(dest).emit('start-transcription', { initiatedBy: userId });
        console.log(`[Signaling] start-transcription broadcast in room ${dest}`);
      }
    });

    // ----------------------------------------------------------------
    // stop-transcription – therapist signals all participants to stop
    // ----------------------------------------------------------------
    socket.on('stop-transcription', ({ roomId: room }) => {
      const dest = room || socket.roomId;
      if (dest) {
        socket.to(dest).emit('stop-transcription', { initiatedBy: userId });
        console.log(`[Signaling] stop-transcription broadcast in room ${dest}`);
      }
    });

    // ----------------------------------------------------------------
    // transcript-entry – relay a single final speech entry to the other participant(s)
    // ----------------------------------------------------------------
    socket.on('transcript-entry', ({ roomId: room, entry }) => {
      const dest = room || socket.roomId;
      if (dest && entry) {
        socket.to(dest).emit('transcript-entry', { entry });
      }
    });

    // ----------------------------------------------------------------    // leave-room – explicit graceful leave
    // ----------------------------------------------------------------
    socket.on('leave-room', async ({ roomId: room }) => {
      closeDeepgram();
      const dest = room || socket.roomId;
      await handleLeave(socket, io, dest, userId, displayName);
      if (dest) {
        const remaining = await io.in(dest).fetchSockets();
        if (remaining.length === 0) transcriptStateByRoom.delete(dest);
      }
    });

    // ----------------------------------------------------------------
    // disconnect – socket dropped (browser closed / network loss)
    // ----------------------------------------------------------------
    socket.on('disconnect', async () => {
      closeDeepgram();
      console.log(`[Signaling] 🔴 Disconnected: ${displayName} (${userId})`);
      await presenceHelpers.setOffline(userId);

      if (socket.roomId) {
        // Notify peers but don't delete session meta immediately –
        // allow the 10-second ICE reconnection window to be useful.
        socket.to(socket.roomId).emit('participant-left', {
          userId,
          displayName,
        });

        // Clean up session meta if room is now empty
        const roomSockets = await io.in(socket.roomId).fetchSockets();
        if (roomSockets.length === 0) {
          transcriptStateByRoom.delete(socket.roomId);
          await telehealthSessionHelpers.deleteSessionMeta(socket.roomId);
          console.log(`[Signaling] Room ${socket.roomId} is empty – session meta cleaned up`);
        }
      }
    });
  });

  return io;
};

// ------------------------------------------------------------------
// Helper: handle a user leaving a room
// ------------------------------------------------------------------
async function handleLeave(socket, io, roomId, userId, displayName) {
  if (!roomId) return;
  await socket.leave(roomId);
  socket.to(roomId).emit('participant-left', { userId, displayName });

  const roomSockets = await io.in(roomId).fetchSockets();
  if (roomSockets.length === 0) {
    await telehealthSessionHelpers.deleteSessionMeta(roomId);
    console.log(`[Signaling] Room ${roomId} cleaned up after leave`);
  }
}

module.exports = { createSignalingServer };
