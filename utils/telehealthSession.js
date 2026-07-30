const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

/**
 * Creates a TelehealthSession (+ therapist/patient participants) for a given
 * appointment, inside a transaction. Shared by direct appointment creation
 * and recurring-series generation so both always produce a working session:
 * sessionUrl embeds the session's own id (not a separate roomId — the video
 * page looks sessions up by id), and both sides have a participant row
 * pre-created (otherwise a first-time patient join 403s in joinSession).
 */
async function createTelehealthSessionForAppointment(tx, { appointmentId, patientId, therapistId, patientUserId, durationMinutes }) {
  const sessionId = uuidv4();
  const roomId = crypto.randomBytes(16).toString('hex');
  const sessionToken = crypto.randomBytes(32).toString('hex');
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const sessionUrl = `${baseUrl}/telehealth/session/${sessionId}`;

  return tx.telehealthSession.create({
    data: {
      id: sessionId,
      appointmentId,
      patientId,
      therapistId,
      roomId,
      sessionUrl,
      sessionToken,
      status: 'scheduled',
      scheduledDuration: durationMinutes,
      platform: 'webrtc',
      recordingEnabled: true,
      chatEnabled: true,
      screenShareEnabled: true,
      participants: {
        create: [
          { userId: therapistId, role: 'therapist', status: 'invited' },
          { userId: patientUserId, role: 'patient', status: 'invited' },
        ],
      },
    },
  });
}

async function ensureTelehealthSessionsForAppointments() {
  const appointments = await require('./prisma').appointment.findMany({
    where: { session: null },
    include: { patient: { select: { userId: true } } },
  });

  let created = 0;
  for (const appointment of appointments) {
    const durationMinutes = Math.max(
      1,
      Math.round((appointment.endTime.getTime() - appointment.startTime.getTime()) / 60000)
    );
    // A unique appointmentId prevents duplicate rooms if concurrent startup
    // work reaches the same appointment.
    try {
      // eslint-disable-next-line no-await-in-loop
      await require('./prisma').$transaction((tx) => createTelehealthSessionForAppointment(tx, {
        appointmentId: appointment.id,
        patientId: appointment.patientId,
        therapistId: appointment.therapistId,
        patientUserId: appointment.patient.userId,
        durationMinutes,
      }));
      created += 1;
    } catch (error) {
      if (error?.code !== 'P2002') throw error;
    }
  }
  return created;
}

module.exports = {
  createTelehealthSessionForAppointment,
  ensureTelehealthSessionsForAppointments,
};
