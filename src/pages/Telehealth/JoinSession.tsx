import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  Button,
} from '@mui/material';
import { VideoCall, Error as ErrorIcon } from '@mui/icons-material';
import { apiClient } from '../../services/apiClient';
import { useAuth } from '../../contexts/AuthContext';
import { SessionDetails } from '../../types';

const JoinSession: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { state } = useAuth();
  const user = state.user;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<SessionDetails | null>(null);

  useEffect(() => {
    if (!user) {
      // Redirect to login if not authenticated
      navigate(`/login?redirect=/telehealth/join/${roomId}`);
      return;
    }

    fetchSessionDetails();
  }, [roomId, user]);

  const fetchSessionDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      // Search for session by room_id
      const response = await apiClient.get(`/telehealth/sessions/`, {
        params: { room_id: roomId }
      });

      const sessions = response.data.results || response.data;
      
      if (!sessions || sessions.length === 0) {
        setError('Session not found. The link may be invalid or expired.');
        setLoading(false);
        return;
      }

      const sessionData = sessions[0];

      // Verify user is authorized to join this session (only for registered patients)
      if (user?.role === 'client' && sessionData.patient_details) {
        if (sessionData.patient_details.id !== user.id) {
          setError('You are not authorized to join this session.');
          setLoading(false);
          return;
        }
      }
      
      // For external patients (no patient_details), allow anyone with the link to join
      // This enables the email link to work for non-registered users

      // Check if session is active
      if (sessionData.status === 'completed') {
        setError('This session has already ended.');
        setLoading(false);
        return;
      }

      if (sessionData.status === 'cancelled') {
        setError('This session has been cancelled.');
        setLoading(false);
        return;
      }

      setSession(sessionData);
      setLoading(false);

      // Auto-join after 2 seconds
      setTimeout(() => {
        handleJoinSession(sessionData);
      }, 2000);

    } catch (error: any) {
      console.error('Error fetching session:', error);
      setError(
        error.response?.data?.detail ||
        'Failed to load session details. Please check the link and try again.'
      );
      setLoading(false);
    }
  };

  const handleJoinSession = (sessionData: SessionDetails) => {
    // Navigate to the video session page
    navigate(`/telehealth/session/${sessionData.id}`);
  };

  if (!user) {
    return null; // Will redirect to login
  }

  return (
    <Container maxWidth="md">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          py: 4,
        }}
      >
        <Paper
          elevation={3}
          sx={{
            p: 4,
            width: '100%',
            textAlign: 'center',
          }}
        >
          {loading && (
            <>
              <CircularProgress size={60} sx={{ mb: 3 }} />
              <Typography variant="h5" gutterBottom>
                Loading Session...
              </Typography>
              <Typography color="text.secondary">
                Please wait while we prepare your session
              </Typography>
            </>
          )}

          {error && (
            <>
              <ErrorIcon color="error" sx={{ fontSize: 60, mb: 2 }} />
              <Typography variant="h5" color="error" gutterBottom>
                Unable to Join Session
              </Typography>
              <Alert severity="error" sx={{ mt: 2, mb: 3, textAlign: 'left' }}>
                {error}
              </Alert>
              <Button
                variant="contained"
                onClick={() => navigate('/telehealth/dashboard')}
              >
                Go to Dashboard
              </Button>
            </>
          )}

          {!loading && !error && session && (
            <>
              <VideoCall color="primary" sx={{ fontSize: 60, mb: 2 }} />
              <Typography variant="h4" gutterBottom>
                {session.title}
              </Typography>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                with {session.therapist_details.first_name}{' '}
                {session.therapist_details.last_name}
              </Typography>
              <Box sx={{ mt: 3, mb: 2 }}>
                <CircularProgress size={30} />
                <Typography variant="body1" sx={{ mt: 2 }}>
                  Joining session...
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                You'll be redirected automatically
              </Typography>
            </>
          )}
        </Paper>
      </Box>
    </Container>
  );
};

export default JoinSession;
