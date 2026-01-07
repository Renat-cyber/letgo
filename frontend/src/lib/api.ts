const API_URL = import.meta.env.PROD 
  ? 'http://193.178.170.153:3001/api'
  : '/api';

export const api = {
  baseUrl: API_URL,

  getHeaders: () => {
    const token = localStorage.getItem('tg_auth_token');
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  },

  async get<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${API_URL}${endpoint}`, {
      headers: this.getHeaders(),
    });
    if (!response.ok) throw new Error(`API Error: ${response.status}`);
    return response.json();
  },

  async post<T>(endpoint: string, data?: any): Promise<T> {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: data ? JSON.stringify(data) : undefined,
    });
    if (!response.ok) throw new Error(`API Error: ${response.status}`);
    return response.json();
  },

  async patch<T>(endpoint: string, data: any): Promise<T> {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error(`API Error: ${response.status}`);
    return response.json();
  },

  async delete<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    if (!response.ok) throw new Error(`API Error: ${response.status}`);
    return response.json();
  },
};

export interface Account {
  id: number;
  sessionId: string;
  phone?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  isActive: boolean;
  aiEnabled: boolean;
  systemPrompt?: string;
  isRunning?: boolean;
  isRecording?: boolean;
}

export interface Conversation {
  id: number;
  accountId: number;
  chatId: string;
  peerUsername?: string;
  peerFirstName?: string;
  peerDescription?: string;
  lastMessageAt?: string;
  aiMode: boolean;
}

export interface Message {
  id: number;
  conversationId: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
}

export interface Pattern {
  id: number;
  name: string;
  description?: string;
  actions: PatternAction[];
  isActive: boolean;
  repeatCount: number;
  delayBetweenMs: number;
}

export interface PatternAction {
  type: 'click' | 'callback' | 'message' | 'like' | 'dislike' | 'wait' | 'next_profile';
  data: Record<string, any>;
  sequenceOrder: number;
  delayAfterMs: number;
}

export interface Settings {
  default_system_prompt: string;
  ai_temperature: string;
  ai_max_tokens: string;
  pattern_default_delay: string;
  notification_chat_id: string;
  frontend_url?: string;
  safety_min_delay?: string;
  safety_max_delay?: string;
  safety_actions_per_hour?: string;
  safety_messages_per_hour?: string;
}
