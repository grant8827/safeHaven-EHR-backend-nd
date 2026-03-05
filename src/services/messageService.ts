import { apiClient } from './apiClient';

export interface MessageThread {
  id: string;
  subject: string;
  participants: any[];
  last_message: any;
  unread_count: number;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  sender: any;
  content: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  is_read: boolean;
  is_starred: boolean;
  created_at: string;
  read_at?: string;
  attachments: any[];
}

export const messageService = {
  // Get available users for messaging
  getUsers: async (): Promise<any[]> => {
    const response = await apiClient.get('/auth/');
    return response.data.results || response.data;
  },

  // Get all message threads for current user
  getThreads: async (): Promise<MessageThread[]> => {
    const response = await apiClient.get('/messages/threads/');
    return response.data.results || response.data;
  },

  // Get messages for a specific thread
  getMessages: async (threadId: string): Promise<Message[]> => {
    const response = await apiClient.get(`/messages/messages/?thread_id=${threadId}`);
    return response.data.results || response.data;
  },

  // Send a new message
  sendMessage: async (data: {
    recipient_ids: string[];
    content: string;
    priority?: string;
  }): Promise<Message> => {
    const response = await apiClient.post('/messages/messages/', data);
    return response.data;
  },

  // Mark message as read
  markMessageRead: async (messageId: string): Promise<void> => {
    await apiClient.post(`/messages/messages/${messageId}/mark_read/`);
  },

  // Toggle star on message
  toggleStar: async (messageId: string): Promise<{ is_starred: boolean }> => {
    const response = await apiClient.post(`/messages/messages/${messageId}/toggle_star/`);
    return response.data;
  },

  // Mark all messages in thread as read
  markThreadRead: async (threadId: string): Promise<void> => {
    await apiClient.post(`/messages/threads/${threadId}/mark_read/`);
  },
};