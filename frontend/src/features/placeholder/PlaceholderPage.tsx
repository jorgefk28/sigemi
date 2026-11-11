/**
 * Minimal placeholder body for pages whose module is not implemented yet.
 * Shows the page title and an explicit pending line — no fabricated content.
 */
export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      <p className="mt-2 text-sm text-muted">Pantalla pendiente de implementación.</p>
    </div>
  );
}
