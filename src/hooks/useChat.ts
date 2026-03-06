/**
 * useChat – Real-time chat hook backed by Socket.io /chat namespace.
 *
 * Features:
 *  - Connects to /chat namespace with JWT auth
 *  - Delivers Redis history buffer (last 50 msgs) on thread join for instant load
 *  - Real-time message delivery via message:receive
 *  - Typing indicators with 3-second auto-expire
 *  - Presence: online/offline per user
 *  - localStorage offline cache (survives page refresh / network drops)
 *  - Graceful fallback when socket is unavailable
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  threadId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  content: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  timestamp: string;
  isRead: boolean;
  isEncrypted: boolean;
  deliveryStatus: 'sent' | 'delivered' | 'read';
  attachments: unknown[];
}

export interface TypingUser {
  userId: string;
  displayName: string;
}

export interface UseChatReturn {
  /** Messages for the currently joined thread (merged Redis buffer + live) */
  messages: ChatMessage[];
  /** Users currently typing in the active thread */
  typingUsers: TypingUser[];
  /** Map userId → true if online */
  onlineUsers: Record<string, boolean>;
  /** Whether the Socket.io connection is established */
  isConnected: boolean;
  /** Join a thread room. Emits join-thread and receives history buffer */
  joinThread: (threadId: string) => void;
  /**
   * Send a message via socket (with optimistic update).
   * Falls back to returning false if not connected so callers can use REST.
   */
  sendMessage: (content: string, priority?: ChatMessage['priority']) => boolean;
  /** Call on every keystroke in the reply input */
  startTyping: () => void;
  /** Call when the user clears the input or sends */
  stopTyping: () => void;
  /** Add messages fetched via REST (merged, no duplicates) */
  injectMessages: (msgs: ChatMessage[]) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SOCKET_URL = import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || '';
const TYPING_EXPIRE_MS = 3000;
const CACHE_KEY = (threadId: string) => `chat:thread:${threadId}`;
const CACHE_MAX = 50;

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useChat = (
  userId: string | undefined,
  token: string | null,
): UseChatReturn => {
  const socketRef = useRef<Socket | null>(null);
  const currentThreadRef = useRef<string | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<Record<string, boolean>>({});

  // ── Helpers ────────────────────────────────────────────────────────────────

  const readCache = useCallback((threadId: string): ChatMessage[] => {
    try {
      const raw = localStorage.getItem(CACHE_KEY(threadId));
      return raw ? (JSON.parse(raw) as ChatMessage[]) : [];
    } catch {
      return [];
    }
  }, []);

  const writeCache = useCallback((threadId: string, msgs: ChatMessage[]) => {
    try {
      const latest = [...msgs]
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        .slice(-CACHE_MAX);
      localStorage.setItem(CACHE_KEY(threadId), JSON.stringify(latest));
    } catch {
      // quota exceeded – ignore
    }
  }, []);

  const mergeMessages = useCallback(
    (existing: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] => {
      const byId = new Map(existing.map((m) => [m.id, m]));
      incoming.forEach((m) => byId.set(m.id, m));
      return Array.from(byId.values()).sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      );
    },
    [],
  );

  // ── Connect ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!userId || !token) return;

    const socket = io(`${SOCKET_URL}/chat`, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      auth: { token, userId },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[useChat] Connected:', socket.id);
      setIsConnected(true);

      // Re-join current thread after reconnect
      if (currentThreadRef.current) {
        socket.emit('join-thread', { threadId: currentThreadRef.current });
      }

      // Send periodic heartbeat to refresh server-side presence TTL
      const heartbeat = setInterval(() => socket.emit('heartbeat'), 60_000);
      socket.once('disconnect', () => clearInterval(heartbeat));
    });

    socket.on('disconnect', (reason) => {
      console.log('[useChat] Disconnected:', reason);
      setIsConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.warn('[useChat] Connection error:', err.message);
    });

    // History buffer (last 50 msgs from Redis, delivered on join-thread)
    socket.on('thread-history', ({ threadId, messages: history }: { threadId: string; messages: ChatMessage[] }) => {
      setMessages((prev) => {
        const cached = readCache(threadId);
        const merged = mergeMessages(mergeMessages(cached, history), prev.filter((m) => m.threadId === threadId));
        writeCache(threadId, merged);
        return merged;
      });
    });

    // Live message
    socket.on('message:receive', (msg: ChatMessage) => {
      setMessages((prev) => {
        const merged = mergeMessages(prev, [msg]);
        writeCache(msg.threadId, merged.filter((m) => m.threadId === msg.threadId));
        return merged;
      });
    });

    // Typing indicators
    socket.on('typing:start', ({ userId: uid, displayName }: { userId: string; displayName: string }) => {
      setTypingUsers((prev) => {
        if (prev.some((u) => u.userId === uid)) return prev;
        return [...prev, { userId: uid, displayName }];
      });
    });

    socket.on('typing:stop', ({ userId: uid }: { userId: string }) => {
      setTypingUsers((prev) => prev.filter((u) => u.userId !== uid));
    });

    // Presence
    socket.on('presence:update', ({ userId: uid, online }: { userId: string; online: boolean }) => {
      setOnlineUsers((prev) => ({ ...prev, [uid]: online }));
    });

    socket.on('error', (err: { message: string }) => {
      console.error('[useChat] Server error:', err.message);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, token]);

  // ── API ────────────────────────────────────────────────────────────────────

  const joinThread = useCallback(
    (threadId: string) => {
      if (currentThreadRef.current === threadId) return;
      currentThreadRef.current = threadId;

      // Immediately seed from localStorage cache for zero-latency display
      const cached = readCache(threadId);
      if (cached.length > 0) {
        setMessages((prev) => mergeMessages(prev.filter((m) => m.threadId !== threadId), cached));
      } else {
        setMessages([]);
      }

      // Reset typing when switching threads
      setTypingUsers([]);

      if (socketRef.current?.connected) {
        socketRef.current.emit('join-thread', { threadId });
      }
    },
    [readCache, mergeMessages],
  );

  const sendMessage = useCallback(
    (content: string, priority: ChatMessage['priority'] = 'normal'): boolean => {
      if (!socketRef.current?.connected || !currentThreadRef.current) return false;

      // Optimistic update
      const optimistic: ChatMessage = {
        id: `optimistic-${Date.now()}`,
        threadId: currentThreadRef.current,
        senderId: userId ?? '',
        senderName: 'You',
        senderRole: 'user',
        content,
        priority,
        timestamp: new Date().toISOString(),
        isRead: false,
        isEncrypted: false,
        deliveryStatus: 'sent',
        attachments: [],
      };
      setMessages((prev) => [...prev, optimistic]);

      socketRef.current.emit('message:send', {
        threadId: currentThreadRef.current,
        content,
        priority,
      });

      stopTyping();
      return true;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId],
  );

  const startTyping = useCallback(() => {
    if (!socketRef.current?.connected || !currentThreadRef.current) return;
    socketRef.current.emit('typing:start', { threadId: currentThreadRef.current });

    // Auto-stop after TYPING_EXPIRE_MS of inactivity
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => stopTyping(), TYPING_EXPIRE_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopTyping = useCallback(() => {
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    if (!socketRef.current?.connected || !currentThreadRef.current) return;
    socketRef.current.emit('typing:stop', { threadId: currentThreadRef.current });
  }, []);

  /** Merge REST-fetched messages (used on initial load) without duplicating */
  const injectMessages = useCallback(
    (msgs: ChatMessage[]) => {
      setMessages((prev) => mergeMessages(prev, msgs));
      if (msgs.length > 0) {
        writeCache(msgs[0].threadId, msgs);
      }
    },
    [mergeMessages, writeCache],
  );

  // ── Cleanup ────────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, []);

  return {
    messages,
    typingUsers,
    onlineUsers,
    isConnected,
    joinThread,
    sendMessage,
    startTyping,
    stopTyping,
    injectMessages,
  };
};
