import React, { useState } from 'react';
import {
  Container,
  Paper,
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  Link,
  Divider,
  FormControlLabel,
  Checkbox,
  CircularProgress,
} from '@mui/material';
import { useFormik } from 'formik';
import * as yup from 'yup';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { useNavigate } from 'react-router-dom';
import ChangePasswordDialog from '../../components/ChangePasswordDialog';

const validationSchema = yup.object({
  username: yup
    .string()
    .required('Username is required')
    .min(3, 'Username must be at least 3 characters'),
  password: yup
    .string()
    .min(12, 'Password must be at least 12 characters')
    .required('Password is required'),
});

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showPasswordChangeDialog, setShowPasswordChangeDialog] = useState(false);
  const [loggedInUsername, setLoggedInUsername] = useState('');
  const { login } = useAuth();
  const { showError, showSuccess } = useNotification();
  const navigate = useNavigate();

  const hasMustChangePassword = (value: unknown): value is { must_change_password?: boolean } => {
    return !!value && typeof value === 'object';
  };

  const handlePasswordChanged = () => {
    setShowPasswordChangeDialog(false);
    showSuccess('Password changed successfully! Redirecting to dashboard...');
    setTimeout(() => {
      navigate('/dashboard');
    }, 1000);
  };

  const formik = useFormik({
    initialValues: {
      username: '',
      password: '',
    },
    validationSchema,
    onSubmit: async (values) => {
      setLoading(true);
      try {
        const success = await login(values.username, values.password);
        
        if (success) {
          // Check if user needs to change password
          const userStr = localStorage.getItem('user');
          if (userStr) {
            const parsedUser: unknown = JSON.parse(userStr);
            if (hasMustChangePassword(parsedUser) && parsedUser.must_change_password === true) {
              // Show password change dialog
              setLoggedInUsername(values.username);
              setShowPasswordChangeDialog(true);
              return;
            }
          }
          
          // Redirect to appropriate dashboard after successful login
          showSuccess('Login successful! Redirecting to dashboard...');
          setTimeout(() => {
            navigate('/dashboard');
          }, 1000);
        } else {
          showError('Invalid username or password. Please try again.');
        }
      } catch (error) {
        showError('Login failed. Please check your connection and try again.');
      } finally {
        setLoading(false);
      }
    },
  });

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          py: 3,
        }}
      >
        <Paper
          elevation={3}
          sx={{
            p: 4,
            width: '100%',
            maxWidth: 400,
            borderRadius: 2,
          }}
        >
          {/* Header */}
          <Box textAlign="center" mb={4}>
            <Typography variant="h4" component="h1" gutterBottom color="primary">
              SafeHaven EHR
            </Typography>
            <Typography variant="h6" component="h2" color="text.secondary">
              Secure EHR Login
            </Typography>
            <Typography variant="body2" color="text.secondary" mt={1}>
              HIPAA-Compliant Electronic Health Records
            </Typography>
          </Box>

          {/* Security Notice */}
          <Alert severity="info" sx={{ mb: 3 }}>
            This is a secure healthcare system. All access is monitored and logged for HIPAA compliance.
          </Alert>

          {/* Login Form */}
          <form onSubmit={formik.handleSubmit}>
            <TextField
              fullWidth
              id="username"
              name="username"
              label="Username"
              type="text"
              value={formik.values.username}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={formik.touched.username && Boolean(formik.errors.username)}
              helperText={formik.touched.username && formik.errors.username}
              margin="normal"
              autoComplete="username"
              autoFocus
            />
            
            <TextField
              fullWidth
              id="password"
              name="password"
              label="Password"
              type="password"
              value={formik.values.password}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={formik.touched.password && Boolean(formik.errors.password)}
              helperText={formik.touched.password && formik.errors.password}
              margin="normal"
              autoComplete="current-password"
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  color="primary"
                />
              }
              label="Remember me on this device"
              sx={{ mt: 1, mb: 2 }}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={loading}
              sx={{ mt: 2, mb: 2, py: 1.5 }}
            >
              {loading ? (
                <>
                  <CircularProgress size={20} sx={{ mr: 1 }} />
                  Signing In...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>

          <Divider sx={{ my: 3 }} />

          {/* Additional Actions */}
          <Box textAlign="center">
            <Link href="#" variant="body2" sx={{ display: 'block', mb: 1 }}>
              Forgot your password?
            </Link>
            <Link href="#" variant="body2">
              Need help accessing your account?
            </Link>
          </Box>

          {/* Footer */}
          <Box mt={4} textAlign="center">
            <Typography variant="caption" color="text.secondary">
              Protected by HIPAA compliance measures
            </Typography>
          </Box>
        </Paper>
      </Box>

      {/* Password Change Required Dialog */}
      <ChangePasswordDialog
        open={showPasswordChangeDialog}
        onPasswordChanged={handlePasswordChanged}
        username={loggedInUsername}
      />
    </Container>
  );
};

export default Login;