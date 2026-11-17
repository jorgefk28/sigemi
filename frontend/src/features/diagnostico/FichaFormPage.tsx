import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  createFicha,
  getCamposClinicos,
  getFicha,
  updateFicha,
  type CampoClinico,
  type FichaClinica,
} from '../../api/fichas';
import { ApiError } from '../../api/http';
import { Btn } from '../../components/Btn';
import { FormField, INPUT_CLASSES, fieldDescribedBy } from '../../components/FormField';
import { loadToken } from '../../session/sessionStore';
import { useGoHome } from '../../routes/useGoHome';

/**
 * DIAG-U03 · Ficha clínica, alta y edición (P3).
 *
 * Backing requirement: UCE-DIAG-01 pasos 4-9 (alta) and UCE-DIAG-07 pasos 1-8
 * (modificación); RF-05, RF-20.
 *
 * The form renders the fields the **API** declares (`GET /fichas-clinicas/campos`),
 * not a list written here: the catalog of clinical keys is an assumption
 * recorded in A-04 and lives in one place. Editing sends only the fields that
 * changed, and the backend keeps the previous version.
 */

export function FichaFormPage() {
  const { pacienteId, fichaId } = useParams<{ pacienteId: string; fichaId?: string }>();
  const navigate = useNavigate();
  const goHome = useGoHome();
  const token = loadToken();
  const isCreate = fichaId === undefined;

  const [campos, setCampos] = useState<CampoClinico[]>([]);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [original, setOriginal] = useState<FichaClinica | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'failed' | 'ready'>('loading');
  const [attempt, setAttempt] = useState(0);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadState('loading');

    Promise.all([
      getCamposClinicos(token),
      isCreate || !fichaId ? Promise.resolve(null) : getFicha(token, fichaId),
    ])
      .then(([catalogo, ficha]) => {
        if (cancelled) {
          return;
        }
        setCampos(catalogo);
        if (ficha) {
          setOriginal(ficha);
          setValores(ficha.datos);
        }
        setLoadState('ready');
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
  }, [isCreate, fichaId, token, attempt, goHome]);

  function changeValue(campo: string, valor: string) {
    setValores((previous) => ({ ...previous, [campo]: valor }));
    setErrors((previous) => {
      const next = { ...previous };
      delete next[campo];
      return next;
    });
  }

  /** Only the fields that changed: an empty PATCH is a `400`. */
  function cambiosDe(originalFicha: FichaClinica): Record<string, string> {
    const cambios: Record<string, string> = {};
    for (const [campo, valor] of Object.entries(valores)) {
      if ((originalFicha.datos[campo] ?? '') !== valor.trim()) {
        cambios[campo] = valor.trim();
      }
    }
    return cambios;
  }

  async function save() {
    if (saving) {
      return;
    }

    const locales: Record<string, string> = {};
    for (const campo of campos) {
      if (campo.obligatorio && !(valores[campo.campo] ?? '').trim()) {
        locales[campo.campo] = `El campo «${campo.etiqueta}» no puede estar vacío`;
      }
    }
    setErrors(locales);
    setGeneralError(null);
    if (Object.keys(locales).length > 0) {
      return;
    }

    setSaving(true);
    try {
      if (isCreate) {
        if (!pacienteId) {
          return;
        }
        const datos = Object.fromEntries(
          Object.entries(valores)
            .map(([campo, valor]) => [campo, valor.trim()])
            .filter(([, valor]) => valor !== ''),
        );
        const creada = await createFicha(token, pacienteId, datos);
        navigate(`/pacientes/${pacienteId}/fichas/${creada.id}`);
      } else if (original && pacienteId) {
        const cambios = cambiosDe(original);
        if (Object.keys(cambios).length > 0) {
          await updateFicha(token, original.id, cambios);
        }
        navigate(`/pacientes/${pacienteId}/fichas/${original.id}`);
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        goHome();
        return;
      }
      // R3: the backend names the field that failed. A rejection that names no
      // rendered field (for example `profesional`) must still be visible, so it
      // falls to the banner instead of vanishing.
      if (error instanceof ApiError && error.campo) {
        if (campos.some((campo) => campo.campo === error.campo)) {
          setErrors({ [error.campo as string]: error.message });
        } else {
          setGeneralError(error.message);
        }
      } else {
        setGeneralError(
          error instanceof ApiError ? error.message : 'No se pudo guardar la ficha clínica',
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
    if (pacienteId) {
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
        <p className="text-sm text-gray-800">No se pudo cargar la ficha clínica</p>
        <div className="mt-2 flex gap-2">
          <Btn onClick={() => setAttempt((valor) => valor + 1)}>Reintentar</Btn>
          <Btn onClick={goBack}>Volver</Btn>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold leading-tight tracking-tight text-gray-900">
            {isCreate ? 'Nueva consulta' : 'Editar ficha clínica'}
          </h1>
          {original && (
            <p className="mt-1 text-xs text-muted">
              Versión {original.version_actual} · {original.profesional_nombre}
            </p>
          )}
        </div>
        <Btn onClick={goBack}>Cancelar</Btn>
      </div>

      <form
        aria-label={isCreate ? 'Alta de ficha clínica' : 'Edición de ficha clínica'}
        className="mt-6 max-w-2xl rounded-md border border-gray-200 bg-white p-4"
        onSubmit={handleSubmit}
      >
        {campos.map((campo) => {
          const error = errors[campo.campo];
          const obligatorio = campo.obligatorio ? ' *' : '';
          return (
            <FormField
              key={campo.campo}
              id={campo.campo}
              label={`${campo.etiqueta}${obligatorio}`}
              error={error}
            >
              <textarea
                id={campo.campo}
                name={campo.campo}
                rows={2}
                value={valores[campo.campo] ?? ''}
                onChange={(event) => changeValue(campo.campo, event.target.value)}
                className={INPUT_CLASSES}
                aria-invalid={error ? true : undefined}
                aria-describedby={fieldDescribedBy(campo.campo, error)}
              />
            </FormField>
          );
        })}

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
            {saving ? 'Guardando…' : 'Guardar Ficha'}
          </Btn>
        </div>
      </form>
    </div>
  );
}

