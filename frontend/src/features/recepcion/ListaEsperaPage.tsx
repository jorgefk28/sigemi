import { useEffect, useState } from 'react';
import { ApiError, type Paginated } from '../../api/http';
import {
  LISTA_ESPERA_PAGE_SIZE,
  listListaEspera,
  quitarDeListaEspera,
  type EntradaListaEspera,
  type ListaEsperaFilters,
} from '../../api/listaEspera';
import { Btn } from '../../components/Btn';
import { DataTable, type Column } from '../../components/DataTable';
import { Dialog } from '../../components/Dialog';
import { EmptyState } from '../../components/EmptyState';
import { FilterBar } from '../../components/FilterBar';
import { Pagination } from '../../components/Pagination';
import { loadToken } from '../../session/sessionStore';
import { formatFechaHora } from '../../lib/format';
import { useGoHome } from '../../routes/useGoHome';

/**
 * REC-U11 · Lista de espera (P1).
 *
 * Backing requirement: UCE-REC-29 pasos 1-4 (consultar, ordenar por prioridad,
 * filtrar) and UCE-REC-28 pasos 1-7 (quitar con confirmación, auditado); RF-03.
 *
 * Two limits are declared, not simulated:
 * - the "tipo de análisis" filter needs a catalog endpoint that does not exist
 *   (`UC-DIAG-10`), so only the state and the date range are offered;
 * - the order is the backend's derived priority, so the screen never re-sorts.
 */

const TABLE_LABEL = 'Entradas de la lista de espera';

const ESTADO_LABELS: Record<string, string> = {
  pendiente: 'Pendiente',
  asignado: 'Asignado',
  retirado: 'Retirado',
};

const ESTADO_OPTIONS = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'asignado', label: 'Asignado' },
  { value: 'retirado', label: 'Retirado' },
  { value: '', label: 'Todos' },
];

/**
 * An entry that is still waiting. REC-28 postcondition: a removed patient is
 * out of the list, so "pendiente" is the default view, not "todos".
 */
const DEFAULT_ESTADO = 'pendiente';

interface FilterValues {
  estado: string;
  fecha_desde: string;
  fecha_hasta: string;
}

const NO_FILTERS: FilterValues = {
  estado: DEFAULT_ESTADO,
  fecha_desde: '',
  fecha_hasta: '',
};

function estadoLabel(estado: string): string {
  return ESTADO_LABELS[estado] ?? estado;
}

export function ListaEsperaPage() {
  const goHome = useGoHome();
  const token = loadToken();

  const [draft, setDraft] = useState<FilterValues>(NO_FILTERS);
  const [applied, setApplied] = useState<FilterValues>(NO_FILTERS);
  const [offset, setOffset] = useState(0);
  const [refresh, setRefresh] = useState(0);

  const [page, setPage] = useState<Paginated<EntradaListaEspera> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [pending, setPending] = useState<EntradaListaEspera | null>(null);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    const filters: ListaEsperaFilters = {
      estado: applied.estado,
      fecha_desde: applied.fecha_desde,
      fecha_hasta: applied.fecha_hasta,
      limit: LISTA_ESPERA_PAGE_SIZE,
      offset,
    };
    listListaEspera(token, filters)
      .then((pagina) => {
        if (cancelled) {
          return;
        }
        // Removing the last entry of a page leaves the offset out of range:
        // step back rather than claim the wait list is empty.
        if (pagina.items.length === 0 && offset > 0) {
          setOffset(Math.max(0, offset - LISTA_ESPERA_PAGE_SIZE));
          return;
        }
        setPage(pagina);
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
        setPage(null);
        setLoadError('No se pudo cargar la lista de espera');
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [applied, offset, refresh, token, goHome]);

  const hasFilters =
    applied.estado !== DEFAULT_ESTADO ||
    Boolean(applied.fecha_desde) ||
    Boolean(applied.fecha_hasta);

  function applyFilters(siguientes: FilterValues) {
    setApplied(siguientes);
    setOffset(0);
  }

  function changeFilter(field: keyof FilterValues, value: string) {
    const siguientes = { ...draft, [field]: value };
    setDraft(siguientes);
    // A select applies on change, but only its own value: applying the whole
    // draft would smuggle the half-typed dates into the query.
    if (field === 'estado') {
      setApplied({ ...applied, estado: value });
      setOffset(0);
    }
  }

  function clearFilters() {
    setDraft(NO_FILTERS);
    applyFilters(NO_FILTERS);
  }

  async function confirmRemoval() {
    if (!pending || removing) {
      return;
    }
    setRemoving(true);
    setActionError(null);
    try {
      await quitarDeListaEspera(token, pending.id);
      setPending(null);
      setRefresh((valor) => valor + 1);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        goHome();
        return;
      }
      setActionError(
        error instanceof ApiError ? error.message : 'No se pudo quitar al paciente',
      );
      setPending(null);
    } finally {
      setRemoving(false);
    }
  }

  const columns: Column<EntradaListaEspera>[] = [
    {
      key: 'paciente',
      header: 'Paciente',
      render: (entrada) => `${entrada.paciente_apellido}, ${entrada.paciente_nombre}`,
    },
    { key: 'dni', header: 'DNI', render: (entrada) => entrada.paciente_dni },
    {
      key: 'solicitud',
      header: 'Fecha de solicitud',
      render: (entrada) => formatFechaHora(entrada.fecha_solicitud),
    },
    {
      key: 'estado',
      header: 'Estado',
      render: (entrada) => estadoLabel(entrada.estado),
    },
    {
      key: 'observaciones',
      header: 'Observaciones',
      render: (entrada) => entrada.observaciones ?? '—',
    },
    {
      key: 'acciones',
      header: 'Acciones',
      render: (entrada) =>
        // A removed entry offers nothing: there is no way back into the list.
        entrada.estado === 'retirado' ? (
          <span className="text-xs text-muted">—</span>
        ) : (
          <button
            type="button"
            aria-label={`Quitar a ${entrada.paciente_apellido}, ${entrada.paciente_nombre}`}
            className="text-xs font-medium text-red-700 hover:underline"
            onClick={() => setPending(entrada)}
          >
            Quitar
          </button>
        ),
    },
  ];

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-[28px] font-bold leading-tight tracking-tight text-gray-900">
          Lista de Espera
        </h1>
      </div>

      <div className="mt-6 overflow-hidden rounded-md border border-gray-200 bg-white">
        <FilterBar
          label="Filtros de la lista de espera"
          onSubmit={() => applyFilters(draft)}
          onReset={hasFilters ? clearFilters : undefined}
        >
          <label className="flex flex-col gap-1 text-xs text-muted">
            Estado
            <select
              value={draft.estado}
              onChange={(event) => changeFilter('estado', event.target.value)}
              className={INPUT}
            >
              {ESTADO_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs text-muted">
            Solicitud desde
            <input
              type="date"
              value={draft.fecha_desde}
              onChange={(event) => changeFilter('fecha_desde', event.target.value)}
              className={INPUT}
            />
          </label>

          <label className="flex flex-col gap-1 text-xs text-muted">
            Solicitud hasta
            <input
              type="date"
              value={draft.fecha_hasta}
              onChange={(event) => changeFilter('fecha_hasta', event.target.value)}
              className={INPUT}
            />
          </label>
        </FilterBar>

        {actionError && (
          <p role="alert" className="border-b border-gray-200 px-3 py-2 text-sm text-red-700">
            {actionError}
          </p>
        )}

        {loadError ? (
          <div className="px-3 py-6">
            <p className="text-sm text-gray-800">{loadError}</p>
            <Btn className="mt-2" onClick={() => setRefresh((valor) => valor + 1)}>
              Reintentar
            </Btn>
          </div>
        ) : loading ? (
          <DataTable
            label={TABLE_LABEL}
            columns={columns}
            rows={[]}
            rowKey={(entrada) => entrada.id}
            loading
          />
        ) : page && page.items.length === 0 ? (
          <div className="px-3 py-6">
            <EmptyState
              message={
                hasFilters
                  ? 'No se encontraron entradas con esos filtros'
                  : 'No hay pacientes en lista de espera'
              }
            />
          </div>
        ) : page ? (
          <>
            <DataTable
              label={TABLE_LABEL}
              columns={columns}
              rows={page.items}
              rowKey={(entrada) => entrada.id}
            />
            <Pagination
              total={page.total}
              limit={page.limit}
              offset={page.offset}
              items={page.items.length}
              onOffsetChange={setOffset}
            />
          </>
        ) : null}
      </div>

      <Dialog
        open={pending !== null}
        title="Quitar de la lista de espera"
        onClose={() => setPending(null)}
        footer={
          <>
            <Btn onClick={() => setPending(null)}>Cancelar</Btn>
            <Btn variant="primary" disabled={removing} onClick={() => void confirmRemoval()}>
              {removing ? 'Quitando…' : 'Confirmar'}
            </Btn>
          </>
        }
      >
        <p className="text-sm text-gray-800">
          {pending
            ? `Se va a quitar a ${pending.paciente_apellido}, ${pending.paciente_nombre} de la lista de espera.`
            : ''}
        </p>
        <p className="mt-2 text-xs text-muted">La baja queda registrada en la auditoría.</p>
      </Dialog>
    </div>
  );
}

const INPUT =
  'rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand focus:outline-none';
