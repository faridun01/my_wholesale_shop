const TOKEN_KEY = 'token';
const USER_KEY = 'user';

export function getAuthToken() {
  return sessionStorage.getItem(TOKEN_KEY);
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
