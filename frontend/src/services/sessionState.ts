// Client-side expiry is for navigation only. The API still verifies signatures/roles.
export function sessionTokenIsExpired(token: string | null, now = Date.now()): boolean {
  if (!token) return true;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    const encoded = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '=')));
    return typeof payload.exp !== 'number' || !Number.isFinite(payload.exp) || payload.exp * 1000 <= now;
  } catch { return true; }
}

export function loadStoredSession(storage: Pick<Storage, 'getItem' | 'removeItem'>, now = Date.now()) {
  const token = storage.getItem('smarthoa_token');
  try {
    const user = JSON.parse(storage.getItem('smarthoa_user') || 'null');
    if (token && !sessionTokenIsExpired(token, now) && user && typeof user.id === 'string' && typeof user.role === 'string') {
      return { user, token, isAuthenticated: true, sessionExpired: false };
    }
  } catch { /* Corrupt cached data must not crash the login page. */ }
  storage.removeItem('smarthoa_user');
  storage.removeItem('smarthoa_token');
  return { user: null, token: null, isAuthenticated: false, sessionExpired: Boolean(token) };
}

export function responseBelongsToSession(status: number | undefined, url: string | undefined, authorization: unknown, token: string | null, apiBase: string) {
  return status === 401 && Boolean(token) && Boolean(url?.startsWith(apiBase.replace(/\/$/, '') + '/'))
    && authorization === `Bearer ${token}`;
}
