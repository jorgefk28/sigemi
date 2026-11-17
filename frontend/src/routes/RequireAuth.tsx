import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../session/auth';
import { LoadingScreen } from '../components/LoadingScreen';
import { SessionUnavailable } from '../components/SessionUnavailable';

/**
 * Auth guard for the protected area. Without a session the app sends the
 * browser to `/login` and never renders the shell.
 *
 * The guard is a redirect and not an inline render so the login screen owns its
 * own URL (SEG-U01): a reload on `/pacientes` restores the session and comes
 * back to `/pacientes`, and logging out leaves `/login` in the history.
 *
 * A stored token that cannot be verified because the server did not answer is
 * NOT a missing session: the token is kept and the guard offers a retry, instead
 * of pretending the user was logged out.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status, reload } = useAuth();

  if (status === 'loading') {
    return <LoadingScreen />;
  }

  if (status === 'unavailable') {
    return <SessionUnavailable onRetry={reload} />;
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
