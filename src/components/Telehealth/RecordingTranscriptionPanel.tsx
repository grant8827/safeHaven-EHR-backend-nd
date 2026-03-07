import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  IconButton,
  LinearProgress,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Alert,
  Tooltip,
  Paper,
  CircularProgress,
  Grid
} from '@mui/material';
import {
  FiberManualRecord,
  Stop,
  Pause,
  PlayArrow,
  Settings,
  Download,
  Delete,
  Transcribe,
  SaveAlt,
  PictureAsPdf,
  Description
} from '@mui/icons-material';
import {
  RecordingState,
  RecordingQuality,
  TranscriptionSettings,
  TranscriptionState,
  SessionTranscript,
  TranscriptEntry,
  RecordingControls,
  TranscriptionProvider
} from '../../types';
import { telehealthService } from '../../services/telehealthService';

interface RecordingTranscriptionPanelProps {
  sessionId: string;
  onRecordingStateChange?: (isRecording: boolean) => void;
  onTranscriptionUpdate?: (entries: TranscriptEntry[]) => void;
}

const RecordingTranscriptionPanel: React.FC<RecordingTranscriptionPanelProps> = ({
  sessionId,
  onRecordingStateChange,
  onTranscriptionUpdate
}) => {

  // Recording state
  const [recordingState, setRecordingState] = useState<RecordingState | null>(null);
  const [recordingControls, setRecordingControls] = useState<RecordingControls | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  // Transcription state
  const [transcriptionSettings, setTranscriptionSettings] = useState<TranscriptionSettings>({
    enabled: true,
    autoStart: true,
    language: 'en-US',
    realTimeTranscription: true,
    speakerIdentification: true,
    confidenceThreshold: 0.8,
    customVocabulary: [],
    medicalTermsEnabled: true,
    punctuationEnabled: true,
    profanityFilter: false,
    saveTranscript: true,
    provider: TranscriptionProvider.BUILT_IN
  });
  
  const [transcriptionState, setTranscriptionState] = useState<TranscriptionState | null>(null);
  const [transcript, setTranscript] = useState<SessionTranscript | null>(null);
  const [realtimeEntries, setRealtimeEntries] = useState<TranscriptEntry[]>([]);
  const [isTranscribing, setIsTranscribing] = useState(false);

  // UI state
  const [showSettings, setShowSettings] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load initial data
  useEffect(() => {
    loadRecordingControls();
    loadRecordingState();
    if (transcriptionSettings.autoStart) {
      startTranscription();
    }
  }, [sessionId]);

  // Update recording duration timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isRecording && !isPaused) {
      interval = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording, isPaused]);

  useEffect(() => {
    const handleTranscriptionUpdate = (entry: TranscriptEntry) => {
      setRealtimeEntries(prevEntries => {
        const lastEntry = prevEntries[prevEntries.length - 1];
        if (entry.isInterim && lastEntry && lastEntry.isInterim) {
          // Replace last interim result with the new one
          return [...prevEntries.slice(0, -1), entry];
        } else {
          // Add new entry (either final or the first interim)
          return [...prevEntries, entry];
        }
      });
    };

    telehealthService.on('transcription-update', handleTranscriptionUpdate);

    return () => {
      telehealthService.off('transcription-update', handleTranscriptionUpdate);
    };
  }, []); // Remove dependencies to avoid re-subscribing on every render

  const loadRecordingControls = async () => {
    try {
      const result = await telehealthService.getRecordingControls(sessionId);
      if (result.success && result.data) {
        setRecordingControls(result.data);
      }
    } catch (error) {
      console.error('Failed to load recording controls:', error);
    }
  };

  const loadRecordingState = async () => {
    try {
      const result = await telehealthService.getRecordingState(sessionId);
      if (result.success && result.data) {
        setRecordingState(result.data);
        setIsRecording(result.data.isRecording);
        setIsPaused(result.data.isPaused);
        setRecordingDuration(Math.floor(result.data.currentDuration / 1000));
      }
    } catch (error) {
      console.error('Failed to load recording state:', error);
    }
  };

  const startRecording = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await telehealthService.startRecording(
        sessionId,
        RecordingQuality.HIGH,
        transcriptionSettings.enabled
      );
      
      if (result.success) {
        setIsRecording(true);
        setRecordingDuration(0);
        onRecordingStateChange?.(true);
        
        if (transcriptionSettings.enabled && transcriptionSettings.autoStart) {
          await startTranscription();
        }
      } else {
        setError(result.message || 'Failed to start recording');
      }
    } catch (error) {
      setError('Error starting recording');
    } finally {
      setLoading(false);
    }
  };

  const stopRecording = async () => {
    setLoading(true);
    
    try {
      const result = await telehealthService.stopRecording(sessionId);
      
      if (result.success) {
        setIsRecording(false);
        setIsPaused(false);
        onRecordingStateChange?.(false);
        
        if (isTranscribing) {
          await stopTranscription();
        }
      } else {
        setError(result.message || 'Failed to stop recording');
      }
    } catch (error) {
      setError('Error stopping recording');
    } finally {
      setLoading(false);
    }
  };

  const pauseRecording = async () => {
    try {
      const result = await telehealthService.pauseRecording(sessionId);
      
      if (result.success) {
        setIsPaused(true);
      } else {
        setError(result.message || 'Failed to pause recording');
      }
    } catch (error) {
      setError('Error pausing recording');
    }
  };

  const resumeRecording = async () => {
    try {
      const result = await telehealthService.resumeRecording(sessionId);
      
      if (result.success) {
        setIsPaused(false);
      } else {
        setError(result.message || 'Failed to resume recording');
      }
    } catch (error) {
      setError('Error resuming recording');
    }
  };

  const startTranscription = async () => {
    try {
      const result = await telehealthService.startTranscription(sessionId, transcriptionSettings);
      
      if (result.success) {
        setIsTranscribing(true);
        if (result.data) {
          setTranscriptionState(result.data);
        }
      } else {
        setError(result.message || 'Failed to start transcription');
      }
    } catch (error) {
      setError('Error starting transcription');
    }
  };

  const stopTranscription = async () => {
    try {
      const result = await telehealthService.stopTranscription(sessionId);
      
      if (result.success) {
        setIsTranscribing(false);
        if (result.data) {
          setTranscript(result.data);
        }
      } else {
        setError(result.message || 'Failed to stop transcription');
      }
    } catch (error) {
      setError('Error stopping transcription');
    }
  };

  const fetchRealtimeTranscription = async () => {
    try {
      const result = await telehealthService.getTranscriptionEntries(sessionId);
      
      if (result.success && result.data) {
        setRealtimeEntries(result.data);
        onTranscriptionUpdate?.(result.data);
      }
    } catch (error) {
      console.error('Error fetching transcription entries:', error);
    }
  };

  // Fetch transcription periodically if needed
  useEffect(() => {
    if (isTranscribing && transcriptionSettings.realTimeTranscription) {
      const interval = setInterval(fetchRealtimeTranscription, 5000);
      return () => clearInterval(interval);
    }
  }, [isTranscribing, transcriptionSettings.realTimeTranscription]);

  const exportTranscript = async (format: 'pdf' | 'docx' | 'txt' | 'json') => {
    try {
      const result = await telehealthService.exportTranscript(sessionId, format);
      
      if (result.success && result.data) {
        // Create download link
        const link = document.createElement('a');
        link.href = result.data.downloadUrl;
        link.download = result.data.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        setError(result.message || 'Failed to export transcript');
      }
    } catch (error) {
      setError('Error exporting transcript');
    }
  };

  const downloadRecording = async () => {
    try {
      const result = await telehealthService.getRecordingDownloadUrl(sessionId);
      
      if (result.success && result.data) {
        // Create download link
        const link = document.createElement('a');
        link.href = result.data.downloadUrl;
        link.download = `session-${sessionId}-recording.webm`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        setError(result.message || 'Failed to get download URL');
      }
    } catch (error) {
      setError('Error downloading recording');
    }
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getRecordingIconColor = () => {
    if (isRecording && !isPaused) return 'error';
    if (isRecording && isPaused) return 'warning';
    return 'inherit';
  };

  const getRecordingChipColor = () => {
    if (isRecording && !isPaused) return 'error';
    if (isRecording && isPaused) return 'warning';
    return 'default';
  };

  const getRecordingStatusText = () => {
    if (isRecording && !isPaused) return 'Recording';
    if (isRecording && isPaused) return 'Paused';
    return 'Stopped';
  };

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Grid container spacing={2}>
        {/* Recording Controls */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="between" mb={2}>
                <Typography variant="h6" display="flex" alignItems="center" gap={1}>
                  <FiberManualRecord color={getRecordingIconColor()} />
                  Session Recording
                </Typography>
                
                <Box display="flex" gap={1}>
                  <Tooltip title="Recording Settings">
                    <IconButton onClick={() => setShowSettings(true)} size="small">
                      <Settings />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>

              <Box display="flex" alignItems="center" gap={2} mb={2}>
                <Chip
                  label={getRecordingStatusText()}
                  color={getRecordingChipColor()}
                  size="small"
                />
                <Typography variant="body2" fontFamily="monospace">
                  {formatDuration(recordingDuration)}
                </Typography>
                {recordingState && (
                  <Typography variant="caption" color="textSecondary">
                    {(recordingState.fileSize / 1024 / 1024).toFixed(1)} MB
                  </Typography>
                )}
              </Box>

              {isRecording && !isPaused && (
                <LinearProgress 
                  variant="indeterminate" 
                  color="error" 
                  sx={{ mb: 2, height: 6, borderRadius: 1 }}
                />
              )}

              <Box display="flex" gap={1} flexWrap="wrap">
                {!isRecording && recordingControls?.canStart && (
                  <Button
                    variant="contained"
                    startIcon={loading ? <CircularProgress size={20} /> : <FiberManualRecord />}
                    onClick={startRecording}
                    disabled={loading}
                    color="error"
                  >
                    Start Recording
                  </Button>
                )}

                {isRecording && (
                  <>
                    {!isPaused ? (
                      <Button
                        variant="outlined"
                        startIcon={<Pause />}
                        onClick={pauseRecording}
                        disabled={loading}
                      >
                        Pause
                      </Button>
                    ) : (
                      <Button
                        variant="outlined"
                        startIcon={<PlayArrow />}
                        onClick={resumeRecording}
                        disabled={loading}
                      >
                        Resume
                      </Button>
                    )}
                    
                    <Button
                      variant="contained"
                      startIcon={<Stop />}
                      onClick={stopRecording}
                      disabled={loading}
                    >
                      Stop Recording
                    </Button>
                  </>
                )}

                {!isRecording && recordingState?.filePath && (
                  <>
                    <Button
                      variant="outlined"
                      startIcon={<Download />}
                      onClick={downloadRecording}
                      disabled={loading}
                    >
                      Download
                    </Button>
                    
                    {recordingControls?.canDelete && (
                      <Button
                        variant="outlined"
                        startIcon={<Delete />}
                        color="error"
                        disabled={loading}
                      >
                        Delete
                      </Button>
                    )}
                  </>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Transcription Controls */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="between" mb={2}>
                <Typography variant="h6" display="flex" alignItems="center" gap={1}>
                  <Transcribe color={isTranscribing ? 'primary' : 'disabled'} />
                  Live Transcription
                </Typography>
                
                <FormControlLabel
                  control={
                    <Switch
                      checked={isTranscribing}
                      onChange={async (e) => {
                        if (e.target.checked) {
                          await startTranscription();
                        } else {
                          await stopTranscription();
                        }
                      }}
                    />
                  }
                  label="Enable"
                />
              </Box>

              {transcriptionState && (
                <Box mb={2}>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    Current Language: {transcriptionState.language}
                  </Typography>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    Word Count: {transcriptionState.wordCount}
                  </Typography>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography variant="caption">Confidence:</Typography>
                    <LinearProgress
                      variant="determinate"
                      value={transcriptionState.confidence * 100}
                      sx={{ flex: 1, height: 4 }}
                      color={transcriptionState.confidence > 0.8 ? 'success' : 'warning'}
                    />
                    <Typography variant="caption">
                      {Math.round(transcriptionState.confidence * 100)}%
                    </Typography>
                  </Box>
                </Box>
              )}

              {realtimeEntries.length > 0 && (
                <Paper 
                  variant="outlined" 
                  sx={{ 
                    maxHeight: 150, 
                    overflow: 'auto', 
                    p: 1, 
                    mb: 2,
                    backgroundColor: 'grey.50'
                  }}
                >
                  {realtimeEntries.slice(-3).map((entry) => (
                    <Typography 
                      key={entry.id} 
                      variant="body2" 
                      sx={{ 
                        mb: 0.5,
                        opacity: entry.isInterim ? 0.7 : 1,
                        fontStyle: entry.isInterim ? 'italic' : 'normal'
                      }}
                    >
                      <strong>{entry.speakerName || 'Speaker'}:</strong> {entry.text}
                    </Typography>
                  ))}
                </Paper>
              )}

              <Box display="flex" gap={1} flexWrap="wrap">
                <Button
                  variant="outlined"
                  startIcon={<Description />}
                  onClick={() => setShowTranscript(true)}
                  disabled={!transcript && realtimeEntries.length === 0}
                  size="small"
                >
                  View Full Transcript
                </Button>

                {(transcript || realtimeEntries.length > 0) && (
                  <>
                    <Button
                      variant="outlined"
                      startIcon={<PictureAsPdf />}
                      onClick={() => exportTranscript('pdf')}
                      size="small"
                    >
                      Export PDF
                    </Button>
                    
                    <Button
                      variant="outlined"
                      startIcon={<SaveAlt />}
                      onClick={() => exportTranscript('docx')}
                      size="small"
                    >
                      Export DOCX
                    </Button>
                  </>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Recording Settings Dialog */}
      <Dialog
        open={showSettings}
        onClose={() => setShowSettings(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Recording & Transcription Settings</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            <FormControl fullWidth>
              <InputLabel>Recording Quality</InputLabel>
              <Select
                value={recordingState?.quality || RecordingQuality.HIGH}
                label="Recording Quality"
              >
                <MenuItem value={RecordingQuality.LOW}>Low (480p)</MenuItem>
                <MenuItem value={RecordingQuality.MEDIUM}>Medium (720p)</MenuItem>
                <MenuItem value={RecordingQuality.HIGH}>High (1080p)</MenuItem>
                <MenuItem value={RecordingQuality.ULTRA}>Ultra (4K)</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Transcription Language</InputLabel>
              <Select
                value={transcriptionSettings.language}
                label="Transcription Language"
                onChange={(e) => setTranscriptionSettings(prev => ({
                  ...prev,
                  language: e.target.value
                }))}
              >
                <MenuItem value="en-US">English (US)</MenuItem>
                <MenuItem value="en-GB">English (UK)</MenuItem>
                <MenuItem value="es-ES">Spanish</MenuItem>
                <MenuItem value="fr-FR">French</MenuItem>
                <MenuItem value="de-DE">German</MenuItem>
                <MenuItem value="it-IT">Italian</MenuItem>
              </Select>
            </FormControl>

            <FormControlLabel
              control={
                <Switch
                  checked={transcriptionSettings.speakerIdentification}
                  onChange={(e) => setTranscriptionSettings(prev => ({
                    ...prev,
                    speakerIdentification: e.target.checked
                  }))}
                />
              }
              label="Speaker Identification"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={transcriptionSettings.medicalTermsEnabled}
                  onChange={(e) => setTranscriptionSettings(prev => ({
                    ...prev,
                    medicalTermsEnabled: e.target.checked
                  }))}
                />
              }
              label="Medical Terms Recognition"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={transcriptionSettings.realTimeTranscription}
                  onChange={(e) => setTranscriptionSettings(prev => ({
                    ...prev,
                    realTimeTranscription: e.target.checked
                  }))}
                />
              }
              label="Real-time Transcription"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSettings(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Full Transcript Dialog */}
      <Dialog
        open={showTranscript}
        onClose={() => setShowTranscript(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Session Transcript</DialogTitle>
        <DialogContent>
          <Paper 
            variant="outlined" 
            sx={{ 
              maxHeight: 400, 
              overflow: 'auto', 
              p: 2,
              backgroundColor: 'background.default'
            }}
          >
            {realtimeEntries.length > 0 ? (
              realtimeEntries.map((entry) => (
                <Box key={entry.id} sx={{ mb: 2 }}>
                  <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                    <Typography variant="subtitle2" color="primary">
                      {entry.speakerName || 'Unknown Speaker'}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {new Date(entry.startTime).toLocaleTimeString()}
                    </Typography>
                    {entry.confidence && (
                      <Chip
                        label={`${Math.round(entry.confidence * 100)}%`}
                        size="small"
                        variant="outlined"
                        color={entry.confidence > 0.8 ? 'success' : 'warning'}
                      />
                    )}
                  </Box>
                  <Typography variant="body1" sx={{ pl: 2 }}>
                    {entry.text}
                  </Typography>
                </Box>
              ))
            ) : (
              <Typography variant="body2" color="textSecondary" align="center">
                No transcript available yet. Start recording and transcription to see content here.
              </Typography>
            )}
          </Paper>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => exportTranscript('pdf')} startIcon={<PictureAsPdf />}>
            Export PDF
          </Button>
          <Button onClick={() => exportTranscript('docx')} startIcon={<SaveAlt />}>
            Export DOCX
          </Button>
          <Button onClick={() => setShowTranscript(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RecordingTranscriptionPanel;