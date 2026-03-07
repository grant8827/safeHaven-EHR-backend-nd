import React, { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: UserRole | UserRole[] | string | string[];
  requireAuth?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
  requireAuth = true,
}) => {
  const { state } = useAuth();
  const location = useLocation();

  // Custom role checker that handles both string and enum roles
  const checkRole = (required: UserRole | UserRole[] | string | string[]): boolean => {
    if (!state.user) return false;
    
    const userRole = state.user.role as string;
    
    if (Array.isArray(required)) {
      return required.some(role => {
        const roleStr = typeof role === 'string' ? role : String(role);
        return userRole === roleStr;
      });
    } else {
      const requiredStr = typeof required === 'string' ? required : String(required);
      return userRole === requiredStr;
    }
  };

  // Show loading spinner while checking authentication
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

  // Check if authentication is required
  if (requireAuth && !state.isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check role requirements
  if (requiredRole && state.isAuthenticated && !checkRole(requiredRole)) {
    return <Navigate to="/unauthorized" replace />;
  }

  // Render children if all checks pass
  return <>{children}</>;
};