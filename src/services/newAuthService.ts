import { User } from '../types';
import { auditService } from './auditService';

interface LoginCredentials {
  username: string;
  password: string;
}

interface LoginResponse {
  user: User;
  access: string;
  refresh: string;
}

interface RegistrationData {
  username: string;
  email: string;
  password: string;
  password_confirm: string;
  first_name: string;
  last_name: string;
  role: 'client' | 'staff' | 'therapist' | 'admin';
  phone_number?: string;
}

class AuthService {
  private tokenRefreshInterval?: NodeJS.Timeout;

  /**
   * Get authorization headers with current token
   */
  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('access_token');
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }

  /**
   * Make authenticated API request
   */
  private async apiRequest<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`/api/v1${endpoint}`, {
      ...options,
      headers: {
        ...this.getAuthHeaders(),
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || errorData.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  /**
   * Authenticate user with username and password
   */
  async login(username: string, password: string): Promise<LoginResponse> {
    try {
      const loginData: LoginCredentials = { username, password };
      
      // Log login attempt
      auditService.logEvent('login_attempt', { username });
      
      const data = await this.apiRequest<LoginResponse>('/users/auth/login/', {
        method: 'POST',
        body: JSON.stringify(loginData),
      });
      
      if (data.access) {
        // Store tokens and user data
        localStorage.setItem('access_token', data.access);
        localStorage.setItem('refresh_token', data.refresh);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        // Set up automatic token refresh
        this.setupTokenRefresh();
        
        // Log successful login
        auditService.logEvent('login_success', { 
          userId: data.user.id,
          role: data.user.role
        });
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
      const refreshToken = localStorage.getItem('refresh_token');
      
      if (refreshToken) {
        await this.apiRequest('/users/auth/logout/', {
          method: 'POST',
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear stored data
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      
      // Clear token refresh interval
      if (this.tokenRefreshInterval) {
        clearInterval(this.tokenRefreshInterval);
        this.tokenRefreshInterval = undefined;
      }
      
      // Log logout
      auditService.logEvent('logout', {});
    }
  }

  /**
   * Register new user
   */
  async register(userData: RegistrationData): Promise<User> {
    try {
      const data = await this.apiRequest<User>('/users/auth/register/', {
        method: 'POST',
        body: JSON.stringify(userData),
      });
      
      // Log user registration
      auditService.logEvent('user_registered', {
        userId: data.id,
        username: userData.username,
        role: userData.role
      });
      
      return data;
    } catch (error: any) {
      auditService.logEvent('registration_failure', {
        username: userData.username,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Refresh authentication token
   */
  async refreshToken(): Promise<string | null> {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await fetch('/api/v1/users/auth/refresh/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh: refreshToken }),
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const data = await response.json();
      
      if (data.access) {
        localStorage.setItem('access_token', data.access);
        this.setupTokenRefresh();
        return data.access;
      }
      
      return null;
    } catch (error) {
      console.error('Token refresh error:', error);
      // Force logout on refresh failure
      this.logout();
      return null;
    }
  }

  /**
   * Get current user information
   */
  async getCurrentUser(): Promise<User | null> {
    try {
      const user = await this.apiRequest<User>('/users/current/');
      
      // Update stored user data
      localStorage.setItem('user', JSON.stringify(user));
      
      return user;
    } catch (error) {
      console.error('Get current user error:', error);
      return null;
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(userData: Partial<User>): Promise<User> {
    try {
      const data = await this.apiRequest<User>('/users/profile/', {
        method: 'PUT',
        body: JSON.stringify(userData),
      });
      
      // Update stored user data
      localStorage.setItem('user', JSON.stringify(data));
      
      // Log profile update
      auditService.logEvent('profile_updated', {
        userId: data.id
      });
      
      return data;
    } catch (error: any) {
      auditService.logEvent('profile_update_failure', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Change user password
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    try {
      await this.apiRequest('/users/auth/password/change/', {
        method: 'POST',
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
          new_password_confirm: newPassword,
        }),
      });
      
      // Log password change
      auditService.logEvent('password_changed', {});
    } catch (error: any) {
      auditService.logEvent('password_change_failure', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<void> {
    try {
      await this.apiRequest('/users/auth/password/reset/', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      
      // Log password reset request
      auditService.logEvent('password_reset_requested', {
        email
      });
    } catch (error: any) {
      auditService.logEvent('password_reset_request_failure', {
        email,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Confirm password reset with token
   */
  async confirmPasswordReset(
    uidb64: string, 
    token: string, 
    newPassword: string
  ): Promise<void> {
    try {
      await this.apiRequest(`/users/auth/password/reset/confirm/${uidb64}/${token}/`, {
        method: 'POST',
        body: JSON.stringify({
          token,
          new_password: newPassword,
          new_password_confirm: newPassword,
        }),
      });
      
      // Log password reset completion
      auditService.logEvent('password_reset_completed', {});
    } catch (error: any) {
      auditService.logEvent('password_reset_failure', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    const token = localStorage.getItem('access_token');
    const user = localStorage.getItem('user');
    return !!(token && user);
  }

  /**
   * Get stored user data
   */
  getStoredUser(): User | null {
    try {
      const userStr = localStorage.getItem('user');
      return userStr ? JSON.parse(userStr) : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get stored access token
   */
  getAccessToken(): string | null {
    return localStorage.getItem('access_token');
  }

  /**
   * Setup automatic token refresh
   */
  private setupTokenRefresh(): void {
    // Clear existing interval
    if (this.tokenRefreshInterval) {
      clearInterval(this.tokenRefreshInterval);
    }

    // Refresh token every 14 minutes (JWT tokens typically expire in 15 minutes)
    this.tokenRefreshInterval = setInterval(async () => {
      try {
        await this.refreshToken();
      } catch (error) {
        console.error('Auto token refresh error:', error);
        // Force logout on refresh failure
        this.logout();
        window.location.href = '/login';
      }
    }, 14 * 60 * 1000); // 14 minutes
  }

  /**
   * Validate token and get user info
   */
  async validateToken(): Promise<User | null> {
    try {
      return await this.getCurrentUser();
    } catch (error) {
      console.error('Token validation error:', error);
      this.logout();
      return null;
    }
  }
}

export const authService = new AuthService();