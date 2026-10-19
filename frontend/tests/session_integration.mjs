// Exercise the actual Axios interceptors + Zustand store. HTTP is fully mocked.
import assert from 'node:assert/strict';
import axios from 'axios';
import { createServer } from 'vite';

const values = new Map();
globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
globalThis.window = Object.assign(new EventTarget(), { setInterval, clearInterval });
globalThis.document = new EventTarget();
const server = await createServer({ configFile: false, mode: 'test', server: { middlewareMode: true }, appType: 'custom', optimizeDeps: { noDiscovery: true } });
const previousAdapter = axios.defaults.adapter;
let dispose;
try {
  const { useAuthStore } = await server.ssrLoadModule('/src/store/authStore.ts');
  const { initializeSessionHandling } = await server.ssrLoadModule('/src/services/sessionHandling.ts');
  const { API_BASE_URL } = await server.ssrLoadModule('/src/config/api.ts');
  const user = { id: 'demo', role: 'Homeowner', name: 'Demo Resident' };
  const jwt = exp => `header.${Buffer.from(JSON.stringify({ exp })).toString('base64url')}.signature`;
  const current = jwt(Math.floor(Date.now() / 1000) + 3600);
  const next = jwt(Math.floor(Date.now() / 1000) + 7200);
  const expired = jwt(Math.floor(Date.now() / 1000) - 1);
  let requests = 0;
  const response = (config, status) => ({ data: {}, status, statusText: 'Mocked', headers: {}, config });
  const rejectStatus = status => async config => { requests++; throw new axios.AxiosError('Mocked API response', 'ERR_BAD_RESPONSE', config, undefined, response(config, status)); };
  useAuthStore.getState().login(user, current);
  dispose = initializeSessionHandling();
  axios.defaults.adapter = async config => { requests++; return response(config, 200); };
  await axios.get(`${API_BASE_URL}/api/example`, { headers: { Authorization: `Bearer ${current}` } });
  assert.equal(useAuthStore.getState().isAuthenticated, true);
  console.log('PASS: successful authenticated request keeps the session.');

  for (const status of [403, 500]) {
    axios.defaults.adapter = rejectStatus(status);
    await assert.rejects(axios.get(`${API_BASE_URL}/api/example`, { headers: { Authorization: `Bearer ${current}` } }));
    assert.equal(useAuthStore.getState().token, current);
  }
  console.log('PASS: 403 / server failure cannot sign out a valid session.');

  axios.defaults.adapter = rejectStatus(401);
  await assert.rejects(axios.post(`${API_BASE_URL}/api/auth/login.php`, {}));
  assert.equal(useAuthStore.getState().token, current);
  console.log('PASS: failed login without a session header does not sign out the current user.');

  await assert.rejects(axios.get(`${API_BASE_URL}/api/example`, { headers: { Authorization: `Bearer ${current}` } }));
  assert.equal(useAuthStore.getState().isAuthenticated, false);
  assert.equal(useAuthStore.getState().sessionExpired, true);
  console.log('PASS: authenticated 401 clears the stale session and enables the login notice.');

  useAuthStore.getState().login(user, expired);
  const before = requests;
  await assert.rejects(axios.get(`${API_BASE_URL}/api/example`, { headers: { Authorization: `Bearer ${expired}` } }));
  assert.equal(requests, before);
  assert.equal(useAuthStore.getState().token, null);
  console.log('PASS: expired token is stopped before any HTTP request.');

  useAuthStore.getState().login(user, current);
  axios.defaults.adapter = async config => {
    useAuthStore.getState().login(user, next);
    throw new axios.AxiosError('Late old response', 'ERR_BAD_RESPONSE', config, undefined, response(config, 401));
  };
  await assert.rejects(axios.get(`${API_BASE_URL}/api/example`, { headers: { Authorization: `Bearer ${current}` } }));
  assert.equal(useAuthStore.getState().token, next);
  console.log('PASS: late 401 from an old token preserves a newer login.');

  useAuthStore.getState().logout();
  assert.equal(useAuthStore.getState().sessionExpired, false);
  console.log('PASS: normal logout does not show an expired-session warning.');
  console.log('7/7 session integration scenarios passed; no network requests sent.');
} finally {
  dispose?.();
  axios.defaults.adapter = previousAdapter;
  await server.close();
}
