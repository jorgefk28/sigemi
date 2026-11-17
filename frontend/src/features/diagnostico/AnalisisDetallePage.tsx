import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ESTADO_LABELS,
  actualizarEstado,
  agregarAddendum,
  getAnalisis,
  getTiposHallazgo,
  invalidarAnalisis,
  rechazarMuestra,
  validarAnalisis,
  type Analisis,
  type EstadoAnalisis,
  type TipoHallazgo,
} from '../../api/analisis';
import { ApiError } from '../../api/http';
import { Btn } from '../../components/Btn';
import { DataTable, type Column } from '../../components/DataTable';
import { Dialog } from '../../components/Dialog';
import { FormField, INPUT_CLASSES, fieldDescribedBy } from '../../components/FormField';
import { useAuth } from '../../session/auth';
import { loadToken } from '../../session/sessionStore';
import { formatFechaHora } from '../../lib/format';
import { useGoHome } from '../../routes/useGoHome';
import type { Hallazgo } from '../../api/analisis';

/**
 * DIAG-U02 · Detalle de análisis (P2 con acciones).
 *
 * Backing requirement: UCE-DIAG-03 (estado), DIAG-04 (validar), DIAG-08
 * (invalidar), DIAG-13 (addendum), DIAG-14 (rechazar muestra). UCE-DIAG-09 paso 6
 * says the detail shows «las acciones habilitadas según el estado», so the screen
 * derives the buttons from the state and from the role, and the backend re-checks
 * both.
 *
 * «Reenviar OTP» is not offered: it needs the WhatsApp delivery that is out of
 * scope (A-14). Offering a button that cannot work would be a lie.
 */

type Accion = 'none' | 'estado' | 'invalidar' | 'rechazar' | 'validar' | 'addendum';

const MOTIVOS_RECHAZO = ['Contaminada', 'Insuficiente', 'Inadecuada', 'Otro'];

function Campo({ nombre, children }: { nombre: string; children: React.ReactNode }) {
  return (
    <div className="flex border-b border-gray-100 px-3 py-2 last:border-0">
      <dt className="w-52 shrink-0 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {nombre}
      </dt>
      <dd className="text-sm text-gray-800">{children}</dd>
    </div>
  );
}

export function AnalisisDetallePage() {
  const { analisisId } = useParams<{ analisisId: string }>();
  const navigate = useNavigate();
  const goHome = useGoHome();
  const { user } = useAuth();
  const token = loadToken();

  const [analisis, setAnalisis] = useState<Analisis | null>(null);
  const [tiposHallazgo, setTiposHallazgo] = useState<TipoHallazgo[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const [accion, setAccion] = useState<Accion>('none');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Fields of the open dialog.
  const [nuevoEstado, setNuevoEstado] = useState<EstadoAnalisis>('en_proceso');
  const [tipoHallazgo, setTipoHallazgo] = useState('observacion');
  const [dato, setDato] = useState('');
  const [motivo, setMotivo] = useState('');
  const [observacion, setObservacion] = useState('');
  const [motivoAddendum, setMotivoAddendum] = useState('');
  const [contenidoAddendum, setContenidoAddendum] = useState('');

  const cargar = useCallback(() => {
    if (!analisisId) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    setFailed(false);

    Promise.all([getAnalisis(token, analisisId), getTiposHallazgo(token)])
      .then(([encontrado, tipos]) => {
        if (!cancelled) {
          setAnalisis(encontrado);
          setTiposHallazgo(tipos);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) {
          return;
        }
        if (err instanceof ApiError && err.status === 403) {
          goHome();
          return;
        }
        setFailed(true);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [analisisId, token, goHome]);

  useEffect(() => cargar(), [cargar, attempt]);

  const isAdmin = user?.roles.includes('administrador') ?? false;
  const isBioquimico = user?.roles.includes('bioquimico') ?? false;

  function cerrar() {
    setAccion('none');
    setError(null);
    setDato('');
    setMotivo('');
    setObservacion('');
    setMotivoAddendum('');
    setContenidoAddendum('');
  }

  async function ejecutar() {
    if (!analisis || saving) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let actualizado: Analisis;
      if (accion === 'estado') {
        actualizado = await actualizarEstado(token, analisis.id, nuevoEstado, [
          { tipo_hallazgo: tipoHallazgo, dato, estado_alcanzado: nuevoEstado },
        ]);
      } else if (accion === 'validar') {
        actualizado = await validarAnalisis(token, analisis.id);
      } else if (accion === 'invalidar') {
        actualizado = await invalidarAnalisis(token, analisis.id, motivo);
      } else if (accion === 'rechazar') {
        actualizado = await rechazarMuestra(token, analisis.id, motivo, observacion);
      } else {
        actualizado = await agregarAddendum(
          token,
          analisis.id,
          motivoAddendum,
          contenidoAddendum,
        );
      }
      setAnalisis(actualizado);
      cerrar();
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        goHome();
        return;
      }
      setError(
        err instanceof ApiError ? err.message : 'No se pudo completar la acción',
      );
    } finally {
      setSaving(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void ejecutar();
  }

  if (loading) {
    return (
      <div role="status" aria-live="polite" className="text-sm text-muted">
        Cargando…
      </div>
    );
  }

  if (failed || !analisis) {
    return (
      <div>
        <p className="text-sm text-gray-800">No se pudo cargar el análisis</p>
        <div className="mt-2 flex gap-2">
          <Btn onClick={() => setAttempt((valor) => valor + 1)}>Reintentar</Btn>
          <Btn onClick={() => navigate('/analisis')}>Volver</Btn>
        </div>
      </div>
    );
  }

  const estado = analisis.estado;
  const abierto = estado === 'validado' || estado === 'invalidado';
  const enCurso = estado === 'pendiente' || estado === 'en_proceso';

  const hallazgos: Column<Hallazgo>[] = [
    {
      key: 'tipo',
      header: 'Tipo',
      render: (fila) =>
        tiposHallazgo.find((tipo) => tipo.codigo === fila.tipo_hallazgo)?.etiqueta ??
        fila.tipo_hallazgo,
    },
    { key: 'dato', header: 'Dato', render: (fila) => fila.dato },
    {
      key: 'fecha',
      header: 'Fecha',
      render: (fila) => formatFechaHora(fila.fecha),
    },
  ];

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold leading-tight tracking-tight text-gray-900">
            {analisis.paciente_apellido}, {analisis.paciente_nombre}
          </h1>
          <p className="mt-1 text-xs text-muted">
            DNI {analisis.paciente_dni}
            <span className="mx-2" aria-hidden="true">
              ·
            </span>
            {analisis.tipo_analisis_nombre}
            <span className="mx-2" aria-hidden="true">
              ·
            </span>
            {ESTADO_LABELS[estado] ?? estado}
            {abierto && (
              <>
                <span className="mx-2" aria-hidden="true">
                  ·
                </span>
                Versión {analisis.version_actual}
              </>
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Btn onClick={() => navigate('/analisis')}>Volver</Btn>
          {/* UCE-DIAG-09 paso 6: the actions depend on the state. */}
          {isBioquimico && enCurso && (
            <Btn variant="primary" onClick={() => setAccion('estado')}>
              Actualizar estado
            </Btn>
          )}
          {isBioquimico && estado === 'terminado' && (
            <Btn variant="primary" onClick={() => setAccion('validar')}>
              Validar Análisis
            </Btn>
          )}
          {(isBioquimico || isAdmin) && enCurso && (
            <Btn onClick={() => setAccion('invalidar')}>Invalidar Análisis</Btn>
          )}
          {isBioquimico && enCurso && (
            <Btn onClick={() => setAccion('rechazar')}>Rechazar Muestra</Btn>
          )}
          {isBioquimico && estado === 'validado' && (
            <Btn onClick={() => setAccion('addendum')}>Corregir / Addendum</Btn>
          )}
        </div>
      </div>

      <section className="mt-6 overflow-hidden rounded-md border border-gray-200 bg-white">
        <h2 className="border-b border-gray-200 px-3 py-2 text-sm font-semibold text-gray-900">
          Análisis
        </h2>
        <dl aria-label="Datos del análisis">
          <Campo nombre="Tipo de muestra">{analisis.tipo_muestra_nombre}</Campo>
          <Campo nombre="Ingreso">{formatFechaHora(analisis.fecha_creacion)}</Campo>
          <Campo nombre="Responsable">
            {analisis.profesional_responsable_nombre || '—'}
          </Campo>
          <Campo nombre="Validado por">
            {analisis.profesional_validador_nombre ?? '—'}
          </Campo>
          <Campo nombre="Fecha de validación">
            {analisis.fecha_validacion ? formatFechaHora(analisis.fecha_validacion) : '—'}
          </Campo>
          <Campo nombre="Motivo de invalidación">
            {analisis.motivo_invalidacion ?? '—'}
          </Campo>
        </dl>
      </section>

      <section className="mt-4 overflow-hidden rounded-md border border-gray-200 bg-white">
        <h2 className="border-b border-gray-200 px-3 py-2 text-sm font-semibold text-gray-900">
          Hallazgos
        </h2>
        {analisis.hallazgos.length === 0 ? (
          <p className="px-3 py-3 text-sm text-muted">Sin hallazgos registrados</p>
        ) : (
          <DataTable
            label="Hallazgos del análisis"
            columns={hallazgos}
            rows={analisis.hallazgos}
            rowKey={(fila) => fila.id}
          />
        )}
      </section>

      {analisis.addendum && (
        <section className="mt-4 rounded-md border border-gray-200 bg-white">
          <h2 className="border-b border-gray-200 px-3 py-2 text-sm font-semibold text-gray-900">
            Addendum
          </h2>
          <div className="px-3 py-3 text-sm text-gray-800">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Motivo
            </p>
            <p>{analisis.addendum.motivo}</p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Contenido
            </p>
            <p>{analisis.addendum.contenido}</p>
          </div>
        </section>
      )}

      <Dialog
        open={accion !== 'none'}
        title={
          accion === 'estado'
            ? 'Actualizar estado'
            : accion === 'validar'
              ? 'Validar análisis'
              : accion === 'invalidar'
                ? 'Invalidar análisis'
                : accion === 'rechazar'
                  ? 'Rechazar muestra'
                  : 'Corregir / Addendum'
        }
        onClose={cerrar}
        footer={
          <>
            <Btn onClick={cerrar}>Cancelar</Btn>
            <Btn
              variant="primary"
              disabled={
                saving ||
                (accion === 'estado' && !dato.trim()) ||
                (accion === 'invalidar' && !motivo.trim()) ||
                (accion === 'rechazar' && (!motivo.trim() || !observacion.trim())) ||
                (accion === 'addendum' &&
                  (!motivoAddendum.trim() || !contenidoAddendum.trim()))
              }
              onClick={() => void ejecutar()}
            >
              {saving ? 'Guardando…' : 'Confirmar'}
            </Btn>
          </>
        }
      >
        <form aria-label="Acción del análisis" onSubmit={handleSubmit}>
          {accion === 'estado' && (
            <>
              <FormField id="nuevo_estado" label="Nuevo estado">
                <select
                  id="nuevo_estado"
                  value={nuevoEstado}
                  onChange={(event) => setNuevoEstado(event.target.value as EstadoAnalisis)}
                  className={INPUT_CLASSES}
                >
                  {estado === 'pendiente' && <option value="en_proceso">En proceso</option>}
                  {estado === 'en_proceso' && <option value="terminado">Terminado</option>}
                </select>
              </FormField>
              <FormField id="tipo_hallazgo" label="Tipo de hallazgo">
                <select
                  id="tipo_hallazgo"
                  value={tipoHallazgo}
                  onChange={(event) => setTipoHallazgo(event.target.value)}
                  className={INPUT_CLASSES}
                >
                  {tiposHallazgo.map((tipo) => (
                    <option key={tipo.codigo} value={tipo.codigo}>
                      {tipo.etiqueta}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField
                id="dato"
                label="Hallazgo u observación"
                hint="Podés cargar más hallazgos en otra actualización."
              >
                <textarea
                  id="dato"
                  rows={3}
                  value={dato}
                  onChange={(event) => setDato(event.target.value)}
                  className={INPUT_CLASSES}
                />
              </FormField>
            </>
          )}

          {accion === 'validar' && (
            <p className="text-sm text-gray-800">
              El análisis queda validado de forma definitiva y se registra tu firma como
              validador.
            </p>
          )}

          {accion === 'invalidar' && (
            <FormField id="motivo" label="Motivo de la invalidación">
              <textarea
                id="motivo"
                rows={3}
                value={motivo}
                onChange={(event) => setMotivo(event.target.value)}
                className={INPUT_CLASSES}
              />
            </FormField>
          )}

          {accion === 'rechazar' && (
            <>
              <FormField id="motivo_rechazo" label="Motivo del rechazo">
                <select
                  id="motivo_rechazo"
                  value={motivo}
                  onChange={(event) => setMotivo(event.target.value)}
                  className={INPUT_CLASSES}
                >
                  <option value="">Seleccioná un motivo</option>
                  {MOTIVOS_RECHAZO.map((opcion) => (
                    <option key={opcion} value={opcion}>
                      {opcion}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField id="observacion" label="Observación">
                <textarea
                  id="observacion"
                  rows={3}
                  value={observacion}
                  onChange={(event) => setObservacion(event.target.value)}
                  className={INPUT_CLASSES}
                />
              </FormField>
            </>
          )}

          {accion === 'addendum' && (
            <>
              <FormField id="motivo_addendum" label="Motivo de la corrección">
                <input
                  id="motivo_addendum"
                  type="text"
                  value={motivoAddendum}
                  onChange={(event) => setMotivoAddendum(event.target.value)}
                  className={INPUT_CLASSES}
                />
              </FormField>
              <FormField id="contenido_addendum" label="Contenido del addendum">
                <textarea
                  id="contenido_addendum"
                  rows={4}
                  value={contenidoAddendum}
                  onChange={(event) => setContenidoAddendum(event.target.value)}
                  className={INPUT_CLASSES}
                  aria-describedby={fieldDescribedBy('contenido_addendum', error)}
                />
              </FormField>
            </>
          )}

          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
        </form>
      </Dialog>
    </div>
  );
}
