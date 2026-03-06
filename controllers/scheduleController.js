const { scheduleHelpers } = require('../utils/redis');
const { asyncHandler } = require('../middleware/errorHandler');
const prisma = require('../utils/prisma');

// All valid time slots: 08:00 – 17:30 in 30-min increments
const SLOT_TIMES = [
  '0800', '0830', '0900', '0930', '1000', '1030', '1100', '1130',
  '1200', '1230', '1300', '1330', '1400', '1430', '1500', '1530',
  '1600', '1630', '1700', '1730',
];

// Human-readable label for a slot string e.g. "0900" -> "9:00 AM"
const slotLabel = (slot) => {
  const h = parseInt(slot.slice(0, 2), 10);
  const m = slot.slice(2, 4);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${displayH}:${m} ${ampm}`;
};

/**
 * GET /schedule/:therapistId?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 * Returns the availability grid for a therapist over a date range.
 * Any authenticated user can call this.
 */
const getAvailability = asyncHandler(async (req, res) => {
  const { therapistId } = req.params;
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'startDate and endDate are required' });
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
  }

  if (end < start) {
    return res.status(400).json({ error: 'endDate must be >= startDate' });
  }

  // Build date array (max 14 days to prevent abuse)
  const dates = [];
  const cur = new Date(start);
  while (cur <= end && dates.length < 14) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }

  // Fetch all dates from Redis in parallel (< 150ms for 7 days)
  const results = await Promise.all(
    dates.map(async (date) => {
      const slots = await scheduleHelpers.getAvailability(therapistId, date);
      return { date, slots };
    })
  );

  // Build grid: { [date]: { [slot]: "0"|"1"|"2" } }
  const grid = {};
  for (const { date, slots } of results) {
    grid[date] = {};
    for (const time of SLOT_TIMES) {
      grid[date][time] = slots[time] || '0';
    }
  }

  return res.json({
    therapist_id: therapistId,
    grid,
    slot_times: SLOT_TIMES,
    slot_labels: Object.fromEntries(SLOT_TIMES.map((s) => [s, slotLabel(s)])),
  });
});

/**
 * POST /schedule/toggle
 * Body: { therapistId, date, slot }
 * Therapist role only. Toggles a slot between 0 (unavailable) and 1 (available).
 * Cannot toggle a slot that is already booked (value "2").
 */
const toggleSlot = asyncHandler(async (req, res) => {
  const { therapistId, date, slot } = req.body;
  const requesterId = req.user.id;
  const requesterRole = req.user.role;

  if (!therapistId || !date || !slot) {
    return res.status(400).json({ error: 'therapistId, date, and slot are required' });
  }

  // Therapists can only toggle their own schedule
  if (requesterRole === 'therapist' && therapistId !== requesterId) {
    return res.status(403).json({ error: 'Therapists can only manage their own availability' });
  }

  if (!SLOT_TIMES.includes(slot)) {
    return res.status(400).json({ error: `Invalid slot. Must be one of: ${SLOT_TIMES.join(', ')}` });
  }

  // No editing past dates
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const slotDate = new Date(date);
  if (slotDate < today) {
    return res.status(400).json({ error: 'Cannot modify availability for past dates' });
  }

  const current = await scheduleHelpers.getSlot(therapistId, date, slot);

  if (current === '2') {
    return res.status(409).json({ error: 'Cannot change a booked slot' });
  }

  const newValue = current === '1' ? '0' : '1';
  await scheduleHelpers.setSlot(therapistId, date, slot, newValue);

  // Broadcast via Socket.io so other open browsers update immediately
  try {
    const io = req.app.get('io');
    if (io) {
      io.emit('slot_update', { therapistId, date, slot, value: newValue });
    }
  } catch (_) {}

  return res.json({ therapist_id: therapistId, date, slot, value: newValue });
});

/**
 * POST /schedule/book
 * Body: { therapistId, date, slot, patientId, type, notes? }
 * Admin / staff only. Atomically books an available slot and creates an Appointment row.
 */
const bookSlot = asyncHandler(async (req, res) => {
  const { therapistId, date, slot, patientId, type, notes } = req.body;
  const requesterId = req.user.id;

  if (!therapistId || !date || !slot || !patientId || !type) {
    return res.status(400).json({
      error: 'therapistId, date, slot, patientId, and type are required',
    });
  }

  if (!SLOT_TIMES.includes(slot)) {
    return res.status(400).json({ error: 'Invalid time slot' });
  }

  // Validate date is not in the past
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const slotDate = new Date(date);
  if (slotDate < today) {
    return res.status(400).json({ error: 'Cannot book appointments in the past' });
  }

  // Build start/end datetime
  const hours = parseInt(slot.slice(0, 2), 10);
  const minutes = parseInt(slot.slice(2, 4), 10);
  const startTime = new Date(date);
  startTime.setHours(hours, minutes, 0, 0);
  const endTime = new Date(startTime);
  endTime.setMinutes(endTime.getMinutes() + 50); // 50-minute sessions

  // Atomic CAS in Redis: slot must be "1" to proceed
  const booked = await scheduleHelpers.atomicBook(therapistId, date, slot);
  if (!booked) {
    return res.status(409).json({
      error: 'Slot already taken. Please refresh and choose another time.',
    });
  }

  // Persist to PostgreSQL
  let appointment;
  try {
    appointment = await prisma.appointment.create({
      data: {
        patientId,
        therapistId,
        createdById: requesterId,
        startTime,
        endTime,
        type,
        status: 'scheduled',
        notes: notes || null,
      },
      include: {
        patient: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
        therapist: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  } catch (dbErr) {
    // DB write failed — roll back the Redis slot to "1"
    await scheduleHelpers.setSlot(therapistId, date, slot, '1');
    throw dbErr;
  }

  // Broadcast to all open browsers
  try {
    const io = req.app.get('io');
    if (io) {
      io.emit('slot_update', {
        therapistId,
        date,
        slot,
        value: '2',
        appointment_id: appointment.id,
      });
    }
  } catch (_) {}

  return res.status(201).json({
    appointment: {
      id: appointment.id,
      therapist_id: appointment.therapistId,
      therapist_name: `${appointment.therapist.firstName} ${appointment.therapist.lastName}`,
      patient_id: appointment.patientId,
      patient_name: appointment.patient?.user
        ? `${appointment.patient.user.firstName} ${appointment.patient.user.lastName}`
        : 'Unknown',
      start_time: appointment.startTime,
      end_time: appointment.endTime,
      type: appointment.type,
      status: appointment.status,
      date,
      slot,
      slot_label: slotLabel(slot),
      notes: appointment.notes,
    },
  });
});

/**
 * GET /schedule/therapists
 * Returns list of active therapists (id + name) for the admin dropdown.
 */
const getTherapists = asyncHandler(async (req, res) => {
  const therapists = await prisma.user.findMany({
    where: {
      role: 'therapist',
      isActive: { not: false },  // includes true AND null
    },
    select: { id: true, firstName: true, lastName: true, email: true },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
  });

  return res.json(
    therapists.map((t) => ({
      id: t.id,
      full_name: `${t.firstName} ${t.lastName}`.trim() || t.email,
      email: t.email,
    }))
  );
});

module.exports = { getAvailability, toggleSlot, bookSlot, getTherapists };
