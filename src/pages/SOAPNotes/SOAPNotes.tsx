import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box, Typography, Paper, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, IconButton, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField, Grid,
  Alert, CircularProgress, Tooltip, Snackbar,
  FormControl, InputLabel, Select, MenuItem,
} from '@mui/material';
import {
  Add, Edit, Visibility, Lock, CheckCircle, Cancel,
  AutorenewOutlined, CloudDoneOutlined, ErrorOutline,
} from '@mui/icons-material';
import { apiClient } from '../../services/apiClient';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SOAPNote {
  id: string;
  patientId: string;
  therapistId: string;
  patient: { id: string; user: { id: string; firstName: string; lastName: string } };
  therapist: { id: string; firstName: string; lastName: string };
  appointment?: { id: string; startTime?: string; type?: string } | null;
  date: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  status: 'draft' | 'finalized' | 'amended';
  isLocked: boolean;
  contentHash?: string;
  signature?: string;
  signatureDate?: string;
  createdAt: string;
  updatedAt: string;
  _hasDraft?: boolean;
}

interface Patient { id: string; user: { firstName: string; lastName: string } }

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

// ─── Debounce hook ────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ─── SaveStatusBadge ─────────────────────────────────────────────────────────

const SaveStatusBadge: React.FC<{ status: SaveStatus; savedAt: string | null }> = ({ status, savedAt }) => {
  if (status === 'saving') return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
      <AutorenewOutlined fontSize="small" sx={{ animation: 'spin 1s linear infinite', '@keyframes spin': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } } }} />
      <Typography variant="caption">Saving…</Typography>
    </Box>
  );
  if (status === 'saved') return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'success.main' }}>
      <CloudDoneOutlined fontSize="small" />
      <Typography variant="caption">Saved {savedAt ? format(new Date(savedAt), 'h:mm:ss a') : ''}</Typography>
    </Box>
  );
  if (status === 'error') return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'error.main' }}>
      <ErrorOutline fontSize="small" />
      <Typography variant="caption">Save failed</Typography>
    </Box>
  );
  return null;
};

// ─── Main Component ───────────────────────────────────────────────────────────

const SOAPNotes: React.FC = () => {
  const { state: authState } = useAuth();
  const user = authState.user as unknown as Record<string, string | undefined>;

  // ── Lists ──
  const [notes, setNotes]         = useState<SOAPNote[]>([]);
  const [patients, setPatients]   = useState<Patient[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  // ── Editor state ──
  const [editorOpen, setEditorOpen] = useState(false);
  const [activeNote, setActiveNote] = useState<SOAPNote | null>(null);
  const [fields, setFields]         = useState({ subjective: '', objective: '', assessment: '', plan: '' });
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [savedAt, setSavedAt]       = useState<string | null>(null);
  const [viewOnly, setViewOnly]     = useState(false);

  // ── New note dialog ──
  const [newOpen, setNewOpen]       = useState(false);
  const [newPatientId, setNewPatientId] = useState('');
  const [creating, setCreating]     = useState(false);

  // ── Finalize dialog ──
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [finalizing, setFinalizing]     = useState(false);
  const [signature, setSignature]       = useState('');

  // ── Snackbar ──
  const [snack, setSnack] = useState<{ open: boolean; msg: string; severity: 'success' | 'error' }>({ open: false, msg: '', severity: 'success' });

  // Track last-saved values so we don't re-save unchanged content
  const lastSaved = useRef({ subjective: '', objective: '', assessment: '', plan: '' });

  // ── Load notes + patients ──
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [notesRes, patientsRes] = await Promise.all([
          apiClient.get('/soap-notes/'),
          apiClient.get('/patients/'),
        ]);
        const raw = notesRes.data?.results ?? notesRes.data ?? [];
        setNotes(Array.isArray(raw) ? raw : []);
        const pRaw = patientsRes.data?.results ?? patientsRes.data ?? [];
        setPatients(Array.isArray(pRaw) ? pRaw : []);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to load notes';
        setError(msg);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  // ── Debounced autosave ──
  const debouncedFields = useDebounce(fields, 2000);

  const doAutosave = useCallback(async (noteId: string, f: typeof fields) => {
    const unchanged =
      f.subjective === lastSaved.current.subjective &&
      f.objective  === lastSaved.current.objective  &&
      f.assessment === lastSaved.current.assessment &&
      f.plan       === lastSaved.current.plan;
    if (unchanged) return;
    setSaveStatus('saving');
    try {
      const res = await apiClient.patch(`/soap-notes/${noteId}/autosave`, f);
      setSavedAt(res.data.savedAt ?? new Date().toISOString());
      lastSaved.current = { ...f };
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    }
  }, []);

  useEffect(() => {
    if (!activeNote || activeNote.isLocked || viewOnly) return;
    void doAutosave(activeNote.id, debouncedFields);
  }, [debouncedFields, activeNote, viewOnly, doAutosave]);

  // ── Open editor ──
  const openNote = async (note: SOAPNote, readOnly = false) => {
    try {
      const res = await apiClient.get(`/soap-notes/${note.id}`);
      const full: SOAPNote = res.data;
      setActiveNote(full);
      const f = { subjective: full.subjective, objective: full.objective, assessment: full.assessment, plan: full.plan };
      setFields(f);
      lastSaved.current = { ...f };
      setSaveStatus('idle');
      setSavedAt(null);
      setViewOnly(readOnly || full.isLocked);
      setEditorOpen(true);
    } catch {
      setSnack({ open: true, msg: 'Could not load note', severity: 'error' });
    }
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setActiveNote(null);
    setSaveStatus('idle');
  };

  // ── Create new note ──
  const handleCreate = async () => {
    if (!newPatientId) return;
    setCreating(true);
    try {
      const therapistId = authState.user?.id;
      const res = await apiClient.post('/soap-notes/', {
        patientId: newPatientId,
        therapistId,
        date: new Date().toISOString(),
      });
      const created: SOAPNote = res.data;
      setNotes((prev) => [created, ...prev]);
      setNewOpen(false);
      setNewPatientId('');
      openNote(created);
    } catch {
      setSnack({ open: true, msg: 'Failed to create note', severity: 'error' });
    } finally {
      setCreating(false);
    }
  };

  // ── Finalize ──
  const handleFinalize = async () => {
    if (!activeNote) return;
    setFinalizing(true);
    try {
      const res = await apiClient.post(`/soap-notes/${activeNote.id}/finalize`, { signature });
      const finalized: SOAPNote = res.data;
      setNotes((prev) => prev.map((n) => (n.id === finalized.id ? finalized : n)));
      setActiveNote(finalized);
      setViewOnly(true);
      setFinalizeOpen(false);
      setSnack({ open: true, msg: 'Note finalized and locked ✓', severity: 'success' });
    } catch {
      setSnack({ open: true, msg: 'Finalization failed', severity: 'error' });
    } finally {
      setFinalizing(false);
    }
  };

  // ── Helpers ──
  const patientName = (note: SOAPNote) =>
    `${note.patient?.user?.firstName ?? ''} ${note.patient?.user?.lastName ?? ''}`.trim() || 'Unknown';

  const statusChip = (note: SOAPNote) => {
    if (note.isLocked) return <Chip label="Finalized" color="success" size="small" icon={<Lock />} />;
    if (note.status === 'draft') return <Chip label="Draft" color="warning" size="small" />;
    return <Chip label={note.status} size="small" />;
  };

  // ── Render ──
  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>SOAP Notes</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => setNewOpen(true)}>
          New Note
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Notes table */}
      <Paper variant="outlined">
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: 'grey.50' }}>
                <TableCell><strong>Date</strong></TableCell>
                <TableCell><strong>Patient</strong></TableCell>
                <TableCell><strong>Therapist</strong></TableCell>
                <TableCell><strong>Status</strong></TableCell>
                <TableCell align="right"><strong>Actions</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4 }}><CircularProgress size={28} /></TableCell></TableRow>
              ) : notes.length === 0 ? (
                <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>No SOAP notes yet. Click "New Note" to get started.</TableCell></TableRow>
              ) : notes.map((note) => (
                <TableRow key={note.id} hover>
                  <TableCell>{format(new Date(note.date), 'MMM d, yyyy')}</TableCell>
                  <TableCell>{patientName(note)}</TableCell>
                  <TableCell>{note.therapist ? `${note.therapist.firstName} ${note.therapist.lastName}` : '—'}</TableCell>
                  <TableCell>{statusChip(note)}</TableCell>
                  <TableCell align="right">
                    {note.isLocked ? (
                      <Tooltip title="View (locked)">
                        <IconButton size="small" onClick={() => openNote(note, true)}><Visibility fontSize="small" /></IconButton>
                      </Tooltip>
                    ) : (
                      <Tooltip title="Edit">
                        <IconButton size="small" color="primary" onClick={() => openNote(note)}><Edit fontSize="small" /></IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* ── SOAP Editor Dialog ── */}
      <Dialog open={editorOpen} onClose={closeEditor} maxWidth="md" fullWidth PaperProps={{ sx: { minHeight: '80vh' } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          <Box>
            <Typography variant="h6">
              {viewOnly ? <Lock sx={{ mr: 1, fontSize: 18, verticalAlign: 'middle', color: 'success.main' }} /> : null}
              SOAP Note — {activeNote ? patientName(activeNote) : ''}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {activeNote ? format(new Date(activeNote.date), 'MMMM d, yyyy') : ''}
              {activeNote?.isLocked && ' · Finalized'}
            </Typography>
          </Box>
          <SaveStatusBadge status={saveStatus} savedAt={savedAt} />
        </DialogTitle>

        {activeNote?.isLocked && (
          <Alert severity="success" icon={<CheckCircle />} sx={{ mx: 3, mb: 1 }}>
            This note has been finalized and signed. It is read-only.
            {activeNote.signature && ` Signed by: ${activeNote.signature}`}
          </Alert>
        )}
        {activeNote?._hasDraft && !activeNote.isLocked && (
          <Alert severity="info" sx={{ mx: 3, mb: 1 }}>
            Draft restored from your last session.
          </Alert>
        )}

        <DialogContent dividers sx={{ p: 3 }}>
          <Grid container spacing={2}>
            {(['subjective', 'objective', 'assessment', 'plan'] as const).map((field) => (
              <Grid item xs={12} sm={6} key={field}>
                <TextField
                  label={field.charAt(0).toUpperCase() + field.slice(1)}
                  multiline
                  rows={8}
                  fullWidth
                  disabled={viewOnly}
                  value={fields[field]}
                  onChange={(e) => setFields((prev) => ({ ...prev, [field]: e.target.value }))}
                  placeholder={
                    field === 'subjective' ? "Patient's own words, chief complaint, history…" :
                    field === 'objective'  ? "Measurable observations, vitals, test results…" :
                    field === 'assessment' ? "Clinical diagnosis, clinical impressions…" :
                                            "Treatment plan, goals, next steps…"
                  }
                  InputProps={{ readOnly: viewOnly }}
                  sx={{ '& .MuiInputBase-root': { fontFamily: 'monospace', fontSize: '0.875rem' } }}
                />
              </Grid>
            ))}
          </Grid>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between' }}>
          <Button onClick={closeEditor} startIcon={<Cancel />} color="inherit">Close</Button>
          {!viewOnly && (
            <Button
              variant="contained"
              color="success"
              startIcon={<CheckCircle />}
              onClick={() => {
                setSignature(`${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim());
                setFinalizeOpen(true);
              }}
            >
              Finalize &amp; Sign
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* ── Finalize Confirmation ── */}
      <Dialog open={finalizeOpen} onClose={() => !finalizing && setFinalizeOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Finalize &amp; Sign Note?</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Once finalized this note will be <strong>permanently locked</strong> and cannot be edited. This action cannot be undone.
          </Alert>
          <TextField
            label="Signature (your name)"
            fullWidth
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            size="small"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFinalizeOpen(false)} disabled={finalizing}>Cancel</Button>
          <Button variant="contained" color="success" onClick={handleFinalize} disabled={finalizing || !signature.trim()}>
            {finalizing ? <CircularProgress size={20} /> : 'Confirm & Lock'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── New Note Dialog ── */}
      <Dialog open={newOpen} onClose={() => !creating && setNewOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>New SOAP Note</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <FormControl fullWidth size="small">
            <InputLabel>Select Patient</InputLabel>
            <Select value={newPatientId} label="Select Patient" onChange={(e) => setNewPatientId(e.target.value)}>
              {patients.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {`${p.user?.firstName ?? ''} ${p.user?.lastName ?? ''}`.trim() || p.id}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewOpen(false)} disabled={creating}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={!newPatientId || creating}>
            {creating ? <CircularProgress size={20} /> : 'Create Note'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Snackbar ── */}
      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snack.severity} onClose={() => setSnack((s) => ({ ...s, open: false }))}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default SOAPNotes;

