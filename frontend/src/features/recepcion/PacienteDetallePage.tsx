import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../../api/http';
import { deactivatePaciente, getPaciente, type Paciente } from '../../api/pacientes';
import { listFichas, type FichaClinica } from '../../api/fichas';
import { Btn } from '../../components/Btn';
import { Dialog } from '../../components/Dialog';
import { FormField, INPUT_CLASSES, fieldDescribedBy } from '../../components/FormField';
import { useAuth } from '../../session/auth';
import { loadToken } from '../../session/sessionStore';
import { formatFecha, formatFechaHora } from '../../lib/format';
import { useGoHome } from '../../routes/useGoHome';

/**
 * REC-U07 · Detalle de paciente (P2).
 *
 * Backing requirement: UCE-REC-18 paso 6, UCE-REC-19 pasos 4-11; RF-05.
 *
 * Read-only record with two actions: "Editar" (REC-U05 in edit mode) and
 * "Desactivar", which is administrator-only (precondition of REC-19) and asks
 * for the mandatory motive in a dialog before writing. The deactivation is
 * logical: the history stays intact and the motive goes to the audit, never to a
 * mutable column.
 *
 * The three history sections (consultas, análisis, resultados) have no endpoint
 * yet, so they say so instead of inventing content.
 */

const STATE_LABELS: Record<string, string> = {
  activo: 'Activo',
  inactivo: 'Inactivo',
};

const LEVEL_LABELS: Record<string, string> = {
  completo: 'Completo',
  temprano: 'Temprano',
};

function label(map: Record<string, string>, value: string): string {
  return map[value] ?? value;
}

function Campo({ nombre, children }: { nombre: string; children: ReactNode }) {
  return (
    <div className="flex border-b border-gray-100 px-3 py-2 last:border-0">
      <dt className="w-48 shrink-0 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {nombre}
      </dt>
      <dd className="text-sm text-gray-800">{children}</dd>
    </div>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="mt-4 rounded-md border border-gray-200 bg-white">
      <h2 className="border-b border-gray-200 px-3 py-2 text-sm font-semibold text-gray-900">
        {titulo}
      </h2>
      <div className="px-3 py-3">{children}</div>
    </section>
  );
}

export function PacienteDetallePage() {
  const { pacienteId } = useParams<{ pacienteId: string }>();
  const navigate = useNavigate();
  const goHome = useGoHome();
  const { user } = useAuth();
  const token = loadToken();

  const [paciente, setPaciente] = useState<Paciente | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [motivoError, setMotivoError] = useState<string | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  const [fichas, setFichas] = useState<FichaClinica[]>([]);
  const [fichasLoading, setFichasLoading] = useState(true);
  const [fichasError, setFichasError] = useState(false);
  const [fichasAttempt, setFichasAttempt] = useState(0);

  const isAdmin = user?.roles.includes('administrador') ?? false;
  // Writing a clinical record is bioquimico-only (A-12 of the decision log).
  const puedeEscribir = user?.roles.includes('bioquimico') ?? false;

  // DIAG-06 paso 4: the patient's records, newest first.
  useEffect(() => {
    if (!pacienteId) {
      return;
    }
    let cancelled = false;
    setFichasLoading(true);
    setFichasError(false);

    listFichas(token, { paciente_id: pacienteId, limit: 20 })
      .then((pagina) => {
        if (!cancelled) {
          setFichas(pagina.items);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFichas([]);
          setFichasError(true);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setFichasLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [pacienteId, token, fichasAttempt]);

  useEffect(() => {
    if (!pacienteId) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(false);

    getPaciente(token, pacienteId)
      .then((encontrado) => {
        if (!cancelled) {
          setPaciente(encontrado);
        }
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        // R2: no permission is a redirect, never a raw 403 on screen.
        if (error instanceof ApiError && error.status === 403) {
          goHome();
          return;
        }
        setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [pacienteId, token, attempt, goHome]);

  async function confirmDeactivation() {
    if (!paciente || deactivating) {
      return;
    }
    if (!motivo.trim()) {
      setMotivoError('El motivo de la baja no puede estar vacío');
      return;
    }

    setDeactivating(true);
    setMotivoError(null);
    try {
      const actualizado = await deactivatePaciente(token, paciente.id, motivo.trim());
      setPaciente(actualizado);
      setDialogOpen(false);
      setMotivo('');
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        goHome();
        return;
      }
      // A rule rejection (for example "turnos vigentes") is reported as it came.
      if (error instanceof ApiError) {
        setMotivoError(error.message);
      } else {
        setMotivoError('No se pudo desactivar el paciente');
      }
    } finally {
      setDeactivating(false);
    }
  }

  if (loading) {
    return (
      <div role="status" aria-live="polite" className="text-sm text-muted">
        Cargando…
      </div>
    );
  }

  if (loadError || !paciente) {
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

  const puedeDesactivar = isAdmin && paciente.estado === 'activo';

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold leading-tight tracking-tight text-gray-900">
            {paciente.apellido}, {paciente.nombre}
          </h1>
          <p className="mt-1 text-xs text-muted">
            {paciente.numero_registro}
            <span className="mx-2" aria-hidden="true">
              ·
            </span>
            {label(STATE_LABELS, paciente.estado)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Btn onClick={() => navigate('/pacientes')}>Volver</Btn>
          <Btn onClick={() => navigate(`/pacientes/${paciente.id}/editar`)}>Editar</Btn>
          {/* R2: administrator-only; presentation only, the backend validates. */}
          {puedeDesactivar && (
            <Btn variant="primary" onClick={() => setDialogOpen(true)}>
              Desactivar
            </Btn>
          )}
        </div>
      </div>

      <section className="mt-6 overflow-hidden rounded-md border border-gray-200 bg-white">
        <h2 className="border-b border-gray-200 px-3 py-2 text-sm font-semibold text-gray-900">
          Datos personales
        </h2>
        <dl aria-label="Datos personales">
          <Campo nombre="DNI">{paciente.dni}</Campo>
          <Campo nombre="Fecha de nacimiento">{formatFecha(paciente.fecha_nacimiento)}</Campo>
          <Campo nombre="Teléfono">{paciente.telefono}</Campo>
          <Campo nombre="Correo electrónico">{paciente.correo_electronico ?? '—'}</Campo>
          <Campo nombre="Dirección">{paciente.domicilio ?? '—'}</Campo>
          <Campo nombre="Obra social">{paciente.obra_social ?? '—'}</Campo>
          <Campo nombre="Estado">{label(STATE_LABELS, paciente.estado)}</Campo>
          <Campo nombre="Nivel de registro">
            {label(LEVEL_LABELS, paciente.nivel_registro)}
          </Campo>
          <Campo nombre="Fecha de ingreso">{formatFechaHora(paciente.fecha_ingreso)}</Campo>
        </dl>
      </section>

      <Seccion titulo="Historial de consultas">
        {fichasLoading ? (
          <p className="text-sm text-muted">Cargando…</p>
        ) : fichasError ? (
          <div>
            <p className="text-sm text-gray-800">No se pudo cargar el historial</p>
            <Btn className="mt-2" onClick={() => setFichasAttempt((valor) => valor + 1)}>
              Reintentar
            </Btn>
          </div>
        ) : fichas.length === 0 ? (
          <p className="text-sm text-muted">Sin consultas registradas</p>
        ) : (
          <ul aria-label="Consultas registradas" className="divide-y divide-gray-100">
            {fichas.map((ficha) => (
              <li key={ficha.id} className="flex items-center justify-between gap-3 py-2">
                <div>
                  <p className="text-sm text-gray-800">
                    {formatFechaHora(ficha.fecha_consulta)}
                  </p>
                  <p className="text-xs text-muted">
                    Versión {ficha.version_actual} · {ficha.profesional_nombre}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`Ver la consulta del ${formatFechaHora(ficha.fecha_consulta)}`}
                  className="text-xs font-medium text-brand hover:underline"
                  onClick={() =>
                    navigate(`/pacientes/${paciente.id}/fichas/${ficha.id}`)
                  }
                >
                  Ver
                </button>
              </li>
            ))}
          </ul>
        )}
        {puedeEscribir && (
          <Btn className="mt-3" variant="primary" onClick={() => navigate(`/pacientes/${paciente.id}/fichas/nueva`)}>
            Nueva consulta
          </Btn>
        )}
      </Seccion>

      <Seccion titulo="Análisis micológicos">
        <p className="text-sm text-muted">Sin análisis registrados</p>
      </Seccion>

      <Seccion titulo="Resultados">
        <p className="text-sm text-muted">
          Pendiente: todavía no hay endpoint que exponga los informes de resultados.
        </p>
      </Seccion>

      <Dialog
        open={dialogOpen}
        title="Desactivar paciente"
        onClose={() => {
          setDialogOpen(false);
          setMotivoError(null);
        }}
        footer={
          <>
            <Btn
              onClick={() => {
                setDialogOpen(false);
                setMotivo('');
                setMotivoError(null);
              }}
            >
              Cancelar
            </Btn>
            <Btn
              variant="primary"
              disabled={deactivating || !motivo.trim()}
              onClick={() => void confirmDeactivation()}
            >
              {deactivating ? 'Desactivando…' : 'Confirmar'}
            </Btn>
          </>
        }
      >
        <FormField
          id="motivo"
          label="Motivo de la baja"
          error={motivoError}
          hint="Queda registrado en la auditoría."
        >
          <textarea
            id="motivo"
            name="motivo"
            rows={3}
            value={motivo}
            onChange={(event) => {
              setMotivo(event.target.value);
              setMotivoError(null);
            }}
            className={INPUT_CLASSES}
            aria-invalid={motivoError ? true : undefined}
            aria-describedby={fieldDescribedBy('motivo', motivoError)}
          />
        </FormField>
      </Dialog>
    </div>
  );
}
