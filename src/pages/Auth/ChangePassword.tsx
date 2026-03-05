import React, { useState } from 'react';
import {
  Container,
  Paper,
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material';
import { useFormik } from 'formik';
import * as yup from 'yup';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../../services/apiService';
import { useNotification } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';

const validationSchema = yup.object({
  currentPassword: yup
    .string()
    .required('Current password is required'),
  newPassword: yup
    .string()
    .min(12, 'Password must be at least 12 characters')
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    )
    .required('New password is required'),
  newPasswordConfirm: yup
    .string()
    .oneOf([yup.ref('newPassword')], 'Passwords must match')
    .required('Please confirm your new password'),
});

const ChangePassword: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [isRequired, setIsRequired] = useState(false);
  const { showError, showSuccess } = useNotification();
  const { updateUser } = useAuth();
  const navigate = useNavigate();

  // Check if password change is required
  React.useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      setIsRequired(user.must_change_password === true);
    }
  }, []);

  const formik = useFormik({
    initialValues: {
      currentPassword: '',
      newPassword: '',
      newPasswordConfirm: '',
    },
    validationSchema,
    onSubmit: async (values) => {
      setLoading(true);
      try {
        await apiService.post('/users/password/change/', {
          current_password: values.currentPassword,
          new_password: values.newPassword,
          new_password_confirm: values.newPasswordConfirm,
        });

        // Update user object to clear must_change_password flag
        const userStr = localStorage.getItem('user');
        if (userStr) {
          const user = JSON.parse(userStr);
          user.must_change_password = false;
          localStorage.setItem('user', JSON.stringify(user));
          updateUser({ must_change_password: false });
        }

        showSuccess('Password changed successfully!');
        
        setTimeout(() => {
          navigate('/dashboard');
        }, 1500);
      } catch (error: any) {
        const errorMessage = error.response?.data?.current_password?.[0] || 
                           error.response?.data?.new_password?.[0] || 
                           error.response?.data?.new_password_confirm?.[0] ||
                           'Failed to change password. Please try again.';
        showError(errorMessage);
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
            maxWidth: 500,
            borderRadius: 2,
          }}
        >
          {/* Header */}
          <Box textAlign="center" mb={4}>
            <Typography variant="h4" component="h1" gutterBottom color="primary">
              Change Password
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {isRequired 
                ? 'You must change your temporary password before continuing.'
                : 'Update your password to keep your account secure.'
              }
            </Typography>
          </Box>

          {/* Security Notice */}
          {isRequired && (
            <Alert severity="warning" sx={{ mb: 3 }}>
              <strong>Password Change Required:</strong> For your security, you must change your temporary password before accessing the system.
            </Alert>
          )}

          {/* Password Requirements */}
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2" fontWeight="bold" gutterBottom>
              Password Requirements:
            </Typography>
            <Typography variant="body2" component="ul" sx={{ pl: 2, mb: 0 }}>
              <li>At least 12 characters long</li>
              <li>Contains uppercase and lowercase letters</li>
              <li>Contains at least one number</li>
              <li>Different from your current password</li>
            </Typography>
          </Alert>

          {/* Change Password Form */}
          <form onSubmit={formik.handleSubmit}>
            <TextField
              fullWidth
              id="currentPassword"
              name="currentPassword"
              label="Current Password"
              type="password"
              value={formik.values.currentPassword}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={formik.touched.currentPassword && Boolean(formik.errors.currentPassword)}
              helperText={formik.touched.currentPassword && formik.errors.currentPassword}
              margin="normal"
              autoComplete="current-password"
              autoFocus
            />
            
            <TextField
              fullWidth
              id="newPassword"
              name="newPassword"
              label="New Password"
              type="password"
              value={formik.values.newPassword}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={formik.touched.newPassword && Boolean(formik.errors.newPassword)}
              helperText={formik.touched.newPassword && formik.errors.newPassword}
              margin="normal"
              autoComplete="new-password"
            />

            <TextField
              fullWidth
              id="newPasswordConfirm"
              name="newPasswordConfirm"
              label="Confirm New Password"
              type="password"
              value={formik.values.newPasswordConfirm}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={formik.touched.newPasswordConfirm && Boolean(formik.errors.newPasswordConfirm)}
              helperText={formik.touched.newPasswordConfirm && formik.errors.newPasswordConfirm}
              margin="normal"
              autoComplete="new-password"
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={loading}
              sx={{ mt: 3, mb: 2 }}
            >
              {loading ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                'Change Password'
              )}
            </Button>

            {!isRequired && (
              <Button
                fullWidth
                variant="text"
                onClick={() => navigate('/dashboard')}
                disabled={loading}
              >
                Cancel
              </Button>
            )}
          </form>
        </Paper>
      </Box>
    </Container>
  );
};

export default ChangePassword;
