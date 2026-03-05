import { User } from '../types';

interface UserListResponse {
  results: User[];
  count: number;
  next: string | null;
  previous: string | null;
}

interface CreateUserRequest {
  username: string;
  email: string;
  password: string;
  password_confirm: string;
  first_name: string;
  last_name: string;
  role: 'client' | 'staff' | 'therapist' | 'admin';
  phone_number?: string;
  is_active?: boolean;
}

interface UpdateUserRequest {
  email?: string;
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  is_active?: boolean;
}

class UserManagementService {
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
   * Get list of all users (admin only)
   */
  async getUsers(params?: {
    role?: string;
    is_active?: boolean;
    search?: string;
    page?: number;
  }): Promise<UserListResponse> {
    const searchParams = new URLSearchParams();
    
    if (params?.role) searchParams.append('role', params.role);
    if (params?.is_active !== undefined) searchParams.append('is_active', params.is_active.toString());
    if (params?.search) searchParams.append('search', params.search);
    if (params?.page) searchParams.append('page', params.page.toString());

    const queryString = searchParams.toString();
    const endpoint = `/users/${queryString ? `?${queryString}` : ''}`;

    return this.apiRequest<UserListResponse>(endpoint);
  }

  /**
   * Get user details by ID
   */
  async getUser(userId: string): Promise<User> {
    return this.apiRequest<User>(`/users/${userId}/`);
  }

  /**
   * Create new user (admin only)
   */
  async createUser(userData: CreateUserRequest): Promise<User> {
    return this.apiRequest<User>('/users/auth/register/', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  /**
   * Update user information
   */
  async updateUser(userId: string, userData: UpdateUserRequest): Promise<User> {
    return this.apiRequest<User>(`/users/${userId}/`, {
      method: 'PATCH',
      body: JSON.stringify(userData),
    });
  }

  /**
   * Deactivate user account
   */
  async deactivateUser(userId: string): Promise<void> {
    await this.apiRequest(`/users/${userId}/`, {
      method: 'DELETE',
    });
  }

  /**
   * Unlock user account (admin only)
   */
  async unlockUserAccount(userId: string): Promise<{ message: string }> {
    return this.apiRequest<{ message: string }>(`/users/${userId}/unlock/`, {
      method: 'POST',
    });
  }

  /**
   * Force password change on next login (admin only)
   */
  async forcePasswordChange(userId: string): Promise<{ message: string }> {
    return this.apiRequest<{ message: string }>(`/users/${userId}/force-password-change/`, {
      method: 'POST',
    });
  }

  /**
   * Get current user profile
   */
  async getCurrentUserProfile(): Promise<User> {
    return this.apiRequest<User>('/users/current/');
  }

  /**
   * Update current user profile
   */
  async updateCurrentUserProfile(userData: UpdateUserRequest): Promise<User> {
    return this.apiRequest<User>('/users/profile/', {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  }
}

export const userManagementService = new UserManagementService();