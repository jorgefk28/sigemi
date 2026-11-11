import type { ReactNode } from 'react';

/**
 * Card primitive used by the dashboard (and later feature pages). A header
 * strip (11px bold uppercase title + optional muted meta on the right) sits
 * above the body content.
 */
export function Panel({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-md border border-gray-200 bg-white">
      <header className="flex items-center justify-between border-b border-gray-200 px-4 py-2">
        <h3 className="text-[11px] font-bold uppercase tracking-wide text-gray-500">{title}</h3>
        {meta && <span className="text-[11px] text-muted">{meta}</span>}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}
