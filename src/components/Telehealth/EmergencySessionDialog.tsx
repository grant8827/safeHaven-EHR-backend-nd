import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Typography,
  Box,
} from '@mui/material';
import { Warning } from '@mui/icons-material';
import { apiClient } from '../../services/apiClient';

interface Patient {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number?: string;
  date_of_birth?: string;
}

interface EmergencySessionDialogProps {
  open: boolean;
  onClose: () => void;
  onSessionCreated: () => void;
}

const EmergencySessionDialog: React.FC<EmergencySessionDialogProps> = ({
  open,
  onClose,
  onSessionCreated,
}) => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | ''>('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [createdSessionUrl, setCreatedSessionUrl] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetchPatients();
    }
  }, [open]);

  const fetchPatients = async () => {
    try {
      const response = await apiClient.get('/api/patients/');
      // Handle paginated response
      const patientList = response.data?.results || [];
      setPatients(patientList);
      
      if (patientList.length === 0) {
        console.warn('No patients found in the system');
        setError('No patients available. Please register a patient first.');
      }
    } catch (error: any) {
      console.error('Error fetching patients:', error);
      console.error('Error details:', error.response?.data);
      setError(`Failed to load patients: ${error.response?.data?.detail || error.message || 'Unknown error'}`);
    }
  };

  const validateForm = () => {
    if (!selectedPatientId) {
      setError('Please select a patient');
      return false;
    }
    return true;
  };

  const handleCreateEmergencySession = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const requestData = { patient_id: selectedPatientId };

      const response = await apiClient.post('/telehealth/sessions/create_emergency/', requestData);
      
      // Store the session URL
      setCreatedSessionUrl(response.data.session_url);
      setSuccess(true);
      
      // Don't auto-close, let user copy the link
    } catch (error: any) {
      console.error('Error creating emergency session:', error);
      setError(
        error.response?.data?.error ||
        error.response?.data?.detail ||
        'Failed to create emergency session'
      );
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedPatientId('');
    setError(null);
    setSuccess(false);
    setCreatedSessionUrl(null);
  };

  const handleClose = () => {
    if (!loading) {
      resetForm();
      onClose();
      if (success) {
        onSessionCreated();
      }
    }
  };

  const copyToClipboard = () => {
    if (createdSessionUrl) {
      navigator.clipboard.writeText(createdSessionUrl);
      alert('Join link copied to clipboard!');
    }
  };

  const selectedPatient = patients.find(p => p.id === selectedPatientId);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <Warning color="error" />
          <Typography variant="h6">Start Emergency Session</Typography>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Emergency session created! Email sent to patient successfully.
          </Alert>
        )}

        <Alert severity="warning" sx={{ mb: 3 }}>
          This will create an emergency session and send an email with a join link to the selected patient.
        </Alert>

        <FormControl fullWidth>
          <InputLabel id="patient-select-label">Select Patient *</InputLabel>
          <Select
            labelId="patient-select-label"
            value={selectedPatientId}
            onChange={(e) => setSelectedPatientId(e.target.value as string)}
            label="Select Patient *"
            disabled={loading || success}
          >
            {patients.map((patient) => (
              <MenuItem key={patient.id} value={patient.id}>
                {patient.first_name} {patient.last_name} ({patient.email})
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {selectedPatient && (
          <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid #e0e0e0' }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              <strong>Patient Details:</strong>
            </Typography>
            <Typography variant="body2">
              Name: {selectedPatient.first_name} {selectedPatient.last_name}
            </Typography>
            <Typography variant="body2">
              Email: {selectedPatient.email}
            </Typography>
            <Typography variant="body2" sx={{ mt: 1, color: 'primary.main' }}>
              ✉️ An email will be sent to this address with the session link
            </Typography>
          </Box>
        )}
        
        {/* Show join link after successful creation */}
        {success && createdSessionUrl && (
          <Box sx={{ mt: 3, p: 2, bgcolor: 'success.light', borderRadius: 1 }}>
            <Typography variant="h6" gutterBottom sx={{ color: 'success.dark' }}>
              ✅ Emergency Session Created!
            </Typography>
            <Typography variant="body2" gutterBottom>
              Email sent to patient. You can also copy and share this link:
            </Typography>
            <Box sx={{ mt: 1, p: 1, bgcolor: 'white', borderRadius: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" sx={{ flex: 1, fontFamily: 'monospace', wordBreak: 'break-all' }}>
                {createdSessionUrl}
              </Typography>
              <Button size="small" variant="outlined" onClick={copyToClipboard}>
                Copy
              </Button>
            </Box>
            <Typography variant="caption" sx={{ mt: 1, display: 'block', color: 'text.secondary' }}>
              💡 Both you and the patient should use this same link to join the session
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          {success ? 'Close' : 'Cancel'}
        </Button>
        {!success && (
          <Button
            onClick={handleCreateEmergencySession}
            variant="contained"
            color="error"
            disabled={loading}
            startIcon={loading && <CircularProgress size={20} />}
          >
            {loading ? 'Creating...' : 'Start Emergency Session'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default EmergencySessionDialog;
