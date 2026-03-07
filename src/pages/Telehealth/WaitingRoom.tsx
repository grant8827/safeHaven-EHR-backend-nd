/**
 * WaitingRoom – pre-session lobby
 *
 * Checks whether the other participant (therapist/patient) is currently
 * online via the Redis-backed presence API before entering the video session.
 * Polls every 10 seconds and shows a live indicator.
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  CircularProgress,
  Chip,
  Avatar,
  Divider,
  Alert,
  LinearProgress,
} from '@mui/material';
import {
  VideoCall,
  FiberManualRecord,
  Schedule,
  Person,
  ArrowBack,
  Refresh,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { apiClient } from '../../services/apiClient';
import { UserRole } from '../../types';
import { format, parseISO } from 'date-fns';

interface SessionInfo {
  id: string;
  room_id: string;
  title?: string;
  scheduled_at?: string;
  status: string;
  patient_details?: { id: string; name: string };
  therapist_details?: { id: string; name: string };
}

const POLL_INTERVAL_MS = 10_000;

const WaitingRoom: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { state } = useAuth();
  const { showError } = useNotification();
  const user = state.user;

  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [providerOnline, setProviderOnline] = useState<boolean | null>(null);
  const [selfOnline, setSelfOnline] = useState<boolean | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [waitSeconds, setWaitSeconds] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load session ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!sessionId) return;
    const load = async () => {
      try {
        const res = await apiClient.get(`/telehealth/sessions/${sessionId}/`);
        setSession(res.data as SessionInfo);
      } catch (err) {
        console.error('[WaitingRoom] Failed to load session:', err);
        showError('Could not load session info.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [sessionId, showError]);

  // ── Presence polling ────────────────────────────────────────────────────────

  const checkPresence = useCallback(async () => {
    if (!session || !user) return;

    // Determine which userId to check (the OTHER participant)
    const isTherapist = user.role === UserRole.THERAPIST || user.role === UserRole.ADMIN || user.role === UserRole.STAFF;
    const otherUserId = isTherapist
      ? session.patient_details?.id
      : session.therapist_details?.id;

    try {
      // Check self
      const selfRes = await apiClient.get(`/telehealth/presence/${user.id}`);
      setSelfOnline((selfRes.data as { online: boolean }).online);

      // Check other participant
      if (otherUserId) {
        const otherRes = await apiClient.get(`/telehealth/presence/${otherUserId}`);
        setProviderOnline((otherRes.data as { online: boolean }).online);
      } else {
        setProviderOnline(false);
      }

      setLastChecked(new Date());
    } catch (err) {
      console.error('[WaitingRoom] Presence check failed:', err);
    }
  }, [session, user]);

  useEffect(() => {
    if (!session) return;

    // Immediate first check
    void checkPresence();

    // Poll every 10 s
    pollRef.current = setInterval(() => { void checkPresence(); }, POLL_INTERVAL_MS);

    // Wait-time counter
    timerRef.current = setInterval(() => {
      setWaitSeconds((s) => s + 1);
    }, 1000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [session, checkPresence]);

  const [autoJoinCountdown, setAutoJoinCountdown] = useState<number | null>(null);
  const autoJoinRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Auto-navigate when other participant comes online ────────────────────────
  useEffect(() => {
    if (providerOnline === true && session?.room_id) {
      // Start 3-second countdown then auto-join
      setAutoJoinCountdown(3);
      autoJoinRef.current = setInterval(() => {
        setAutoJoinCountdown((c) => {
          if (c === null) return null;
          if (c <= 1) {
            clearInterval(autoJoinRef.current!);
            navigate(`/telehealth/session/${sessionId}`);
            return null;
          }
          return c - 1;
        });
      }, 1000);
    } else {
      if (autoJoinRef.current) clearInterval(autoJoinRef.current);
      setAutoJoinCountdown(null);
    }
    return () => { if (autoJoinRef.current) clearInterval(autoJoinRef.current); };
  }, [providerOnline, session?.room_id, sessionId, navigate]);
  const formatWait = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const isTherapist = user?.role === UserRole.THERAPIST || user?.role === UserRole.ADMIN || user?.role === UserRole.STAFF;

  const otherParticipantLabel = isTherapist
    ? session?.patient_details?.name ?? 'Patient'
    : session?.therapist_details?.name ?? 'Provider';

  const handleJoin = () => {
    navigate(`/telehealth/session/${sessionId}`);
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  if (!session) {
    return (
      <Box p={4}>
        <Alert severity="error">Session not found.</Alert>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/telehealth/dashboard')} sx={{ mt: 2 }}>
          Back to Dashboard
        </Button>
      </Box>
    );
  }

  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      minHeight="80vh"
      px={2}
    >
      <Paper elevation={4} sx={{ maxWidth: 520, width: '100%', borderRadius: 3, overflow: 'hidden' }}>
        {/* Header */}
        <Box
          sx={{
            background: 'linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%)',
            color: 'white',
            px: 4,
            py: 3,
          }}
        >
          <Typography variant="h5" fontWeight={700}>
            Waiting Room
          </Typography>
          {session.scheduled_at && (
            <Typography variant="body2" sx={{ opacity: 0.85, mt: 0.5 }}>
              Scheduled: {format(parseISO(session.scheduled_at), 'MMM d, yyyy h:mm a')}
            </Typography>
          )}
        </Box>

        <Box px={4} py={3}>
          {/* Session title */}
          {session.title && (
            <Typography variant="h6" gutterBottom>
              {session.title}
            </Typography>
          )}

          {/* Participants */}
          <Box display="flex" gap={2} my={2} flexWrap="wrap">
            {/* Self */}
            <Box display="flex" alignItems="center" gap={1}>
              <Avatar sx={{ width: 36, height: 36, bgcolor: 'primary.main' }}>
                <Person fontSize="small" />
              </Avatar>
              <Box>
                <Typography variant="body2" fontWeight={600}>
                  You ({user?.firstName} {user?.lastName})
                </Typography>
                {selfOnline !== null && (
                  <Chip
                    size="small"
                    icon={<FiberManualRecord sx={{ fontSize: '10px !important' }} />}
                    label={selfOnline ? 'Online' : 'Offline'}
                    color={selfOnline ? 'success' : 'default'}
                    variant="outlined"
                    sx={{ height: 20, fontSize: 11 }}
                  />
                )}
              </Box>
            </Box>

            <Divider orientation="vertical" flexItem />

            {/* Other participant */}
            <Box display="flex" alignItems="center" gap={1}>
              <Avatar sx={{ width: 36, height: 36, bgcolor: isTherapist ? 'secondary.main' : 'success.main' }}>
                <Person fontSize="small" />
              </Avatar>
              <Box>
                <Typography variant="body2" fontWeight={600}>
                  {otherParticipantLabel}
                </Typography>
                {providerOnline !== null ? (
                  <Chip
                    size="small"
                    icon={<FiberManualRecord sx={{ fontSize: '10px !important' }} />}
                    label={providerOnline ? 'Online' : 'Waiting to join'}
                    color={providerOnline ? 'success' : 'warning'}
                    variant="outlined"
                    sx={{ height: 20, fontSize: 11 }}
                  />
                ) : (
                  <CircularProgress size={12} />
                )}
              </Box>
            </Box>
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* Wait time */}
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
            <Box display="flex" alignItems="center" gap={1}>
              <Schedule fontSize="small" color="action" />
              <Typography variant="body2" color="text.secondary">
                Waiting: {formatWait(waitSeconds)}
              </Typography>
            </Box>
            {lastChecked && (
              <Typography variant="caption" color="text.secondary">
                Last checked: {format(lastChecked, 'h:mm:ss a')}
              </Typography>
            )}
          </Box>

          {/* Presence poll progress */}
          <LinearProgress
            variant="determinate"
            value={(waitSeconds % (POLL_INTERVAL_MS / 1000)) * (100 / (POLL_INTERVAL_MS / 1000))}
            sx={{ borderRadius: 1, height: 4, mb: 2 }}
          />

          {/* Status message */}
          {providerOnline === true && autoJoinCountdown !== null && (
            <Alert severity="success" sx={{ mb: 2 }} icon={<VideoCall />}>
              {otherParticipantLabel} is online! Joining in {autoJoinCountdown}s…
            </Alert>
          )}
          {providerOnline === false && (
            <Alert severity="info" sx={{ mb: 2 }}>
              {otherParticipantLabel} is not yet online. Checking every 10 seconds…
            </Alert>
          )}
          {providerOnline === true && autoJoinCountdown === null && (
            <Alert severity="success" sx={{ mb: 2 }}>
              {otherParticipantLabel} is online and ready!
            </Alert>
          )}

          {/* Actions */}
          <Box display="flex" gap={2} mt={1}>
            <Button
              variant="outlined"
              startIcon={<ArrowBack />}
              onClick={() => navigate('/telehealth/dashboard')}
              sx={{ flex: 1 }}
            >
              Back
            </Button>
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={() => { void checkPresence(); }}
              sx={{ minWidth: 44, px: 1.5 }}
            />
            <Button
              variant="contained"
              color="success"
              startIcon={<VideoCall />}
              onClick={handleJoin}
              disabled={!session.room_id}
              sx={{ flex: 2, fontWeight: 700 }}
            >
              {providerOnline ? 'Join Now' : 'Join Anyway'}
            </Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default WaitingRoom;
