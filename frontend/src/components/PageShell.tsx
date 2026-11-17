import type { ReactNode } from 'react';

interface Breadcrumb {
  section: string;
  title: string;
}

interface PageShellProps {
  /** Left column: the navigation sidebar. */
  sidebar: ReactNode;
  breadcrumb: Breadcrumb;
  /** Right-aligned header actions (the account menu). */
  actions?: ReactNode;
  /** Scrollable body content. */
  children: ReactNode;
}

/**
 * Id of the scrollable body. The shell focuses it after a navigation so a
 * keyboard or screen-reader user lands on the new screen instead of staying at
 * the top of the chrome; the skip link targets the same id.
 */
export const MAIN_CONTENT_ID = 'contenido-principal';

/**
 * Application chrome (S6): sidebar + header + scrollable body. The root fills
 * the viewport (`h-screen overflow-hidden`) so only the body scrolls.
 */
export function PageShell({ sidebar, breadcrumb, actions, children }: PageShellProps) {
  return (
    <div className="flex h-screen overflow-hidden">
      <a
        href={`#${MAIN_CONTENT_ID}`}
        className="sr-only rounded bg-white px-3 py-2 text-sm text-brand focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-30 focus:border focus:border-brand"
      >
        Ir al contenido
      </a>
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
        <main
          id={MAIN_CONTENT_ID}
          tabIndex={-1}
          className="flex-1 overflow-auto bg-gray-100 p-6 outline-none"
        >
          <div className="mx-auto max-w-[1200px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
