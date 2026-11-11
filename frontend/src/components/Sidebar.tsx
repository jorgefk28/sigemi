import type { User } from '../api/auth';
import { roleLabel, type NavGroup, type NavPage } from '../features/navigation/navigation';

/** Two-letter initials from a user's first and last name. */
function initialsOf(user: User): string {
  const first = user.nombre.trim().charAt(0) ?? '';
  const last = user.apellido.trim().charAt(0) ?? '';
  return `${first}${last}`.toUpperCase() || 'S';
}

interface SidebarProps {
  user: User;
  /** Groups already gated to the pages the user may see. */
  groups: NavGroup[];
  activePageId: string;
  onSelectPage: (id: string) => void;
  onLogout: () => void;
}

/**
 * Fixed 220px sidebar (S6): brand block, gated navigation groups, and a footer
 * with the user block and the logout control.
 */
export function Sidebar({ user, groups, activePageId, onSelectPage, onLogout }: SidebarProps) {
  return (
    <aside
      className="flex h-full w-[220px] shrink-0 flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar"
      aria-label="Navegación principal"
    >
      {/* Brand */}
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="flex h-7 w-7 items-center justify-center rounded bg-brand text-sm font-bold text-white">
          S
        </div>
        <div className="min-w-0">
          <div className="text-[13px] font-bold tracking-[0.03em] text-white">SIGEMI</div>
          <div className="text-[10px] text-muted">Lab. Micología · UNaM</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1" aria-label="Menú de secciones">
        {groups.map((group) => (
          <div key={group.id} className="mb-1">
            <div className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              {group.label}
            </div>
            {group.pages.map((page: NavPage) => {
              const isActive = page.id === activePageId;
              return (
                <button
                  key={page.id}
                  type="button"
                  onClick={() => onSelectPage(page.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={[
                    'flex w-full items-center border-l-2 px-4 py-[7px] text-left text-[12.5px]',
                    isActive
                      ? 'border-brand bg-sidebar-border font-semibold text-white'
                      : 'border-transparent text-nav-text hover:bg-sidebar-border/50',
                  ].join(' ')}
                >
                  {page.label}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sidebar-border text-[11px] font-semibold text-white">
            {initialsOf(user)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12.5px] font-medium text-white">
              {user.nombre} {user.apellido}
            </div>
            <div className="truncate text-[10px] text-muted">
              {user.roles.length > 0 ? roleLabel(user.roles[0]) : ''}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="mt-2 w-full rounded border border-sidebar-border px-3 py-1.5 text-left text-[12.5px] text-nav-text hover:bg-sidebar-border/50"
        >
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
