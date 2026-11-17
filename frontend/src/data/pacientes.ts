/**
 * Patient persistence bridge (spec S5 of `odd/tasks/07-frontend-backoffice.md`).
 *
 * The delivered screens keep their global store and their own model; this module
 * is the only place that talks to `/api/v1/pacientes` and translates between the
 * two shapes. Two rules make the whole screen work:
 *
 * 1. **Backend rows win, the demo dataset survives** (S4): the hydrated list is
 *    `[...reales, ...seed sin el mismo DNI]`, so a fresh database still shows the
 *    prototype's patients and a real alta appears on top of them.
 * 2. **Editing a demo patient persists it** (S5): a row that came from the seed
 *    has no UUID yet, so the first write issues a `POST` instead of a `PATCH`.
 *    From then on the patient has an identity and later edits are updates.
 */

import { ApiError } from '../api/http';
import {
  createPaciente,
  deactivatePaciente,
  listPacientes,
  updatePaciente,
  type PacienteCreate,
  type Paciente as ApiPaciente,
} from '../api/pacientes';
import { pacientesStore, type Paciente } from '../screens/components/clinica';
import { loadToken } from '../session/sessionStore';

/** Demo dataset, captured before the first hydration replaces the store. */
const SEED: readonly Paciente[] = pacientesStore.get();

/** Pending DNIs (without dots) → backend UUID. */
const ids = new Map<string, string>();

const sinPuntos = (dni: string) => dni.replace(/\./g, '');

/** `12345678` → `12.345.678` (the format the screens render). */
export function formatearDni(dni: string): string {
  return dni.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** `YYYY-MM-DD` (or a timestamp) → `dd/mm/yyyy`. */
function fechaAr(valor: string | null): string {
  if (!valor) {
    return '';
  }
  const [anio, mes, dia] = valor.slice(0, 10).split('-');
  return `${dia}/${mes}/${anio}`;
}

/** `dd/mm/yyyy` → `YYYY-MM-DD`. */
function fechaIso(valor: string): string {
  return valor.split('/').reverse().join('-');
}

function mapear(paciente: ApiPaciente): Paciente {
  return {
    dni: formatearDni(paciente.dni),
    nombre: paciente.nombre,
    apellido: paciente.apellido,
    nacimiento: fechaAr(paciente.fecha_nacimiento),
    sexo: (paciente.sexo ?? '') as Paciente['sexo'],
    // Level 3 has no occupation column (A1): the screen no longer offers it.
    ocupacion: '',
    telefono: paciente.telefono,
    correo: paciente.correo_electronico ?? '',
    direccion: paciente.domicilio ?? '',
    obraSocial: paciente.obra_social ?? '',
    registro: fechaAr(paciente.fecha_ingreso),
    activo: paciente.estado === 'activo',
  };
}

/**
 * Payload for the API. Optional text travels as `''` rather than `null`: the
 * backend PATCH drops `null` (`exclude_none`) and would never clear a field,
 * while its own normalizer turns `''` into `NULL`.
 */
function aPayload(paciente: Paciente): PacienteCreate {
  return {
    dni: sinPuntos(paciente.dni),
    nombre: paciente.nombre.trim(),
    apellido: paciente.apellido.trim(),
    fecha_nacimiento: fechaIso(paciente.nacimiento),
    telefono: paciente.telefono.trim(),
    sexo: paciente.sexo || '',
    correo_electronico: paciente.correo.trim() || '',
    domicilio: paciente.direccion.trim() || '',
    obra_social: paciente.obraSocial.trim() || '',
  };
}

/** Replace the store with `real rows first, then whatever the seed still owns`. */
export async function hidratarPacientes(): Promise<void> {
  const pagina = await listPacientes(loadToken(), { limit: 100 });
  const reales = pagina.items.map((fila) => {
    ids.set(fila.dni, fila.id);
    return mapear(fila);
  });
  const yaReales = new Set(reales.map((p) => sinPuntos(p.dni)));
  const demo = SEED.filter((p) => !yaReales.has(sinPuntos(p.dni)));
  pacientesStore.set(() => [...reales, ...demo]);
}

/** Resolve the backend identity of a row, creating it when it only exists in the seed. */
async function asegurarId(paciente: Paciente): Promise<string> {
  const conocido = ids.get(sinPuntos(paciente.dni));
  if (conocido) {
    return conocido;
  }
  const creado = await createPaciente(loadToken(), aPayload(paciente));
  ids.set(creado.dni, creado.id);
  return creado.id;
}

/**
 * Create or update one patient and re-read the list.
 *
 * `dniOriginal` is the key the row had when the form opened; the API forbids
 * changing a stored DNI, so an edited key means a new record.
 */
export async function guardarPaciente(
  paciente: Paciente,
  dniOriginal?: string,
): Promise<void> {
  const id = dniOriginal ? ids.get(sinPuntos(dniOriginal)) : undefined;
  const clave = sinPuntos(paciente.dni);

  if (id && clave === sinPuntos(dniOriginal ?? '')) {
    await updatePaciente(loadToken(), id, aPayload(paciente));
  } else {
    const creado = await createPaciente(loadToken(), aPayload(paciente));
    ids.set(creado.dni, creado.id);
  }

  await hidratarPacientes();
}

/** Logical deactivation (UCE-REC-19). A demo row is persisted first. */
export async function darDeBajaPaciente(
  paciente: Paciente,
  motivo: string,
): Promise<void> {
  const id = await asegurarId(paciente);
  await deactivatePaciente(loadToken(), id, motivo);
  await hidratarPacientes();
}

/** User-facing message of a failed write. */
export function mensajeDeError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  return 'No se pudo completar la operación';
}
