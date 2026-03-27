const USER_KEY = 'user';

export function getAuthToken() {
  return null;
}

export function getTokenPayload() {
  return null;
}

export function getStoredUser() {
  return sessionStorage.getItem(USER_KEY) || localStorage.getItem(USER_KEY);
}

export function hasStoredSession() {
  return Boolean(getStoredUser());
}

export function setAuthSession(_token: string | null, user: unknown) {
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  localStorage.removeItem('token');
}

export function updateStoredUser(user: unknown) {
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuthSession() {
  sessionStorage.removeItem(USER_KEY);
  localStorage.removeItem('token');
  localStorage.removeItem(USER_KEY);
}
