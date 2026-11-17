import { apiRequest, buildQuery, type Paginated } from './http';

/**
 * Mycological analysis API (UCE-DIAG-02 a DIAG-14).
 *
 * Contract fixed by `backend/app/api/v1/analisis.py`. The listing resolves the
 * patient, both types and both professionals, so a row never costs another
 * request. The state machine lives on the backend: the screen only offers the
 * actions the current state allows and shows the rejection when it is wrong.
 */

export type EstadoAnalisis =
  | 'pendiente'
  | 'en_proceso'
  | 'terminado'
  | 'validado'
  | 'invalidado';

export const ESTADO_LABELS: Record<string, string> = {
  pendiente: 'Pendiente',
  en_proceso: 'En proceso',
  terminado: 'Terminado',
  validado: 'Validado',
  invalidado: 'Invalidado',
};

export interface Hallazgo {
  id: string;
  tipo_hallazgo: string;
  dato: string;
  estado_alcanzado: string | null;
  fecha: string;
}

export interface HallazgoPayload {
  tipo_hallazgo: string;
  dato: string;
  estado_alcanzado?: string | null;
}

export interface Analisis {
  id: string;
  ficha_clinica_id: string;
  paciente_id: string;
  paciente_apellido: string;
  paciente_nombre: string;
  paciente_dni: string;
  tipo_analisis_id: string;
  tipo_analisis_nombre: string;
  muestra_id: string;
  tipo_muestra_nombre: string;
  profesional_responsable_id: string;
  profesional_responsable_nombre: string;
  profesional_validador_id: string | null;
  profesional_validador_nombre: string | null;
  version_actual: number;
  estado: string;
  fecha_creacion: string;
  fecha_validacion: string | null;
  motivo_invalidacion: string | null;
  hallazgos: Hallazgo[];
  addendum: Record<string, string> | null;
}

export interface Muestra {
  id: string;
  paciente_id: string;
  tipo_muestra_id: string;
  fecha_ingreso: string;
  observaciones: string | null;
  analisis: Analisis;
}

export interface AnalisisFilters {
  q?: string;
  estado?: string;
  tipo_analisis_id?: string;
  paciente_id?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
  limit?: number;
  offset?: number;
}

/** Repository convention: 20 per page, capped at 100 by the backend. */
export const ANALISIS_PAGE_SIZE = 20;

export interface TipoHallazgo {
  codigo: string;
  etiqueta: string;
}

export function getTiposHallazgo(token: string | null): Promise<TipoHallazgo[]> {
  return apiRequest<TipoHallazgo[]>('/tipos-hallazgo', { token });
}

export function listAnalisis(
  token: string | null,
  filters: AnalisisFilters = {},
): Promise<Paginated<Analisis>> {
  const query = buildQuery({
    q: filters.q,
    estado: filters.estado,
    tipo_analisis_id: filters.tipo_analisis_id,
    paciente_id: filters.paciente_id,
    fecha_desde: filters.fecha_desde,
    fecha_hasta: filters.fecha_hasta,
    limit: filters.limit ?? ANALISIS_PAGE_SIZE,
    offset: filters.offset ?? 0,
  });
  return apiRequest<Paginated<Analisis>>(`/analisis?${query}`, { token });
}

export function getAnalisis(token: string | null, id: string): Promise<Analisis> {
  return apiRequest<Analisis>(`/analisis/${id}`, { token });
}

export function registrarMuestra(
  token: string | null,
  datos: {
    paciente_id: string;
    tipo_muestra_id: string;
    tipo_analisis_id: string;
    ficha_clinica_id?: string;
    observaciones?: string;
  },
): Promise<Muestra> {
  return apiRequest<Muestra>('/muestras', { method: 'POST', token, body: datos });
}

export function actualizarEstado(
  token: string | null,
  id: string,
  estado: EstadoAnalisis,
  hallazgos: HallazgoPayload[] = [],
): Promise<Analisis> {
  return apiRequest<Analisis>(`/analisis/${id}/estado`, {
    method: 'PATCH',
    token,
    body: { estado, hallazgos },
  });
}

export function validarAnalisis(token: string | null, id: string): Promise<Analisis> {
  return apiRequest<Analisis>(`/analisis/${id}/validar`, { method: 'POST', token });
}

export function invalidarAnalisis(
  token: string | null,
  id: string,
  motivo: string,
): Promise<Analisis> {
  return apiRequest<Analisis>(`/analisis/${id}/invalidar`, {
    method: 'POST',
    token,
    body: { motivo },
  });
}

export function rechazarMuestra(
  token: string | null,
  id: string,
  motivo: string,
  observacion: string,
): Promise<Analisis> {
  return apiRequest<Analisis>(`/analisis/${id}/rechazar`, {
    method: 'POST',
    token,
    body: { motivo, observacion },
  });
}

export function agregarAddendum(
  token: string | null,
  id: string,
  motivo: string,
  contenido: string,
): Promise<Analisis> {
  return apiRequest<Analisis>(`/analisis/${id}/addendum`, {
    method: 'POST',
    token,
    body: { motivo, contenido },
  });
}
