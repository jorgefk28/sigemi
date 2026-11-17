/**
 * Shown when there is a stored token but the server did not answer, so the
 * session could not be verified.
 *
 * It is deliberately not the login form: the session is not known to be gone,
 * and asking for credentials would suggest otherwise.
 */
export function SessionUnavailable({ onRetry }: { onRetry: () => void }) {
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
        onClick={onRetry}
        className="mt-3 rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
      >
        Reintentar
      </button>
    </div>
  );
}
