import type { Paciente } from '../api/pacientes';

/**
 * Fixtures for the REC screens. Every shape mirrors the real backend
 * (`PacienteRead` and the `{items, total, limit, offset}` envelope pinned in
 * `AGENTS.md`).
 */

export const pacienteActivo: Paciente = {
  id: 'p-ana',
  numero_registro: 'PAC-1A2B3C4D',
  dni: '30123456',
  nombre: 'Ana',
  apellido: 'García',
  fecha_nacimiento: '1980-05-12',
  domicilio: 'San Lorenzo 123',
  telefono: '3764123456',
  correo_electronico: 'ana@correo.com',
  obra_social: 'OSDE',
  nivel_registro: 'completo',
  estado: 'activo',
  fecha_ingreso: '2026-11-01T12:00:00Z',
};

export const pacienteInactivo: Paciente = {
  ...pacienteActivo,
  id: 'p-beto',
  numero_registro: 'PAC-9F8E7D6C',
  dni: '28987654',
  nombre: 'Beto',
  apellido: 'López',
  fecha_nacimiento: '1975-01-30',
  telefono: '3764556677',
  correo_electronico: null,
  domicilio: null,
  obra_social: null,
  estado: 'inactivo',
};

/** `GET /pacientes` answer. */
export function pacientesPage(
  items: Paciente[],
  envelope: { total?: number; limit?: number; offset?: number } = {},
) {
  return { items, total: items.length, limit: 20, offset: 0, ...envelope };
}
