import { apiService } from './apiService';
import { ApiResponse } from '../types';

// Report interfaces
export interface ReportTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  estimatedTime: string;
  complexity: 'simple' | 'moderate' | 'complex';
  requiredPermissions: string[];
  parameters: ReportParameter[];
  outputFormats: ('pdf' | 'xlsx' | 'csv' | 'json')[];
  tags: string[];
}

export interface ReportParameter {
  id: string;
  name: string;
  type: 'date' | 'daterange' | 'select' | 'multiselect' | 'boolean' | 'text' | 'number';
  required: boolean;
  options?: { value: string; label: string }[];
  defaultValue?: any;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
  description?: string;
  placeholder?: string;
}

export interface GeneratedReport {
  id: string;
  templateId: string;
  templateName: string;
  category: string;
  status: 'pending' | 'generating' | 'completed' | 'failed' | 'expired';
  createdAt: string;
  completedAt?: string;
  parameters: Record<string, any>;
  downloadUrl?: string;
  previewUrl?: string;
  expiresAt?: string;
  fileSize?: number;
  format: 'pdf' | 'xlsx' | 'csv' | 'json';
  generatedBy: string;
  error?: string;
  progress?: number;
  metadata?: {
    recordCount?: number;
    chartCount?: number;
    tableCount?: number;
  };
}

export interface ReportAnalytics {
  totalReports: number;
  reportsThisMonth: number;
  reportsToday: number;
  averageGenerationTime: number;
  mostUsedTemplate: string;
  successRate: number;
  popularCategories: { category: string; count: number; percentage: number }[];
  recentActivity: {
    date: string;
    count: number;
  }[];
  userActivity: {
    userId: string;
    userName: string;
    reportCount: number;
    lastGenerated: string;
  }[];
}

export interface ReportSchedule {
  id: string;
  templateId: string;
  name: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  parameters: Record<string, any>;
  recipients: string[];
  nextRun: string;
  lastRun?: string;
  isActive: boolean;
  createdBy: string;
}



class ReportingService {
  private baseUrl = '/api/v1/reports';

  /**
   * Get all available report templates
   */
  async getReportTemplates(category?: string): Promise<ApiResponse<ReportTemplate[]>> {
    try {
      const params = new URLSearchParams();
      if (category) params.append('category', category);
      
      const response = await apiService.get(`${this.baseUrl}/templates?${params}`);
      return response as ApiResponse<ReportTemplate[]>;
    } catch (error) {
      console.error('Error fetching report templates:', error);
      return {
        success: false,
        message: 'Failed to fetch report templates',
        errors: ['Network error or server unavailable'],
      };
    }
  }

  /**
   * Get a specific report template by ID
   */
  async getReportTemplate(templateId: string): Promise<ApiResponse<ReportTemplate>> {
    try {
      const response = await apiService.get(`${this.baseUrl}/templates/${templateId}`);
      return response as ApiResponse<ReportTemplate>;
    } catch (error) {
      console.error('Error fetching report template:', error);
      return {
        success: false,
        message: 'Failed to fetch report template',
        errors: ['Template not found or access denied'],
      };
    }
  }

  /**
   * Generate a new report
   */
  async generateReport(
    templateId: string, 
    parameters: Record<string, any>,
    format: 'pdf' | 'xlsx' | 'csv' | 'json' = 'pdf'
  ): Promise<ApiResponse<{ reportId: string }>> {
    try {
      const response = await apiService.post(`${this.baseUrl}/generate`, {
        templateId,
        parameters,
        format,
      });
      return response as ApiResponse<{ reportId: string }>;
    } catch (error) {
      console.error('Error generating report:', error);
      return {
        success: false,
        message: 'Failed to generate report',
        errors: ['Report generation failed. Please check parameters and try again.'],
      };
    }
  }

  /**
   * Get generated reports
   */
  async getGeneratedReports(
    page = 1,
    limit = 10,
    status?: GeneratedReport['status'],
    category?: string
  ): Promise<ApiResponse<{
    reports: GeneratedReport[];
    total: number;
    page: number;
    limit: number;
  }>> {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      
      if (status) params.append('status', status);
      if (category) params.append('category', category);
      
      const response = await apiService.get(`${this.baseUrl}?${params}`);
      return response as ApiResponse<{
        reports: GeneratedReport[];
        total: number;
        page: number;
        limit: number;
      }>;
    } catch (error) {
      console.error('Error fetching generated reports:', error);
      return {
        success: false,
        message: 'Failed to fetch reports',
        errors: ['Unable to load reports at this time'],
      };
    }
  }

  /**
   * Get a specific generated report
   */
  async getGeneratedReport(reportId: string): Promise<ApiResponse<GeneratedReport>> {
    try {
      const response = await apiService.get(`${this.baseUrl}/${reportId}`);
      return response as any;
    } catch (error) {
      console.error('Error fetching report:', error);
      return {
        success: false,
        message: 'Failed to fetch report details',
        errors: ['Report not found or access denied'],
      };
    }
  }

  /**
   * Download a report
   */
  async downloadReport(reportId: string): Promise<ApiResponse<Blob>> {
    try {
      const response = await fetch(`${this.baseUrl}/${reportId}/download`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const blob = await response.blob();
      return {
        success: true,
        data: blob,
      };
    } catch (error) {
      console.error('Error downloading report:', error);
      return {
        success: false,
        message: 'Failed to download report',
        errors: ['Download failed or file not available'],
      };
    }
  }

  /**
   * Delete a generated report
   */
  async deleteReport(reportId: string): Promise<ApiResponse<void>> {
    try {
      const response = await apiService.delete(`${this.baseUrl}/${reportId}`);
      return response as any;
    } catch (error) {
      console.error('Error deleting report:', error);
      return {
        success: false,
        message: 'Failed to delete report',
        errors: ['Unable to delete report at this time'],
      };
    }
  }

  /**
   * Get report analytics
   */
  async getReportAnalytics(): Promise<ApiResponse<ReportAnalytics>> {
    try {
      const response = await apiService.get(`${this.baseUrl}/analytics`);
      return response as any;
    } catch (error) {
      console.error('Error fetching report analytics:', error);
      return {
        success: false,
        message: 'Failed to fetch analytics',
        errors: ['Analytics data unavailable'],
      };
    }
  }

  /**
   * Schedule a recurring report
   */
  async scheduleReport(
    templateId: string,
    name: string,
    frequency: ReportSchedule['frequency'],
    parameters: Record<string, any>,
    recipients: string[]
  ): Promise<ApiResponse<{ scheduleId: string }>> {
    try {
      const response = await apiService.post(`${this.baseUrl}/schedule`, {
        templateId,
        name,
        frequency,
        parameters,
        recipients,
      });
      return response as any;
    } catch (error) {
      console.error('Error scheduling report:', error);
      return {
        success: false,
        message: 'Failed to schedule report',
        errors: ['Report scheduling failed'],
      };
    }
  }

  /**
   * Get scheduled reports
   */
  async getScheduledReports(): Promise<ApiResponse<ReportSchedule[]>> {
    try {
      const response = await apiService.get(`${this.baseUrl}/schedule`);
      return response as any;
    } catch (error) {
      console.error('Error fetching scheduled reports:', error);
      return {
        success: false,
        message: 'Failed to fetch scheduled reports',
        errors: ['Unable to load scheduled reports'],
      };
    }
  }

  /**
   * Update a scheduled report
   */
  async updateScheduledReport(
    scheduleId: string,
    updates: Partial<ReportSchedule>
  ): Promise<ApiResponse<void>> {
    try {
      const response = await apiService.put(`${this.baseUrl}/schedule/${scheduleId}`, updates);
      return response as any;
    } catch (error) {
      console.error('Error updating scheduled report:', error);
      return {
        success: false,
        message: 'Failed to update scheduled report',
        errors: ['Update failed'],
      };
    }
  }

  /**
   * Delete a scheduled report
   */
  async deleteScheduledReport(scheduleId: string): Promise<ApiResponse<void>> {
    try {
      const response = await apiService.delete(`${this.baseUrl}/schedule/${scheduleId}`);
      return response as any;
    } catch (error) {
      console.error('Error deleting scheduled report:', error);
      return {
        success: false,
        message: 'Failed to delete scheduled report',
        errors: ['Deletion failed'],
      };
    }
  }

  /**
   * Share a report via email
   */
  async shareReport(
    reportId: string,
    recipients: string[],
    message?: string
  ): Promise<ApiResponse<void>> {
    try {
      const response = await apiService.post(`${this.baseUrl}/${reportId}/share`, {
        recipients,
        message,
      });
      return response as any;
    } catch (error) {
      console.error('Error sharing report:', error);
      return {
        success: false,
        message: 'Failed to share report',
        errors: ['Email sharing failed'],
      };
    }
  }

  /**
   * Get report categories
   */
  async getReportCategories(): Promise<ApiResponse<string[]>> {
    try {
      const response = await apiService.get(`${this.baseUrl}/categories`);
      return response as any;
    } catch (error) {
      console.error('Error fetching report categories:', error);
      return {
        success: false,
        message: 'Failed to fetch categories',
        errors: ['Categories unavailable'],
      };
    }
  }

  /**
   * Validate report parameters
   */
  async validateReportParameters(
    templateId: string,
    parameters: Record<string, any>
  ): Promise<ApiResponse<{
    isValid: boolean;
    errors: Record<string, string[]>;
  }>> {
    try {
      const response = await apiService.post(`${this.baseUrl}/validate`, {
        templateId,
        parameters,
      });
      return response as any;
    } catch (error) {
      console.error('Error validating parameters:', error);
      return {
        success: false,
        message: 'Failed to validate parameters',
        errors: ['Validation service unavailable'],
      };
    }
  }

  /**
   * Get report generation progress
   */
  async getReportProgress(reportId: string): Promise<ApiResponse<{
    progress: number;
    status: GeneratedReport['status'];
    estimatedTimeRemaining?: number;
  }>> {
    try {
      const response = await apiService.get(`${this.baseUrl}/${reportId}/progress`);
      return response as any;
    } catch (error) {
      console.error('Error fetching report progress:', error);
      return {
        success: false,
        message: 'Failed to fetch progress',
        errors: ['Progress information unavailable'],
      };
    }
  }

  /**
   * Cancel report generation
   */
  async cancelReportGeneration(reportId: string): Promise<ApiResponse<void>> {
    try {
      const response = await apiService.post(`${this.baseUrl}/${reportId}/cancel`);
      return response as any;
    } catch (error) {
      console.error('Error cancelling report:', error);
      return {
        success: false,
        message: 'Failed to cancel report',
        errors: ['Cancellation failed'],
      };
    }
  }

  /**
   * Get report preview (for supported formats)
   */
  async getReportPreview(reportId: string): Promise<ApiResponse<{
    previewUrl: string;
    previewType: 'image' | 'html' | 'json';
  }>> {
    try {
      const response = await apiService.get(`${this.baseUrl}/${reportId}/preview`);
      return response as any;
    } catch (error) {
      console.error('Error fetching report preview:', error);
      return {
        success: false,
        message: 'Failed to fetch preview',
        errors: ['Preview not available'],
      };
    }
  }

  /**
   * Export multiple reports as archive
   */
  async exportReportsArchive(
    reportIds: string[],
    format: 'zip' | 'tar'
  ): Promise<ApiResponse<Blob>> {
    try {
      const response = await fetch(`${this.baseUrl}/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          reportIds,
          format,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const blob = await response.blob();
      return {
        success: true,
        data: blob,
      };
    } catch (error) {
      console.error('Error exporting reports:', error);
      return {
        success: false,
        message: 'Failed to export reports',
        errors: ['Export failed'],
      };
    }
  }

  /**
   * Get system report settings
   */
  async getReportSettings(): Promise<ApiResponse<{
    maxReportSize: number;
    allowedFormats: string[];
    retentionPeriod: number;
    maxConcurrentReports: number;
    emailSettings: {
      enabled: boolean;
      maxRecipients: number;
    };
  }>> {
    try {
      const response = await apiService.get(`${this.baseUrl}/settings`);
      return response as any;
    } catch (error) {
      console.error('Error fetching report settings:', error);
      return {
        success: false,
        message: 'Failed to fetch settings',
        errors: ['Settings unavailable'],
      };
    }
  }
}

export const reportingService = new ReportingService();
export default reportingService;