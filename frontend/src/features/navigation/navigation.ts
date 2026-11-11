/**
 * Navigation model and role gating (S5).
 *
 * Backend role codes are closed: `administrador`, `bioquimico`, `profesor`.
 * A user may hold several; effective visibility is the union. An unknown code
 * grants nothing. Gating is presentational only — real authorization is the
 * backend's.
 */

export type RoleCode = 'administrador' | 'bioquimico' | 'profesor';

/** Display label for each known backend role code. */
export const ROLE_LABELS: Record<RoleCode, string> = {
  administrador: 'Administrador',
  bioquimico: 'Bioquímico/Doctor',
  profesor: 'Profesor',
};

/** Map a role code to its display label; unknown codes fall back to the code. */
export function roleLabel(code: string): string {
  return ROLE_LABELS[code as RoleCode] ?? code;
}

export interface NavPage {
  id: string;
  /** Sidebar navigation label (visible name). */
  label: string;
  /** Page title used in the breadcrumb and page heading. */
  title: string;
  /**
   * Non-admin roles allowed to view the page. `administrador` is intentionally
   * omitted: the administrator sees every page (handled in `canSeePage`).
   */
  roles: RoleCode[];
}

export interface NavGroup {
  id: string;
  label: string;
  pages: NavPage[];
}

/** Flat list of every page, in navigation order. */
export const PAGES: NavPage[] = [
  { id: 'dashboard', label: 'Panel de Control', title: 'Estado operativo del laboratorio', roles: ['bioquimico'] },
  { id: 'agenda', label: 'Agenda y Turnos', title: 'Agenda y Turnos', roles: ['bioquimico'] },
  { id: 'pacientes', label: 'Pacientes', title: 'Pacientes', roles: ['bioquimico'] },
  { id: 'analisis', label: 'Análisis', title: 'Análisis', roles: ['bioquimico'] },
  { id: 'resultados', label: 'Resultados', title: 'Resultados', roles: ['bioquimico'] },
  { id: 'insumos', label: 'Insumos y Stock', title: 'Insumos y Stock', roles: ['bioquimico', 'profesor'] },
  { id: 'residuos', label: 'Control de Residuos', title: 'Control de Residuos', roles: ['bioquimico', 'profesor'] },
  { id: 'reportes', label: 'Reportes y Estadísticas', title: 'Reportes y Estadísticas', roles: ['bioquimico'] },
  { id: 'usuarios', label: 'Usuarios y Roles', title: 'Usuarios y Roles', roles: [] },
  { id: 'auditoria', label: 'Auditoría', title: 'Auditoría', roles: [] },
];

/** Groups in sidebar order. */
export const NAV_GROUPS: NavGroup[] = [
  { id: 'principal', label: 'Principal', pages: [PAGES[0], PAGES[1], PAGES[2]] },
  { id: 'laboratorio', label: 'Laboratorio', pages: [PAGES[3], PAGES[4]] },
  { id: 'insumos', label: 'Insumos', pages: [PAGES[5], PAGES[6]] },
  { id: 'reportes', label: 'Reportes', pages: [PAGES[7]] },
  { id: 'administracion', label: 'Administración', pages: [PAGES[8], PAGES[9]] },
];

export const DEFAULT_PAGE_ID = 'dashboard';

/** True when a user holding `roles` may view `page`. Administrador sees all. */
export function canSeePage(page: NavPage, roles: string[]): boolean {
  return roles.includes('administrador') || page.roles.some((role) => roles.includes(role));
}

/** Groups filtered to only the pages the user may see; empty groups are dropped. */
export function visibleGroups(roles: string[]): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    pages: group.pages.filter((page) => canSeePage(page, roles)),
  })).filter((group) => group.pages.length > 0);
}

export function findPage(id: string): NavPage | undefined {
  return PAGES.find((page) => page.id === id);
}

/** Group that contains a page, if any. */
export function groupOf(pageId: string): NavGroup | undefined {
  return NAV_GROUPS.find((group) => group.pages.some((page) => page.id === pageId));
}
