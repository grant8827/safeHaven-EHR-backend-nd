const prisma = require('./prisma');
const { createTelehealthSessionForAppointment } = require('./telehealthSession');
const { redisClient } = require('./redis');

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Returns a Date at the given wall-clock hour/minute, on the next occurrence
// of `dayOfWeek` (0=Sun..6=Sat) at or after `fromDate`.
function nextOccurrenceOnOrAfter(fromDate, dayOfWeek, hour, minute) {
  const d = new Date(fromDate);
  d.setHours(hour, minute, 0, 0);
  if (d < fromDate) {
    d.setDate(d.getDate() + 1);
  }
  const diff = (dayOfWeek - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  return d;
}

// Creates one materialized Appointment and its telehealth session.
// for a series at a given start time. Mirrors the single-appointment path in
// appointmentsController.createAppointment so recurring occurrences behave
// exactly like any other appointment.
async function createOneOccurrence(tx, series, occurrenceStart) {
  const occurrenceEnd = new Date(occurrenceStart.getTime() + series.durationMinutes * 60000);

  const appointment = await tx.appointment.create({
    data: {
      patientId: series.patientId,
      therapistId: series.therapistId,
      createdById: series.createdById,
      startTime: occurrenceStart,
      endTime: occurrenceEnd,
      type: series.type,
      status: 'scheduled',
      notes: series.notes,
      location: series.location,
      seriesId: series.id,
    },
    include: {
      patient: { include: { user: { select: { id: true } } } },
    },
  });

  const createdSession = await createTelehealthSessionForAppointment(tx, {
    appointmentId: appointment.id,
    patientId: series.patientId,
    therapistId: series.therapistId,
    patientUserId: appointment.patient.user.id,
    durationMinutes: series.durationMinutes,
  });

  if (redisClient) {
    await redisClient.set(
      `telehealth:appt:${appointment.id}`,
      createdSession.id,
      'EX',
      series.durationMinutes * 60
    ).catch((err) => console.error('[Redis] Failed to cache session:', err));
  }

  return appointment;
}

/**
 * Creates a new AppointmentSeries starting from an already-chosen first
 * occurrence, and generates just that one occurrence. Only one upcoming
 * occurrence ever exists for a series at a time — see topUpSeries, which
 * generates the next one once this one has passed (or been cancelled).
 */
async function createSeriesAndGenerateAppointments({
  patientId,
  therapistId,
  createdById,
  firstOccurrenceStart,
  durationMinutes,
  type,
  notes,
  location,
}) {
  const series = await prisma.appointmentSeries.create({
    data: {
      patientId,
      therapistId,
      createdById,
      dayOfWeek: firstOccurrenceStart.getDay(),
      startHour: firstOccurrenceStart.getHours(),
      startMinute: firstOccurrenceStart.getMinutes(),
      durationMinutes,
      type,
      notes,
      location,
    },
  });

  const appointment = await prisma.$transaction((tx) => createOneOccurrence(tx, series, firstOccurrenceStart));

  return { series, appointments: [appointment] };
}

// Ensures an active series has exactly one upcoming occurrence (scheduled,
// not yet passed). Call periodically (see index.js): once the current
// occurrence's start time passes, or it's cancelled, this generates the
// next one — computed fresh from "now", not from the old one's date — to
// replace it.
async function topUpSeries(series) {
  const hasUpcoming = await prisma.appointment.findFirst({
    where: {
      seriesId: series.id,
      status: 'scheduled',
    },
  });
  if (hasUpcoming) return [];

  const nextStart = nextOccurrenceOnOrAfter(new Date(), series.dayOfWeek, series.startHour, series.startMinute);
  const appointment = await prisma.$transaction((tx) => createOneOccurrence(tx, series, nextStart));
  return [appointment];
}

async function topUpAllActiveSeries() {
  const activeSeries = await prisma.appointmentSeries.findMany({ where: { isActive: true } });
  let totalCreated = 0;
  for (const series of activeSeries) {
    // eslint-disable-next-line no-await-in-loop
    const created = await topUpSeries(series);
    totalCreated += created.length;
  }
  if (totalCreated > 0) {
    console.log(`[RecurringAppointments] Topped up ${totalCreated} occurrence(s) across ${activeSeries.length} active series`);
  }
  return totalCreated;
}

// Keep the current occurrence visible for three hours after its scheduled
// start. Once that grace period expires, reuse the appointment/session rows
// for the next weekly occurrence.
async function rollForwardExpiredRecurringAppointments() {
  const now = new Date();
  const cutoff = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const expired = await prisma.appointment.findMany({
    where: {
      OR: [{ isRecurring: true }, { seriesId: { not: null } }],
      status: { notIn: ['cancelled', 'completed'] },
      startTime: { lte: cutoff },
    },
    include: { session: true, series: true },
  });

  let rolled = 0;
  for (const appointment of expired) {
    const intervalDays = Math.max(1, appointment.recurrenceIntervalWeeks || 1) * 7;
    const nextStart = new Date(appointment.startTime);
    do {
      nextStart.setDate(nextStart.getDate() + intervalDays);
    } while (nextStart <= now);

    const recurrenceEnd = appointment.recurrenceEndDate;
    const seriesActive = !appointment.series || appointment.series.isActive !== false;
    if (!seriesActive || (recurrenceEnd && nextStart > recurrenceEnd)) {
      // eslint-disable-next-line no-await-in-loop
      await prisma.appointment.update({ where: { id: appointment.id }, data: { status: 'completed' } });
      continue;
    }

    const durationMs = appointment.endTime.getTime() - appointment.startTime.getTime();
    // eslint-disable-next-line no-await-in-loop
    await prisma.$transaction(async (tx) => {
      await tx.appointment.update({
        where: { id: appointment.id },
        data: {
          startTime: nextStart,
          endTime: new Date(nextStart.getTime() + durationMs),
          status: 'scheduled',
          isRecurring: true,
        },
      });
      if (appointment.session) {
        await tx.telehealthSession.update({
          where: { id: appointment.session.id },
          data: { status: 'scheduled', startedAt: null, endedAt: null, actualDuration: null },
        });
        await tx.telehealthParticipant.updateMany({
          where: { sessionId: appointment.session.id },
          data: { status: 'invited', joinedAt: null, leftAt: null },
        });
      }
    });
    rolled += 1;
  }
  return rolled;
}

/**
 * Stops a series: marks it inactive (top-up no longer extends it) and
 * cancels any not-yet-occurred generated appointments. Past/in-progress
 * appointments are left as-is.
 */
async function stopSeries(seriesId) {
  const series = await prisma.appointmentSeries.update({
    where: { id: seriesId },
    data: { isActive: false },
  });

  const { count } = await prisma.appointment.updateMany({
    where: {
      seriesId,
      status: 'scheduled',
      startTime: { gt: new Date() },
    },
    data: { status: 'cancelled' },
  });

  return { series, cancelledCount: count };
}

module.exports = {
  createSeriesAndGenerateAppointments,
  topUpAllActiveSeries,
  rollForwardExpiredRecurringAppointments,
  stopSeries,
};
