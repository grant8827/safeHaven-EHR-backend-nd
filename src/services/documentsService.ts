import { 
  Document, 
  DocumentCategory, 
  DocumentFolder, 
  DocumentTemplate, 
  DocumentShare, 
  ShareType, 
  ApiResponse 
} from '../types';
import { apiService } from './apiService';

class DocumentsService {
  private baseUrl = '/api/documents';

  /**
   * Get all documents for the current patient
   */
  async getPatientDocuments(
    patientId?: string,
    category?: DocumentCategory,
    folderId?: string
  ): Promise<ApiResponse<Document[]>> {
    try {
      const params = new URLSearchParams();
      if (patientId) params.append('patientId', patientId);
      if (category) params.append('category', category);
      if (folderId) params.append('folderId', folderId);

      const response = await apiService.get(`${this.baseUrl}?${params.toString()}`);
      return response as any;
    } catch (error) {
      console.error('Error fetching patient documents:', error);
      return {
        success: false,
        message: 'Failed to fetch documents',
        errors: ['Unable to load documents at this time'],
      };
    }
  }

  /**
   * Get a single document by ID
   */
  async getDocument(documentId: string): Promise<ApiResponse<Document>> {
    try {
      const response = await apiService.get(`${this.baseUrl}/${documentId}`);
      return response as any;
    } catch (error) {
      console.error('Error fetching document:', error);
      return {
        success: false,
        message: 'Failed to fetch document',
        errors: ['Document not found or access denied'],
      };
    }
  }

  /**
   * Download a document
   */
  async downloadDocument(documentId: string): Promise<Blob | null> {
    try {
      const response = await fetch(`${this.baseUrl}/${documentId}/download`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Download failed');
      }

      return await response.blob();
    } catch (error) {
      console.error('Error downloading document:', error);
      return null;
    }
  }

  /**
   * Upload a new document
   */
  async uploadDocument(
    file: File,
    category: DocumentCategory,
    title: string,
    description?: string,
    folderId?: string,
    tags?: string[]
  ): Promise<ApiResponse<Document>> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', category);
      formData.append('title', title);
      if (description) formData.append('description', description);
      if (folderId) formData.append('folderId', folderId);
      if (tags) formData.append('tags', JSON.stringify(tags));

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: formData,
      });

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error uploading document:', error);
      return {
        success: false,
        message: 'Failed to upload document',
        errors: ['Upload failed'],
      };
    }
  }

  /**
   * Update document metadata
   */
  async updateDocument(
    documentId: string,
    updates: Partial<Document>
  ): Promise<ApiResponse<Document>> {
    try {
      const response = await apiService.put(`${this.baseUrl}/${documentId}`, updates);
      return response as any;
    } catch (error) {
      console.error('Error updating document:', error);
      return {
        success: false,
        message: 'Failed to update document',
        errors: ['Update failed'],
      };
    }
  }

  /**
   * Delete a document
   */
  async deleteDocument(documentId: string): Promise<ApiResponse<void>> {
    try {
      const response = await apiService.delete(`${this.baseUrl}/${documentId}`);
      return response as any;
    } catch (error) {
      console.error('Error deleting document:', error);
      return {
        success: false,
        message: 'Failed to delete document',
        errors: ['Deletion failed'],
      };
    }
  }

  /**
   * Sign a document
   */
  async signDocument(
    documentId: string,
    signature: string,
    signatureType: 'electronic' | 'digital'
  ): Promise<ApiResponse<Document>> {
    try {
      const response = await apiService.post(`${this.baseUrl}/${documentId}/sign`, {
        signature,
        signatureType,
      });
      return response as any;
    } catch (error) {
      console.error('Error signing document:', error);
      return {
        success: false,
        message: 'Failed to sign document',
        errors: ['Signature failed'],
      };
    }
  }

  /**
   * Share a document
   */
  async shareDocument(
    documentId: string,
    recipients: string[],
    shareType: ShareType,
    expiresAt?: Date,
    message?: string
  ): Promise<ApiResponse<DocumentShare>> {
    try {
      const response = await apiService.post(`${this.baseUrl}/${documentId}/share`, {
        recipients,
        shareType,
        expiresAt: expiresAt?.toISOString(),
        message,
      });
      return response as any;
    } catch (error) {
      console.error('Error sharing document:', error);
      return {
        success: false,
        message: 'Failed to share document',
        errors: ['Sharing failed'],
      };
    }
  }

  /**
   * Get document folders for a patient
   */
  async getDocumentFolders(patientId?: string): Promise<ApiResponse<DocumentFolder[]>> {
    try {
      const params = patientId ? `?patientId=${patientId}` : '';
      const response = await apiService.get(`${this.baseUrl}/folders${params}`);
      return response as any;
    } catch (error) {
      console.error('Error fetching document folders:', error);
      return {
        success: false,
        message: 'Failed to fetch folders',
        errors: ['Unable to load folders'],
      };
    }
  }

  /**
   * Create a new document folder
   */
  async createFolder(
    name: string,
    description?: string,
    parentId?: string,
    color?: string
  ): Promise<ApiResponse<DocumentFolder>> {
    try {
      const response = await apiService.post(`${this.baseUrl}/folders`, {
        name,
        description,
        parentId,
        color,
      });
      return response as any;
    } catch (error) {
      console.error('Error creating folder:', error);
      return {
        success: false,
        message: 'Failed to create folder',
        errors: ['Folder creation failed'],
      };
    }
  }

  /**
   * Update a document folder
   */
  async updateFolder(
    folderId: string,
    updates: Partial<DocumentFolder>
  ): Promise<ApiResponse<DocumentFolder>> {
    try {
      const response = await apiService.put(`${this.baseUrl}/folders/${folderId}`, updates);
      return response as any;
    } catch (error) {
      console.error('Error updating folder:', error);
      return {
        success: false,
        message: 'Failed to update folder',
        errors: ['Update failed'],
      };
    }
  }

  /**
   * Delete a document folder
   */
  async deleteFolder(folderId: string): Promise<ApiResponse<void>> {
    try {
      const response = await apiService.delete(`${this.baseUrl}/folders/${folderId}`);
      return response as any;
    } catch (error) {
      console.error('Error deleting folder:', error);
      return {
        success: false,
        message: 'Failed to delete folder',
        errors: ['Deletion failed'],
      };
    }
  }

  /**
   * Get available document templates
   */
  async getDocumentTemplates(): Promise<ApiResponse<DocumentTemplate[]>> {
    try {
      const response = await apiService.get(`${this.baseUrl}/templates`);
      return response as any;
    } catch (error) {
      console.error('Error fetching document templates:', error);
      return {
        success: false,
        message: 'Failed to fetch templates',
        errors: ['Templates unavailable'],
      };
    }
  }

  /**
   * Create document from template
   */
  async createFromTemplate(
    templateId: string,
    data: Record<string, any>
  ): Promise<ApiResponse<Document>> {
    try {
      const response = await apiService.post(`${this.baseUrl}/templates/${templateId}/create`, {
        data,
      });
      return response as any;
    } catch (error) {
      console.error('Error creating document from template:', error);
      return {
        success: false,
        message: 'Failed to create document',
        errors: ['Document creation failed'],
      };
    }
  }

  /**
   * Search documents
   */
  async searchDocuments(
    query: string,
    category?: DocumentCategory,
    tags?: string[],
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<ApiResponse<Document[]>> {
    try {
      const params = new URLSearchParams();
      params.append('q', query);
      if (category) params.append('category', category);
      if (tags) params.append('tags', tags.join(','));
      if (dateFrom) params.append('dateFrom', dateFrom.toISOString());
      if (dateTo) params.append('dateTo', dateTo.toISOString());

      const response = await apiService.get(`${this.baseUrl}/search?${params.toString()}`);
      return response as any;
    } catch (error) {
      console.error('Error searching documents:', error);
      return {
        success: false,
        message: 'Failed to search documents',
        errors: ['Search failed'],
      };
    }
  }

  /**
   * Get document access history
   */
  async getDocumentAccessHistory(documentId: string): Promise<ApiResponse<any[]>> {
    try {
      const response = await apiService.get(`${this.baseUrl}/${documentId}/access-history`);
      return response as any;
    } catch (error) {
      console.error('Error fetching access history:', error);
      return {
        success: false,
        message: 'Failed to fetch access history',
        errors: ['History unavailable'],
      };
    }
  }

  /**
   * Preview a document (for supported formats)
   */
  async previewDocument(documentId: string): Promise<string | null> {
    try {
      const response = await fetch(`${this.baseUrl}/${documentId}/preview`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Preview failed');
      }

      const result = await response.json();
      return result.previewUrl || null;
    } catch (error) {
      console.error('Error getting document preview:', error);
      return null;
    }
  }
}

export const documentsService = new DocumentsService();