import type { AuditoriaDetalle, AuditoriaEvento } from '../api/auditoria';
import type { User } from '../api/auth';

/**
 * Fixtures for the auditoría screens (SEG-U04 y SEG-U05). Each shape mirrors the
 * backend (`AuditoriaRead`, `AuditoriaDetalle` and the `{items, total, limit,
 * offset}` envelope pinned in `AGENTS.md`).
 */

/** A user creation event written by `Ana García` (midday UTC: stays on the same
 *  calendar day in any timezone near Argentina, so the date prefix is stable). */
export const eventoCrear: AuditoriaEvento = {
  id: 'a-crear',
  fecha_hora: '2026-11-12T15:30:00Z',
  usuario_id: 'u-ana',
  usuario_nombre: 'Ana',
  usuario_apellido: 'García',
  modulo: 'seguridad',
  accion: 'crear',
  entidad_afectada: 'usuario',
  direccion_ip: '192.168.1.10',
};

/** A successful login event (``accion`` = ``acceder``) by `Beto López`. */
export const eventoAcceder: AuditoriaEvento = {
  id: 'a-acceder',
  fecha_hora: '2026-11-12T14:00:00Z',
  usuario_id: 'u-beto',
  usuario_nombre: 'Beto',
  usuario_apellido: 'López',
  modulo: 'seguridad',
  accion: 'acceder',
  entidad_afectada: 'usuario',
  direccion_ip: '192.168.1.11',
};

/** An event whose IP was not captured: proves the ``—`` fallback. */
export const eventoSinIp: AuditoriaEvento = {
  id: 'a-sin-ip',
  fecha_hora: '2026-11-11T09:00:00Z',
  usuario_id: 'u-ana',
  usuario_nombre: 'Ana',
  usuario_apellido: 'García',
  modulo: 'seguridad',
  accion: 'eliminar',
  entidad_afectada: 'usuario',
  direccion_ip: null,
};

/** `GET /auditoria` answer. */
export function auditoriaPage(
  items: AuditoriaEvento[],
  envelope: { total?: number; limit?: number; offset?: number } = {},
) {
  return { items, total: items.length, limit: 20, offset: 0, ...envelope };
}

/** Field changes of a typical edit event. */
export const cambiosDeEdicion = [
  { campo: 'nombre', valor_anterior: 'Ana Viejo', valor_nuevo: 'Ana' },
  { campo: 'estado', valor_anterior: 'activo', valor_nuevo: 'inactivo' },
];

/** A detail whose password change is masked to `null` (the SEG-U05 rule). */
export const detalleConContrasena: AuditoriaDetalle = {
  ...eventoCrear,
  entidad_id: '11111111-2222-3333-4444-555555555555',
  cambios: [
    { campo: 'contrasena_hash', valor_anterior: null, valor_nuevo: null },
    { campo: 'nombre', valor_anterior: 'Ana Viejo', valor_nuevo: 'Ana' },
  ],
};

/** A detail with no field changes (a valid 0..N list). */
export const detalleSinCambios: AuditoriaDetalle = {
  ...eventoAcceder,
  entidad_id: '22222222-3333-4444-5555-666666666666',
  cambios: [],
};

/** The user catalog the ``usuario_id`` selector reads (`GET /usuarios`). */
export function usuariosSelector(
  items: User[],
  envelope: { total?: number; limit?: number; offset?: number } = {},
) {
  return { items, total: items.length, limit: 100, offset: 0, ...envelope };
}