import {
  createContext,
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

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Owns the session lifecycle: restore on boot via `GET /auth/me`, login,
 * and logout. A 401/403 from `/me` discards the stored token.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let cancelled = false;
    const token = loadToken();

    if (!token) {
      setStatus('unauthenticated');
      return;
    }

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
        }
        setUser(null);
        setStatus('unauthenticated');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      async login(username: string, password: string) {
        const token = await apiLogin(username, password);
        const meUser = await fetchMe(token.access_token);
        saveSession(token.access_token, meUser);
        setUser(meUser);
        setStatus('authenticated');
      },
      logout() {
        clearSession();
        setUser(null);
        setStatus('unauthenticated');
      },
    }),
    [status, user],
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
