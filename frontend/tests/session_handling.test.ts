import test from 'node:test';
import assert from 'node:assert/strict';
import { loadStoredSession, responseBelongsToSession, sessionTokenIsExpired } from '../src/services/sessionState.ts';

const now = 1800000000000;
const token = (exp: unknown) => `header.${Buffer.from(JSON.stringify({ exp })).toString('base64url')}.signature`;
const storage = (jwt: string | null, user: string | null = JSON.stringify({ id: 'demo', role: 'Homeowner' })) => {
  const values = new Map<string, string>();
  if (jwt) values.set('smarthoa_token', jwt);
  if (user) values.set('smarthoa_user', user);
  values.set('unrelated-preference', 'keep');
  return { values, getItem: (key: string) => values.get(key) ?? null, removeItem: (key: string) => { values.delete(key); } };
};
test('valid future token retains the signed-in session', () => {
  const jwt = token(now / 1000 + 3600); const local = storage(jwt);
  assert.equal(sessionTokenIsExpired(jwt, now), false);
  assert.equal(loadStoredSession(local, now).isAuthenticated, true);
});
test('token expiring now or in the past is cleared', () => {
  for (const exp of [now / 1000, now / 1000 - 1]) {
    const local = storage(token(exp));
    assert.equal(loadStoredSession(local, now).sessionExpired, true);
    assert.equal(local.getItem('smarthoa_token'), null);
    assert.equal(local.getItem('smarthoa_user'), null);
    assert.equal(local.getItem('unrelated-preference'), 'keep');
  }
});
test('malformed token or missing/non-numeric expiration is rejected without crashing', () => {
  for (const jwt of ['broken', 'a.!.c', token(null), token('soon')]) assert.equal(sessionTokenIsExpired(jwt, now), true);
});
test('corrupt user storage does not crash startup', () => {
  const local = storage(token(now / 1000 + 3600), '{invalid JSON');
  assert.equal(loadStoredSession(local, now).isAuthenticated, false);
});
test('missing cached user cannot leave a token-only authenticated session', () => {
  assert.equal(loadStoredSession(storage(token(now / 1000 + 3600), null), now).isAuthenticated, false);
});
test('fresh logged-out state has no expired-session warning', () => {
  assert.equal(loadStoredSession(storage(null, null), now).sessionExpired, false);
});
test('401 for the current authenticated API request expires that session', () => {
  assert.equal(responseBelongsToSession(401, 'https://api.example/api/auth/me.php', 'Bearer current', 'current', 'https://api.example'), true);
});
test('bad login, external requests and 403/500 responses do not clear a valid session', () => {
  for (const status of [403, 500, undefined]) assert.equal(responseBelongsToSession(status, 'https://api.example/api/example', 'Bearer current', 'current', 'https://api.example'), false);
  assert.equal(responseBelongsToSession(401, 'https://api.example/api/auth/login.php', undefined, 'current', 'https://api.example'), false);
  assert.equal(responseBelongsToSession(401, 'https://other.example/api/example', 'Bearer current', 'current', 'https://api.example'), false);
});
test('late response for an old token cannot log out a newer login', () => {
  assert.equal(responseBelongsToSession(401, 'https://api.example/api/example', 'Bearer old', 'new', 'https://api.example'), false);
});
