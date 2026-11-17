import { apiRequest, buildQuery, type Paginated } from './http';

/**
 * Wait-list API (UCE-REC-28, UCE-REC-29).
 *
 * Contract fixed by `backend/app/api/v1/lista_espera.py` and
 * `backend/app/schemas/lista_espera.py`. The listing resolves the patient's
 * name and dni server-side, so a row never costs a second request.
 *
 * The order is the backend's derived priority (`fecha_solicitud` and
 * `tipo_analisis_id` ascending, decision A9): the screen does not re-sort.
 */

/** State of a wait-list entry (level 3, amendment S11). */
export type EstadoListaEspera = 'pendiente' | 'asignado' | 'retirado';

export interface EntradaListaEspera {
  id: string;
  paciente_id: string;
  paciente_nombre: string;
  paciente_apellido: string;
  paciente_dni: string;
  /** The entry carries only the id: no catalog endpoint resolves its name yet. */
  tipo_analisis_id: string | null;
  /** ISO timestamp (UTC). */
  fecha_solicitud: string;
  estado: string;
  observaciones: string | null;
}

export interface ListaEsperaFilters {
  tipo_analisis_id?: string;
  estado?: string;
  /** Calendar dates, `YYYY-MM-DD`. */
  fecha_desde?: string;
  fecha_hasta?: string;
  limit?: number;
  offset?: number;
}

/** Repository convention: 20 per page, capped at 100 by the backend. */
export const LISTA_ESPERA_PAGE_SIZE = 20;

export function listListaEspera(
  token: string | null,
  filters: ListaEsperaFilters = {},
): Promise<Paginated<EntradaListaEspera>> {
  const query = buildQuery({
    tipo_analisis_id: filters.tipo_analisis_id,
    estado: filters.estado,
    fecha_desde: filters.fecha_desde,
    fecha_hasta: filters.fecha_hasta,
    limit: filters.limit ?? LISTA_ESPERA_PAGE_SIZE,
    offset: filters.offset ?? 0,
  });
  return apiRequest<Paginated<EntradaListaEspera>>(`/lista-espera?${query}`, { token });
}

/** Remove an entry logically (REC-28 pasos 3-7); idempotent by contract. */
export function quitarDeListaEspera(
  token: string | null,
  id: string,
): Promise<EntradaListaEspera> {
  return apiRequest<EntradaListaEspera>(`/lista-espera/${id}/quitar`, {
    method: 'POST',
    token,
  });
}
