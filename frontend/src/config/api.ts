import { Capacitor } from '@capacitor/core';

// Browsers can reach the local PHP server through localhost. Android emulators
// reach the host computer through 10.0.2.2. Set VITE_API_BASE_URL for a deployed
// HTTPS backend or when running on a physical phone.
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  (Capacitor.isNativePlatform() ? 'http://10.0.2.2:8000' : 'http://localhost:8000');
