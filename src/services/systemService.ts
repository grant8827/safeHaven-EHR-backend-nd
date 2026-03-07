interface SystemStats {
  totalUsers: number;
  activeUsers: number;
  lockedUsers: number;
  totalPatients: number;
  activePatients: number;
  todayAppointments: number;
  pendingAppointments: number;
  completedAppointments: number;
  totalRevenue: number;
  monthlyRevenue: number;
  weeklyRevenue: number;
  dailyRevenue: number;
  systemAlerts: number;
  failedLogins: number;
  activeConnections: number;
  serverLoad: number;
}

interface SystemAlert {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  timestamp: string;
  resolved: boolean;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

interface AuditLogEntry {
  id: string;
  timestamp: string;
  user_id: string;
  username: string;
  action: string;
  resource: string;
  resource_id: string;
  ip_address: string;
  user_agent: string;
  result: 'success' | 'failure';
  details: Record<string, any>;
}

interface SystemSettings {
  security: {
    password_expiry_days: number;
    max_failed_logins: number;
    session_timeout_minutes: number;
    require_2fa: boolean;
    password_complexity: {
      min_length: number;
      require_uppercase: boolean;
      require_lowercase: boolean;
      require_numbers: boolean;
      require_special: boolean;
    };
  };
  backup: {
    auto_backup_enabled: boolean;
    backup_frequency_hours: number;
    retention_days: number;
    last_backup: string;
  };
  notifications: {
    email_notifications: boolean;
    sms_notifications: boolean;
    appointment_reminders: boolean;
    system_alerts: boolean;
  };
  maintenance: {
    maintenance_mode: boolean;
    maintenance_message: string;
    scheduled_maintenance: string | null;
  };
}

class SystemService {
  /**
   * Get system statistics (admin only)
   */
  async getSystemStats(): Promise<SystemStats> {
    // Mock data for now - replace with actual API call
    return {
      totalUsers: 45,
      activeUsers: 42,
      lockedUsers: 3,
      totalPatients: 150,
      activePatients: 138,
      todayAppointments: 23,
      pendingAppointments: 8,
      completedAppointments: 15,
      totalRevenue: 125000,
      monthlyRevenue: 18500,
      weeklyRevenue: 4200,
      dailyRevenue: 850,
      systemAlerts: 3,
      failedLogins: 12,
      activeConnections: 28,
      serverLoad: 65,
    };
  }

  /**
   * Get system alerts (admin only)
   */
  async getSystemAlerts(): Promise<SystemAlert[]> {
    // Mock data for now - replace with actual API call
    return [
      {
        id: '1',
        type: 'warning',
        title: 'Database Backup Overdue',
        message: 'The last database backup was completed over 24 hours ago.',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        resolved: false,
        priority: 'high',
      },
      {
        id: '2',
        type: 'error',
        title: 'Multiple Failed Login Attempts',
        message: 'Detected 12 failed login attempts in the last hour.',
        timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        resolved: false,
        priority: 'critical',
      },
      {
        id: '3',
        type: 'success',
        title: 'HIPAA Audit Completed',
        message: 'Monthly HIPAA compliance audit completed successfully with no issues.',
        timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
        resolved: true,
        priority: 'medium',
      },
    ];
  }

  /**
   * Get audit log entries (admin only)
   */
  async getAuditLog(_params?: {
    user_id?: string;
    action?: string;
    resource?: string;
    start_date?: string;
    end_date?: string;
    page?: number;
    limit?: number;
  }): Promise<{ results: AuditLogEntry[]; count: number }> {
    // Mock data for now - replace with actual API call
    return {
      results: [
        {
          id: '1',
          timestamp: new Date().toISOString(),
          user_id: 'user-1',
          username: 'admin',
          action: 'USER_LOGIN',
          resource: 'authentication',
          resource_id: 'user-1',
          ip_address: '192.168.1.100',
          user_agent: 'Mozilla/5.0...',
          result: 'success',
          details: { role: 'admin' },
        },
      ],
      count: 1,
    };
  }

  /**
   * Get system settings (admin only)
   */
  async getSystemSettings(): Promise<SystemSettings> {
    // Mock data for now - replace with actual API call
    return {
      security: {
        password_expiry_days: 90,
        max_failed_logins: 5,
        session_timeout_minutes: 30,
        require_2fa: true,
        password_complexity: {
          min_length: 8,
          require_uppercase: true,
          require_lowercase: true,
          require_numbers: true,
          require_special: true,
        },
      },
      backup: {
        auto_backup_enabled: true,
        backup_frequency_hours: 24,
        retention_days: 30,
        last_backup: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      },
      notifications: {
        email_notifications: true,
        sms_notifications: true,
        appointment_reminders: true,
        system_alerts: true,
      },
      maintenance: {
        maintenance_mode: false,
        maintenance_message: '',
        scheduled_maintenance: null,
      },
    };
  }

  /**
   * Update system settings (admin only)
   */
  async updateSystemSettings(settings: Partial<SystemSettings>): Promise<SystemSettings> {
    // Mock implementation - replace with actual API call
    console.log('Updating system settings:', settings);
    return this.getSystemSettings();
  }

  /**
   * Trigger database backup (admin only)
   */
  async triggerBackup(): Promise<{ message: string; backup_id: string }> {
    // Mock implementation - replace with actual API call
    return {
      message: 'Database backup initiated successfully',
      backup_id: `backup_${Date.now()}`,
    };
  }

  /**
   * Generate system report (admin only)
   */
  async generateReport(reportType: 'users' | 'patients' | 'appointments' | 'revenue' | 'audit'): Promise<{ 
    report_id: string; 
    download_url: string; 
    expires_at: string;
  }> {
    // Mock implementation - replace with actual API call
    return {
      report_id: `report_${reportType}_${Date.now()}`,
      download_url: `/api/v1/reports/download/report_${reportType}_${Date.now()}`,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  /**
   * Resolve system alert (admin only)
   */
  async resolveAlert(alertId: string): Promise<{ message: string }> {
    // Mock implementation - replace with actual API call
    return {
      message: `Alert ${alertId} has been resolved`,
    };
  }

  /**
   * Get system health status
   */
  async getSystemHealth(): Promise<{
    database: 'healthy' | 'warning' | 'critical';
    server: 'healthy' | 'warning' | 'critical';
    storage: 'healthy' | 'warning' | 'critical';
    backup: 'healthy' | 'warning' | 'critical';
    last_check: string;
  }> {
    // Mock implementation - replace with actual API call
    return {
      database: 'healthy',
      server: 'healthy',
      storage: 'warning',
      backup: 'healthy',
      last_check: new Date().toISOString(),
    };
  }
}

export const systemService = new SystemService();