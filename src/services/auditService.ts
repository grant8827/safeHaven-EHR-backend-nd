import { AuditLog, ApiResponse } from '../types';
import { apiService } from './apiService';

interface AuditLogRequest {
  action: string;
  resource: string;
  resourceId: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  metadata?: Record<string, any>;
}

class AuditService {
  private pendingLogs: AuditLogRequest[] = [];
  private batchTimeout?: NodeJS.Timeout;
  private readonly BATCH_SIZE = 10;
  private readonly BATCH_DELAY = 5000; // 5 seconds

  /**
   * Log an audit event
   */
  async log(logData: AuditLogRequest): Promise<void> {
    try {
      // Add client-side metadata
      const enrichedLogData = {
        ...logData,
        timestamp: new Date().toISOString(),
        ipAddress: await this.getClientIP(),
        userAgent: navigator.userAgent,
        sessionId: this.getSessionId(),
        ...logData.metadata,
      };

      // Add to batch for processing
      this.addToBatch(enrichedLogData);

      // For critical actions, send immediately
      if (this.isCriticalAction(logData.action)) {
        await this.flushBatch();
      }
    } catch (error) {
      console.error('Audit logging error:', error);
      // Don't throw error to avoid disrupting main application flow
    }
  }

  /**
   * Log an event (backward compatibility method)
   */
  async logEvent(eventType: string, metadata?: Record<string, any>): Promise<void> {
    await this.log({
      action: eventType,
      resource: 'general',
      resourceId: 'event',
      metadata,
    });
  }

  /**
   * Log user authentication events
   */
  async logAuth(action: 'LOGIN' | 'LOGOUT' | 'LOGIN_FAILED' | 'TOKEN_REFRESH', userId?: string): Promise<void> {
    await this.log({
      action: `AUTH_${action}`,
      resource: 'authentication',
      resourceId: userId || 'unknown',
    });
  }

  /**
   * Log data access events
   */
  async logDataAccess(resource: string, resourceId: string, action: 'READ' | 'CREATED' | 'UPDATED' | 'DELETED', oldValues?: any, newValues?: any): Promise<void> {
    await this.log({
      action: `DATA_${action}`,
      resource,
      resourceId,
      oldValues,
      newValues,
    });
  }

  /**
   * Log HIPAA-specific events
   */
  async logHIPAAEvent(eventType: 'PHI_ACCESS' | 'PHI_EXPORT' | 'PHI_PRINT' | 'PHI_SHARE', patientId: string, details?: Record<string, any>): Promise<void> {
    await this.log({
      action: `HIPAA_${eventType}`,
      resource: 'patient_phi',
      resourceId: patientId,
      metadata: {
        ...details,
        complianceFlag: true,
        requiresReview: eventType !== 'PHI_ACCESS',
      },
    });
  }

  /**
   * Log security events
   */
  async logSecurity(eventType: 'UNAUTHORIZED_ACCESS' | 'PERMISSION_DENIED' | 'SUSPICIOUS_ACTIVITY', resource: string, details?: Record<string, any>): Promise<void> {
    await this.log({
      action: `SECURITY_${eventType}`,
      resource,
      resourceId: 'security_event',
      metadata: {
        ...details,
        securityFlag: true,
        alertLevel: 'HIGH',
      },
    });

    // Immediately flush security events
    await this.flushBatch();
  }

  /**
   * Log system events
   */
  async logSystem(eventType: 'BACKUP_CREATED' | 'MAINTENANCE_START' | 'MAINTENANCE_END' | 'ERROR' | 'PERFORMANCE_ISSUE', details?: Record<string, any>): Promise<void> {
    await this.log({
      action: `SYSTEM_${eventType}`,
      resource: 'system',
      resourceId: 'system_event',
      metadata: details,
    });
  }

  /**
   * Retrieve audit logs with filtering
   */
  async getAuditLogs(filters?: {
    startDate?: Date;
    endDate?: Date;
    userId?: string;
    resource?: string;
    action?: string;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<AuditLog[]>> {
    try {
      const params = new URLSearchParams();
      
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined) {
            if (value instanceof Date) {
              params.append(key, value.toISOString());
            } else {
              params.append(key, value.toString());
            }
          }
        });
      }

      return await apiService.get(`/audit/logs?${params.toString()}`);
    } catch (error) {
      console.error('Error retrieving audit logs:', error);
      return {
        success: false,
        message: 'Failed to retrieve audit logs',
        errors: ['Audit log retrieval failed'],
      };
    }
  }

  /**
   * Generate audit report
   */
  async generateAuditReport(reportType: 'HIPAA_COMPLIANCE' | 'USER_ACTIVITY' | 'SECURITY_EVENTS' | 'DATA_CHANGES', filters?: {
    startDate: Date;
    endDate: Date;
    userId?: string;
    patientId?: string;
  }): Promise<ApiResponse<{ reportId: string; downloadUrl: string }>> {
    try {
      return await apiService.post('/audit/reports', {
        reportType,
        filters,
      });
    } catch (error) {
      console.error('Error generating audit report:', error);
      return {
        success: false,
        message: 'Failed to generate audit report',
        errors: ['Report generation failed'],
      };
    }
  }

  /**
   * Add log to batch for processing
   */
  private addToBatch(logData: AuditLogRequest): void {
    this.pendingLogs.push(logData);

    // Process batch if it reaches the size limit
    if (this.pendingLogs.length >= this.BATCH_SIZE) {
      this.flushBatch();
    } else {
      // Set up delayed batch processing
      this.setupBatchTimeout();
    }
  }

  /**
   * Setup batch timeout for delayed processing
   */
  private setupBatchTimeout(): void {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }

    this.batchTimeout = setTimeout(() => {
      this.flushBatch();
    }, this.BATCH_DELAY);
  }

  /**
   * Flush pending logs to server
   */
  private async flushBatch(): Promise<void> {
    if (this.pendingLogs.length === 0) {
      return;
    }

    const logsToSend = [...this.pendingLogs];
    this.pendingLogs = [];

    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = undefined;
    }

    try {
      await apiService.post('/audit/logs/batch/', { logs: logsToSend });
    } catch (error) {
      console.error('Failed to send audit logs:', error);
      
      // Store failed logs locally for retry
      this.storeFailedLogs(logsToSend);
    }
  }

  /**
   * Store failed logs locally for retry
   */
  private storeFailedLogs(logs: AuditLogRequest[]): void {
    try {
      const existingLogs = JSON.parse(localStorage.getItem('theracare_failed_audit_logs') || '[]');
      const updatedLogs = [...existingLogs, ...logs];
      
      // Limit stored logs to prevent storage issues
      const maxStoredLogs = 100;
      if (updatedLogs.length > maxStoredLogs) {
        updatedLogs.splice(0, updatedLogs.length - maxStoredLogs);
      }
      
      localStorage.setItem('theracare_failed_audit_logs', JSON.stringify(updatedLogs));
    } catch (error) {
      console.error('Failed to store audit logs locally:', error);
    }
  }

  /**
   * Retry failed logs
   */
  async retryFailedLogs(): Promise<void> {
    try {
      const failedLogs = JSON.parse(localStorage.getItem('theracare_failed_audit_logs') || '[]');
      
      if (failedLogs.length > 0) {
        const response = await apiService.post('/audit/logs/batch', { logs: failedLogs });
        
        if (response.success) {
          localStorage.removeItem('theracare_failed_audit_logs');
        }
      }
    } catch (error) {
      console.error('Failed to retry audit logs:', error);
    }
  }

  /**
   * Check if action is critical and should be sent immediately
   */
  private isCriticalAction(action: string): boolean {
    const criticalActions = [
      'AUTH_LOGIN_FAILED',
      'SECURITY_UNAUTHORIZED_ACCESS',
      'SECURITY_PERMISSION_DENIED',
      'SECURITY_SUSPICIOUS_ACTIVITY',
      'HIPAA_PHI_EXPORT',
      'HIPAA_PHI_SHARE',
      'DATA_DELETED',
    ];
    
    return criticalActions.includes(action);
  }

  /**
   * Get client IP address (best effort)
   */
  private async getClientIP(): Promise<string> {
    try {
      // This would typically be handled by the server
      // Client-side IP detection is limited and unreliable
      return 'client-side';
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Get session ID
   */
  private getSessionId(): string {
    // Generate or retrieve session ID
    let sessionId = sessionStorage.getItem('theracare_session_id');
    
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      sessionStorage.setItem('theracare_session_id', sessionId);
    }
    
    return sessionId;
  }

  /**
   * Initialize audit service
   */
  init(): void {
    // Retry any failed logs on initialization
    this.retryFailedLogs();

    // Set up periodic retry of failed logs
    setInterval(() => {
      this.retryFailedLogs();
    }, 5 * 60 * 1000); // Every 5 minutes

    // Flush any remaining logs on page unload
    window.addEventListener('beforeunload', () => {
      this.flushBatch();
    });
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }
    
    // Flush any pending logs
    this.flushBatch();
  }
}

export const auditService = new AuditService();

// Initialize audit service
auditService.init();