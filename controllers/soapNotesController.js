const crypto = require('crypto');
const prisma = require('../utils/prisma');
const { asyncHandler } = require('../middleware/errorHandler');
const { soapDraftHelpers } = require('../utils/redis');

// ─── Helpers ─────────────────────────────────────────────────────────────────

const hashContent = ({ subjective, objective, assessment, plan }) =>
  crypto.createHash('sha256').update(`${subjective}|${objective}|${assessment}|${plan}`).digest('hex');

const assertAccess = async (user, note) => {
  if (user.role === 'admin') return;
  if (note.therapistId === user.id) return;
  const patient = await prisma.patient.findUnique({
    where: { id: note.patientId },
    select: { assignedTherapistId: true },
  });
  if (patient?.assignedTherapistId === user.id) return;
  const err = new Error('You do not have access to this note');
  err.status = 403;
  throw err;
};

const noteInclude = {
  patient: {
    include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
  },
  therapist: { select: { id: true, firstName: true, lastName: true, email: true } },
  appointment: { select: { id: true, startTime: true, endTime: true, type: true } },
};

// ─── LIST ─────────────────────────────────────────────────────────────────────

const getSoapNotes = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, patientId, therapistId, appointmentId, status } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const take = parseInt(limit);

  const where = {};
  if (patientId) where.patientId = patientId;
  if (appointmentId) where.appointmentId = appointmentId;
  if (status) where.status = status;
  // Admins and staff can see all notes (optionally filtered by therapistId query param)
  // Therapists can only see their own notes
  if (req.user.role === 'therapist') {
    where.therapistId = req.user.id;
  } else if (therapistId) {
    // admin or staff passed an explicit filter
    where.therapistId = therapistId;
  }

  const [notes, total] = await Promise.all([
    prisma.sOAPNote.findMany({ where, skip, take, include: noteInclude, orderBy: { createdAt: 'desc' } }),
    prisma.sOAPNote.count({ where }),
  ]);

  return res.json({
    results: notes,
    count: total,
    next: skip + take < total ? parseInt(page) + 1 : null,
    previous: page > 1 ? parseInt(page) - 1 : null,
  });
});

// ─── GET SINGLE ───────────────────────────────────────────────────────────────

const getSoapNote = asyncHandler(async (req, res) => {
  const note = await prisma.sOAPNote.findUnique({ where: { id: req.params.id }, include: noteInclude });
  if (!note) return res.status(404).json({ error: 'SOAP note not found' });
  await assertAccess(req.user, note);

  // Merge Redis draft so the client always gets the freshest unsaved content
  const draft = await soapDraftHelpers.getDraft(note.therapistId, note.patientId, note.id);
  const merged = draft ? { ...note, ...draft, _hasDraft: true } : note;
  return res.json(merged);
});

// ─── CREATE ───────────────────────────────────────────────────────────────────

const createSoapNote = asyncHandler(async (req, res) => {
  const { patientId, therapistId, appointmentId, subjective = '', objective = '', assessment = '', plan = '', date } = req.body;
  if (!patientId || !therapistId) return res.status(400).json({ error: 'patientId and therapistId are required' });

  const note = await prisma.sOAPNote.create({
    data: {
      patientId,
      therapistId,
      appointmentId: appointmentId || null,
      date: date ? new Date(date) : new Date(),
      subjective, objective, assessment, plan,
      status: 'draft',
    },
    include: noteInclude,
  });
  return res.status(201).json(note);
});

// ─── AUTOSAVE (Redis only, low-latency) ───────────────────────────────────────

const autosaveNote = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { subjective, objective, assessment, plan } = req.body;

  const note = await prisma.sOAPNote.findUnique({
    where: { id },
    select: { id: true, patientId: true, therapistId: true, isLocked: true },
  });
  if (!note) return res.status(404).json({ error: 'SOAP note not found' });
  if (note.isLocked) return res.status(409).json({ error: 'Note is finalized and cannot be edited' });
  await assertAccess(req.user, note);

  const fields = {};
  if (subjective !== undefined) fields.subjective = subjective;
  if (objective  !== undefined) fields.objective  = objective;
  if (assessment !== undefined) fields.assessment = assessment;
  if (plan       !== undefined) fields.plan       = plan;
  const savedAt = new Date().toISOString();
  fields._savedAt = savedAt;
  fields._savedBy = req.user.id;

  await soapDraftHelpers.setFields(note.therapistId, note.patientId, note.id, fields);

  // Non-blocking audit log
  prisma.auditLog.create({
    data: {
      userId: req.user.id,
      action: 'SOAP_AUTOSAVE',
      resourceType: 'SOAPNote',
      resourceId: id,
      details: JSON.stringify({ fields: Object.keys(fields), ip: req.ip }),
    },
  }).catch(() => {});

  return res.json({ status: 'saved', savedAt });
});

// ─── FINALIZE (Redis → DB, immutable) ────────────────────────────────────────

const finalizeNote = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { signature } = req.body;

  const note = await prisma.sOAPNote.findUnique({ where: { id }, include: noteInclude });
  if (!note) return res.status(404).json({ error: 'SOAP note not found' });
  if (note.isLocked) return res.status(409).json({ error: 'Note is already finalized' });
  await assertAccess(req.user, note);

  // Merge any unsaved draft into final content
  const draft = await soapDraftHelpers.getDraft(note.therapistId, note.patientId, note.id);
  const subjective = draft?.subjective ?? note.subjective;
  const objective  = draft?.objective  ?? note.objective;
  const assessment = draft?.assessment ?? note.assessment;
  const plan       = draft?.plan       ?? note.plan;
  const contentHash = hashContent({ subjective, objective, assessment, plan });

  const finalized = await prisma.$transaction(async (tx) => {
    const updated = await tx.sOAPNote.update({
      where: { id },
      data: {
        subjective, objective, assessment, plan,
        status: 'finalized',
        isLocked: true,
        contentHash,
        signature: signature || `${req.user.firstName} ${req.user.lastName}`.trim() || req.user.id,
        signatureDate: new Date(),
      },
      include: noteInclude,
    });
    await tx.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'SOAP_FINALIZED',
        resourceType: 'SOAPNote',
        resourceId: id,
        details: JSON.stringify({ contentHash, ip: req.ip }),
      },
    });
    return updated;
  });

  // Remove the Redis draft — note is now permanent
  await soapDraftHelpers.deleteDraft(note.therapistId, note.patientId, note.id);
  return res.json(finalized);
});

// ─── UPDATE ───────────────────────────────────────────────────────────────────

const updateSoapNote = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const existing = await prisma.sOAPNote.findUnique({
    where: { id },
    select: { id: true, patientId: true, therapistId: true, isLocked: true },
  });
  if (!existing) return res.status(404).json({ error: 'SOAP note not found' });
  if (existing.isLocked) return res.status(409).json({ error: 'Note is finalized and cannot be edited' });
  await assertAccess(req.user, existing);

  const { subjective, objective, assessment, plan, date } = req.body;
  const data = {};
  if (subjective !== undefined) data.subjective = subjective;
  if (objective  !== undefined) data.objective  = objective;
  if (assessment !== undefined) data.assessment = assessment;
  if (plan       !== undefined) data.plan       = plan;
  if (date       !== undefined) data.date       = new Date(date);

  const note = await prisma.sOAPNote.update({ where: { id }, data, include: noteInclude });
  return res.json(note);
});

// ─── DELETE ───────────────────────────────────────────────────────────────────

const deleteSoapNote = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Only admins may delete SOAP notes
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only administrators can delete SOAP notes' });
  }

  const note = await prisma.sOAPNote.findUnique({
    where: { id },
    select: { id: true, patientId: true, therapistId: true, isLocked: true },
  });
  if (!note) return res.status(404).json({ error: 'SOAP note not found' });
  if (note.isLocked) return res.status(409).json({ error: 'Finalized notes cannot be deleted' });

  await soapDraftHelpers.deleteDraft(note.therapistId, note.patientId, note.id);
  await prisma.sOAPNote.delete({ where: { id } });
  return res.status(204).send();
});

module.exports = { getSoapNotes, getSoapNote, createSoapNote, autosaveNote, finalizeNote, updateSoapNote, deleteSoapNote };
