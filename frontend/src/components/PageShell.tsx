import type { ReactNode } from 'react';

interface Breadcrumb {
  section: string;
  title: string;
}

interface PageShellProps {
  /** Left column: the navigation sidebar. */
  sidebar: ReactNode;
  breadcrumb: Breadcrumb;
  /** Right-aligned header actions (empty for now). */
  actions?: ReactNode;
  /** Scrollable body content. */
  children: ReactNode;
}

/**
 * Application chrome (S6): sidebar + header + scrollable body. The root fills
 * the viewport (`h-screen overflow-hidden`) so only the body scrolls.
 */
export function PageShell({ sidebar, breadcrumb, actions, children }: PageShellProps) {
  return (
    <div className="flex h-screen overflow-hidden">
      {sidebar}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6">
          <nav aria-label="Miga de pan" className="flex items-baseline gap-2">
            <span className="text-xs text-muted">{breadcrumb.section}</span>
            <span className="text-xs text-gray-300" aria-hidden="true">
              /
            </span>
            <span className="text-[13px] font-semibold text-gray-900">{breadcrumb.title}</span>
          </nav>
          <div className="flex items-center gap-3">{actions}</div>
        </header>
        <main className="flex-1 overflow-auto bg-gray-100 p-6">
          <div className="mx-auto max-w-[1200px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
