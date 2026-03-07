import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Tooltip,
  Alert,
  Paper,
  IconButton,
  Chip,
} from '@mui/material';
import { ChevronLeft, ChevronRight, Refresh } from '@mui/icons-material';
import { io, Socket } from 'socket.io-client';
import { apiClient } from '../../services/apiClient';
import BookingModal from './BookingModal';

// ─── Types ────────────────────────────────────────────────────────────────────

type SlotValue = '0' | '1' | '2'; // unavailable | available | booked
type Grid = Record<string, Record<string, SlotValue>>; // date -> slot -> value

export interface GridPatient {
  id: string;
  name: string;
}

interface ScheduleGridProps {
  /** The therapist whose calendar is shown */
  therapistId: string;
  therapistName?: string;
  /** Monday of the week to display */
  weekStart: Date;
  /** therapist = can only toggle own slots; admin = can book available slots */
  mode: 'therapist' | 'admin';
  /** Patients list for the admin booking modal */
  patients?: GridPatient[];
  /** Called after a successful booking */
  onSlotBooked?: (appointment: Record<string, unknown>) => void;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const SLOT_TIMES = [
  '0800', '0830', '0900', '0930', '1000', '1030', '1100', '1130',
  '1200', '1230', '1300', '1330', '1400', '1430', '1500', '1530',
  '1600', '1630', '1700', '1730',
];

const SLOT_LABELS: Record<string, string> = {};
SLOT_TIMES.forEach((s) => {
  const h = parseInt(s.slice(0, 2), 10);
  const m = s.slice(2, 4);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const dh = h > 12 ? h - 12 : h === 0 ? 12 : h;
  SLOT_LABELS[s] = `${dh}:${m} ${ampm}`;
});

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ─── Colour helpers ───────────────────────────────────────────────────────────

const slotBg = (value: SlotValue, isClickable: boolean) => {
  if (value === '1') return '#2563EB'; // blue — available
  if (value === '2') return '#059669'; // emerald — booked
  return isClickable ? '#e5e7eb' : '#f3f4f6'; // grey
};

const slotHover = (value: SlotValue) => {
  if (value === '1') return '#1d4ed8';
  if (value === '2') return '#047857';
  return '#d1d5db';
};

const slotText = (value: SlotValue) => {
  if (value === '1') return '#fff';
  if (value === '2') return '#fff';
  return '#9ca3af';
};

const slotHint = (value: SlotValue, mode: 'therapist' | 'admin') => {
  if (value === '2') return 'Booked';
  if (value === '1') return mode === 'therapist' ? 'Click to mark unavailable' : 'Click to book';
  return mode === 'therapist' ? 'Click to mark available' : 'Unavailable';
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Return the 7 ISO date strings starting from the given Monday */
const weekDates = (monday: Date): string[] => {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
};

/** Format YYYY-MM-DD to "Mon 6 Mar" */
const fmtDate = (iso: string) => {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
};

/** True if the ISO date string is in the past */
const isPastDate = (iso: string) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(iso + 'T00:00:00') < today;
};

// ─── Component ───────────────────────────────────────────────────────────────

const ScheduleGrid: React.FC<ScheduleGridProps> = ({
  therapistId,
  therapistName,
  weekStart,
  mode,
  patients = [],
  onSlotBooked,
}) => {
  const [grid, setGrid] = useState<Grid>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(weekStart);
  const [bookingTarget, setBookingTarget] = useState<{ date: string; slot: string } | null>(null);

  const dates = useMemo(() => weekDates(currentWeekStart), [currentWeekStart]);

  // ── Fetch grid from backend ──────────────────────────────────────────────
  const fetchGrid = useCallback(async () => {
    if (!therapistId) return;
    setLoading(true);
    setError(null);
    try {
      const startDate = dates[0];
      const endDate = dates[6];
      const res = await apiClient.get(`/schedule/${therapistId}`, {
        params: { startDate, endDate },
      });
      setGrid((res.data as { grid: Grid }).grid ?? {});
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to load schedule';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [therapistId, dates]);

  useEffect(() => {
    void fetchGrid();
  }, [fetchGrid]);

  // ── Reset week when prop changes ─────────────────────────────────────────
  useEffect(() => {
    setCurrentWeekStart(weekStart);
  }, [weekStart]);

  // ── Socket.io — live slot_update events ──────────────────────────────────
  useEffect(() => {
    if (!therapistId) return;

    const apiBase = (import.meta as { env: Record<string, string> }).env.VITE_API_BASE_URL ?? '';
    const backendUrl = apiBase
      ? apiBase.replace(/\/api\/v1\/?$/, '').replace(/\/api\/?$/, '').replace(/\/$/, '')
      : 'http://localhost:8000';

    const token = localStorage.getItem('access_token');
    const socket: Socket = io(backendUrl, {
      transports: ['websocket', 'polling'],
      auth: token ? { token } : {},
      reconnectionAttempts: 3,
    });

    socket.on('slot_update', (data: { therapistId: string; date: string; slot: string; value: string }) => {
      if (data.therapistId !== therapistId) return;
      setGrid((prev) => ({
        ...prev,
        [data.date]: {
          ...(prev[data.date] ?? {}),
          [data.slot]: data.value as SlotValue,
        },
      }));
    });

    return () => {
      socket.disconnect();
    };
  }, [therapistId]);

  // ── Slot click handlers ───────────────────────────────────────────────────
  const handleSlotClick = useCallback(
    async (date: string, slot: string, currentValue: SlotValue) => {
      if (isPastDate(date)) return;

      if (mode === 'therapist') {
        // Can only toggle own availability (0↔1). Cannot touch booked slots.
        if (currentValue === '2') return;

        // Optimistic update
        const newValue: SlotValue = currentValue === '1' ? '0' : '1';
        setGrid((prev) => ({
          ...prev,
          [date]: { ...(prev[date] ?? {}), [slot]: newValue },
        }));

        try {
          await apiClient.post('/schedule/toggle', { therapistId, date, slot });
        } catch (err: unknown) {
          // Roll back on failure
          setGrid((prev) => ({
            ...prev,
            [date]: { ...(prev[date] ?? {}), [slot]: currentValue },
          }));
          const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to update slot';
          setError(msg);
        }
      } else {
        // Admin mode: can only book available (blue) slots
        if (currentValue !== '1') return;
        setBookingTarget({ date, slot });
      }
    },
    [mode, therapistId]
  );

  const handleBooked = useCallback(
    (appointment: Record<string, unknown>) => {
      const date = appointment.date as string;
      const slot = appointment.slot as string;
      setGrid((prev) => ({
        ...prev,
        [date]: { ...(prev[date] ?? {}), [slot]: '2' },
      }));
      setBookingTarget(null);
      if (onSlotBooked) onSlotBooked(appointment);
    },
    [onSlotBooked]
  );

  // ── Week navigation ───────────────────────────────────────────────────────
  const prevWeek = () => {
    setCurrentWeekStart((d) => {
      const n = new Date(d);
      n.setDate(n.getDate() - 7);
      return n;
    });
  };

  const nextWeek = () => {
    setCurrentWeekStart((d) => {
      const n = new Date(d);
      n.setDate(n.getDate() + 7);
      return n;
    });
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const COL_W = 110; // px per day column
  const ROW_H = 36;  // px per slot row
  const LABEL_W = 80; // px for time label column

  return (
    <Box>
      {/* ── Legend + navigation ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
        <IconButton size="small" onClick={prevWeek} aria-label="Previous week">
          <ChevronLeft />
        </IconButton>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, minWidth: 180, textAlign: 'center' }}>
          {fmtDate(dates[0])} – {fmtDate(dates[6])}
        </Typography>
        <IconButton size="small" onClick={nextWeek} aria-label="Next week">
          <ChevronRight />
        </IconButton>

        <IconButton size="small" onClick={() => void fetchGrid()} disabled={loading} aria-label="Refresh">
          <Refresh fontSize="small" />
        </IconButton>

        {loading && <CircularProgress size={16} sx={{ ml: 1 }} />}

        <Box sx={{ ml: 'auto', display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip size="small" label="Unavailable" sx={{ bgcolor: '#f3f4f6', color: '#9ca3af', fontSize: 11 }} />
          <Chip size="small" label="Available" sx={{ bgcolor: '#2563EB', color: '#fff', fontSize: 11 }} />
          <Chip size="small" label="Booked" sx={{ bgcolor: '#059669', color: '#fff', fontSize: 11 }} />
        </Box>
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 1 }}>
          {error}
        </Alert>
      )}

      {/* ── Grid ── */}
      <Paper
        variant="outlined"
        sx={{ overflowX: 'auto', borderRadius: 2 }}
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: `${LABEL_W}px repeat(7, minmax(${COL_W}px, 1fr))`,
            minWidth: LABEL_W + COL_W * 7,
          }}
        >
          {/* Header row */}
          <Box
            sx={{
              position: 'sticky',
              left: 0,
              zIndex: 2,
              bgcolor: 'background.paper',
              borderBottom: '2px solid',
              borderRight: '1px solid',
              borderColor: 'divider',
              p: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography variant="caption" color="text.secondary">Time</Typography>
          </Box>

          {dates.map((date, i) => {
            const past = isPastDate(date);
            return (
              <Box
                key={date}
                sx={{
                  borderBottom: '2px solid',
                  borderLeft: i > 0 ? '1px solid' : 'none',
                  borderColor: 'divider',
                  p: 1,
                  textAlign: 'center',
                  bgcolor: past ? '#fafafa' : 'background.paper',
                }}
              >
                <Typography variant="caption" fontWeight={600} color={past ? 'text.disabled' : 'text.primary'}>
                  {DAY_NAMES[i]}
                </Typography>
                <br />
                <Typography variant="caption" color="text.secondary" fontSize={10}>
                  {fmtDate(date).replace(/^\w+ /, '')}
                </Typography>
              </Box>
            );
          })}

          {/* Slot rows */}
          {SLOT_TIMES.map((slot) => (
            <React.Fragment key={slot}>
              {/* Time label (sticky left) */}
              <Box
                sx={{
                  position: 'sticky',
                  left: 0,
                  zIndex: 1,
                  bgcolor: 'background.paper',
                  borderTop: '1px solid',
                  borderRight: '1px solid',
                  borderColor: 'divider',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: ROW_H,
                  px: 0.5,
                }}
              >
                <Typography variant="caption" color="text.secondary" fontSize={10} noWrap>
                  {SLOT_LABELS[slot]}
                </Typography>
              </Box>

              {/* Day cells */}
              {dates.map((date, colIdx) => {
                const value: SlotValue = (grid[date]?.[slot] ?? '0') as SlotValue;
                const past = isPastDate(date);
                const isClickable =
                  !past &&
                  (mode === 'therapist' ? value !== '2' : value === '1');

                return (
                  <Tooltip
                    key={date}
                    title={past ? 'Past date' : slotHint(value, mode)}
                    placement="top"
                    arrow
                  >
                    <Box
                      role={isClickable ? 'button' : undefined}
                      tabIndex={isClickable ? 0 : undefined}
                      onClick={() => { if (isClickable) void handleSlotClick(date, slot, value); }}
                      onKeyDown={(e) => {
                        if (isClickable && (e.key === 'Enter' || e.key === ' ')) void handleSlotClick(date, slot, value);
                      }}
                      sx={{
                        height: ROW_H,
                        borderTop: '1px solid',
                        borderLeft: colIdx > 0 ? '1px solid' : 'none',
                        borderColor: 'divider',
                        bgcolor: past ? '#fafafa' : slotBg(value, isClickable),
                        color: slotText(value),
                        cursor: isClickable ? 'pointer' : 'default',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'background-color 0.15s ease',
                        '&:hover': isClickable
                          ? { bgcolor: slotHover(value), filter: 'brightness(1.08)' }
                          : {},
                        '&:focus-visible': {
                          outline: '2px solid',
                          outlineColor: 'primary.main',
                          outlineOffset: -2,
                        },
                      }}
                    >
                      {value === '2' && (
                        <Typography variant="caption" fontSize={9} sx={{ color: '#fff', fontWeight: 600, opacity: 0.9 }}>
                          ✓
                        </Typography>
                      )}
                      {value === '1' && mode === 'admin' && (
                        <Typography variant="caption" fontSize={9} sx={{ color: '#fff', opacity: 0.85 }}>
                          Book
                        </Typography>
                      )}
                    </Box>
                  </Tooltip>
                );
              })}
            </React.Fragment>
          ))}
        </Box>
      </Paper>

      {/* ── Booking modal (admin only) ── */}
      {mode === 'admin' && bookingTarget && (
        <BookingModal
          open={Boolean(bookingTarget)}
          therapistId={therapistId}
          therapistName={therapistName}
          date={bookingTarget.date}
          slot={bookingTarget.slot}
          slotLabel={SLOT_LABELS[bookingTarget.slot] ?? bookingTarget.slot}
          patients={patients}
          onClose={() => setBookingTarget(null)}
          onBooked={handleBooked}
        />
      )}
    </Box>
  );
};

export default ScheduleGrid;
