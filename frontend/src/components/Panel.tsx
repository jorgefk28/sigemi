import type { ReactNode } from 'react';

/**
 * Card primitive used by the dashboard. A header strip (11px bold uppercase title
 * + optional muted meta or action on the right) sits above the body content.
 *
 * `action` exists for REP-02 pasos 4-5: an indicator is selectable and leads to
 * the module that governs it (A-10), so the card needs a place for that link.
 */
export function Panel({
  title,
  meta,
  action,
  children,
}: {
  title: string;
  meta?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-md border border-gray-200 bg-white">
      <header className="flex items-center justify-between border-b border-gray-200 px-4 py-2">
        <h3 className="text-[11px] font-bold uppercase tracking-wide text-gray-500">{title}</h3>
        <div className="flex items-center gap-2">
          {meta && <span className="text-[11px] text-muted">{meta}</span>}
          {action}
        </div>
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}
