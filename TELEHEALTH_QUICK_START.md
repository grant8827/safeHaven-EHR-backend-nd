# 🚀 Quick Start: Telehealth Emergency Session

## Quick Reference for Emergency Sessions

### Backend Endpoint
```javascript
POST /api/telehealth/sessions/create_emergency/

// Request
{
  "patient_id": "patient-uuid"
}

// Response
{
  "session": {...},
  "session_url": "https://app.com/telehealth/session/emergency-xxx",
  "room_id": "emergency-xxx",
  "message": "Emergency session created and email sent to patient"
}
```

### Frontend Component Usage

```tsx
import EmergencySessionDialog from '@/components/Telehealth/EmergencySessionDialog';

function MyComponent() {
  const [showDialog, setShowDialog] = useState(false);

  return (
    <>
      <Button onClick={() => setShowDialog(true)}>
        Emergency Session
      </Button>
      
      <EmergencySessionDialog
        open={showDialog}
        onClose={() => setShowDialog(false)}
        onSessionCreated={() => {
          // Refresh session list or navigate
        }}
      />
    </>
  );
}
```

### Complete Video Session Features

#### In VideoSession Component:
- ✅ Camera on/off
- ✅ Microphone mute/unmute
- ✅ Screen sharing
- ✅ Recording
- ✅ Live transcription
- ✅ In-session chat
- ✅ Participant list
- ✅ Session timer
- ✅ Picture-in-picture

### Testing Checklist

#### Backend Tests:
- [ ] Emergency session creation
- [ ] Email sending
- [ ] Patient lookup
- [ ] Room ID generation
- [ ] Participant creation

#### Frontend Tests:
- [ ] Patient selection
- [ ] Emergency dialog flow
- [ ] Session link copy
- [ ] Error handling
- [ ] Loading states

#### Video Session Tests:
- [ ] Camera/mic access
- [ ] Video connection
- [ ] WebSocket signaling
- [ ] Chat messaging
- [ ] Screen sharing
- [ ] Recording toggle
- [ ] Session end

### Environment Setup

#### Required Backend Variables:
```env
EMAIL_HOST=smtp.mailgun.org
EMAIL_PORT=587
EMAIL_HOST_USER=your-user
EMAIL_HOST_PASSWORD=your-password
DEFAULT_FROM_EMAIL=noreply@domain.com
FRONTEND_URL=https://your-frontend.com
```

#### Required Frontend Variables:
```env
VITE_STUN_URLS=stun:stun.l.google.com:19302
VITE_WS_BASE_URL=wss://your-backend.com
VITE_API_BASE_URL=https://your-backend.com
```

### Common Development Commands

```bash
# Backend
cd backend
npm install
npm run dev

# Frontend
cd frontend
npm install
npm run dev

# Test email service
cd backend
node test_email.js
```

### Files Modified/Created

#### Backend:
- ✅ `/backend/controllers/telehealthController.js` - Added `createEmergencySession()`
- ✅ `/backend/routes/telehealth.js` - Added emergency route
- ✅ `/backend/utils/emailService.js` - Added `sendEmergencySessionEmail()`

#### Frontend:
- ✅ `/frontend/src/components/Telehealth/EmergencySessionDialog.tsx` - Complete
- ✅ `/frontend/src/pages/Telehealth/VideoSession.tsx` - Complete
- ✅ `/frontend/src/pages/Telehealth/TelehealthDashboard.tsx` - Existing
- ✅ `/frontend/src/hooks/telehealth/useTelehealthMedia.ts` - Existing
- ✅ `/frontend/src/hooks/telehealth/useWebRTC.ts` - Existing

### Quick Debug Steps

1. **Emergency session not creating**:
   - Check patient_id is valid UUID
   - Verify patient exists in database
   - Check server logs for errors

2. **Email not sending**:
   - Verify EMAIL_* env variables
   - Test email service: `node test_email.js`
   - Check Mailgun dashboard for logs

3. **Video not connecting**:
   - Check browser console for `[VIDEO]` logs
   - Verify WebSocket connection
   - Check STUN/TURN configuration
   - Allow camera/mic permissions

4. **WebSocket failing**:
   - Verify WS_BASE_URL is correct
   - Check backend WebSocket server is running
   - Look for CORS issues

### Key URLs

- Dashboard: `/telehealth/dashboard`
- Join Session: `/telehealth/session/:sessionId`
- Transcripts: `/telehealth/transcripts`

### API Endpoints Quick Reference

```
GET    /api/telehealth/sessions              → List sessions
POST   /api/telehealth/sessions              → Create session
POST   /api/telehealth/sessions/create_emergency → Emergency session
GET    /api/telehealth/sessions/:id          → Get session
POST   /api/telehealth/sessions/:id/start    → Start session
POST   /api/telehealth/sessions/:id/end      → End session
POST   /api/telehealth/sessions/:id/join     → Join session
```

---
**Quick Reference** | Last Updated: 2026-03-03
