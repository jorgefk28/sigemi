/**
 * Navigation model and role gating (S5).
 *
 * Backend role codes are closed: `administrador`, `bioquimico`, `profesor`.
 * A user may hold several; effective visibility is the union. An unknown code
 * grants nothing. Gating is presentational only — real authorization is the
 * backend's.
 *
 * Every page owns a URL path. The path is what the router matches, so a reload,
 * a deep link and the browser back button all land on the same screen.
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
  /** URL path owned by the page. */
  path: string;
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
  { id: 'dashboard', label: 'Panel de Control', title: 'Estado operativo del laboratorio', path: '/panel-control', roles: ['bioquimico'] },
  { id: 'agenda', label: 'Agenda y Turnos', title: 'Agenda y Turnos', path: '/agenda', roles: ['bioquimico'] },
  { id: 'pacientes', label: 'Pacientes', title: 'Pacientes', path: '/pacientes', roles: ['bioquimico'] },
  { id: 'analisis', label: 'Análisis', title: 'Análisis', path: '/analisis', roles: ['bioquimico'] },
  { id: 'resultados', label: 'Resultados', title: 'Resultados', path: '/resultados', roles: ['bioquimico'] },
  { id: 'insumos', label: 'Insumos y Stock', title: 'Insumos y Stock', path: '/insumos', roles: ['bioquimico', 'profesor'] },
  { id: 'residuos', label: 'Control de Residuos', title: 'Control de Residuos', path: '/residuos', roles: ['bioquimico', 'profesor'] },
  { id: 'reportes', label: 'Reportes y Estadísticas', title: 'Reportes y Estadísticas', path: '/reportes', roles: ['bioquimico'] },
  { id: 'usuarios', label: 'Usuarios y Roles', title: 'Usuarios y Roles', path: '/usuarios', roles: [] },
  { id: 'auditoria', label: 'Auditoría', title: 'Auditoría', path: '/auditoria', roles: [] },
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

/**
 * Screens that belong to the signed-in account, not to the module map (D3).
 * The sidebar keeps being the map of business modules, so these paths are
 * reachable only from the header's user menu; they are valid for every
 * authenticated role.
 */
export interface AccountRoute {
  path: string;
  section: string;
  title: string;
}

export const ACCOUNT_ROUTES: AccountRoute[] = [
  { path: '/perfil', section: 'Mi cuenta', title: 'Mi perfil' },
  { path: '/perfil/contrasena', section: 'Mi cuenta', title: 'Cambiar contraseña' },
];

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

/** Page that owns a URL path, when the path is one of the module pages. */
export function pageByPath(pathname: string): NavPage | undefined {
  return PAGES.find(
    (page) => pathname === page.path || pathname.startsWith(`${page.path}/`),
  );
}

/** Account screen that owns a URL path, when there is one. */
export function accountRouteByPath(pathname: string): AccountRoute | undefined {
  return ACCOUNT_ROUTES.find((route) => route.path === pathname);
}

/** Path a user lands on: the first page its roles can see, else the default. */
export function homePath(roles: string[]): string {
  const first = visibleGroups(roles)[0]?.pages[0];
  return first?.path ?? (findPage(DEFAULT_PAGE_ID) as NavPage).path;
}

/** Group that contains a page, if any. */
export function groupOf(pageId: string): NavGroup | undefined {
  return NAV_GROUPS.find((group) => group.pages.some((page) => page.id === pageId));
}
