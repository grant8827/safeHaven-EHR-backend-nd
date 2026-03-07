import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Snackbar,
  Alert,
} from '@mui/material';
import { CalendarMonth } from '@mui/icons-material';
import { apiClient } from '../../services/apiClient';
import ScheduleGrid, { GridPatient } from '../../components/ScheduleGrid/ScheduleGrid';

const getMondayOf = (d: Date): Date => {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  mon.setHours(0, 0, 0, 0);
  return mon;
};

const AdminSchedulePage: React.FC = () => {
  const [therapistList, setTherapistList] = useState<{ id: string; full_name: string }[]>([]);
  const [selectedTherapistId, setSelectedTherapistId] = useState('');
  const [patients, setPatients] = useState<GridPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekStart] = useState<Date>(() => getMondayOf(new Date()));
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success',
  });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [therapistsRes, patientsRes] = await Promise.all([
          apiClient.get('/schedule/therapists'),
          apiClient.get('/patients/'),
        ]);
        const therapists = therapistsRes.data as { id: string; full_name: string }[];
        setTherapistList(therapists);
        if (therapists.length > 0) setSelectedTherapistId(therapists[0].id);

        const raw = (patientsRes.data?.results ?? patientsRes.data ?? []) as Record<string, unknown>[];
        setPatients(
          raw.map((p) => ({
            id: p.id as string,
            name: [`${p.first_name ?? ''}`, `${p.last_name ?? ''}`].join(' ').trim() || (p.username as string) || 'Unknown',
          }))
        );
      } catch (err) {
        console.error('Failed to load schedule data:', err);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexGrow: 1 }}>
          <CalendarMonth color="primary" sx={{ fontSize: 32 }} />
          <Box>
            <Typography variant="h5" component="h1" fontWeight={700}>
              Schedule Appointment
            </Typography>
            <Typography variant="body2" color="text.secondary">
              View therapist availability and book patient appointments
            </Typography>
          </Box>
        </Box>

        {loading ? (
          <CircularProgress size={24} />
        ) : (
          <FormControl size="small" sx={{ minWidth: 240 }}>
            <InputLabel id="therapist-select-label">Select Therapist</InputLabel>
            <Select
              labelId="therapist-select-label"
              value={selectedTherapistId}
              label="Select Therapist"
              onChange={(e) => setSelectedTherapistId(e.target.value)}
            >
              {therapistList.map((t) => (
                <MenuItem key={t.id} value={t.id}>{t.full_name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </Box>

      {!loading && therapistList.length === 0 && (
        <Typography color="text.secondary">No active therapists found.</Typography>
      )}

      {selectedTherapistId && (
        <ScheduleGrid
          therapistId={selectedTherapistId}
          therapistName={therapistList.find((t) => t.id === selectedTherapistId)?.full_name}
          weekStart={weekStart}
          mode="admin"
          patients={patients}
          onSlotBooked={(appt) =>
            setSnackbar({
              open: true,
              message: `Booked for ${(appt as Record<string, string>).patient_name} at ${new Date((appt as Record<string, string>).start_time).toLocaleString()}`,
              severity: 'success',
            })
          }
        />
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar((p) => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((p) => ({ ...p, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default AdminSchedulePage;
