import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { CircularProgress, Box } from '@mui/material';

export const DashboardRedirect: React.FC = () => {
  const { state } = useAuth();

  // Show loading while checking authentication
  if (state.isLoading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
      >
        <CircularProgress size={60} />
      </Box>
    );
  }

  // Redirect to login if not authenticated
  if (!state.isAuthenticated || !state.user) {
    return <Navigate to="/login" replace />;
  }

  // Route users to their appropriate dashboard based on role
  const userRole = state.user.role as string;

  switch (userRole) {
    case 'admin':
      return <Navigate to="/admin" replace />;
    case 'therapist':
      return <Navigate to="/therapist" replace />;
    case 'patient':
    case 'client':
      return <Navigate to="/client" replace />;
    case 'staff':
      return <Navigate to="/staff" replace />;
    default:
      // Default to client dashboard for unknown roles
      return <Navigate to="/client" replace />;
  }
};