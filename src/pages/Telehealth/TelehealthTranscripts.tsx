import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { ArrowBack, Transcribe } from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { apiClient } from '../../services/apiClient';

interface TranscriptRecord {
  id: number;
  session: number;
  session_time: string;
  session_title: string;
  patient_name: string;
  therapist_name: string;
  transcript: string;
  created_at: string;
}

const TelehealthTranscripts: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { state } = useAuth();
  const { showError } = useNotification();

  const [loading, setLoading] = useState(false);
  const [transcripts, setTranscripts] = useState<TranscriptRecord[]>([]);
  const [selectedTranscript, setSelectedTranscript] = useState<TranscriptRecord | null>(null);

  const user = state.user;

  const sessionFilter = searchParams.get('sessionId');

  useEffect(() => {
    const loadTranscripts = async () => {
      setLoading(true);
      try {
        const response = await apiClient.get('/telehealth/sessions/transcripts/');
        const records = Array.isArray(response.data) ? response.data : [];
        setTranscripts(records);
      } catch (error) {
        console.error('Failed to load transcripts:', error);
        showError('Failed to load transcripts');
      } finally {
        setLoading(false);
      }
    };

    loadTranscripts();
  }, [showError]);

  const filteredTranscripts = useMemo(() => {
    if (!sessionFilter) {
      return transcripts;
    }
    return transcripts.filter((item) => String(item.session) === sessionFilter);
  }, [transcripts, sessionFilter]);

  if (!user || !['admin', 'therapist'].includes(user.role)) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Only therapists and admins can access transcripts.</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Session Transcripts
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Saved telehealth conversation transcripts from your completed sessions
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<ArrowBack />}
          onClick={() => navigate('/telehealth/dashboard')}
        >
          Back to Dashboard
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Patient</TableCell>
              <TableCell>Session Time</TableCell>
              <TableCell>Session Title</TableCell>
              <TableCell>Therapist/Admin</TableCell>
              <TableCell align="right">Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                  <CircularProgress size={28} />
                </TableCell>
              </TableRow>
            ) : filteredTranscripts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                  <Typography color="text.secondary">
                    No transcripts saved yet
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredTranscripts.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell>{row.patient_name}</TableCell>
                  <TableCell>{format(parseISO(row.session_time), 'PPp')}</TableCell>
                  <TableCell>{row.session_title}</TableCell>
                  <TableCell>{row.therapist_name}</TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<Transcribe />}
                      onClick={() => setSelectedTranscript(row)}
                    >
                      View Conversation
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog
        open={Boolean(selectedTranscript)}
        onClose={() => setSelectedTranscript(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {selectedTranscript?.patient_name} • {selectedTranscript?.session_time ? format(parseISO(selectedTranscript.session_time), 'PPp') : ''}
        </DialogTitle>
        <DialogContent dividers>
          <Typography
            variant="body2"
            sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}
          >
            {selectedTranscript?.transcript || 'No transcript content'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedTranscript(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TelehealthTranscripts;
