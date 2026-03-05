import React from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import { Lock, Home } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const Unauthorized: React.FC = () => {
  const navigate = useNavigate();
  const { state } = useAuth();

  const handleGoHome = () => {
    // Redirect to appropriate dashboard based on user role
    const userRole = state.user?.role as string;
    
    switch (userRole) {
      case 'admin':
        navigate('/admin');
        break;
      case 'therapist':
      case 'staff':
        navigate('/therapist');
        break;
      case 'patient':
      case 'client':
        navigate('/client');
        break;
      default:
        navigate('/login');
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        bgcolor: 'background.default',
      }}
    >
      <Paper
        sx={{
          p: 4,
          maxWidth: 400,
          textAlign: 'center',
          mx: 2,
        }}
      >
        <Lock
          sx={{
            fontSize: 64,
            color: 'error.main',
            mb: 2,
          }}
        />
        
        <Typography variant="h4" gutterBottom color="error">
          Access Denied
        </Typography>
        
        <Typography variant="body1" color="text.secondary" paragraph>
          You don't have permission to access this page. Please contact your administrator if you believe this is an error.
        </Typography>
        
        <Typography variant="body2" color="text.secondary" paragraph>
          Current role: <strong>{state.user?.role || 'Unknown'}</strong>
        </Typography>
        
        <Button
          variant="contained"
          startIcon={<Home />}
          onClick={handleGoHome}
          sx={{ mt: 2 }}
        >
          Go to My Dashboard
        </Button>
      </Paper>
    </Box>
  );
};