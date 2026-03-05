import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Box,
  Chip,
  Avatar,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  List
} from '@mui/material';
import {
  VideoCall,
  Schedule,
  Person,
  AccessTime,
  Warning,
  Cancel,
  Refresh
} from '@mui/icons-material';
import { 
  SessionInvitation, 
  InvitationStatus
} from '../../types';
import { telehealthService } from '../../services/telehealthService';
import { useAuth } from '../../contexts/AuthContext';

interface PatientInvitationsProps {
  onJoinSession: (sessionId: string) => void;
}

const PatientInvitations: React.FC<PatientInvitationsProps> = ({ onJoinSession }) => {
  const { state } = useAuth();
  const user = state.user;
  const [invitations, setInvitations] = useState<SessionInvitation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joiningInvitation, setJoiningInvitation] = useState<string | null>(null);
  const [accessCodeDialog, setAccessCodeDialog] = useState<{
    open: boolean;
    invitation: SessionInvitation | null;
  }>({ open: false, invitation: null });
  const [accessCode, setAccessCode] = useState('');

  useEffect(() => {
    if (user) {
      loadInvitations();
      // Set up polling for new invitations
      const interval = setInterval(loadInvitations, 30000); // Check every 30 seconds
      return () => clearInterval(interval);
    }
  }, [user]);

  const loadInvitations = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const result = await telehealthService.getPatientInvitations(user.id);
      
      if (result.success && result.data) {
        // Filter to show only pending and accepted invitations
        const activeInvitations = result.data.filter(
          invitation => invitation.status === InvitationStatus.PENDING || 
                       invitation.status === InvitationStatus.ACCEPTED
        );
        setInvitations(activeInvitations);
      } else {
        setError(result.message || 'Failed to load invitations');
      }
    } catch (err) {
      setError('Error loading invitations');
      console.error('Error loading invitations:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinSession = async (invitation: SessionInvitation) => {
    if (invitation.accessCode) {
      setAccessCodeDialog({ open: true, invitation });
      return;
    }

    await joinWithInvitation(invitation);
  };

  const joinWithInvitation = async (invitation: SessionInvitation, accessCode?: string) => {
    setJoiningInvitation(invitation.id);
    setError(null);

    try {
      const result = await telehealthService.joinSessionViaInvitation(
        invitation.id,
        accessCode
      );

      if (result.success && result.data) {
        onJoinSession(result.data.sessionId);
        // Remove the invitation from the list after successful join
        setInvitations(prev => prev.filter(inv => inv.id !== invitation.id));
      } else {
        setError(result.message || 'Failed to join session');
      }
    } catch (err) {
      setError('Error joining session');
      console.error('Error joining session:', err);
    } finally {
      setJoiningInvitation(null);
      setAccessCodeDialog({ open: false, invitation: null });
      setAccessCode('');
    }
  };

  const handleDeclineInvitation = async (invitationId: string) => {
    try {
      await telehealthService.cancelInvitation(invitationId);
      setInvitations(prev => prev.filter(inv => inv.id !== invitationId));
    } catch (err) {
      setError('Failed to decline invitation');
      console.error('Error declining invitation:', err);
    }
  };

  const getStatusChip = (status: InvitationStatus) => {
    switch (status) {
      case InvitationStatus.PENDING:
        return <Chip label="Pending" color="warning" size="small" />;
      case InvitationStatus.ACCEPTED:
        return <Chip label="Ready to Join" color="success" size="small" />;
      case InvitationStatus.EXPIRED:
        return <Chip label="Expired" color="error" size="small" />;
      default:
        return <Chip label={status} size="small" />;
    }
  };

  const isExpired = (invitation: SessionInvitation) => {
    return new Date() > new Date(invitation.expiresAt);
  };

  const formatDateTime = (date: Date) => {
    return new Date(date).toLocaleString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  };

  if (loading && invitations.length === 0) {
    return (
      <Box display="flex" justifyContent="center" py={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box display="flex" alignItems="center" justifyContent="between" mb={2}>
        <Typography variant="h6">Session Invitations</Typography>
        <Button
          startIcon={<Refresh />}
          onClick={loadInvitations}
          disabled={loading}
          size="small"
        >
          Refresh
        </Button>
      </Box>

      {invitations.length === 0 ? (
        <Card>
          <CardContent>
            <Box display="flex" flexDirection="column" alignItems="center" py={4}>
              <VideoCall sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="textSecondary" gutterBottom>
                No Session Invitations
              </Typography>
              <Typography variant="body2" color="textSecondary" align="center">
                You don't have any pending session invitations at the moment.
                Your therapist will send you an invitation when it's time for your session.
              </Typography>
            </Box>
          </CardContent>
        </Card>
      ) : (
        <List>
          {invitations.map((invitation) => {
            const expired = isExpired(invitation);
            const canJoin = invitation.status === InvitationStatus.PENDING || 
                           invitation.status === InvitationStatus.ACCEPTED;
            
            return (
              <Card key={invitation.id} sx={{ mb: 2 }}>
                <CardContent>
                  <Box display="flex" alignItems="flex-start" gap={2}>
                    <Avatar sx={{ bgcolor: 'primary.main' }}>
                      <Person />
                    </Avatar>
                    
                    <Box flex={1}>
                      <Box display="flex" alignItems="center" gap={1} mb={1}>
                        <Typography variant="h6">
                          {invitation.sessionDetails.title}
                        </Typography>
                        {getStatusChip(invitation.status)}
                        {expired && (
                          <Chip label="Expired" color="error" size="small" />
                        )}
                      </Box>

                      {invitation.sessionDetails.description && (
                        <Typography variant="body2" color="textSecondary" paragraph>
                          {invitation.sessionDetails.description}
                        </Typography>
                      )}

                      <Box display="flex" flexDirection="column" gap={1}>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Schedule fontSize="small" color="action" />
                          <Typography variant="body2">
                            Scheduled for: {formatDateTime(invitation.sessionDetails.scheduledFor)}
                          </Typography>
                        </Box>
                        
                        <Box display="flex" alignItems="center" gap={1}>
                          <AccessTime fontSize="small" color="action" />
                          <Typography variant="body2">
                            Duration: {formatDuration(invitation.sessionDetails.estimatedDuration)}
                          </Typography>
                        </Box>

                        <Box display="flex" alignItems="center" gap={1}>
                          <Warning fontSize="small" color="action" />
                          <Typography variant="body2" color="textSecondary">
                            Expires: {formatDateTime(invitation.expiresAt)}
                          </Typography>
                        </Box>
                      </Box>

                      {invitation.accessCode && (
                        <Alert severity="info" sx={{ mt: 2 }}>
                          This session requires an access code to join.
                        </Alert>
                      )}
                    </Box>
                  </Box>
                </CardContent>

                <CardActions>
                  <Button
                    variant="contained"
                    startIcon={joiningInvitation === invitation.id ? 
                      <CircularProgress size={20} color="inherit" /> : <VideoCall />
                    }
                    onClick={() => handleJoinSession(invitation)}
                    disabled={!canJoin || expired || joiningInvitation === invitation.id}
                  >
                    {joiningInvitation === invitation.id ? 'Joining...' : 'Join Session'}
                  </Button>
                  
                  <Button
                    variant="outlined"
                    startIcon={<Cancel />}
                    onClick={() => handleDeclineInvitation(invitation.id)}
                    disabled={expired}
                  >
                    Decline
                  </Button>
                </CardActions>
              </Card>
            );
          })}
        </List>
      )}

      {/* Access Code Dialog */}
      <Dialog
        open={accessCodeDialog.open}
        onClose={() => setAccessCodeDialog({ open: false, invitation: null })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Enter Access Code</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" paragraph>
            This session requires an access code. Please enter the code provided by your therapist.
          </Typography>
          <TextField
            fullWidth
            label="Access Code"
            value={accessCode}
            onChange={(e) => setAccessCode(e.target.value)}
            autoFocus
            margin="dense"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAccessCodeDialog({ open: false, invitation: null })}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              if (accessCodeDialog.invitation) {
                joinWithInvitation(accessCodeDialog.invitation, accessCode);
              }
            }}
            disabled={!accessCode.trim()}
          >
            Join Session
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PatientInvitations;