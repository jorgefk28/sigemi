import type { User } from './auth';
import { apiRequest } from './http';

/**
 * User and role administration API (UCE-SEG-02).
 *
 * The contract is fixed by `backend/app/api/v1/usuarios.py` and
 * `backend/app/api/v1/roles.py`; the closed role catalog is read, never
 * written (S3).
 */

/** Response envelope every list endpoint answers (`AGENTS.md`). */
export interface Paginated<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

/** One row of the closed role catalog. */
export interface Rol {
  id: string;
  codigo: string;
  nombre: string;
}

/** Repository convention: 20 per page, capped at 100 by the backend. */
export const PAGE_SIZE = 20;

const CATALOG_PAGE_SIZE = 100;

/** Filters named after the level-3 column, plus `q` for free text. */
export interface UserFilters {
  q?: string;
  estado?: string;
  rol?: string;
  limit?: number;
  offset?: number;
}

export interface UserCreate {
  nombre: string;
  apellido: string;
  correo_electronico: string;
  contrasena: string;
  roles: string[];
}

export interface UserUpdate {
  nombre?: string;
  apellido?: string;
  correo_electronico?: string;
  estado?: string;
}

function usersQuery(filters: UserFilters): string {
  const params = new URLSearchParams();
  if (filters.q) {
    params.set('q', filters.q);
  }
  if (filters.estado) {
    params.set('estado', filters.estado);
  }
  if (filters.rol) {
    params.set('rol', filters.rol);
  }
  params.set('limit', String(filters.limit ?? PAGE_SIZE));
  params.set('offset', String(filters.offset ?? 0));
  return params.toString();
}

export function listUsers(
  token: string | null,
  filters: UserFilters = {},
): Promise<Paginated<User>> {
  return apiRequest<Paginated<User>>(`/usuarios?${usersQuery(filters)}`, { token });
}

export function listRoles(token: string | null): Promise<Paginated<Rol>> {
  return apiRequest<Paginated<Rol>>(`/roles?limit=${CATALOG_PAGE_SIZE}`, { token });
}

export function createUser(token: string | null, datos: UserCreate): Promise<User> {
  return apiRequest<User>('/usuarios', { method: 'POST', token, body: datos });
}

export function updateUser(
  token: string | null,
  id: string,
  cambios: UserUpdate,
): Promise<User> {
  return apiRequest<User>(`/usuarios/${id}`, { method: 'PATCH', token, body: cambios });
}

/** Replace the whole role set: `PUT` is idempotent by contract (decision 4 of L13). */
export function replaceRoles(
  token: string | null,
  id: string,
  roles: string[],
): Promise<User> {
  return apiRequest<User>(`/usuarios/${id}/roles`, {
    method: 'PUT',
    token,
    body: { roles },
  });
}
