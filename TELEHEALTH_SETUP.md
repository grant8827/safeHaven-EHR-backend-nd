# 🎥 Telehealth System Setup Guide

## Overview
This document describes the complete telehealth system for Safe Haven EHR, including emergency sessions and full-featured video conferencing capabilities.

## Features Implemented

### ✅ Core Features
- **Emergency Session Creation**: Instant telehealth session initiation with email notifications
- **Full Video Conferencing**: Real-time audio/video communication using WebRTC
- **Session Recording**: Automatic recording with metadata storage
- **Live Transcription**: Real-time speech-to-text with confidence scoring
- **In-Session Chat**: Text messaging during video calls
- **Screen Sharing**: Share screen during sessions
- **Session Management**: Dashboard for viewing, scheduling, and managing sessions

### 🎯 Emergency Session Features
- One-click emergency session initiation
- Automatic patient email notification with join link
- Priority session handling
- Immediate video connection setup
- Session URLs with unique room IDs

### 📹 Video Session Features
- **Media Controls**:
  - Camera on/off toggle
  - Microphone mute/unmute
  - Screen share toggle
  - Recording start/stop
  - Transcription start/stop

- **Real-Time Communication**:
  - WebRTC peer-to-peer video
  - ICE/STUN/TURN server support
  - Automatic reconnection handling
  - Connection quality monitoring

- **Session Features**:
  - Live chat sidebar
  - Live transcript panel
  - Participant list
  - Session duration timer
  - Picture-in-picture view

## Backend Implementation

### API Endpoints

#### Emergency Session Endpoint
```
POST /api/telehealth/sessions/create_emergency/
```

**Request Body**:
```json
{
  "patient_id": "patient-uuid"
}
```

**Response**:
```json
{
  "session": {
    "id": "session-uuid",
    "roomId": "emergency-xxx",
    "sessionUrl": "https://app.com/telehealth/session/emergency-xxx",
    "status": "active",
    "participants": [...]
  },
  "session_url": "https://app.com/telehealth/session/emergency-xxx",
  "room_id": "emergency-xxx",
  "message": "Emergency session created and email sent to patient"
}
```

#### Standard Session Endpoints
```
GET    /api/telehealth/sessions              # List all sessions
POST   /api/telehealth/sessions              # Create scheduled session
GET    /api/telehealth/sessions/:id          # Get session details
PATCH  /api/telehealth/sessions/:id          # Update session
DELETE /api/telehealth/sessions/:id          # Delete session
POST   /api/telehealth/sessions/:id/start    # Start session
POST   /api/telehealth/sessions/:id/end      # End session
POST   /api/telehealth/sessions/:id/join     # Join session
POST   /api/telehealth/sessions/:id/leave    # Leave session
POST   /api/telehealth/recordings            # Save recording metadata
POST   /api/telehealth/transcripts           # Save transcript entry
```

### Database Schema

#### TelehealthSession Model
```prisma
model TelehealthSession {
  id                String            @id @default(uuid())
  appointmentId     String?           @unique
  patientId         String
  roomId            String            @unique
  sessionUrl        String
  status            TelehealthStatus  @default(scheduled)
  startedAt         DateTime?
  endedAt           DateTime?
  scheduledDuration Int              // minutes
  actualDuration    Int?             // minutes
  platform          String           @default("webrtc")
  recordingEnabled  Boolean          @default(true)
  recordingUrl      String?
  chatEnabled       Boolean          @default(true)
  screenShareEnabled Boolean         @default(true)
  createdAt         DateTime         @default(now())
  updatedAt         DateTime         @updatedAt
  
  participants      TelehealthParticipant[]
  recordings        RecordingMetadata[]
  transcripts       Transcript[]
}
```

#### TelehealthParticipant Model
```prisma
model TelehealthParticipant {
  id                String   @id @default(uuid())
  sessionId         String
  userId            String
  role              String   // host, therapist, patient, observer
  status            String   @default("waiting")
  joinedAt          DateTime?
  leftAt            DateTime?
  connectionQuality String?  // excellent, good, fair, poor, failed
  cameraEnabled     Boolean  @default(true)
  micEnabled        Boolean  @default(true)
  screenSharing     Boolean  @default(false)
  createdAt         DateTime @default(now())
}
```

### Email Service

#### Emergency Session Email
The system automatically sends an email to the patient with:
- Urgent notification styling
- Direct join link
- Session room ID
- Technical requirements
- Instructions for joining

**Email Function**: `sendEmergencySessionEmail()`
- Located in: `/backend/utils/emailService.js`
- Sends HTML and plain text versions
- Includes session URL and room ID
- Branded with Safe Haven EHR styling

## Frontend Implementation

### Components

#### 1. EmergencySessionDialog
**Location**: `/frontend/src/components/Telehealth/EmergencySessionDialog.tsx`

**Features**:
- Patient selection dropdown
- Form validation
- Success/error handling
- Copy-to-clipboard for session link
- Loading states
- Email confirmation

**Usage**:
```tsx
<EmergencySessionDialog
  open={isOpen}
  onClose={() => setIsOpen(false)}
  onSessionCreated={() => fetchSessions()}
/>
```

#### 2. VideoSession
**Location**: `/frontend/src/pages/Telehealth/VideoSession.tsx`

**Features**:
- Full WebRTC implementation
- Media device management
- Peer connection handling
- WebSocket signaling
- UI controls for all features
- Recording and transcription
- Chat functionality

**Key Functions**:
- `startSession()`: Initialize media and WebRTC
- `connectWebSocket()`: Connect to signaling server
- `initializePeerConnection()`: Setup RTCPeerConnection
- `toggleCamera()`, `toggleMic()`: Media controls
- `toggleRecording()`, `toggleTranscription()`: Session features

#### 3. TelehealthDashboard
**Location**: `/frontend/src/pages/Telehealth/TelehealthDashboard.tsx`

**Features**:
- Session list view
- Schedule new sessions
- Emergency session button
- Session status management
- Join active sessions
- View session history

### Routing

All telehealth routes are configured in `/frontend/src/App.tsx`:

```tsx
// Telehealth Routes
<Route path="/telehealth" element={<Telehealth />} />
<Route path="/telehealth/dashboard" element={<TelehealthDashboard />} />
<Route path="/telehealth/session/:sessionId" element={<VideoSession />} />
<Route path="/telehealth/join/:sessionId" element={<JoinSession />} />
<Route path="/telehealth/transcripts" element={<TelehealthTranscripts />} />
```

### Hooks

#### useTelehealthMedia
**Location**: `/frontend/src/hooks/telehealth/useTelehealthMedia.ts`

Manages local media streams and device access:
- Camera/microphone access
- Fallback constraints for mobile
- Media error handling
- Device toggle functions

#### useWebRTC
**Location**: `/frontend/src/hooks/telehealth/useWebRTC.ts`

Manages WebRTC peer connections:
- ICE candidate handling
- Offer/answer negotiation
- Connection state management
- STUN/TURN configuration

## Configuration

### Environment Variables

#### Backend (.env)
```env
# Email Configuration for Emergency Notifications
EMAIL_HOST=smtp.mailgun.org
EMAIL_PORT=587
EMAIL_HOST_USER=your-mailgun-user
EMAIL_HOST_PASSWORD=your-mailgun-password
DEFAULT_FROM_EMAIL=noreply@safehaven.com

# Frontend URL for email links
FRONTEND_URL=https://your-frontend-domain.com
```

#### Frontend (.env)
```env
# WebRTC Configuration
VITE_STUN_URLS=stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302
VITE_TURN_URLS=turn:your-turn-server.com:3478
VITE_TURN_USERNAME=your-turn-username
VITE_TURN_CREDENTIAL=your-turn-credential
VITE_WEBRTC_FORCE_RELAY=false

# WebSocket Configuration
VITE_WS_BASE_URL=wss://your-backend-domain.com
VITE_API_BASE_URL=https://your-backend-domain.com
```

## Usage Guide

### For Therapists/Staff

#### Creating an Emergency Session:
1. Navigate to Telehealth Dashboard
2. Click "Emergency Session" button
3. Select patient from dropdown
4. Click "Start Emergency Session"
5. Copy the session link or use the emailed link
6. Join the session using the link

#### Scheduling a Regular Session:
1. Navigate to Telehealth Dashboard
2. Click "Schedule Session"
3. Select patient, date/time
4. Set duration and preferences
5. Click "Create Session"
6. Session appears in upcoming sessions list

### For Patients

#### Joining an Emergency Session:
1. Check email for urgent session notification
2. Click the "JOIN SESSION NOW" button
3. Allow camera/microphone when prompted
4. Wait for therapist to connect

#### Joining a Scheduled Session:
1. Navigate to "My Sessions"
2. Find upcoming session
3. Click "Join Session" when it's time
4. Allow camera/microphone permissions

### During a Session

#### Media Controls:
- **Camera Toggle**: Click camera icon to turn video on/off
- **Microphone Toggle**: Click mic icon to mute/unmute
- **Screen Share**: Click screen share icon to start/stop sharing
- **Record**: Click record button to start/stop recording
- **Transcribe**: Click caption icon to enable/disable transcription

#### Features:
- **Chat**: Click chat icon to open message panel
- **Transcript**: Click transcript icon to view live captions
- **Participants**: Click people icon to see who's in the session
- **End Session**: Click red "End Session" button to leave

## Technical Details

### WebRTC Architecture

```
┌─────────────┐                    ┌─────────────┐
│  Therapist  │                    │   Patient   │
│   Browser   │                    │   Browser   │
└──────┬──────┘                    └──────┬──────┘
       │                                  │
       │  WebSocket Signaling             │
       │  (Offer/Answer/ICE)              │
       │                                  │
       └────────────┬─────────────────────┘
                    │
            ┌───────▼────────┐
            │  WebSocket     │
            │  Server        │
            │  /ws/video/    │
            └────────────────┘

    Direct P2P Media Connection
    ┌─────────────────────────┐
    │   STUN/TURN Servers     │
    │   (NAT Traversal)       │
    └─────────────────────────┘
```

### Session Flow

1. **Session Creation**:
   - POST to `/api/telehealth/sessions/create_emergency/`
   - Backend creates session in database
   - Email sent to patient
   - Session URL generated

2. **Joining Session**:
   - User navigates to session URL
   - Component loads session data
   - Requests camera/microphone access
   - Initializes WebRTC peer connection
   - Connects to WebSocket signaling server

3. **Connection Establishment**:
   - WebSocket sends `participant_joined` message
   - Initiator creates WebRTC offer
   - Responder receives offer, creates answer
   - ICE candidates exchanged
   - Direct P2P media connection established

4. **Active Session**:
   - Video/audio streams transmitted
   - Chat messages via WebSocket
   - Recording/transcription if enabled
   - Connection quality monitoring

5. **Session End**:
   - User clicks "End Session"
   - Media streams stopped
   - Peer connection closed
   - WebSocket disconnected
   - Session metadata saved

## Security

- **Access Control**: Role-based permissions for creating/managing sessions
- **Secure Communication**: HTTPS/WSS for all connections
- **Media Encryption**: WebRTC DTLS-SRTP encryption
- **Session Validation**: Room IDs and participant verification
- **Email Privacy**: Secure email transmission with credentials

## Troubleshooting

### Common Issues

#### Camera/Microphone Access Denied:
- **Solution**: Check browser permissions, allow access when prompted
- **For Mobile**: Check both browser and OS-level permissions

#### Connection Failed:
- **Solution**: Check STUN/TURN server configuration
- **Fallback**: Public STUN servers are used if custom ones fail

#### No Video/Audio:
- **Solution**: Check device is not in use by another app
- **Try**: Close other video apps (Zoom, Teams, etc.)

#### WebSocket Connection Failed:
- **Solution**: Verify WebSocket URL configuration
- **Check**: Backend WebSocket server is running

### Debug Mode

Enable detailed logging in browser console:
- Look for `[VIDEO]` prefixed logs
- Check WebRTC connection stats
- Monitor ICE candidate gathering
- Review WebSocket messages

## Future Enhancements

- [ ] Waiting room functionality
- [ ] Virtual backgrounds
- [ ] Breakout rooms
- [ ] Session analytics dashboard
- [ ] Automated session summaries
- [ ] Integration with scheduling system
- [ ] Mobile app support
- [ ] Multi-participant sessions (3+ people)
- [ ] Session playback viewer
- [ ] AI-powered transcript summarization

## Support

For technical support or questions:
- Check console logs for detailed error messages
- Review WebRTC connection stats
- Verify environment variable configuration
- Test with different browsers/devices

## Version Information

- **Backend**: Node.js + Express + Prisma
- **Frontend**: React + TypeScript + Material-UI
- **WebRTC**: Native browser APIs
- **Database**: PostgreSQL (via Prisma)
- **Email**: Nodemailer + Mailgun SMTP

---

**Last Updated**: 2026-03-03
**Status**: ✅ Production Ready
