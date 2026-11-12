import type { User } from '../api/auth';
import type { Rol } from '../api/usuarios';

/**
 * Fixtures for the Seguridad screens. Every shape mirrors the real backend
 * (`UsuarioRead`, `RolRead`, and the `{items, total, limit, offset}` envelope
 * pinned in `AGENTS.md`).
 */

/** The signed-in administrator. Its id is what the self-deactivation rule keys on. */
export const adminSession: User = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  nombre: 'Ada',
  apellido: 'Administradora',
  correo_electronico: 'ada@unam.edu.ar',
  estado: 'activo',
  roles: ['administrador'],
};

/** Active user holding two roles: proves the table shows all of them. */
export const anaActiva: User = {
  id: 'u-ana',
  nombre: 'Ana',
  apellido: 'García',
  correo_electronico: 'ana@unam.edu.ar',
  estado: 'activo',
  roles: ['bioquimico', 'profesor'],
};

export const betoActivo: User = {
  id: 'u-beto',
  nombre: 'Beto',
  apellido: 'López',
  correo_electronico: 'beto@unam.edu.ar',
  estado: 'activo',
  roles: ['profesor'],
};

export const betoInactivo: User = { ...betoActivo, estado: 'inactivo' };

/** The closed catalog seeded by the data migration. */
export const catalogoRoles: Rol[] = [
  { id: 'r-bio', codigo: 'bioquimico', nombre: 'Bioquímico' },
  { id: 'r-prof', codigo: 'profesor', nombre: 'Profesor' },
  { id: 'r-adm', codigo: 'administrador', nombre: 'Administrador' },
];

/** `GET /roles` answer. */
export function rolesPage(items: Rol[] = catalogoRoles) {
  return { items, total: items.length, limit: 100, offset: 0 };
}

/** `GET /usuarios` answer. */
export function usuariosPage(
  items: User[],
  envelope: { total?: number; limit?: number; offset?: number } = {},
) {
  return { items, total: items.length, limit: 20, offset: 0, ...envelope };
}
