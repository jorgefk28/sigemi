import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { registrarMuestra } from '../../api/analisis';
import { listTiposAnalisis, listTiposMuestra, type TipoAnalisis, type TipoMuestra } from '../../api/catalogos';
import { ApiError } from '../../api/http';
import { Btn } from '../../components/Btn';
import { FormField, INPUT_CLASSES, fieldDescribedBy } from '../../components/FormField';
import { loadToken } from '../../session/sessionStore';
import { useGoHome } from '../../routes/useGoHome';

/**
 * DIAG-U05 · Ingreso de muestra (P3).
 *
 * Backing requirement: UCE-DIAG-02 pasos 2-7. The screen asks for the sample type,
 * the analysis type (G5: level 3 makes it mandatory) and the initial observations,
 * and the backend creates the sample plus its first analysis in «pendiente».
 *
 * The patient must already have a clinical record; when it does not, the backend
 * answers with `campo = "ficha_clinica_id"` and the screen says what to do instead
 * of failing silently.
 */

interface FormValues {
  tipo_muestra_id: string;
  tipo_analisis_id: string;
  observaciones: string;
}

const NO_VALUES: FormValues = {
  tipo_muestra_id: '',
  tipo_analisis_id: '',
  observaciones: '',
};

export function MuestraFormPage() {
  const { pacienteId } = useParams<{ pacienteId: string }>();
  const navigate = useNavigate();
  const goHome = useGoHome();
  const token = loadToken();

  const [valores, setValores] = useState<FormValues>(NO_VALUES);
  const [muestras, setMuestras] = useState<TipoMuestra[]>([]);
  const [analisis, setAnalisis] = useState<TipoAnalisis[]>([]);
  const [catalogSettled, setCatalogSettled] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    Promise.all([listTiposMuestra(token, { limit: 100 }), listTiposAnalisis(token, { limit: 100 })])
      .then(([paginaMuestras, paginaAnalisis]) => {
        if (!cancelled) {
          setMuestras(paginaMuestraActivas(paginaMuestras.items));
          setAnalisis(paginaAnalisis.items.filter((tipo) => tipo.estado === 'activo'));
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
        setCatalogSettled(true);
      });

    return () => {
      cancelled = true;
    };
  }, [token, goHome]);

  function changeValue(field: keyof FormValues, value: string) {
    setValores((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => {
      const next = { ...previous };
      delete next[field];
      return next;
    });
  }

  async function save() {
    if (saving || !pacienteId) {
      return;
    }

    const locales: Record<string, string> = {};
    if (!valores.tipo_muestra_id) {
      locales.tipo_muestra_id = 'Seleccioná el tipo de muestra';
    }
    if (!valores.tipo_analisis_id) {
      locales.tipo_analisis_id = 'Seleccioná el tipo de análisis';
    }
    setErrors(locales);
    setGeneralError(null);
    if (Object.keys(locales).length > 0) {
      return;
    }

    setSaving(true);
    try {
      const muestra = await registrarMuestra(token, {
        paciente_id: pacienteId,
        tipo_muestra_id: valores.tipo_muestra_id,
        tipo_analisis_id: valores.tipo_analisis_id,
        observaciones: valores.observaciones.trim() || undefined,
      });
      // DIAG-02 paso 7: the confirmation returns to the analysis panel.
      navigate(`/analisis/${muestra.analisis.id}`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        goHome();
        return;
      }
      if (error instanceof ApiError && error.campo) {
        setErrors({ [error.campo]: error.message });
      } else {
        setGeneralError(
          error instanceof ApiError ? error.message : 'No se pudo registrar la muestra',
        );
      }
      setSaving(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void save();
  }

  const catalogoVacio = catalogSettled && (muestras.length === 0 || analisis.length === 0);

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-[28px] font-bold leading-tight tracking-tight text-gray-900">
          Ingresar Muestra
        </h1>
        <Btn onClick={() => navigate(`/pacientes/${pacienteId}`)}>Cancelar</Btn>
      </div>

      <form
        aria-label="Ingreso de muestra"
        className="mt-6 max-w-xl rounded-md border border-gray-200 bg-white p-4"
        onSubmit={handleSubmit}
      >
        {catalogoVacio ? (
          <div className="mb-4 rounded bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <p>
              Faltan tipos de muestra o de análisis en el catálogo clínico. Sin ellos no se puede
              registrar la muestra.
            </p>
          </div>
        ) : (
          <>
            <FormField
              id="tipo_muestra_id"
              label="Tipo de muestra"
              error={errors.tipo_muestra_id}
            >
              <select
                id="tipo_muestra_id"
                value={valores.tipo_muestra_id}
                onChange={(event) => changeValue('tipo_muestra_id', event.target.value)}
                className={INPUT_CLASSES}
                aria-invalid={errors.tipo_muestra_id ? true : undefined}
                aria-describedby={fieldDescribedBy('tipo_muestra_id', errors.tipo_muestra_id)}
              >
                <option value="">Seleccioná un tipo</option>
                {muestras.map((tipo) => (
                  <option key={tipo.id} value={tipo.id}>
                    {tipo.nombre}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField
              id="tipo_analisis_id"
              label="Tipo de análisis"
              error={errors.tipo_analisis_id}
              hint="El esquema exige el estudio que se va a realizar sobre la muestra."
            >
              <select
                id="tipo_analisis_id"
                value={valores.tipo_analisis_id}
                onChange={(event) => changeValue('tipo_analisis_id', event.target.value)}
                className={INPUT_CLASSES}
                aria-invalid={errors.tipo_analisis_id ? true : undefined}
                aria-describedby={fieldDescribedBy(
                  'tipo_analisis_id',
                  errors.tipo_analisis_id,
                  'El esquema exige el estudio que se va a realizar sobre la muestra.',
                )}
              >
                <option value="">Seleccioná un tipo</option>
                {analisis.map((tipo) => (
                  <option key={tipo.id} value={tipo.id}>
                    {tipo.nombre}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField id="observaciones" label="Observaciones iniciales" error={errors.observaciones}>
              <textarea
                id="observaciones"
                rows={3}
                value={valores.observaciones}
                onChange={(event) => changeValue('observaciones', event.target.value)}
                className={INPUT_CLASSES}
              />
            </FormField>
          </>
        )}

        {errors.ficha_clinica_id && (
          <p role="alert" className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
            {errors.ficha_clinica_id}
          </p>
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
          <Btn onClick={() => navigate(`/pacientes/${pacienteId}`)}>Cancelar</Btn>
          <Btn type="submit" variant="primary" disabled={saving || catalogoVacio}>
            {saving ? 'Registrando…' : 'Registrar Muestra'}
          </Btn>
        </div>
      </form>
    </div>
  );
}

/** Only an active sample type can be chosen for a new sample. */
function paginaMuestraActivas(items: TipoMuestra[]): TipoMuestra[] {
  return items.filter((tipo) => tipo.estado === 'activo');
}
