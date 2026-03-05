import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Card,
  CardContent,
  Divider,
  MenuItem,
  Alert,
  CircularProgress,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Add,
  Edit,
  Visibility,
  Assignment,
  Schedule,
  Save,
  Cancel,
  CheckCircle
} from '@mui/icons-material';
import { apiClient } from '../../services/apiClient';
import { format } from 'date-fns';

interface SOAPNote {
  id: string;
  patient: string;
  patient_name: string;
  therapist: string;
  therapist_name: string;
  appointment: string | null;
  appointment_details: {
    id: string;
    start_datetime: string;
    end_datetime: string;
    appointment_type: string | null;
  } | null;
  session_date: string;
  session_duration: number | null;
  chief_complaint: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  status: 'draft' | 'finalized' | 'amended';
  created_at: string;
  updated_at: string;
  finalized_at: string | null;
}

const SOAPNotes: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [soapNotes, setSoapNotes] = useState<SOAPNote[]>([]);
  const [stats, setStats] = useState({
    completedThisWeek: 0,
    draftNotes: 0,
    overdueNotes: 0
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSOAPNotes();
  }, []);

  const loadSOAPNotes = async () => {
    setLoading(true);
    setError(null);
    try {
      const notesRes = await apiClient.get('/soap-notes/soap-notes/');
      const statsRes = await apiClient.get('/soap-notes/soap-notes/stats/');
      
      // Handle both paginated (results array) and non-paginated (direct array) responses
      const notesData = Array.isArray(notesRes.data) ? notesRes.data : (notesRes.data.results || []);
      setSoapNotes(notesData);
      setStats({
        completedThisWeek: statsRes.data.completed_this_week || 0,
        draftNotes: statsRes.data.draft || 0,
        overdueNotes: statsRes.data.overdue || 0
      });
    } catch (error: any) {
      console.error('Error loading SOAP notes:', error);
      setError(error.response?.data?.detail || 'Failed to load SOAP notes');
    } finally {
      setLoading(false);
    }
  };
  const [open, setOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState<SOAPNote | null>(null);
  const [patients, setPatients] = useState<any[]>([]);
  const [soapData, setSoapData] = useState({
    patient: '',
    session_date: format(new Date(), 'yyyy-MM-dd'),
    chief_complaint: '',
    subjective: '',
    objective: '',
    assessment: '',
    plan: '',
    status: 'draft' as 'draft' | 'finalized' | 'amended'
  });

  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async () => {
    try {
      const response = await apiClient.get('/auth/?role=client');
      // Handle both paginated (results array) and non-paginated (direct array) responses
      const patientsData = Array.isArray(response.data) ? response.data : (response.data.results || []);
      setPatients(patientsData);
    } catch (error) {
      console.error('Error loading patients:', error);
      setPatients([]);
    }
  };

  const handleOpenDialog = (note: SOAPNote | null = null) => {
    setSelectedNote(note);
    if (note) {
      setSoapData({
        patient: note.patient,
        session_date: format(new Date(note.session_date), 'yyyy-MM-dd'),
        chief_complaint: note.chief_complaint || '',
        subjective: note.subjective || '',
        objective: note.objective || '',
        assessment: note.assessment || '',
        plan: note.plan || '',
        status: note.status
      });
    } else {
      setSoapData({ 
        patient: '',
        session_date: format(new Date(), 'yyyy-MM-dd'),
        chief_complaint: '',
        subjective: '', 
        objective: '', 
        assessment: '', 
        plan: '',
        status: 'draft'
      });
    }
    setOpen(true);
  };

  const handleCloseDialog = () => {
    setOpen(false);
    setSelectedNote(null);
    setError(null);
  };

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    try {
      if (selectedNote) {
        // Update existing note
        await apiClient.patch(`/soap-notes/soap-notes/${selectedNote.id}/`, soapData);
      } else {
        // Create new note
        await apiClient.post('/soap-notes/soap-notes/', soapData);
      }
      await loadSOAPNotes();
      handleCloseDialog();
    } catch (error: any) {
      console.error('Error saving SOAP note:', error);
      setError(error.response?.data?.detail || 'Failed to save SOAP note');
    } finally {
      setLoading(false);
    }
  };

  const handleFinalize = async (noteId: string) => {
    if (!window.confirm('Are you sure you want to finalize this note? This action cannot be undone.')) {
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      await apiClient.post(`/soap-notes/soap-notes/${noteId}/finalize/`);
      await loadSOAPNotes();
    } catch (error: any) {
      console.error('Error finalizing SOAP note:', error);
      setError(error.response?.data?.detail || 'Failed to finalize SOAP note');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'finalized': return 'success';
      case 'draft': return 'warning';
      case 'amended': return 'info';
      default: return 'default';
    }
  };

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'center' }, gap: 1.5, mb: 3 }}>
        <Typography variant="h4" component="h1">
          SOAP Notes & Clinical Documentation
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => handleOpenDialog()}
          disabled={loading}
          fullWidth={isMobile}
        >
          New SOAP Note
        </Button>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={6} md={4}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Assignment color="success" sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h4" color="success.main">
                {loading ? <CircularProgress size={24} /> : stats.completedThisWeek}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Completed This Week
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} md={4}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Edit color="warning" sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h4" color="warning.main">
                {loading ? <CircularProgress size={24} /> : stats.draftNotes}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Draft Notes
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Schedule color="error" sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h4" color="error.main">
                {loading ? <CircularProgress size={24} /> : stats.overdueNotes}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Overdue Notes
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* SOAP Notes Table */}
      <Paper>
        {isMobile ? (
          <Box sx={{ p: 2, display: 'grid', gap: 1.5 }}>
            {loading && soapNotes.length === 0 ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : soapNotes.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                No SOAP notes found. Create your first note to get started.
              </Typography>
            ) : (
              soapNotes.map((note) => (
                <Card key={note.id} variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle2">{format(new Date(note.session_date), 'MMM dd, yyyy')}</Typography>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>{note.patient_name}</Typography>
                    <Typography variant="caption" color="text.secondary">{note.therapist_name}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      {note.chief_complaint || '-'}
                    </Typography>
                    <Box sx={{ mt: 1 }}>
                      <Chip
                        label={note.status.charAt(0).toUpperCase() + note.status.slice(1)}
                        color={getStatusColor(note.status) as any}
                        size="small"
                        variant="outlined"
                      />
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                      Updated {format(new Date(note.updated_at), 'MMM dd, yyyy HH:mm')}
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                      <IconButton size="small" color="primary" onClick={() => handleOpenDialog(note)} disabled={loading}>
                        <Edit />
                      </IconButton>
                      <IconButton size="small" color="info" onClick={() => handleOpenDialog(note)} disabled={loading}>
                        <Visibility />
                      </IconButton>
                      {note.status === 'draft' && (
                        <IconButton size="small" color="success" onClick={() => handleFinalize(note.id)} disabled={loading} title="Finalize Note">
                          <CheckCircle />
                        </IconButton>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              ))
            )}
          </Box>
        ) : (
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Patient</TableCell>
                <TableCell>Therapist</TableCell>
                <TableCell>Chief Complaint</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Last Modified</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && soapNotes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <CircularProgress sx={{ my: 4 }} />
                  </TableCell>
                </TableRow>
              ) : soapNotes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                      No SOAP notes found. Create your first note to get started.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                soapNotes.map((note) => (
                <TableRow key={note.id}>
                  <TableCell>
                    {format(new Date(note.session_date), 'MMM dd, yyyy')}
                  </TableCell>
                  <TableCell>{note.patient_name}</TableCell>
                  <TableCell>{note.therapist_name}</TableCell>
                  <TableCell>{note.chief_complaint || '-'}</TableCell>
                  <TableCell>
                    <Chip
                      label={note.status.charAt(0).toUpperCase() + note.status.slice(1)}
                      color={getStatusColor(note.status) as any}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    {format(new Date(note.updated_at), 'MMM dd, yyyy HH:mm')}
                  </TableCell>
                  <TableCell align="center">
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={() => handleOpenDialog(note)}
                      disabled={loading}
                    >
                      <Edit />
                    </IconButton>
                    <IconButton 
                      size="small" 
                      color="info"
                      onClick={() => handleOpenDialog(note)}
                      disabled={loading}
                    >
                      <Visibility />
                    </IconButton>
                    {note.status === 'draft' && (
                      <IconButton
                        size="small"
                        color="success"
                        onClick={() => handleFinalize(note.id)}
                        disabled={loading}
                        title="Finalize Note"
                      >
                        <CheckCircle />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        )}
      </Paper>

      {/* SOAP Note Dialog */}
      <Dialog open={open} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {selectedNote ? 'Edit SOAP Note' : 'New SOAP Note'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Grid container spacing={3}>
              {!selectedNote && (
                <>
                  <Grid item xs={12} md={6}>
                    <TextField
                      select
                      fullWidth
                      label="Patient"
                      value={soapData.patient}
                      onChange={(e) => setSoapData({ ...soapData, patient: e.target.value })}
                      required
                    >
                      <MenuItem value="">Select a patient</MenuItem>
                      {patients.map((patient) => (
                        <MenuItem key={patient.id} value={patient.id}>
                          {patient.first_name} {patient.last_name}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      type="date"
                      label="Session Date"
                      value={soapData.session_date}
                      onChange={(e) => setSoapData({ ...soapData, session_date: e.target.value })}
                      InputLabelProps={{ shrink: true }}
                      required
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Chief Complaint"
                      placeholder="Brief description of the main concern..."
                      value={soapData.chief_complaint}
                      onChange={(e) => setSoapData({ ...soapData, chief_complaint: e.target.value })}
                    />
                  </Grid>
                </>
              )}
              
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom color="primary">
                  Subjective
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  placeholder="Patient's reported symptoms, concerns, and subjective experience..."
                  value={soapData.subjective}
                  onChange={(e) => setSoapData({ ...soapData, subjective: e.target.value })}
                />
              </Grid>
              
              <Grid item xs={12}>
                <Divider sx={{ my: 1 }} />
                <Typography variant="h6" gutterBottom color="primary">
                  Objective
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  placeholder="Observable findings, test results, mental status exam..."
                  value={soapData.objective}
                  onChange={(e) => setSoapData({ ...soapData, objective: e.target.value })}
                />
              </Grid>
              
              <Grid item xs={12}>
                <Divider sx={{ my: 1 }} />
                <Typography variant="h6" gutterBottom color="primary">
                  Assessment
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  placeholder="Clinical impression, diagnosis, progress assessment..."
                  value={soapData.assessment}
                  onChange={(e) => setSoapData({ ...soapData, assessment: e.target.value })}
                />
              </Grid>
              
              <Grid item xs={12}>
                <Divider sx={{ my: 1 }} />
                <Typography variant="h6" gutterBottom color="primary">
                  Plan
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  placeholder="Treatment plan, interventions, follow-up, homework assignments..."
                  value={soapData.plan}
                  onChange={(e) => setSoapData({ ...soapData, plan: e.target.value })}
                />
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  select
                  fullWidth
                  label="Status"
                  value={soapData.status}
                  onChange={(e) => setSoapData({ ...soapData, status: e.target.value as any })}
                >
                  <MenuItem value="draft">Draft</MenuItem>
                  <MenuItem value="finalized">Finalized</MenuItem>
                  <MenuItem value="amended">Amended</MenuItem>
                </TextField>
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} startIcon={<Cancel />} disabled={loading}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            variant="contained" 
            startIcon={loading ? <CircularProgress size={20} /> : <Save />}
            disabled={loading || !soapData.patient}
          >
            {loading ? 'Saving...' : 'Save Note'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SOAPNotes;