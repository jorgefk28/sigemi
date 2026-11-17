import { apiRequest, buildQuery, type Paginated } from './http';

/**
 * Clinical record API (UCE-DIAG-01, DIAG-06, DIAG-07).
 *
 * The record is a key-value store, so the payload is a map. The **catalog of
 * accepted keys is served by the API** (`getCamposClinicos`): the form renders
 * from it and keeps no second copy, which is what makes changing the clinical
 * list a one-place change.
 */

export interface CampoClinico {
  campo: string;
  etiqueta: string;
  obligatorio: boolean;
}

export interface FichaClinica {
  id: string;
  paciente_id: string;
  paciente_apellido: string;
  paciente_nombre: string;
  paciente_dni: string;
  profesional_id: string;
  profesional_nombre: string;
  fecha_consulta: string;
  version_actual: number;
  estado: string;
  datos: Record<string, string>;
}

export interface FichaFilters {
  paciente_id?: string;
  limit?: number;
  offset?: number;
}

/** Repository convention: 20 per page, capped at 100 by the backend. */
export const FICHAS_PAGE_SIZE = 20;

export function getCamposClinicos(token: string | null): Promise<CampoClinico[]> {
  return apiRequest<CampoClinico[]>('/fichas-clinicas/campos', { token });
}

export function listFichas(
  token: string | null,
  filters: FichaFilters = {},
): Promise<Paginated<FichaClinica>> {
  const query = buildQuery({
    paciente_id: filters.paciente_id,
    limit: filters.limit ?? FICHAS_PAGE_SIZE,
    offset: filters.offset ?? 0,
  });
  return apiRequest<Paginated<FichaClinica>>(`/fichas-clinicas?${query}`, { token });
}

export function getFicha(token: string | null, id: string): Promise<FichaClinica> {
  return apiRequest<FichaClinica>(`/fichas-clinicas/${id}`, { token });
}

export function createFicha(
  token: string | null,
  pacienteId: string,
  datos: Record<string, string>,
): Promise<FichaClinica> {
  return apiRequest<FichaClinica>('/fichas-clinicas', {
    method: 'POST',
    token,
    body: { paciente_id: pacienteId, datos },
  });
}

/** Partial modification (UCE-DIAG-07): only the fields sent travel. */
export function updateFicha(
  token: string | null,
  id: string,
  datos: Record<string, string>,
): Promise<FichaClinica> {
  return apiRequest<FichaClinica>(`/fichas-clinicas/${id}`, {
    method: 'PATCH',
    token,
    body: { datos },
  });
}
