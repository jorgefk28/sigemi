import { apiRequest } from './http';
import { PAGE_SIZE, type Paginated } from './usuarios';

/**
 * Audit log read API (UCE-SEG-04, RF-14).
 *
 * The log is append-only: this module exposes read calls only. The listing
 * (SEG-U04) answers the repository pagination envelope and filters by
 * `usuario_id`, `fecha_desde` / `fecha_hasta` and the closed `accion` catalog
 * (D6); the detail (SEG-U05) adds the polymorphic `entidad_id` and the 0..N
 * field-level changes of the event. No route here writes anything (R1).
 */

/** One audit event as the listing shows it (SEG-U04 columns). */
export interface AuditoriaEvento {
  id: string;
  /** ISO-8601 UTC; the screen renders it in the viewer's local time (R4). */
  fecha_hora: string;
  usuario_id: string;
  usuario_nombre: string;
  usuario_apellido: string;
  modulo: string;
  accion: string;
  entidad_afectada: string;
  direccion_ip: string | null;
}

/** One field-level change of an audit event (`cambio_auditoria`). */
export interface CambioAuditoria {
  campo: string;
  valor_anterior: string | null;
  valor_nuevo: string | null;
}

/** One audit event with its header extras and its changes (SEG-U05). */
export interface AuditoriaDetalle extends AuditoriaEvento {
  entidad_id: string;
  cambios: CambioAuditoria[];
}

/** Filters named after the level-3 column (`fecha_*` filter `fecha_hora`). */
export interface AuditoriaFilters {
  usuario_id?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
  accion?: string;
  limit?: number;
  offset?: number;
}

function auditoriaQuery(filters: AuditoriaFilters): string {
  const params = new URLSearchParams();
  if (filters.usuario_id) {
    params.set('usuario_id', filters.usuario_id);
  }
  if (filters.fecha_desde) {
    params.set('fecha_desde', filters.fecha_desde);
  }
  if (filters.fecha_hasta) {
    params.set('fecha_hasta', filters.fecha_hasta);
  }
  if (filters.accion) {
    params.set('accion', filters.accion);
  }
  params.set('limit', String(filters.limit ?? PAGE_SIZE));
  params.set('offset', String(filters.offset ?? 0));
  return params.toString();
}

export function listAuditoria(
  token: string | null,
  filters: AuditoriaFilters = {},
): Promise<Paginated<AuditoriaEvento>> {
  return apiRequest<Paginated<AuditoriaEvento>>(
    `/auditoria?${auditoriaQuery(filters)}`,
    { token },
  );
}

export function getAuditoria(
  token: string | null,
  id: string,
): Promise<AuditoriaDetalle> {
  return apiRequest<AuditoriaDetalle>(`/auditoria/${id}`, { token });
}