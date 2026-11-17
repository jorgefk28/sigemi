/**
 * Audit log bridge (spec S5 of `odd/tasks/07-frontend-backoffice.md`).
 *
 * The log is append-only and read-only for the SPA (RF-14). Two adaptations are
 * needed to fit the delivered screen:
 *
 * - the backend stores `fecha_hora` as one UTC timestamp; the screen shows a
 *   date and a time column in the viewer's local time;
 * - the backend has no `resumen`: the header is composed from the module, the
 *   entity and the field-level changes of the event (detail request), which is
 *   exactly what a reviewer needs to read.
 */

import {
  getAuditoria,
  listAuditoria,
  type AuditoriaDetalle,
  type AuditoriaEvento,
} from '../api/auditoria';
import { fmtDate, auditStore, type EventoAud } from '../screens/sigemi/core';
import { loadToken } from '../session/sessionStore';

/** Demo rows of the delivered prototype; kept after the real ones (S4). */
const SEED: readonly EventoAud[] = auditStore.get();

const MODULO_LABELS: Record<string, string> = {
  pacientes: 'Pacientes',
  usuarios: 'Usuarios',
  fichas_clinicas: 'Análisis',
  analisis: 'Análisis',
  auditoria: 'Auditoría',
  auth: 'Seguridad',
  indicaciones_medicas: 'Recepción',
  lista_espera: 'Recepción',
  catalogos: 'Catálogos',
  reportes: 'Reportes',
};

const ACCION_LABELS: Record<string, string> = {
  crear: 'Alta',
  modificar: 'Modificación',
  eliminar: 'Baja',
  consultar: 'Consulta',
  acceder: 'Acceso',
  bloquear: 'Bloqueo',
};

function resumen(accion: string, entidad: string, cambios: { campo: string }[]): string {
  const base = `${ACCION_LABELS[accion] ?? accion} de ${entidad}`;
  return cambios.length
    ? `${base} — campos: ${cambios.map((c) => c.campo).join(', ')}`
    : base;
}

function mapear(evento: AuditoriaEvento, detalle?: AuditoriaDetalle): EventoAud {
  const fecha = new Date(evento.fecha_hora);
  const cambios = (detalle?.cambios ?? []).map((c) => ({
    campo: c.campo,
    antes: c.valor_anterior ?? '—',
    despues: c.valor_nuevo ?? '—',
  }));
  return {
    id: evento.id,
    fecha: fmtDate(fecha),
    hora: fecha.toTimeString().slice(0, 8),
    usuario: `${evento.usuario_apellido}, ${evento.usuario_nombre}`,
    ip: evento.direccion_ip ?? '—',
    modulo: MODULO_LABELS[evento.modulo] ?? evento.modulo,
    accion: evento.accion.toUpperCase(),
    entidad: evento.entidad_afectada,
    entidadId: detalle?.entidad_id ?? '',
    resumen: resumen(evento.accion, evento.entidad_afectada, cambios),
    cambios,
  };
}

/** Read the most recent events and put them ahead of the demo trail. */
export async function hidratarAuditoria(limit = 100): Promise<void> {
  const pagina = await listAuditoria(loadToken(), { limit });
  const reales = pagina.items.map((evento) => mapear(evento));
  auditStore.set(() => [...reales, ...SEED]);
}

/** Fetch one event with its field-level changes (SEG-U05) and merge it in. */
export async function cargarDetalleAuditoria(id: string): Promise<EventoAud> {
  const yaCompleto = auditStore.get().find((e) => e.id === id && e.cambios.length > 0);
  if (yaCompleto) {
    return yaCompleto;
  }
  const completo = await getAuditoria(loadToken(), id);
  const detalle = mapear(completo, completo);
  auditStore.set((list) => list.map((e) => (e.id === id ? detalle : e)));
  return detalle;
}
