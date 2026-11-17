import { apiRequest, buildQuery, type Paginated } from './http';

/**
 * Clinical catalog API (UCE-DIAG-10, RF-16).
 *
 * The analysis types feed the selector of REC-U08 and, later, the sample entry of
 * DIAG-02. The catalog starts empty: it is loaded from the Catálogos Clínicos
 * screen, never from a hardcoded list in a form.
 */

export interface TipoAnalisis {
  id: string;
  nombre: string;
  descripcion: string | null;
  estado: string;
}

export interface TipoMuestra {
  id: string;
  nombre: string;
  descripcion: string | null;
  estado: string;
}

export interface CatalogoFilters {
  q?: string;
  estado?: string;
  limit?: number;
  offset?: number;
}

/** Repository convention: 20 per page, capped at 100 by the backend. */
export const CATALOGO_PAGE_SIZE = 20;

export interface TipoCatalogoPayload {
  nombre: string;
  descripcion?: string;
}

function query(filters: CatalogoFilters): string {
  return buildQuery({
    q: filters.q,
    estado: filters.estado,
    limit: filters.limit ?? CATALOGO_PAGE_SIZE,
    offset: filters.offset ?? 0,
  });
}

export function listTiposAnalisis(
  token: string | null,
  filters: CatalogoFilters = {},
): Promise<Paginated<TipoAnalisis>> {
  return apiRequest<Paginated<TipoAnalisis>>(`/tipos-analisis?${query(filters)}`, { token });
}

export function listTiposMuestra(
  token: string | null,
  filters: CatalogoFilters = {},
): Promise<Paginated<TipoMuestra>> {
  return apiRequest<Paginated<TipoMuestra>>(`/tipos-muestra?${query(filters)}`, { token });
}

export function createTipoAnalisis(
  token: string | null,
  datos: TipoCatalogoPayload,
): Promise<TipoAnalisis> {
  return apiRequest<TipoAnalisis>('/tipos-analisis', { method: 'POST', token, body: datos });
}

export function updateTipoAnalisis(
  token: string | null,
  id: string,
  cambios: Partial<TipoCatalogoPayload>,
): Promise<TipoAnalisis> {
  return apiRequest<TipoAnalisis>(`/tipos-analisis/${id}`, {
    method: 'PATCH',
    token,
    body: cambios,
  });
}

export function deactivateTipoAnalisis(
  token: string | null,
  id: string,
): Promise<TipoAnalisis> {
  return apiRequest<TipoAnalisis>(`/tipos-analisis/${id}/baja`, { method: 'POST', token });
}

export function createTipoMuestra(
  token: string | null,
  datos: TipoCatalogoPayload,
): Promise<TipoMuestra> {
  return apiRequest<TipoMuestra>('/tipos-muestra', { method: 'POST', token, body: datos });
}

export function updateTipoMuestra(
  token: string | null,
  id: string,
  cambios: Partial<TipoCatalogoPayload>,
): Promise<TipoMuestra> {
  return apiRequest<TipoMuestra>(`/tipos-muestra/${id}`, {
    method: 'PATCH',
    token,
    body: cambios,
  });
}

export function deactivateTipoMuestra(token: string | null, id: string): Promise<TipoMuestra> {
  return apiRequest<TipoMuestra>(`/tipos-muestra/${id}/baja`, { method: 'POST', token });
}
