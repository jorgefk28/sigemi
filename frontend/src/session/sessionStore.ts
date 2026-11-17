import type { User } from '../api/auth';

/**
 * Session persistence. The token and user live in `sessionStorage` (not
 * `localStorage`) so they are dropped when the tab closes and never written to
 * disk.
 *
 * Every access is guarded: `sessionStorage` is synchronous and can throw when
 * storage is disabled by policy or full. Alternativas: romper el arranque de la
 * SPA por un cuota llena es peor que perder la sesión, así que un acceso
 * fallido se trata como "no hay sesión".
 */

const TOKEN_KEY = 'sigemi.access_token';
const USER_KEY = 'sigemi.user';

function read(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): boolean {
  try {
    sessionStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function remove(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // Nothing to do: the token cannot be erased, so the session lives in memory.
  }
}

/** Persist the session. Returns false when the browser refused to store it. */
export function saveSession(token: string, user: User): boolean {
  const tokenSaved = write(TOKEN_KEY, token);
  write(USER_KEY, JSON.stringify(user));
  return tokenSaved;
}

export function loadToken(): string | null {
  return read(TOKEN_KEY);
}

/** The stored user, if any. `null` on a malformed or unreadable entry. */
export function loadUser(): User | null {
  const raw = read(USER_KEY);
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
  remove(TOKEN_KEY);
  remove(USER_KEY);
}
