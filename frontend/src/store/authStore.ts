import { create } from 'zustand';

interface AuthState {
  user: any;
  token: string | null;
  isAuthenticated: boolean;
  login: (userData: any, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: JSON.parse(localStorage.getItem('smarthoa_user') || 'null'),
  token: localStorage.getItem('smarthoa_token'),
  isAuthenticated: !!localStorage.getItem('smarthoa_token'),
  
  login: (userData: any, token: string) => {
    localStorage.setItem('smarthoa_user', JSON.stringify(userData));
    localStorage.setItem('smarthoa_token', token);
    set({ user: userData, token, isAuthenticated: true });
  },
  
  logout: () => {
    localStorage.removeItem('smarthoa_user');
    localStorage.removeItem('smarthoa_token');
    set({ user: null, token: null, isAuthenticated: false });
  }
}));
