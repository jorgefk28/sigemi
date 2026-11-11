import type { ReactNode } from 'react';
import { useAuth } from '../session/auth';
import { LoginPage } from '../features/auth/LoginPage';

/**
 * Auth guard for the protected area. Without a session the app renders the
 * login screen and never the shell. T2 wraps the real `PageShell` with this.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <div role="status" aria-live="polite" className="p-6 text-muted">
        Cargando…
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return <LoginPage />;
  }

  return <>{children}</>;
}