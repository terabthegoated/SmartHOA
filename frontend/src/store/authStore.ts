import { create } from 'zustand';
import { loadStoredSession } from '../services/sessionState';

interface AuthState {
  user: any;
  token: string | null;
  isAuthenticated: boolean;
  sessionExpired: boolean;
  login: (userData: any, token: string) => void;
  logout: () => void;
  expireSession: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  ...loadStoredSession(localStorage),
  
  login: (userData: any, token: string) => {
    localStorage.setItem('smarthoa_user', JSON.stringify(userData));
    localStorage.setItem('smarthoa_token', token);
    set({ user: userData, token, isAuthenticated: true, sessionExpired: false });
  },
  
  logout: () => {
    localStorage.removeItem('smarthoa_user');
    localStorage.removeItem('smarthoa_token');
    set({ user: null, token: null, isAuthenticated: false, sessionExpired: false });
  },
  expireSession: () => {
    localStorage.removeItem('smarthoa_user');
    localStorage.removeItem('smarthoa_token');
    set({ user: null, token: null, isAuthenticated: false, sessionExpired: true });
  }
}));
