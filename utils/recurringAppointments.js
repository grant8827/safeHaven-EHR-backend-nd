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

// Creates one materialized Appointment (+ telehealth session, if applicable)
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

  let createdSession = null;
  if (series.type === 'telehealth') {
    createdSession = await createTelehealthSessionForAppointment(tx, {
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
      startTime: { gt: new Date() },
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
  stopSeries,
};
