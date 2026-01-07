import { create } from 'zustand';
import { api } from '../lib/api';

interface AuthState {
  token: string | null;
  isLoading: boolean;
  error: string | null;
  login: (password: string) => Promise<boolean>;
  logout: () => void;
  checkAuth: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: localStorage.getItem('tg_auth_token'),
  isLoading: false,
  error: null,

  login: async (password: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(api.baseUrl + '/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        throw new Error('Неверный пароль');
      }

      const data = await response.json();
      localStorage.setItem('tg_auth_token', data.token);
      set({ token: data.token, isLoading: false });
      return true;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem('tg_auth_token');
    set({ token: null });
  },

  checkAuth: async () => {
    const token = get().token;
    if (!token) return false;

    // Check token from URL params
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');
    if (urlToken) {
      localStorage.setItem('tg_auth_token', urlToken);
      set({ token: urlToken });
      window.history.replaceState({}, '', window.location.pathname);
      return true;
    }

    try {
      const response = await fetch(api.baseUrl + '/auth/verify', {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!response.ok) {
        throw new Error('Invalid token');
      }
      
      return true;
    } catch {
      localStorage.removeItem('tg_auth_token');
      set({ token: null });
      return false;
    }
  },
}));
