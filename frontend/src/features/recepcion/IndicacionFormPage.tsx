import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { listTiposAnalisis, type TipoAnalisis } from '../../api/catalogos';
import { ApiError } from '../../api/http';
import {
  createIndicacion,
  getIndicacion,
  updateIndicacion,
  type IndicacionCreate,
  type IndicacionMedica,
  type IndicacionUpdate,
} from '../../api/indicaciones';
import { Btn } from '../../components/Btn';
import { FormField, INPUT_CLASSES, fieldDescribedBy } from '../../components/FormField';
import { useAuth } from '../../session/auth';
import { loadToken } from '../../session/sessionStore';
import { useGoHome } from '../../routes/useGoHome';

/**
 * REC-U08 · Formulario de indicación médica, alta y edición (P3).
 *
 * Backing requirement: UCE-REC-10 pasos 1-7 (crear) and UCE-REC-11 pasos 1-5
 * (modificar); RF-02.
 *
 * The three fields are the ones UCE-REC-10 paso 2 names, and the selector is
 * filled from `GET /tipos-analisis`: a hardcoded list would drift from the
 * catalog. When the catalog is empty the form says so and links to the screen
 * that loads it, instead of showing an unusable select.
 */

interface FormValues {
  titulo: string;
  contenido: string;
  tipo_analisis_id: string;
}

const NO_VALUES: FormValues = { titulo: '', contenido: '', tipo_analisis_id: '' };

function validate(values: FormValues): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!values.titulo.trim()) {
    errors.titulo = 'El título no puede estar vacío';
  }
  if (!values.contenido.trim()) {
    errors.contenido = 'El contenido no puede estar vacío';
  }
  // REC-10 excepción del paso 4: sin tipo de análisis no se persiste.
  if (!values.tipo_analisis_id) {
    errors.tipo_analisis_id = 'Seleccioná un tipo de análisis';
  }

  return errors;
}

function changesOf(original: IndicacionMedica, values: FormValues): IndicacionUpdate {
  const cambios: IndicacionUpdate = {};

  if (values.titulo.trim() !== original.titulo) {
    cambios.titulo = values.titulo.trim();
  }
  if (values.contenido.trim() !== original.contenido) {
    cambios.contenido = values.contenido.trim();
  }
  if (values.tipo_analisis_id !== original.tipo_analisis_id) {
    cambios.tipo_analisis_id = values.tipo_analisis_id;
  }

  return cambios;
}

export function IndicacionFormPage() {
  const { indicacionId } = useParams<{ indicacionId: string }>();
  const navigate = useNavigate();
  const goHome = useGoHome();
  const { user } = useAuth();
  const token = loadToken();
  const isCreate = indicacionId === undefined;

  const [valores, setValores] = useState<FormValues>(NO_VALUES);
  const [original, setOriginal] = useState<IndicacionMedica | null>(null);
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'failed' | 'ready'>(
    isCreate ? 'ready' : 'loading',
  );
  const [attempt, setAttempt] = useState(0);

  const [tipos, setTipos] = useState<TipoAnalisis[]>([]);
  const [catalogSettled, setCatalogSettled] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isAdmin = user?.roles.includes('administrador') ?? false;

  useEffect(() => {
    let cancelled = false;
    setCatalogSettled(false);

    listTiposAnalisis(token, { limit: 100 })
      .then((pagina) => {
        if (!cancelled) {
          // A deactivated type cannot be selected for a new instruction, but it
          // must stay in the list when it is the one already saved.
          setTipos(pagina.items);
          setCatalogSettled(true);
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
        setTipos([]);
        setCatalogSettled(true);
      });

    return () => {
      cancelled = true;
    };
  }, [token, goHome]);

  useEffect(() => {
    if (isCreate || !indicacionId) {
      return;
    }
    let cancelled = false;
    setLoadState('loading');

    getIndicacion(token, indicacionId)
      .then((encontrada) => {
        if (cancelled) {
          return;
        }
        setOriginal(encontrada);
        setValores({
          titulo: encontrada.titulo,
          contenido: encontrada.contenido,
          tipo_analisis_id: encontrada.tipo_analisis_id,
        });
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
  }, [isCreate, indicacionId, token, attempt, goHome]);

  function changeValue(field: keyof FormValues, value: string) {
    setValores((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => {
      const next = { ...previous };
      delete next[field];
      return next;
    });
  }

  async function save() {
    if (saving) {
      return;
    }

    const localErrors = validate(valores);
    setErrors(localErrors);
    setGeneralError(null);
    if (Object.keys(localErrors).length > 0) {
      return;
    }

    setSaving(true);
    try {
      if (isCreate) {
        const payload: IndicacionCreate = {
          titulo: valores.titulo.trim(),
          contenido: valores.contenido.trim(),
          tipo_analisis_id: valores.tipo_analisis_id,
        };
        await createIndicacion(token, payload);
      } else if (original) {
        const cambios = changesOf(original, valores);
        if (Object.keys(cambios).length > 0) {
          await updateIndicacion(token, original.id, cambios);
        }
      }
      // REC-10 paso 7 and REC-11 paso 5: back to the listing.
      navigate('/indicaciones');
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        goHome();
        return;
      }
      // R3: a field-scoped rejection belongs on the field.
      if (error instanceof ApiError && error.campo) {
        setErrors({ [error.campo]: error.message });
      } else {
        setGeneralError(
          error instanceof ApiError ? error.message : 'No se pudo guardar la indicación',
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
    navigate('/indicaciones');
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
        <p className="text-sm text-gray-800">No se pudo cargar la indicación</p>
        <div className="mt-2 flex gap-2">
          <Btn onClick={() => setAttempt((valor) => valor + 1)}>Reintentar</Btn>
          <Btn onClick={goBack}>Volver</Btn>
        </div>
      </div>
    );
  }

  const opciones = tipos.filter(
    (tipo) => tipo.estado === 'activo' || tipo.id === valores.tipo_analisis_id,
  );
  const catalogoVacio = catalogSettled && opciones.length === 0;

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-[28px] font-bold leading-tight tracking-tight text-gray-900">
          {isCreate ? 'Nueva Indicación' : 'Editar indicación'}
        </h1>
        <Btn onClick={goBack}>Cancelar</Btn>
      </div>

      <form
        aria-label={isCreate ? 'Alta de indicación médica' : 'Edición de indicación médica'}
        className="mt-6 max-w-xl rounded-md border border-gray-200 bg-white p-4"
        onSubmit={handleSubmit}
      >
        <FormField id="titulo" label="Título" error={errors.titulo}>
          <input
            id="titulo"
            name="titulo"
            type="text"
            autoComplete="off"
            maxLength={120}
            value={valores.titulo}
            onChange={(event) => changeValue('titulo', event.target.value)}
            className={INPUT_CLASSES}
            aria-invalid={errors.titulo ? true : undefined}
            aria-describedby={fieldDescribedBy('titulo', errors.titulo)}
          />
        </FormField>

        <FormField
          id="contenido"
          label="Contenido"
          error={errors.contenido}
          hint="Es el texto que recibe el paciente al agendar el turno."
        >
          <textarea
            id="contenido"
            name="contenido"
            rows={5}
            value={valores.contenido}
            onChange={(event) => changeValue('contenido', event.target.value)}
            className={INPUT_CLASSES}
            aria-invalid={errors.contenido ? true : undefined}
            aria-describedby={fieldDescribedBy(
              'contenido',
              errors.contenido,
              'Es el texto que recibe el paciente al agendar el turno.',
            )}
          />
        </FormField>

        {catalogoVacio ? (
          <div className="mb-4 rounded bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <p>No hay tipos de análisis cargados.</p>
            {isAdmin && (
              <Btn className="mt-2" onClick={() => navigate('/catalogos')}>
                Ir a Catálogos Clínicos
              </Btn>
            )}
          </div>
        ) : (
          <FormField
            id="tipo_analisis_id"
            label="Tipo de análisis asociado"
            error={errors.tipo_analisis_id}
          >
            <select
              id="tipo_analisis_id"
              name="tipo_analisis_id"
              value={valores.tipo_analisis_id}
              onChange={(event) => changeValue('tipo_analisis_id', event.target.value)}
              className={INPUT_CLASSES}
              aria-invalid={errors.tipo_analisis_id ? true : undefined}
              aria-describedby={fieldDescribedBy(
                'tipo_analisis_id',
                errors.tipo_analisis_id,
              )}
            >
              <option value="">Seleccioná un tipo</option>
              {opciones.map((tipo) => (
                <option key={tipo.id} value={tipo.id}>
                  {tipo.nombre}
                  {tipo.estado === 'activo' ? '' : ' (inactivo)'}
                </option>
              ))}
            </select>
          </FormField>
        )}

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
          <Btn type="submit" variant="primary" disabled={saving || catalogoVacio}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Btn>
        </div>
      </form>
    </div>
  );
}
