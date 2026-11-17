import { apiRequest, buildQuery, type Paginated } from './http';

/**
 * Patient API (UCE-REC-16/17/18/19, UCE-REC-S-01).
 *
 * Contract fixed by `backend/app/api/v1/pacientes.py` and
 * `backend/app/schemas/pacientes.py`. `sexo` is deliberately absent: no UCE
 * governs it (gap G13), so the API neither accepts nor exposes it.
 *
 * The backend validates every format rule and answers `400` with `campo`; the
 * screen only renders that message on the field.
 */

export interface Paciente {
  id: string;
  numero_registro: string;
  dni: string;
  nombre: string;
  apellido: string;
  /** `YYYY-MM-DD` (the backend's `date`). */
  fecha_nacimiento: string;
  domicilio: string | null;
  telefono: string;
  correo_electronico: string | null;
  obra_social: string | null;
  nivel_registro: string;
  estado: string;
  /** ISO timestamp of registration. */
  fecha_ingreso: string;
}

/** Filters named after the level-3 column, plus `q` for free text. */
export interface PacienteFilters {
  q?: string;
  dni?: string;
  nombre?: string;
  apellido?: string;
  estado?: string;
  limit?: number;
  offset?: number;
}

/** Payload for a new patient (REC-16 paso 2). Derived fields are not accepted. */
export interface PacienteCreate {
  dni: string;
  nombre: string;
  apellido: string;
  fecha_nacimiento: string;
  telefono: string;
  domicilio?: string | null;
  correo_electronico?: string | null;
  obra_social?: string | null;
}

/** Partial modification (REC-17): only the fields that changed travel. */
export type PacienteUpdate = Partial<PacienteCreate>;

/** Repository convention: 20 per page, capped at 100 by the backend. */
export const PACIENTES_PAGE_SIZE = 20;

export function listPacientes(
  token: string | null,
  filters: PacienteFilters = {},
): Promise<Paginated<Paciente>> {
  const query = buildQuery({
    q: filters.q,
    dni: filters.dni,
    nombre: filters.nombre,
    apellido: filters.apellido,
    estado: filters.estado,
    limit: filters.limit ?? PACIENTES_PAGE_SIZE,
    offset: filters.offset ?? 0,
  });
  return apiRequest<Paginated<Paciente>>(`/pacientes?${query}`, { token });
}

export function getPaciente(token: string | null, id: string): Promise<Paciente> {
  return apiRequest<Paciente>(`/pacientes/${id}`, { token });
}

export function createPaciente(
  token: string | null,
  datos: PacienteCreate,
): Promise<Paciente> {
  return apiRequest<Paciente>('/pacientes', { method: 'POST', token, body: datos });
}

export function updatePaciente(
  token: string | null,
  id: string,
  cambios: PacienteUpdate,
): Promise<Paciente> {
  return apiRequest<Paciente>(`/pacientes/${id}`, {
    method: 'PATCH',
    token,
    body: cambios,
  });
}

/** Logical deactivation (REC-19): the motivo is mandatory and goes to the audit. */
export function deactivatePaciente(
  token: string | null,
  id: string,
  motivo: string,
): Promise<Paciente> {
  return apiRequest<Paciente>(`/pacientes/${id}/baja`, {
    method: 'POST',
    token,
    body: { motivo },
  });
}
