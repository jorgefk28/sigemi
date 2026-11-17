/** Full-viewport status used while the session is being restored. */
export function LoadingScreen() {
  return (
    <div role="status" aria-live="polite" className="p-6 text-muted">
      Cargando…
    </div>
  );
}
