import React, { useState } from 'react';
import { Box, Typography } from '@mui/material';
import { CalendarMonth } from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import ScheduleGrid from '../../components/ScheduleGrid/ScheduleGrid';

const getMondayOf = (d: Date): Date => {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  mon.setHours(0, 0, 0, 0);
  return mon;
};

const TherapistSchedulePage: React.FC = () => {
  const { state } = useAuth();
  const [weekStart] = useState<Date>(() => getMondayOf(new Date()));

  const user = state.user as unknown as Record<string, string | undefined>;
  const name = [user?.firstName || user?.first_name || '', user?.lastName || user?.last_name || '']
    .join(' ')
    .trim();

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <CalendarMonth color="primary" sx={{ fontSize: 32 }} />
        <Box>
          <Typography variant="h5" component="h1" fontWeight={700}>
            My Availability
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Click white slots to mark yourself <strong>available</strong> (blue). Click blue slots to mark them unavailable.
            Office staff will book patients into your available slots.
          </Typography>
        </Box>
      </Box>

      {state.user?.id ? (
        <ScheduleGrid
          therapistId={state.user.id}
          therapistName={name || undefined}
          weekStart={weekStart}
          mode="therapist"
        />
      ) : (
        <Typography color="text.secondary">Loading…</Typography>
      )}
    </Box>
  );
};

export default TherapistSchedulePage;
