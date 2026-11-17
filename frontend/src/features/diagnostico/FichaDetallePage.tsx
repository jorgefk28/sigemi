import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getCamposClinicos, getFicha, type CampoClinico, type FichaClinica } from '../../api/fichas';
import { ApiError } from '../../api/http';
import { Btn } from '../../components/Btn';
import { loadToken } from '../../session/sessionStore';
import { formatFechaHora } from '../../lib/format';
import { useGoHome } from '../../routes/useGoHome';

/**
 * DIAG-U04 · Ficha clínica, detalle (P2).
 *
 * Backing requirement: UCE-DIAG-06 pasos 4-6. It is the read-only view of one
 * record, reached from the patient's history, with "Editar" when the record can
 * still change: with a validated analysis the backend rejects the modification,
 * and the screen simply says so instead of offering a button that fails.
 */

export function FichaDetallePage() {
  const { pacienteId, fichaId } = useParams<{ pacienteId: string; fichaId: string }>();
  const navigate = useNavigate();
  const goHome = useGoHome();
  const token = loadToken();

  const [ficha, setFicha] = useState<FichaClinica | null>(null);
  const [campos, setCampos] = useState<CampoClinico[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!fichaId) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    setFailed(false);

    Promise.all([getFicha(token, fichaId), getCamposClinicos(token)])
      .then(([encontrada, catalogo]) => {
        if (!cancelled) {
          setFicha(encontrada);
          setCampos(catalogo);
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
  }, [fichaId, token, attempt, goHome]);

  if (loading) {
    return (
      <div role="status" aria-live="polite" className="text-sm text-muted">
        Cargando…
      </div>
    );
  }

  if (failed || !ficha) {
    return (
      <div>
        <p className="text-sm text-gray-800">No se pudo cargar la ficha clínica</p>
        <div className="mt-2 flex gap-2">
          <Btn onClick={() => setAttempt((valor) => valor + 1)}>Reintentar</Btn>
          <Btn onClick={() => navigate(`/pacientes/${pacienteId}`)}>Volver</Btn>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold leading-tight tracking-tight text-gray-900">
            Ficha clínica
          </h1>
          <p className="mt-1 text-xs text-muted">
            {ficha.paciente_apellido}, {ficha.paciente_nombre} · DNI {ficha.paciente_dni}
            <span className="mx-2" aria-hidden="true">
              ·
            </span>
            {formatFechaHora(ficha.fecha_consulta)}
            <span className="mx-2" aria-hidden="true">
              ·
            </span>
            Versión {ficha.version_actual}
            <span className="mx-2" aria-hidden="true">
              ·
            </span>
            {ficha.profesional_nombre}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Btn onClick={() => navigate(`/pacientes/${pacienteId}`)}>Volver</Btn>
          <Btn
            onClick={() =>
              navigate(`/pacientes/${pacienteId}/fichas/${ficha.id}/editar`)
            }
          >
            Editar
          </Btn>
        </div>
      </div>

      <section className="mt-6 overflow-hidden rounded-md border border-gray-200 bg-white">
        <h2 className="border-b border-gray-200 px-3 py-2 text-sm font-semibold text-gray-900">
          Datos clínicos
        </h2>
        <dl aria-label="Datos clínicos">
          {campos.map((campo) => (
            <div
              key={campo.campo}
              className="flex border-b border-gray-100 px-3 py-2 last:border-0"
            >
              <dt className="w-56 shrink-0 text-xs font-semibold uppercase tracking-wide text-gray-500">
                {campo.etiqueta}
              </dt>
              {/* R4: an absent value is an em dash, never a blank cell. */}
              <dd className="text-sm text-gray-800">
                {ficha.datos[campo.campo] ?? '—'}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
