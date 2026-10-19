import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import { useAuthStore } from '../store/authStore';
import { responseBelongsToSession, sessionTokenIsExpired } from './sessionState';

export function initializeSessionHandling() {
  const checkExpiry = () => {
    const state = useAuthStore.getState();
    if (state.token && sessionTokenIsExpired(state.token)) state.expireSession();
  };
  const request = axios.interceptors.request.use(config => {
    const state = useAuthStore.getState();
    if (state.token && responseBelongsToSession(401, config.url, config.headers.get('Authorization'), state.token, API_BASE_URL)
        && sessionTokenIsExpired(state.token)) {
      state.expireSession();
      throw new axios.CanceledError('Your session expired. Please sign in again.');
    }
    return config;
  });
  const response = axios.interceptors.response.use(result => result, error => {
    const state = useAuthStore.getState();
    const headers = error.config?.headers;
    const authorization = typeof headers?.get === 'function' ? headers.get('Authorization') : headers?.Authorization;
    // A failed login, external request, 403, 500 or old-token response must not
    // sign out a valid new session. Only the current authenticated API request.
    if (responseBelongsToSession(error.response?.status, error.config?.url, authorization, state.token, API_BASE_URL)) {
      state.expireSession();
    }
    return Promise.reject(error);
  });
  const interval = window.setInterval(checkExpiry, 30000);
  window.addEventListener('focus', checkExpiry);
  document.addEventListener('visibilitychange', checkExpiry);
  checkExpiry();
  return () => {
    axios.interceptors.request.eject(request);
    axios.interceptors.response.eject(response);
    window.clearInterval(interval);
    window.removeEventListener('focus', checkExpiry);
    document.removeEventListener('visibilitychange', checkExpiry);
  };
}
