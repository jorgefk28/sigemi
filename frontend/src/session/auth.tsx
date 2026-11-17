import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  AuthError,
  fetchMe,
  login as apiLogin,
  type User,
} from '../api/auth';
import { clearSession, loadToken, saveSession } from './sessionStore';

/**
 * `unavailable` means: there is a stored token, but the session could not be
 * restored because the server did not answer. It is deliberately different from
 * `unauthenticated`: the token is kept so a retry can succeed, and the UI says
 * "no se pudo conectar" instead of showing a login form the user does not need.
 */
export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'unavailable';

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  /** Retry the session restore after an `unavailable` boot. */
  reload: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Owns the session lifecycle: restore on boot via `GET /auth/me`, login, and
 * logout. A 401/403 from `/me` discards the stored token.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const token = loadToken();

    if (!token) {
      setStatus('unauthenticated');
      return;
    }

    setStatus('loading');
    fetchMe(token)
      .then((meUser) => {
        if (cancelled) {
          return;
        }
        saveSession(token, meUser);
        setUser(meUser);
        setStatus('authenticated');
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        if (error instanceof AuthError && (error.status === 401 || error.status === 403)) {
          clearSession();
          setUser(null);
          setStatus('unauthenticated');
          return;
        }
        // Network or 5xx: the token may still be valid, so it is not discarded.
        setUser(null);
        setStatus('unavailable');
      });

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const reload = useCallback(() => {
    setAttempt((valor) => valor + 1);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      async login(username: string, password: string) {
        const token = await apiLogin(username, password);
        const meUser = await fetchMe(token.access_token);
        // A browser that refuses to persist leaves an in-memory session: it
        // works until the next reload, which is better than failing the login.
        saveSession(token.access_token, meUser);
        setUser(meUser);
        setStatus('authenticated');
      },
      logout() {
        clearSession();
        setUser(null);
        setStatus('unauthenticated');
      },
      reload,
    }),
    [status, user, reload],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
