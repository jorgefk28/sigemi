import type { User } from '../api/auth';

/**
 * Session persistence. The token and user live in `sessionStorage` (not
 * `localStorage`) so they are dropped when the tab closes and never written to
 * disk.
 */

const TOKEN_KEY = 'sigemi.access_token';
const USER_KEY = 'sigemi.user';

export function saveSession(token: string, user: User): void {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function loadToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function loadUser(): User | null {
  const raw = sessionStorage.getItem(USER_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}
