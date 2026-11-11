/**
 * Explicit empty state for list bodies. Shown while a module's data source is
 * not yet wired, so the UI never fabricates content.
 */
export function EmptyState({ message = 'Sin datos todavía' }: { message?: string }) {
  return <p className="text-sm text-muted">{message}</p>;
}
