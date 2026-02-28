# Appointment Setup Guide

## Overview
This system automatically creates appointments by:
1. Finding patients (users with role='client') from the users table
2. Finding therapists (users with role='therapist') from the users table  
3. Creating appointments linking them in the appointments table
4. Automatically creating telehealth sessions when appointment type is 'telehealth'

## Scripts

### `setup_appointments.js`
Creates sample appointments with patients, therapists, and telehealth sessions.

**Usage:**
```bash
node backend/setup_appointments.js
```

**What it does:**
- Finds all client users with patient profiles
- Finds all therapist users
- Creates 6 sample appointments with different types
- For telehealth appointments, automatically creates:
  - TelehealthSession with unique room ID and session URL
  - TelehealthParticipants (therapist as host, patient as participant)

## Database Structure

### Appointments Table
- **patientId** → Links to Patient (from users with role='client')
- **therapistId** → Links to User (therapist role)
- **createdById** → Links to User (admin/staff who created it)
- **type** → Appointment type (initial_consultation, therapy_session, telehealth, etc.)
- **status** → scheduled, confirmed, completed, cancelled, etc.
- **startTime** → Appointment start date/time
- **endTime** → Appointment end date/time

### TelehealthSession Table (created for telehealth appointments)
- **appointmentId** → Links to Appointment
- **patientId** → Links to Patient
- **roomId** → Unique room identifier
- **sessionUrl** → URL to join the session
- **status** → scheduled, active, ended, etc.
- **scheduledDuration** → Expected duration in minutes
- **platform** → webrtc, zoom, teams, etc.

### TelehealthParticipant Table
- **sessionId** → Links to TelehealthSession
- **userId** → Links to User
- **role** → host, participant, observer
- **status** → waiting, connected, disconnected

## Current Data

### Created Appointments
6 appointments have been created:
1. **Initial Consultation** - Feb 28, 2026 @ 9:00 AM (60 min)
2. **Therapy Session** - Mar 2, 2026 @ 2:00 PM (50 min)
3. **Telehealth** - Mar 4, 2026 @ 10:00 AM (45 min) 📹
4. **Follow-up** - Mar 6, 2026 @ 3:00 PM (30 min)
5. **Group Therapy** - Mar 9, 2026 @ 4:00 PM (90 min)
6. **Telehealth** - Mar 11, 2026 @ 11:00 AM (50 min) 📹

### Telehealth Sessions Created
2 telehealth sessions with:
- Unique room IDs
- Session URLs
- Host and participant roles assigned
- WebRTC platform configured

## Key Features

✅ **Auto-populates from Users Table**
- Queries users by role (client, therapist)
- Validates patient profiles exist

✅ **Smart Telehealth Integration**
- Detects when appointment type is 'telehealth'
- Automatically creates corresponding session
- Generates unique room ID and URL
- Sets up participants with roles

✅ **Flexible Configuration**
- Easy to modify appointment types
- Adjustable schedule dates/times
- Configurable duration
- Multiple platform support

## API Endpoints

The backend now has these working endpoints:

- `GET /api/appointments/` - List all appointments
- `GET /api/appointments/:id` - Get single appointment
- `GET /api/appointments/types` - Get appointment types
- `POST /api/appointments/` - Create new appointment
- `PATCH /api/appointments/:id` - Update appointment
- `DELETE /api/appointments/:id` - Delete appointment

## Testing

To verify appointments were created:
```bash
# View all appointments
node -e "const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient(); (async () => { const count = await prisma.appointment.count(); console.log('Total appointments:', count); await prisma.\$disconnect(); })();"

# View telehealth sessions
node -e "const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient(); (async () => { const count = await prisma.telehealthSession.count(); console.log('Telehealth sessions:', count); await prisma.\$disconnect(); })();"
```

## Next Steps

To create more appointments:
1. Run `node backend/setup_appointments.js` again
2. Or use the API endpoints to create appointments programmatically
3. Or create through the frontend UI

The system will automatically:
- Find available patients and therapists
- Rotate through them for appointments
- Create telehealth sessions for telehealth appointments
