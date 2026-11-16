import { useEffect, useState } from 'react';
import { ApiError } from '../../api/http';
import {
  getAuditoria,
  type AuditoriaDetalle,
  type CambioAuditoria,
} from '../../api/auditoria';
import { Btn } from '../../components/Btn';
import { DataTable, type Column } from '../../components/DataTable';
import { EmptyState } from '../../components/EmptyState';
import { loadToken } from '../../session/sessionStore';
import { accionLabel, formatFechaHora } from './AuditoriaPage';

/**
 * SEG-U05 · Detalle de evento de auditoría (P2).
 *
 * Backing requirement: UCE-SEG-04 pasos 5-6. Read-only: the header block and the
 * field-change table mirror what the backend answers, and nothing here writes.
 * It is a view state of `AuditoriaPage`, so it has no route of its own.
 */

const CHANGES_TABLE = 'Cambios de campos';

/** R1: a masked password change reads as an action, never the field or hash. */
function campoLabel(campo: string): string {
  return campo === 'contrasena_hash' || campo === 'contrasena'
    ? 'Contraseña actualizada'
    : campo;
}

/** R4: an empty value reads as `—`, never a blank cell. */
function valor(value: string | null): string {
  return value ?? '—';
}

const changesColumns: Column<CambioAuditoria>[] = [
  { key: 'campo', header: 'Campo', render: (cambio) => campoLabel(cambio.campo) },
  {
    key: 'valor_anterior',
    header: 'Valor anterior',
    render: (cambio) => valor(cambio.valor_anterior),
  },
  {
    key: 'valor_nuevo',
    header: 'Valor nuevo',
    render: (cambio) => valor(cambio.valor_nuevo),
  },
];

function changesKey(cambio: CambioAuditoria): string {
  return `${cambio.campo}|${cambio.valor_anterior ?? ''}|${cambio.valor_nuevo ?? ''}`;
}

interface AuditoriaDetallePageProps {
  id: string;
  onBack: () => void;
  onForbidden: () => void;
}

export function AuditoriaDetallePage({
  id,
  onBack,
  onForbidden,
}: AuditoriaDetallePageProps) {
  const token = loadToken();

  const [detalle, setDetalle] = useState<AuditoriaDetalle | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    setLoadError(false);

    getAuditoria(token, id)
      .then((evento) => {
        if (!cancelled) {
          setDetalle(evento);
        }
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        // R2: no permission is a redirect, not a raw 403 on screen.
        if (error instanceof ApiError && error.status === 403) {
          onForbidden();
          return;
        }
        if (error instanceof ApiError && error.status === 404) {
          setDetalle(null);
          setNotFound(true);
          return;
        }
        setDetalle(null);
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
  }, [token, id, onForbidden]);

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-[28px] font-bold leading-tight tracking-tight text-gray-900">
          Detalle del evento
        </h1>
        <Btn onClick={onBack}>Volver</Btn>
      </div>

      <div className="mt-6 overflow-hidden rounded-md border border-gray-200 bg-white">
        {loadError ? (
          <div className="px-3 py-6">
            <p className="text-sm text-gray-800">No se pudo cargar el evento</p>
          </div>
        ) : notFound ? (
          <div className="px-3 py-6">
            <p className="text-sm text-gray-800">No se encontró el evento</p>
          </div>
        ) : loading || detalle === null ? (
          <DataTable
            label={CHANGES_TABLE}
            columns={changesColumns}
            rows={[]}
            rowKey={changesKey}
            loading
          />
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 px-3 py-4 sm:grid-cols-3">
              <CampoDetalle nombre="Fecha y hora" valor={formatFechaHora(detalle.fecha_hora)} />
              <CampoDetalle
                nombre="Usuario"
                valor={`${detalle.usuario_nombre} ${detalle.usuario_apellido}`}
              />
              <CampoDetalle nombre="Módulo" valor={detalle.modulo} />
              <CampoDetalle nombre="Acción" valor={accionLabel(detalle.accion)} />
              <CampoDetalle nombre="Entidad afectada" valor={detalle.entidad_afectada} />
              <CampoDetalle nombre="Identificador de entidad" valor={detalle.entidad_id} />
              <CampoDetalle nombre="Dirección IP" valor={detalle.direccion_ip ?? '—'} />
            </dl>
            <div className="border-t border-gray-200">
              {detalle.cambios.length === 0 ? (
                <div className="px-3 py-6">
                  <EmptyState message="Evento sin cambios de campo registrados" />
                </div>
              ) : (
                <DataTable
                  label={CHANGES_TABLE}
                  columns={changesColumns}
                  rows={detalle.cambios}
                  rowKey={changesKey}
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function CampoDetalle({ nombre, valor }: { nombre: string; valor: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        {nombre}
      </dt>
      <dd className="mt-0.5 text-sm text-gray-800">{valor}</dd>
    </div>
  );
}