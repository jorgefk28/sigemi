import { apiRequest, buildQuery, type Paginated } from './http';

/**
 * Medical instruction API (UCE-REC-10 a REC-13, RF-02).
 *
 * Contract fixed by `backend/app/api/v1/indicaciones.py`. The listing resolves
 * `tipo_analisis_nombre`, so a row never costs a second request; the three
 * mandatory fields answer `400` with `campo` and the form places the message on
 * the field.
 *
 * Deleting is logical (`estado = inactiva`): historical appointments still point
 * at the instruction they used, and UCE-REC-12 says so in its own comment.
 */

export interface IndicacionMedica {
  id: string;
  titulo: string;
  contenido: string;
  tipo_analisis_id: string;
  tipo_analisis_nombre: string;
  estado: string;
  fecha_creacion: string;
  fecha_modificacion: string;
}

export interface IndicacionFilters {
  q?: string;
  estado?: string;
  tipo_analisis_id?: string;
  limit?: number;
  offset?: number;
}

/** Payload for a new instruction: all three fields are mandatory (REC-10 paso 2). */
export interface IndicacionCreate {
  titulo: string;
  contenido: string;
  tipo_analisis_id: string;
}

/** Partial modification (REC-11): only the fields that changed travel. */
export type IndicacionUpdate = Partial<IndicacionCreate>;

/** Repository convention: 20 per page, capped at 100 by the backend. */
export const INDICACIONES_PAGE_SIZE = 20;

function query(filters: IndicacionFilters): string {
  return buildQuery({
    q: filters.q,
    estado: filters.estado,
    tipo_analisis_id: filters.tipo_analisis_id,
    limit: filters.limit ?? INDICACIONES_PAGE_SIZE,
    offset: filters.offset ?? 0,
  });
}

export function listIndicaciones(
  token: string | null,
  filters: IndicacionFilters = {},
): Promise<Paginated<IndicacionMedica>> {
  return apiRequest<Paginated<IndicacionMedica>>(`/indicaciones-medicas?${query(filters)}`, {
    token,
  });
}

export function getIndicacion(
  token: string | null,
  id: string,
): Promise<IndicacionMedica> {
  return apiRequest<IndicacionMedica>(`/indicaciones-medicas/${id}`, { token });
}

export function createIndicacion(
  token: string | null,
  datos: IndicacionCreate,
): Promise<IndicacionMedica> {
  return apiRequest<IndicacionMedica>('/indicaciones-medicas', {
    method: 'POST',
    token,
    body: datos,
  });
}

export function updateIndicacion(
  token: string | null,
  id: string,
  cambios: IndicacionUpdate,
): Promise<IndicacionMedica> {
  return apiRequest<IndicacionMedica>(`/indicaciones-medicas/${id}`, {
    method: 'PATCH',
    token,
    body: cambios,
  });
}

/** Logical deactivation (REC-12 paso 5); idempotent by contract. */
export function deactivateIndicacion(
  token: string | null,
  id: string,
): Promise<IndicacionMedica> {
  return apiRequest<IndicacionMedica>(`/indicaciones-medicas/${id}/baja`, {
    method: 'POST',
    token,
  });
}
