import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../session/auth';
import { LoadingScreen } from '../components/LoadingScreen';

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
    return (
      <div className="mx-auto mt-10 max-w-md rounded-md border border-gray-200 bg-white p-4">
        <h1 className="text-base font-semibold text-gray-900">
          No se pudo conectar con el servidor
        </h1>
        <p className="mt-1 text-sm text-gray-700">
          Tu sesión sigue guardada. Reintentá cuando el servidor esté disponible.
        </p>
        <button
          type="button"
          onClick={reload}
          className="mt-3 rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
