import axios, {
  AxiosError,
  AxiosHeaders,
  AxiosInstance,
  AxiosProgressEvent,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';
import { ApiResponse, PaginatedResponse } from '../types';
import { encryptionService } from './encryptionService';

class ApiService {
  private client: AxiosInstance;
  private baseURL: string;
  private isRefreshing: boolean = false;
  private refreshSubscribers: ((token: string) => void)[] = [];

  constructor() {
    this.baseURL = import.meta.env.VITE_API_BASE_URL || '/api';
    
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000, // 30 seconds
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setHeader(config: AxiosRequestConfig, key: string, value: string): void {
    if (config.headers instanceof AxiosHeaders) {
      config.headers.set(key, value);
      return;
    }

    const currentHeaders = config.headers as Record<string, string> | undefined;
    config.headers = {
      ...(currentHeaders ?? {}),
      [key]: value,
    };
  }

  private getErrorStatus(error: unknown): number | undefined {
    return axios.isAxiosError(error) ? error.response?.status : undefined;
  }

  private parseUnknownRecord(value: unknown): Record<string, unknown> | null {
    if (value && typeof value === 'object') {
      return value as Record<string, unknown>;
    }
    return null;
  }

  private getErrorMessageFromUnknown(error: unknown): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }
    return 'Unknown error';
  }

  private getStatusText(error: unknown): string {
    if (axios.isAxiosError(error) && typeof error.response?.statusText === 'string' && error.response.statusText) {
      return error.response.statusText;
    }
    return 'Request failed';
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // Add authentication token
        const token = this.getStoredToken();
        if (token) {
          this.setHeader(config, 'Authorization', `Bearer ${token}`);
        }

        // Add CSRF token for state-changing requests
        if (['post', 'put', 'patch', 'delete'].includes(config.method || '')) {
          const csrfToken = this.getCSRFToken();
          if (csrfToken) {
            this.setHeader(config, 'X-CSRFToken', csrfToken);
          }
        }

        // Encrypt sensitive data in request body
        if (config.data && this.shouldEncryptRequest(config.url || '')) {
          config.data = this.encryptRequestData(config.data);
        }

        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        // Decrypt sensitive data in response
        if (response.data && this.shouldDecryptResponse(response.config.url || '')) {
          response.data = this.decryptResponseData(response.data);
        }
        return response;
      },
      async (error: unknown) => {
        const axiosError = error as AxiosError;
        const originalRequest = (axiosError.config ?? {}) as InternalAxiosRequestConfig & { _retry?: boolean };

        // Handle 401 Unauthorized - try to refresh token
        if (this.getErrorStatus(error) === 401 && !originalRequest._retry) {
          if (this.isRefreshing) {
            // If already refreshing, wait for the new token
            return new Promise((resolve) => {
              this.refreshSubscribers.push((token: string) => {
                this.setHeader(originalRequest, 'Authorization', `Bearer ${token}`);
                resolve(this.client(originalRequest));
              });
            });
          }

          originalRequest._retry = true;
          this.isRefreshing = true;

          try {
            const newToken = await this.refreshToken();
            
            if (newToken) {
              // Update token in storage
              localStorage.setItem('access_token', newToken);
              
              // Update the failed request with new token
              this.setHeader(originalRequest, 'Authorization', `Bearer ${newToken}`);
              
              // Retry all queued requests with new token
              this.refreshSubscribers.forEach(callback => callback(newToken));
              this.refreshSubscribers = [];
              
              // Retry the original request
              return this.client(originalRequest);
            }
          } catch (refreshError) {
            // Refresh failed - log out user
            this.handleUnauthorized();
            return Promise.reject(refreshError);
          } finally {
            this.isRefreshing = false;
          }
        }

        if (this.getErrorStatus(error) === 403) {
          // Insufficient permissions
          this.handleForbidden();
        }
        
        return Promise.reject(error);
      }
    );
  }

  private async refreshToken(): Promise<string | null> {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      // Use the same base URL as the main API client
      // this.baseURL is already set from VITE_API_BASE_URL and includes '/api'
      const response = await axios.post(
        `${this.baseURL}/auth/refresh/`,
        { refresh: refreshToken },
        {
          headers: { 'Content-Type': 'application/json' }
        }
      );

      const responseData = this.parseUnknownRecord(response.data);
      const accessToken = responseData?.access;
      return typeof accessToken === 'string' ? accessToken : null;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return null;
    }
  }

  private getStoredToken(): string | null {
    try {
      // Try access_token first (plain token for API calls)
      const accessToken = localStorage.getItem('access_token');
      if (accessToken) {
        return accessToken;
      }
      
      // Fallback to encrypted token
      const encryptedToken = localStorage.getItem('theracare_token');
      return encryptedToken ? encryptionService.decrypt(encryptedToken) : null;
    } catch (error) {
      console.error('Error retrieving token:', error);
      return null;
    }
  }

  private getCSRFToken(): string | null {
    // Extract CSRF token from meta tag or cookie
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : null;
  }

  private shouldEncryptRequest(url: string): boolean {
    // Define endpoints that require encryption
    // Note: Patient endpoint does NOT need request encryption - 
    // the backend handles field-level encryption internally
    const encryptedEndpoints = [
      '/messages/',
      '/soap-notes/',
      '/billing/',
    ];
    return encryptedEndpoints.some(endpoint => url.includes(endpoint));
  }

  private shouldDecryptResponse(url: string): boolean {
    return this.shouldEncryptRequest(url);
  }

  private encryptRequestData(data: unknown): unknown {
    try {
      return {
        encrypted_data: encryptionService.encrypt(JSON.stringify(data)),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error encrypting request data:', error);
      return data; // Fallback to unencrypted data
    }
  }

  private decryptResponseData(data: unknown): unknown {
    try {
      const responseData = this.parseUnknownRecord(data);
      const encryptedData = responseData?.encrypted_data;

      if (typeof encryptedData === 'string') {
        const decryptedString = encryptionService.decrypt(encryptedData);
        return JSON.parse(decryptedString);
      }
      return data;
    } catch (error) {
      console.error('Error decrypting response data:', error);
      return data; // Fallback to original data
    }
  }

  private handleUnauthorized(): void {
    // Clear all stored credentials
    localStorage.removeItem('theracare_token');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    
    // Redirect to login
    window.location.href = '/login';
  }

  private handleForbidden(): void {
    // Show access denied message
    console.error('Access denied - insufficient permissions');
  }

  // Generic GET request
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response: AxiosResponse<ApiResponse<T>> = await this.client.get(url, config);
      return response.data;
    } catch (error: unknown) {
      return this.handleError<T>(error);
    }
  }

  // Generic POST request
  async post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response: AxiosResponse<ApiResponse<T>> = await this.client.post(url, data, config);
      return response.data;
    } catch (error: unknown) {
      return this.handleError<T>(error);
    }
  }

  // Generic PUT request
  async put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response: AxiosResponse<ApiResponse<T>> = await this.client.put(url, data, config);
      return response.data;
    } catch (error: unknown) {
      return this.handleError<T>(error);
    }
  }

  // Generic PATCH request
  async patch<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response: AxiosResponse<ApiResponse<T>> = await this.client.patch(url, data, config);
      return response.data;
    } catch (error: unknown) {
      return this.handleError<T>(error);
    }
  }

  // Generic DELETE request
  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response: AxiosResponse<ApiResponse<T>> = await this.client.delete(url, config);
      return response.data;
    } catch (error: unknown) {
      return this.handleError<T>(error);
    }
  }

  // Paginated GET request
  async getPaginated<T>(
    url: string, 
    params?: { page?: number; limit?: number; [key: string]: unknown },
    config?: AxiosRequestConfig
  ): Promise<PaginatedResponse<T>> {
    try {
      const response: AxiosResponse<PaginatedResponse<T>> = await this.client.get(url, {
        ...config,
        params: {
          page: 1,
          limit: 20,
          ...params,
        },
      });
      return response.data;
    } catch (error: unknown) {
      return this.handlePaginatedError<T>(error, params?.page || 1, params?.limit || 20);
    }
  }

  // File upload
  async uploadFile(
    url: string,
    file: File,
    onProgress?: (progressEvent: AxiosProgressEvent) => void
  ): Promise<ApiResponse<Record<string, unknown>>> {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response: AxiosResponse<ApiResponse<Record<string, unknown>>> = await this.client.post(url, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: onProgress,
      });

      return response.data;
    } catch (error: unknown) {
      return this.handleError<Record<string, unknown>>(error);
    }
  }

  // Download file
  async downloadFile(url: string, filename: string): Promise<void> {
    try {
      const response = await this.client.get(url, {
        responseType: 'blob',
      });

      const blob = new Blob([response.data]);
      const downloadUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Error downloading file:', error);
      throw error;
    }
  }

  private handleError<T>(error: unknown): ApiResponse<T> {
    if (axios.isAxiosError(error) && error.response) {
      // Server responded with an error status
      const responseData = this.parseUnknownRecord(error.response.data);
      
      // Check if it's a Django REST Framework validation error format
      // DRF returns: { "field_name": ["error message"], ... }
      if (responseData && !responseData.message && !responseData.errors) {
        // Parse Django validation errors
        const errors: string[] = [];
        let firstError = '';
        
        Object.keys(responseData).forEach(field => {
          const fieldErrors = responseData[field];
          if (Array.isArray(fieldErrors)) {
            fieldErrors.forEach((err) => {
              const errorMsg = `${field}: ${String(err)}`;
              errors.push(errorMsg);
              if (!firstError) firstError = errorMsg;
            });
          } else if (typeof fieldErrors === 'string') {
            const errorMsg = `${field}: ${fieldErrors}`;
            errors.push(errorMsg);
            if (!firstError) firstError = errorMsg;
          }
        });
        
        return {
          success: false,
          message: firstError || 'Validation error',
          errors,
          data: responseData as T,
        };
      }
      
      // Standard error format
      const message = responseData && typeof responseData.message === 'string' ? responseData.message : 'An error occurred';
      const parsedErrors = responseData?.errors;
      const errors = Array.isArray(parsedErrors)
        ? parsedErrors.map((entry) => String(entry))
        : [this.getStatusText(error)];
      
      return {
        success: false,
        message,
        errors,
        data: responseData as T,
      };
    } else if (axios.isAxiosError(error) && error.request) {
      // Network error
      return {
        success: false,
        message: 'Network error - please check your connection',
        errors: ['Network error'],
      };
    } else {
      // Other error
      return {
        success: false,
        message: this.getErrorMessageFromUnknown(error) || 'An unexpected error occurred',
        errors: [this.getErrorMessageFromUnknown(error)],
      };
    }
  }

  private handlePaginatedError<T>(error: unknown, page: number, limit: number): PaginatedResponse<T> {
    if (axios.isAxiosError(error) && error.response) {
      // Server responded with an error status
      return {
        success: false,
        data: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
        },
      };
    } else if (axios.isAxiosError(error) && error.request) {
      // Network error
      return {
        success: false,
        data: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
        },
      };
    } else {
      // Other error
      return {
        success: false,
        data: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
        },
      };
    }
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.get('/health');
      return response.success;
    } catch (error) {
      return false;
    }
  }

  // Notification methods
  async getNotifications(): Promise<ApiResponse<Record<string, unknown>>> {
    return this.get<Record<string, unknown>>('/notifications/notifications/');
  }

  async getUnreadNotificationCount(): Promise<ApiResponse<Record<string, unknown>>> {
    return this.get<Record<string, unknown>>('/notifications/unread_count/');
  }

  async markNotificationAsRead(notificationId: string): Promise<ApiResponse<Record<string, unknown>>> {
    return this.post<Record<string, unknown>>(`/notifications/${notificationId}/mark_read/`, {});
  }

  async markAllNotificationsAsRead(): Promise<ApiResponse<Record<string, unknown>>> {
    return this.post<Record<string, unknown>>('/notifications/mark_all_read/', {});
  }

  // Set authentication token
  setAuthToken(token: string): void {
    if (token) {
      this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      localStorage.setItem('auth_token', token);
    } else {
      delete this.client.defaults.headers.common['Authorization'];
      localStorage.removeItem('auth_token');
    }
  }

  // Get current auth token
  getAuthToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  // Clear authentication
  clearAuth(): void {
    this.setAuthToken('');
  }
}

export const apiService = new ApiService();