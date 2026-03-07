import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Box,
  Chip,
  Alert,
  Autocomplete,
  CircularProgress,
  Divider,
} from '@mui/material';
import { Event, Person, MedicalServices } from '@mui/icons-material';
import { apiClient } from '../../services/apiClient';
import { GridPatient } from './ScheduleGrid';

// ─── Types ────────────────────────────────────────────────────────────────────

const APPOINTMENT_TYPES = [
  { value: 'initial_consultation', label: 'Initial Consultation' },
  { value: 'therapy_session', label: 'Therapy Session' },
  { value: 'follow_up', label: 'Follow-Up' },
  { value: 'group_therapy', label: 'Group Therapy' },
  { value: 'telehealth', label: 'Telehealth' },
  { value: 'assessment', label: 'Assessment' },
];

interface BookingModalProps {
  open: boolean;
  therapistId: string;
  therapistName?: string;
  date: string;
  slot: string;
  slotLabel: string;
  patients: GridPatient[];
  onClose: () => void;
  onBooked: (appointment: Record<string, unknown>) => void;
}

/** Format YYYY-MM-DD as "Wednesday, March 6 2026" */
const fmtLongDate = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

// ─── Component ───────────────────────────────────────────────────────────────

const BookingModal: React.FC<BookingModalProps> = ({
  open,
  therapistId,
  therapistName,
  date,
  slot,
  slotLabel,
  patients,
  onClose,
  onBooked,
}) => {
  const [selectedPatient, setSelectedPatient] = useState<GridPatient | null>(null);
  const [appointmentType, setAppointmentType] = useState('therapy_session');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setSelectedPatient(null);
    setAppointmentType('therapy_session');
    setNotes('');
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!selectedPatient) {
      setError('Please select a patient');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await apiClient.post('/schedule/book', {
        therapistId,
        date,
        slot,
        patientId: selectedPatient.id,
        type: appointmentType,
        notes: notes.trim() || undefined,
      });

      reset();
      onBooked(res.data.appointment as Record<string, unknown>);
    } catch (err: unknown) {
      const errData = (err as { response?: { data?: { error?: string } } })?.response?.data;
      setError(errData?.error ?? 'Failed to book appointment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Box display="flex" alignItems="center" gap={1}>
          <Event color="primary" />
          <Typography variant="h6" component="span">
            Book Appointment
          </Typography>
        </Box>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ pt: 2 }}>
        {/* Slot summary */}
        <Box
          sx={{
            bgcolor: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: 1.5,
            p: 1.5,
            mb: 2.5,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1,
            alignItems: 'center',
          }}
        >
          <Chip
            icon={<Event fontSize="small" />}
            label={fmtLongDate(date)}
            size="small"
            variant="outlined"
            color="primary"
          />
          <Chip
            label={slotLabel}
            size="small"
            color="primary"
            sx={{ fontWeight: 600 }}
          />
          {therapistName && (
            <Chip
              icon={<Person fontSize="small" />}
              label={therapistName}
              size="small"
              variant="outlined"
            />
          )}
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Patient selector */}
        <Autocomplete
          options={patients}
          getOptionLabel={(p) => p.name}
          value={selectedPatient}
          onChange={(_, v) => setSelectedPatient(v)}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Patient"
              required
              placeholder="Search patient by name…"
              InputProps={{
                ...params.InputProps,
                startAdornment: (
                  <>
                    <Person color="action" fontSize="small" sx={{ mr: 0.5 }} />
                    {params.InputProps.startAdornment}
                  </>
                ),
              }}
            />
          )}
          sx={{ mb: 2 }}
          noOptionsText="No patients found"
        />

        {/* Appointment type */}
        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel id="appt-type-label">Appointment Type</InputLabel>
          <Select
            labelId="appt-type-label"
            value={appointmentType}
            label="Appointment Type"
            onChange={(e) => setAppointmentType(e.target.value)}
            startAdornment={<MedicalServices color="action" fontSize="small" sx={{ mr: 1, ml: 0.5 }} />}
          >
            {APPOINTMENT_TYPES.map((t) => (
              <MenuItem key={t.value} value={t.value}>
                {t.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Notes */}
        <TextField
          fullWidth
          label="Notes (optional)"
          multiline
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add any relevant notes or instructions…"
          inputProps={{ maxLength: 500 }}
          helperText={`${notes.length}/500`}
        />
      </DialogContent>

      <Divider />

      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button onClick={handleClose} disabled={submitting} color="inherit">
          Cancel
        </Button>
        <Button
          onClick={() => void handleSubmit()}
          variant="contained"
          disabled={submitting || !selectedPatient}
          startIcon={submitting ? <CircularProgress size={16} /> : <Event />}
          sx={{ bgcolor: '#2563EB', '&:hover': { bgcolor: '#1d4ed8' }, minWidth: 150 }}
        >
          {submitting ? 'Booking…' : 'Confirm Booking'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BookingModal;
