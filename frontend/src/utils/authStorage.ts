const TOKEN_KEY = 'token';
const USER_KEY = 'user';

function decodeTokenPayload(token: string) {
  try {
    const [, payload = ''] = token.split('.');
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const decoded = atob(padded);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export function getAuthToken() {
  const token = sessionStorage.getItem(TOKEN_KEY);
  if (!token) return null;

  const payload = decodeTokenPayload(token);
  const expiresAt = typeof payload?.exp === 'number' ? payload.exp * 1000 : null;
  if (expiresAt && Date.now() >= expiresAt) {
    clearAuthSession();
    return null;
  }

  return token;
}

export function getTokenPayload() {
  const token = getAuthToken();
  if (!token) return null;
  return decodeTokenPayload(token);
}

export function getStoredUser() {
  return sessionStorage.getItem(USER_KEY);
}

export function setAuthSession(token: string, user: unknown) {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function clearAuthSession() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
