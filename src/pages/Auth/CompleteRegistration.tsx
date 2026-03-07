import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Container,
  InputAdornment,
  IconButton,
} from '@mui/material';
import { Visibility, VisibilityOff, CheckCircle, Person, Lock } from '@mui/icons-material';
import axios from 'axios';
import { apiClient } from '../../services/apiClient';

interface TokenData {
  token: string;
  email: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  is_valid: boolean;
}

interface RegistrationTokens {
  access: string;
  refresh: string;
}

interface CompleteRegistrationResponse {
  tokens?: RegistrationTokens;
}

const CompleteRegistration: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    password_confirm: ''
  });
  
  const [formErrors, setFormErrors] = useState({
    username: '',
    password: '',
    password_confirm: ''
  });

  const toRecord = (value: unknown): Record<string, unknown> | null => {
    if (value && typeof value === 'object') {
      return value as Record<string, unknown>;
    }
    return null;
  };

  const firstString = (value: unknown): string | null => {
    if (typeof value === 'string') return value;
    if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
    return null;
  };

  useEffect(() => {
    void validateToken();
  }, [token]);

  const validateToken = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiClient.post<TokenData>('/auth/registration/validate-token/', { token });
      setTokenData(response.data);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const data = toRecord(err.response?.data);
        const message = firstString(data?.error);
        setError(message || 'Invalid or expired registration link');
      } else {
        setError('Invalid or expired registration link');
      }
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const errors = {
      username: '',
      password: '',
      password_confirm: ''
    };
    
    let isValid = true;
    
    if (!formData.username.trim()) {
      errors.username = 'Username is required';
      isValid = false;
    } else if (formData.username.length < 3) {
      errors.username = 'Username must be at least 3 characters';
      isValid = false;
    }
    
    if (!formData.password) {
      errors.password = 'Password is required';
      isValid = false;
    } else if (formData.password.length < 12) {
      errors.password = 'Password must be at least 12 characters';
      isValid = false;
    } else if (!/[A-Z]/.test(formData.password)) {
      errors.password = 'Password must include at least one uppercase letter';
      isValid = false;
    } else if (!/[a-z]/.test(formData.password)) {
      errors.password = 'Password must include at least one lowercase letter';
      isValid = false;
    } else if (!/[0-9]/.test(formData.password)) {
      errors.password = 'Password must include at least one number';
      isValid = false;
    } else if (!/[!@#$%^&*(),.?":{}|<>]/.test(formData.password)) {
      errors.password = 'Password must include at least one special character';
      isValid = false;
    }
    
    if (!formData.password_confirm) {
      errors.password_confirm = 'Please confirm your password';
      isValid = false;
    } else if (formData.password !== formData.password_confirm) {
      errors.password_confirm = 'Passwords do not match';
      isValid = false;
    }
    
    setFormErrors(errors);
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setSubmitting(true);
    setError(null);
    
    try {
      const response = await apiClient.post<CompleteRegistrationResponse>('/auth/registration/complete/', {
        token,
        username: formData.username,
        password: formData.password,
        password_confirm: formData.password_confirm
      });
      
      // Store the tokens
      if (response.data.tokens?.access && response.data.tokens?.refresh) {
        localStorage.setItem('access_token', response.data.tokens.access);
        localStorage.setItem('refresh_token', response.data.tokens.refresh);
      }
      
      setSuccess(true);
      
      // Redirect to patient dashboard after 2 seconds
      setTimeout(() => {
        navigate('/client');
      }, 2000);
      
    } catch (err: unknown) {
      const errorData = axios.isAxiosError(err) ? toRecord(err.response?.data) : null;
      
      if (errorData) {
        const newErrors = { ...formErrors };

        const usernameError = firstString(errorData.username);
        if (usernameError) {
          newErrors.username = usernameError;
        }

        const passwordValue = errorData.password;
        if (Array.isArray(passwordValue)) {
          newErrors.password = passwordValue.map((entry) => String(entry)).join(' ');
        } else {
          const passwordError = firstString(passwordValue);
          if (passwordError) {
            newErrors.password = passwordError;
          }
        }

        const passwordConfirmError = firstString(errorData.password_confirm);
        if (passwordConfirmError) {
          newErrors.password_confirm = passwordConfirmError;
        }

        setFormErrors(newErrors);

        const generalError = firstString(errorData.error) || firstString(errorData.detail);
        if (generalError) {
          setError(generalError);
        }
      } else {
        setError('Registration failed. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="sm">
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error && !tokenData) {
    return (
      <Container maxWidth="sm">
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
          <Card>
            <CardContent sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="h5" color="error" gutterBottom>
                Invalid Registration Link
              </Typography>
              <Alert severity="error" sx={{ mt: 2 }}>
                {error}
              </Alert>
              <Button
                variant="contained"
                onClick={() => navigate('/login')}
                sx={{ mt: 3 }}
              >
                Go to Login
              </Button>
            </CardContent>
          </Card>
        </Box>
      </Container>
    );
  }

  if (success) {
    return (
      <Container maxWidth="sm">
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
          <Card>
            <CardContent sx={{ p: 4, textAlign: 'center' }}>
              <CheckCircle color="success" sx={{ fontSize: 60, mb: 2 }} />
              <Typography variant="h5" gutterBottom>
                Registration Complete!
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Redirecting you to your dashboard...
              </Typography>
            </CardContent>
          </Card>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm">
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', py: 4 }}>
        <Card sx={{ width: '100%' }}>
          <CardContent sx={{ p: 4 }}>
            <Box sx={{ textAlign: 'center', mb: 4 }}>
              <Typography variant="h4" gutterBottom>
                Complete Your Registration
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Welcome to Safe Haven, {tokenData?.first_name}!
              </Typography>
            </Box>

            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
            )}

            <Box component="form" onSubmit={(event) => {
              void handleSubmit(event);
            }}>
              {/* Pre-filled information (read-only) */}
              <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Your Information
                </Typography>
                <Typography variant="body2">
                  <strong>Name:</strong> {tokenData?.first_name} {tokenData?.last_name}
                </Typography>
                <Typography variant="body2">
                  <strong>Email:</strong> {tokenData?.email}
                </Typography>
                {tokenData?.phone_number && (
                  <Typography variant="body2">
                    <strong>Phone:</strong> {tokenData.phone_number}
                  </Typography>
                )}
              </Box>

              <Typography variant="subtitle1" gutterBottom sx={{ mt: 3, mb: 2 }}>
                Create Your Login Credentials
              </Typography>

              <TextField
                fullWidth
                label="Username"
                value={formData.username}
                onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                error={!!formErrors.username}
                helperText={formErrors.username || 'Choose a unique username for logging in'}
                required
                sx={{ mb: 2 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Person />
                    </InputAdornment>
                  ),
                }}
              />

              <TextField
                fullWidth
                type={showPassword ? 'text' : 'password'}
                label="Password"
                value={formData.password}
                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                error={!!formErrors.password}
                helperText={formErrors.password || 'Min 12 chars, uppercase, lowercase, number, and special character'}
                required
                sx={{ mb: 2 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Lock />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              <TextField
                fullWidth
                type={showConfirmPassword ? 'text' : 'password'}
                label="Confirm Password"
                value={formData.password_confirm}
                onChange={(e) => setFormData(prev => ({ ...prev, password_confirm: e.target.value }))}
                error={!!formErrors.password_confirm}
                helperText={formErrors.password_confirm}
                required
                sx={{ mb: 3 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Lock />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        edge="end"
                      >
                        {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              <Button
                type="submit"
                variant="contained"
                fullWidth
                size="large"
                disabled={submitting}
                sx={{ py: 1.5 }}
              >
                {submitting ? <CircularProgress size={24} /> : 'Complete Registration'}
              </Button>

              <Box sx={{ mt: 2, textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">
                  By completing registration, you agree to our Terms of Service and Privacy Policy
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
};

export default CompleteRegistration;
