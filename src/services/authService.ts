import { User } from '../types';
import { auditService } from './auditService';
import { apiService } from './apiService';

// Define ApiResponse interface locally since it's not exported from apiService
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
}

interface LoginCredentials {
  username: string;
  password: string;
}

interface LoginResponse {
  user: User;
  access: string;
  refresh: string;
}

interface RefreshTokenResponse {
  access: string;
}

class AuthService {
  private tokenRefreshInterval?: NodeJS.Timeout;

  /**
   * Authenticate user with username and password
   */
  async login(username: string, password: string): Promise<LoginResponse> {
    try {
      const loginData: LoginCredentials = { username, password };
      
      // Log login attempt
      auditService.logEvent('login_attempt', { username });
      
      // Use direct fetch for login since Django returns data directly (not wrapped in ApiResponse)
      const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
      const response = await fetch(`${baseURL}/auth/login/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(loginData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Login failed with status ${response.status}`);
      }

      const rawData: any = await response.json();
      
      // Transform backend response (snake_case) to frontend format (camelCase)
      const data: LoginResponse = {
        access: rawData.access,
        refresh: rawData.refresh,
        user: {
          id: rawData.user.id,
          username: rawData.user.username,
          email: rawData.user.email,
          firstName: rawData.user.first_name,
          lastName: rawData.user.last_name,
          role: rawData.user.role,
          isActive: rawData.user.is_active,
          lastLogin: rawData.user.last_login ? new Date(rawData.user.last_login) : undefined,
          createdAt: rawData.user.created_at ? new Date(rawData.user.created_at) : new Date(),
          updatedAt: rawData.user.updated_at ? new Date(rawData.user.updated_at) : new Date(),
        }
      };
      
      if (data.access) {
        // Store tokens
        localStorage.setItem('access_token', data.access);
        localStorage.setItem('refresh_token', data.refresh);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        // Set authorization header for future requests
        apiService.setAuthToken(data.access);
        
        // Set up automatic token refresh (assuming 24 hour expiry)
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        this.setupTokenRefresh(expiresAt);
        
        // Log successful login
        auditService.logAuth('LOGIN', data.user.id);
      }
      
      return data;
    } catch (error: any) {
      auditService.logEvent('login_failure', { 
        username,
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Logout user and cleanup
   */
  async logout(): Promise<void> {
    try {
      await apiService.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear token refresh interval
      if (this.tokenRefreshInterval) {
        clearInterval(this.tokenRefreshInterval);
        this.tokenRefreshInterval = undefined;
      }
    }
  }

  /**
   * Validate existing token
   */
  async validateToken(token: string): Promise<User | null> {
    try {
      const response = await apiService.post<User>('/auth/validate', {
        token,
      });
      
      if (response.success && response.data) {
        return response.data;
      }
      
      return null;
    } catch (error) {
      console.error('Token validation error:', error);
      return null;
    }
  }

  /**
   * Refresh authentication token
   */
  async refreshToken(): Promise<string | null> {
    try {
      const response = await apiService.post<RefreshTokenResponse>('/auth/refresh');
      
      if (response.success && response.data) {
        // Update stored token
        const token = response.data.access;
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // Assume 24h expiry
        this.setupTokenRefresh(expiresAt);
        
        return token;
      }
      
      return null;
    } catch (error) {
      console.error('Token refresh error:', error);
      return null;
    }
  }

  /**
   * Register new user (admin only)
   */
  async register(userData: Partial<User> & { password: string }): Promise<ApiResponse<User>> {
    try {
      const response = await apiService.post<User>('/auth/register', userData);
      
      if (response.success && response.data) {
        // Log user registration
        await auditService.log({
          action: 'USER_REGISTERED',
          resource: 'user',
          resourceId: response.data.id,
        });
      }
      
      return response;
    } catch (error) {
      console.error('Registration error:', error);
      return {
        success: false,
        message: 'Registration failed',
        errors: ['User registration failed'],
      };
    }
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<ApiResponse<void>> {
    try {
      const response = await apiService.post<void>('/auth/password-reset-request', { email });
      
      // Log password reset request (without sensitive data)
      await auditService.log({
        action: 'PASSWORD_RESET_REQUESTED',
        resource: 'authentication',
        resourceId: email,
      });
      
      return response;
    } catch (error) {
      console.error('Password reset request error:', error);
      return {
        success: false,
        message: 'Password reset request failed',
        errors: ['Unable to process password reset request'],
      };
    }
  }

  /**
   * Reset password with token
   */
  async resetPassword(token: string, newPassword: string): Promise<ApiResponse<void>> {
    try {
      const response = await apiService.post<void>('/auth/password-reset', {
        token,
        password: newPassword,
      });
      
      if (response.success) {
        // Log password reset completion
        await auditService.log({
          action: 'PASSWORD_RESET_COMPLETED',
          resource: 'authentication',
          resourceId: 'user', // We don't have user ID here
        });
      }
      
      return response;
    } catch (error) {
      console.error('Password reset error:', error);
      return {
        success: false,
        message: 'Password reset failed',
        errors: ['Unable to reset password'],
      };
    }
  }

  /**
   * Change user password (authenticated)
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<ApiResponse<void>> {
    try {
      const response = await apiService.post<void>('/auth/change-password', {
        currentPassword,
        newPassword,
      });
      
      if (response.success) {
        // Log password change
        await auditService.log({
          action: 'PASSWORD_CHANGED',
          resource: 'authentication',
          resourceId: 'current_user',
        });
      }
      
      return response;
    } catch (error) {
      console.error('Password change error:', error);
      return {
        success: false,
        message: 'Password change failed',
        errors: ['Unable to change password'],
      };
    }
  }

  /**
   * Enable two-factor authentication
   */
  async enableTwoFactor(): Promise<ApiResponse<{ qrCode: string; backupCodes: string[] }>> {
    try {
      const response = await apiService.post<{ qrCode: string; backupCodes: string[] }>('/auth/2fa/enable');
      
      if (response.success) {
        // Log 2FA enablement
        await auditService.log({
          action: 'TWO_FACTOR_ENABLED',
          resource: 'authentication',
          resourceId: 'current_user',
        });
      }
      
      return response;
    } catch (error) {
      console.error('2FA enable error:', error);
      return {
        success: false,
        message: '2FA setup failed',
        errors: ['Unable to enable two-factor authentication'],
      };
    }
  }

  /**
   * Verify two-factor authentication code
   */
  async verifyTwoFactor(code: string): Promise<ApiResponse<void>> {
    try {
      const response = await apiService.post<void>('/auth/2fa/verify', { code });
      
      if (response.success) {
        // Log successful 2FA verification
        await auditService.log({
          action: 'TWO_FACTOR_VERIFIED',
          resource: 'authentication',
          resourceId: 'current_user',
        });
      }
      
      return response;
    } catch (error) {
      console.error('2FA verification error:', error);
      return {
        success: false,
        message: '2FA verification failed',
        errors: ['Invalid verification code'],
      };
    }
  }

  /**
   * Disable two-factor authentication
   */
  async disableTwoFactor(code: string): Promise<ApiResponse<void>> {
    try {
      const response = await apiService.post<void>('/auth/2fa/disable', { code });
      
      if (response.success) {
        // Log 2FA disabling
        await auditService.log({
          action: 'TWO_FACTOR_DISABLED',
          resource: 'authentication',
          resourceId: 'current_user',
        });
      }
      
      return response;
    } catch (error) {
      console.error('2FA disable error:', error);
      return {
        success: false,
        message: '2FA disable failed',
        errors: ['Unable to disable two-factor authentication'],
      };
    }
  }

  /**
   * Setup automatic token refresh
   */
  private setupTokenRefresh(expiresAt: string): void {
    if (this.tokenRefreshInterval) {
      clearInterval(this.tokenRefreshInterval);
    }

    const expiryTime = new Date(expiresAt).getTime();
    const currentTime = new Date().getTime();
    const timeUntilExpiry = expiryTime - currentTime;
    
    // Refresh token 5 minutes before expiry
    const refreshTime = Math.max(timeUntilExpiry - 5 * 60 * 1000, 60 * 1000);

    this.tokenRefreshInterval = setTimeout(async () => {
      try {
        const newToken = await this.refreshToken();
        
        if (newToken) {
          // Update stored token
          localStorage.setItem('theracare_token', newToken);
        } else {
          // Refresh failed, logout user
          this.logout();
          window.location.href = '/login';
        }
      } catch (error) {
        console.error('Auto token refresh error:', error);
        // Force logout on refresh failure
        this.logout();
        window.location.href = '/login';
      }
    }, refreshTime);
  }

  /**
   * Get current user session information
   */
  async getSessionInfo(): Promise<ApiResponse<{ user: User; sessionExpiry: string }>> {
    try {
      return await apiService.get('/auth/session');
    } catch (error) {
      console.error('Session info error:', error);
      return {
        success: false,
        message: 'Unable to retrieve session information',
        errors: ['Session retrieval failed'],
      };
    }
  }

  /**
   * Get user permissions
   */
  async getUserPermissions(): Promise<ApiResponse<string[]>> {
    try {
      return await apiService.get('/auth/permissions');
    } catch (error) {
      console.error('Permissions retrieval error:', error);
      return {
        success: false,
        message: 'Unable to retrieve permissions',
        errors: ['Permissions retrieval failed'],
      };
    }
  }
}

export const authService = new AuthService();