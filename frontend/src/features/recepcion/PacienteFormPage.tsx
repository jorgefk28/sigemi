import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../../api/http';
import {
  createPaciente,
  getPaciente,
  listPacientes,
  updatePaciente,
  type Paciente,
  type PacienteCreate,
  type PacienteUpdate,
} from '../../api/pacientes';
import { Btn } from '../../components/Btn';
import { FormField, INPUT_CLASSES, fieldDescribedBy } from '../../components/FormField';
import { loadToken } from '../../session/sessionStore';
import { useGoHome } from '../../routes/useGoHome';

/**
 * REC-U05 · Formulario de paciente, alta y edición (P3).
 *
 * Backing requirement: UCE-REC-16 pasos 2-6 (alta), UCE-REC-17 pasos 6-11
 * (edición), UCE-REC-15 paso 6 (modo «completar»); RF-05.
 *
 * The screen asks for the eight fields of REC-16 paso 2 and nothing else:
 * `numero_registro`, `estado`, `fecha_ingreso` and `nivel_registro` are derived
 * by the application, and `sexo` has no UCE behind it (gap G13).
 *
 * Every format rule (dni, telefono, correo, fecha) is the backend's and travels
 * back as `400` with `campo`; the form never decides it (R3).
 */

interface FormValues {
  dni: string;
  nombre: string;
  apellido: string;
  fecha_nacimiento: string;
  telefono: string;
  correo_electronico: string;
  domicilio: string;
  obra_social: string;
}

const NO_VALUES: FormValues = {
  dni: '',
  nombre: '',
  apellido: '',
  fecha_nacimiento: '',
  telefono: '',
  correo_electronico: '',
  domicilio: '',
  obra_social: '',
};

const REQUIRED: Array<{ field: keyof FormValues; message: string }> = [
  { field: 'dni', message: 'El DNI no puede estar vacío' },
  { field: 'nombre', message: 'El nombre no puede estar vacío' },
  { field: 'apellido', message: 'El apellido no puede estar vacío' },
  { field: 'fecha_nacimiento', message: 'La fecha de nacimiento no puede estar vacía' },
  { field: 'telefono', message: 'El teléfono no puede estar vacío' },
];

function valuesOf(paciente: Paciente): FormValues {
  return {
    dni: paciente.dni,
    nombre: paciente.nombre,
    apellido: paciente.apellido,
    fecha_nacimiento: paciente.fecha_nacimiento.slice(0, 10),
    telefono: paciente.telefono,
    correo_electronico: paciente.correo_electronico ?? '',
    domicilio: paciente.domicilio ?? '',
    obra_social: paciente.obra_social ?? '',
  };
}

function validate(values: FormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const { field, message } of REQUIRED) {
    if (!values[field].trim()) {
      errors[field] = message;
    }
  }
  return errors;
}

/** Only the fields that actually changed: an empty `PATCH` is a `400`. */
function changesOf(paciente: Paciente, values: FormValues): PacienteUpdate {
  const original = valuesOf(paciente);
  const cambios: PacienteUpdate = {};

  const igual = (a: string, b: string) => a.trim() === b.trim();
  /**
   * An emptied optional field travels as `''`, not as `null`: the backend
   * serializes the payload with `exclude_none=True`, so a `null` is dropped and
   * the field is silently left untouched. `''` survives that filter and
   * `normalizar_optional`/`normalizar_correo` turn it into `NULL`.
   */
  const optional = (value: string) => value.trim();

  if (!igual(values.dni, original.dni)) {
    cambios.dni = values.dni.trim();
  }
  if (!igual(values.nombre, original.nombre)) {
    cambios.nombre = values.nombre.trim();
  }
  if (!igual(values.apellido, original.apellido)) {
    cambios.apellido = values.apellido.trim();
  }
  if (!igual(values.fecha_nacimiento, original.fecha_nacimiento)) {
    cambios.fecha_nacimiento = values.fecha_nacimiento;
  }
  if (!igual(values.telefono, original.telefono)) {
    cambios.telefono = values.telefono.trim();
  }
  if (!igual(values.correo_electronico, original.correo_electronico)) {
    cambios.correo_electronico = optional(values.correo_electronico);
  }
  if (!igual(values.domicilio, original.domicilio)) {
    cambios.domicilio = optional(values.domicilio);
  }
  if (!igual(values.obra_social, original.obra_social)) {
    cambios.obra_social = optional(values.obra_social);
  }

  return cambios;
}

export function PacienteFormPage() {
  const { pacienteId } = useParams<{ pacienteId: string }>();
  const navigate = useNavigate();
  const goHome = useGoHome();
  const token = loadToken();
  const isCreate = pacienteId === undefined;

  const [paciente, setPaciente] = useState<Paciente | null>(null);
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'failed' | 'ready'>(
    isCreate ? 'ready' : 'loading',
  );
  const [attempt, setAttempt] = useState(0);

  const [values, setValues] = useState<FormValues>(NO_VALUES);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /** Set when a create is rejected because the DNI is already registered. */
  const [duplicateDni, setDuplicateDni] = useState<string | null>(null);

  useEffect(() => {
    if (isCreate || !pacienteId) {
      return;
    }
    let cancelled = false;
    setLoadState('loading');

    getPaciente(token, pacienteId)
      .then((encontrado) => {
        if (!cancelled) {
          setPaciente(encontrado);
          setValues(valuesOf(encontrado));
          setLoadState('ready');
        }
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        if (error instanceof ApiError && error.status === 403) {
          goHome();
          return;
        }
        setLoadState('failed');
      });

    return () => {
      cancelled = true;
    };
  }, [isCreate, pacienteId, token, attempt, goHome]);

  function changeValue(field: keyof FormValues, value: string) {
    setValues((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => {
      const next = { ...previous };
      delete next[field];
      return next;
    });
    // The offer to open the existing patient stops being true once the DNI is
    // edited: leaving it on screen points at the wrong record.
    if (field === 'dni') {
      setDuplicateDni(null);
    }
  }

  /** Open the existing patient when a create is rejected by a duplicate DNI. */
  async function openExisting(dni: string) {
    try {
      const pagina = await listPacientes(token, { dni, limit: 1 });
      const encontrado = pagina.items[0];
      if (encontrado) {
        navigate(`/pacientes/${encontrado.id}/editar`);
      }
    } catch {
      // The message on the field already tells the user what happened; a
      // failed lookup must not turn into a second error.
    }
  }

  async function save() {
    if (saving) {
      return;
    }

    const localErrors = validate(values);
    setErrors(localErrors);
    setGeneralError(null);
    setDuplicateDni(null);
    if (Object.keys(localErrors).length > 0) {
      return;
    }

    setSaving(true);
    try {
      if (isCreate) {
        const payload: PacienteCreate = {
          dni: values.dni.trim(),
          nombre: values.nombre.trim(),
          apellido: values.apellido.trim(),
          fecha_nacimiento: values.fecha_nacimiento,
          telefono: values.telefono.trim(),
          correo_electronico: values.correo_electronico.trim() || null,
          domicilio: values.domicilio.trim() || null,
          obra_social: values.obra_social.trim() || null,
        };
        await createPaciente(token, payload);
        // REC-16 paso 6: the alta returns to the listing.
        navigate('/pacientes');
      } else if (paciente) {
        const cambios = changesOf(paciente, values);
        if (Object.keys(cambios).length > 0) {
          await updatePaciente(token, paciente.id, cambios);
        }
        // REC-17 pasos 9-11: the edition returns to the patient's record.
        navigate(`/pacientes/${paciente.id}`);
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        goHome();
        return;
      }
      // R3: a field-scoped rejection belongs on the field, not in a banner.
      if (error instanceof ApiError && error.campo) {
        setErrors({ [error.campo]: error.message });
        if (isCreate && error.campo === 'dni') {
          setDuplicateDni(values.dni.trim());
        }
      } else {
        // A network failure must never be reported as a duplicate DNI.
        setGeneralError(
          error instanceof ApiError
            ? error.message
            : 'No se pudo guardar el paciente',
        );
      }
      setSaving(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void save();
  }

  function goBack() {
    if (isCreate) {
      navigate('/pacientes');
    } else if (pacienteId) {
      navigate(`/pacientes/${pacienteId}`);
    }
  }

  if (loadState === 'loading') {
    return (
      <div role="status" aria-live="polite" className="text-sm text-muted">
        Cargando…
      </div>
    );
  }

  if (loadState === 'failed') {
    return (
      <div>
        <p className="text-sm text-gray-800">No se pudo cargar el paciente</p>
        <div className="mt-2 flex gap-2">
          <Btn onClick={() => setAttempt((valor) => valor + 1)}>Reintentar</Btn>
          <Btn onClick={() => navigate('/pacientes')}>Volver</Btn>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-[28px] font-bold leading-tight tracking-tight text-gray-900">
          {isCreate ? 'Nuevo Paciente' : 'Editar paciente'}
        </h1>
        <Btn onClick={goBack}>Cancelar</Btn>
      </div>

      <form
        aria-label={isCreate ? 'Alta de paciente' : 'Edición de paciente'}
        className="mt-6 max-w-xl rounded-md border border-gray-200 bg-white p-4"
        onSubmit={handleSubmit}
      >
        <FormField id="dni" label="DNI" error={errors.dni}>
          <input
            id="dni"
            name="dni"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={values.dni}
            onChange={(event) => changeValue('dni', event.target.value)}
            className={INPUT_CLASSES}
            aria-invalid={errors.dni ? true : undefined}
            aria-describedby={fieldDescribedBy('dni', errors.dni)}
          />
          {duplicateDni && (
            <Btn className="mt-2" onClick={() => void openExisting(duplicateDni)}>
              Abrir la ficha del paciente existente
            </Btn>
          )}
        </FormField>

        <FormField id="nombre" label="Nombre" error={errors.nombre}>
          <input
            id="nombre"
            name="nombre"
            type="text"
            autoComplete="off"
            value={values.nombre}
            onChange={(event) => changeValue('nombre', event.target.value)}
            className={INPUT_CLASSES}
            aria-invalid={errors.nombre ? true : undefined}
            aria-describedby={fieldDescribedBy('nombre', errors.nombre)}
          />
        </FormField>

        <FormField id="apellido" label="Apellido" error={errors.apellido}>
          <input
            id="apellido"
            name="apellido"
            type="text"
            autoComplete="off"
            value={values.apellido}
            onChange={(event) => changeValue('apellido', event.target.value)}
            className={INPUT_CLASSES}
            aria-invalid={errors.apellido ? true : undefined}
            aria-describedby={fieldDescribedBy('apellido', errors.apellido)}
          />
        </FormField>

        <FormField
          id="fecha_nacimiento"
          label="Fecha de nacimiento"
          error={errors.fecha_nacimiento}
          hint="No se puede modificar si el paciente tiene análisis registrados."
        >
          <input
            id="fecha_nacimiento"
            name="fecha_nacimiento"
            type="date"
            value={values.fecha_nacimiento}
            onChange={(event) => changeValue('fecha_nacimiento', event.target.value)}
            className={INPUT_CLASSES}
            aria-invalid={errors.fecha_nacimiento ? true : undefined}
            aria-describedby={fieldDescribedBy(
              'fecha_nacimiento',
              errors.fecha_nacimiento,
              'No se puede modificar si el paciente tiene análisis registrados.',
            )}
          />
        </FormField>

        <FormField id="telefono" label="Teléfono" error={errors.telefono}>
          <input
            id="telefono"
            name="telefono"
            type="tel"
            autoComplete="off"
            value={values.telefono}
            onChange={(event) => changeValue('telefono', event.target.value)}
            className={INPUT_CLASSES}
            aria-invalid={errors.telefono ? true : undefined}
            aria-describedby={fieldDescribedBy('telefono', errors.telefono)}
          />
        </FormField>

        <FormField id="correo_electronico" label="Correo electrónico" error={errors.correo_electronico}>
          <input
            id="correo_electronico"
            name="correo_electronico"
            type="email"
            autoComplete="off"
            value={values.correo_electronico}
            onChange={(event) => changeValue('correo_electronico', event.target.value)}
            className={INPUT_CLASSES}
            aria-invalid={errors.correo_electronico ? true : undefined}
            aria-describedby={fieldDescribedBy('correo_electronico', errors.correo_electronico)}
          />
        </FormField>

        <FormField id="domicilio" label="Dirección" error={errors.domicilio}>
          <input
            id="domicilio"
            name="domicilio"
            type="text"
            autoComplete="off"
            value={values.domicilio}
            onChange={(event) => changeValue('domicilio', event.target.value)}
            className={INPUT_CLASSES}
            aria-invalid={errors.domicilio ? true : undefined}
            aria-describedby={fieldDescribedBy('domicilio', errors.domicilio)}
          />
        </FormField>

        <FormField id="obra_social" label="Obra social" error={errors.obra_social}>
          <input
            id="obra_social"
            name="obra_social"
            type="text"
            autoComplete="off"
            value={values.obra_social}
            onChange={(event) => changeValue('obra_social', event.target.value)}
            className={INPUT_CLASSES}
            aria-invalid={errors.obra_social ? true : undefined}
            aria-describedby={fieldDescribedBy('obra_social', errors.obra_social)}
          />
        </FormField>

        {generalError && (
          <div role="alert" className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
            <p>{generalError}</p>
            <Btn className="mt-2" onClick={() => void save()}>
              Reintentar
            </Btn>
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-2 border-t border-gray-200 pt-4">
          <Btn onClick={goBack}>Cancelar</Btn>
          <Btn type="submit" variant="primary" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Btn>
        </div>
      </form>
    </div>
  );
}
