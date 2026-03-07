import { 
  PatientSettings, 
  ProfileSettings, 
  NotificationSettings, 
  PrivacySettings, 
  UserPreferences, 
  SecuritySettings, 
  AccessibilitySettings,
  ApiResponse 
} from '../types';
import { apiService } from './apiService';

class SettingsService {
  private baseUrl = '/api/settings';

  /**
   * Get all patient settings
   */
  async getPatientSettings(patientId?: string): Promise<ApiResponse<PatientSettings>> {
    try {
      const url = patientId ? `${this.baseUrl}/${patientId}` : this.baseUrl;
      const response = await apiService.get(url);
      return response as any;
    } catch (error) {
      console.error('Error fetching patient settings:', error);
      return {
        success: false,
        message: 'Failed to fetch settings',
        errors: ['Unable to load settings at this time'],
      };
    }
  }

  /**
   * Update profile settings
   */
  async updateProfileSettings(
    patientId: string,
    profileSettings: Partial<ProfileSettings>
  ): Promise<ApiResponse<ProfileSettings>> {
    try {
      const response = await apiService.put(`${this.baseUrl}/${patientId}/profile`, profileSettings);
      return response as any;
    } catch (error) {
      console.error('Error updating profile settings:', error);
      return {
        success: false,
        message: 'Failed to update profile',
        errors: ['Profile update failed'],
      };
    }
  }

  /**
   * Update notification settings
   */
  async updateNotificationSettings(
    patientId: string,
    notificationSettings: Partial<NotificationSettings>
  ): Promise<ApiResponse<NotificationSettings>> {
    try {
      const response = await apiService.put(`${this.baseUrl}/${patientId}/notifications`, notificationSettings);
      return response as any;
    } catch (error) {
      console.error('Error updating notification settings:', error);
      return {
        success: false,
        message: 'Failed to update notifications',
        errors: ['Notification settings update failed'],
      };
    }
  }

  /**
   * Update privacy settings
   */
  async updatePrivacySettings(
    patientId: string,
    privacySettings: Partial<PrivacySettings>
  ): Promise<ApiResponse<PrivacySettings>> {
    try {
      const response = await apiService.put(`${this.baseUrl}/${patientId}/privacy`, privacySettings);
      return response as any;
    } catch (error) {
      console.error('Error updating privacy settings:', error);
      return {
        success: false,
        message: 'Failed to update privacy settings',
        errors: ['Privacy settings update failed'],
      };
    }
  }

  /**
   * Update user preferences
   */
  async updateUserPreferences(
    patientId: string,
    preferences: Partial<UserPreferences>
  ): Promise<ApiResponse<UserPreferences>> {
    try {
      const response = await apiService.put(`${this.baseUrl}/${patientId}/preferences`, preferences);
      return response as any;
    } catch (error) {
      console.error('Error updating preferences:', error);
      return {
        success: false,
        message: 'Failed to update preferences',
        errors: ['Preferences update failed'],
      };
    }
  }

  /**
   * Update security settings
   */
  async updateSecuritySettings(
    patientId: string,
    securitySettings: Partial<SecuritySettings>
  ): Promise<ApiResponse<SecuritySettings>> {
    try {
      const response = await apiService.put(`${this.baseUrl}/${patientId}/security`, securitySettings);
      return response as any;
    } catch (error) {
      console.error('Error updating security settings:', error);
      return {
        success: false,
        message: 'Failed to update security settings',
        errors: ['Security settings update failed'],
      };
    }
  }

  /**
   * Update accessibility settings
   */
  async updateAccessibilitySettings(
    patientId: string,
    accessibilitySettings: Partial<AccessibilitySettings>
  ): Promise<ApiResponse<AccessibilitySettings>> {
    try {
      const response = await apiService.put(`${this.baseUrl}/${patientId}/accessibility`, accessibilitySettings);
      return response as any;
    } catch (error) {
      console.error('Error updating accessibility settings:', error);
      return {
        success: false,
        message: 'Failed to update accessibility settings',
        errors: ['Accessibility settings update failed'],
      };
    }
  }

  /**
   * Change password
   */
  async changePassword(
    currentPassword: string,
    newPassword: string,
    confirmPassword: string
  ): Promise<ApiResponse<void>> {
    try {
      const response = await apiService.post(`${this.baseUrl}/change-password`, {
        currentPassword,
        newPassword,
        confirmPassword,
      });
      return response as any;
    } catch (error) {
      console.error('Error changing password:', error);
      return {
        success: false,
        message: 'Failed to change password',
        errors: ['Password change failed'],
      };
    }
  }

  /**
   * Upload profile photo
   */
  async uploadProfilePhoto(file: File): Promise<ApiResponse<{ photoUrl: string }>> {
    try {
      const formData = new FormData();
      formData.append('photo', file);

      const response = await fetch(`${this.baseUrl}/profile-photo`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: formData,
      });

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error uploading profile photo:', error);
      return {
        success: false,
        message: 'Failed to upload photo',
        errors: ['Photo upload failed'],
      };
    }
  }

  /**
   * Delete profile photo
   */
  async deleteProfilePhoto(): Promise<ApiResponse<void>> {
    try {
      const response = await apiService.delete(`${this.baseUrl}/profile-photo`);
      return response as any;
    } catch (error) {
      console.error('Error deleting profile photo:', error);
      return {
        success: false,
        message: 'Failed to delete photo',
        errors: ['Photo deletion failed'],
      };
    }
  }

  /**
   * Enable two-factor authentication
   */
  async enableTwoFactorAuth(method: string): Promise<ApiResponse<{
    qrCode?: string;
    backupCodes: string[];
  }>> {
    try {
      const response = await apiService.post(`${this.baseUrl}/2fa/enable`, { method });
      return response as any;
    } catch (error) {
      console.error('Error enabling 2FA:', error);
      return {
        success: false,
        message: 'Failed to enable 2FA',
        errors: ['Two-factor authentication setup failed'],
      };
    }
  }

  /**
   * Disable two-factor authentication
   */
  async disableTwoFactorAuth(password: string): Promise<ApiResponse<void>> {
    try {
      const response = await apiService.post(`${this.baseUrl}/2fa/disable`, { password });
      return response as any;
    } catch (error) {
      console.error('Error disabling 2FA:', error);
      return {
        success: false,
        message: 'Failed to disable 2FA',
        errors: ['Two-factor authentication disable failed'],
      };
    }
  }

  /**
   * Generate backup codes for 2FA
   */
  async generateBackupCodes(): Promise<ApiResponse<{ backupCodes: string[] }>> {
    try {
      const response = await apiService.post(`${this.baseUrl}/2fa/backup-codes`);
      return response as any;
    } catch (error) {
      console.error('Error generating backup codes:', error);
      return {
        success: false,
        message: 'Failed to generate backup codes',
        errors: ['Backup code generation failed'],
      };
    }
  }

  /**
   * Get active sessions
   */
  async getActiveSessions(): Promise<ApiResponse<any[]>> {
    try {
      const response = await apiService.get(`${this.baseUrl}/sessions`);
      return response as any;
    } catch (error) {
      console.error('Error fetching active sessions:', error);
      return {
        success: false,
        message: 'Failed to fetch sessions',
        errors: ['Session data unavailable'],
      };
    }
  }

  /**
   * Revoke session
   */
  async revokeSession(sessionId: string): Promise<ApiResponse<void>> {
    try {
      const response = await apiService.delete(`${this.baseUrl}/sessions/${sessionId}`);
      return response as any;
    } catch (error) {
      console.error('Error revoking session:', error);
      return {
        success: false,
        message: 'Failed to revoke session',
        errors: ['Session revocation failed'],
      };
    }
  }

  /**
   * Export user data
   */
  async exportUserData(): Promise<ApiResponse<{ downloadUrl: string }>> {
    try {
      const response = await apiService.post(`${this.baseUrl}/export-data`);
      return response as any;
    } catch (error) {
      console.error('Error exporting user data:', error);
      return {
        success: false,
        message: 'Failed to export data',
        errors: ['Data export failed'],
      };
    }
  }

  /**
   * Request account deletion
   */
  async requestAccountDeletion(reason: string, password: string): Promise<ApiResponse<void>> {
    try {
      const response = await apiService.post(`${this.baseUrl}/delete-account`, {
        reason,
        password,
      });
      return response as any;
    } catch (error) {
      console.error('Error requesting account deletion:', error);
      return {
        success: false,
        message: 'Failed to request account deletion',
        errors: ['Account deletion request failed'],
      };
    }
  }

  /**
   * Test notification settings
   */
  async testNotification(type: 'email' | 'sms' | 'push'): Promise<ApiResponse<void>> {
    try {
      const response = await apiService.post(`${this.baseUrl}/test-notification`, { type });
      return response as any;
    } catch (error) {
      console.error('Error testing notification:', error);
      return {
        success: false,
        message: 'Failed to send test notification',
        errors: ['Test notification failed'],
      };
    }
  }
}

export const settingsService = new SettingsService();