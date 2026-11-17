import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  listTiposAnalisis,
  type TipoAnalisis,
} from '../../api/catalogos';
import { ApiError, type Paginated } from '../../api/http';
import {
  INDICACIONES_PAGE_SIZE,
  deactivateIndicacion,
  listIndicaciones,
  type IndicacionFilters,
  type IndicacionMedica,
} from '../../api/indicaciones';
import { Btn } from '../../components/Btn';
import { DataTable, type Column } from '../../components/DataTable';
import { Dialog } from '../../components/Dialog';
import { EmptyState } from '../../components/EmptyState';
import { FilterBar } from '../../components/FilterBar';
import { Pagination } from '../../components/Pagination';
import { loadToken } from '../../session/sessionStore';
import { useGoHome } from '../../routes/useGoHome';

/**
 * REC-U09 · Listado de indicaciones médicas (P1).
 *
 * Backing requirement: UCE-REC-13 pasos 1-4 (consultar y filtrar), UCE-REC-12
 * pasos 1-6 (eliminar lógicamente), RF-02.
 *
 * The four columns are the ones UCE-REC-13 paso 3 names. Deleting is the logical
 * `inactiva` transition, so an inactive instruction offers no action: it stays
 * visible because historical appointments still reference it.
 */

const TABLE_LABEL = 'Indicaciones médicas registradas';

const ESTADO_LABELS: Record<string, string> = {
  activa: 'Activa',
  inactiva: 'Inactiva',
};

const ESTADO_OPTIONS = [
  { value: '', label: 'Todas' },
  { value: 'activa', label: 'Activa' },
  { value: 'inactiva', label: 'Inactiva' },
];

interface FilterValues {
  q: string;
  estado: string;
  tipo_analisis_id: string;
}

const NO_FILTERS: FilterValues = { q: '', estado: '', tipo_analisis_id: '' };

function estadoLabel(estado: string): string {
  return ESTADO_LABELS[estado] ?? estado;
}

/** UCE-REC-13 paso 3 asks for the content; a long one is truncated, not hidden. */
function resumen(contenido: string, limite = 90): string {
  if (contenido.length <= limite) {
    return contenido;
  }
  return `${contenido.slice(0, limite).trimEnd()}…`;
}

export function IndicacionesListPage() {
  const navigate = useNavigate();
  const goHome = useGoHome();
  const token = loadToken();

  const [draft, setDraft] = useState<FilterValues>(NO_FILTERS);
  const [applied, setApplied] = useState<FilterValues>(NO_FILTERS);
  const [offset, setOffset] = useState(0);
  const [refresh, setRefresh] = useState(0);

  const [page, setPage] = useState<Paginated<IndicacionMedica> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [tipos, setTipos] = useState<TipoAnalisis[]>([]);

  const [pending, setPending] = useState<IndicacionMedica | null>(null);
  const [removing, setRemoving] = useState(false);

  // The "tipo de análisis" filter reads the catalog once (UCE-REC-13 paso 4).
  useEffect(() => {
    let cancelled = false;
    listTiposAnalisis(token, { limit: 100 })
      .then((pagina) => {
        if (!cancelled) {
          setTipos(pagina.items);
        }
      })
      .catch(() => {
        // A missing catalog only removes the filter; the listing still works.
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    const filters: IndicacionFilters = {
      q: applied.q,
      estado: applied.estado,
      tipo_analisis_id: applied.tipo_analisis_id,
      limit: INDICACIONES_PAGE_SIZE,
      offset,
    };
    listIndicaciones(token, filters)
      .then((pagina) => {
        if (cancelled) {
          return;
        }
        // Removing the last row of a page leaves the offset out of range.
        if (pagina.items.length === 0 && offset > 0) {
          setOffset(Math.max(0, offset - INDICACIONES_PAGE_SIZE));
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
        setLoadError('No se pudieron cargar las indicaciones');
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

  const hasFilters = Boolean(applied.q || applied.estado || applied.tipo_analisis_id);

  function applyFilters(siguientes: FilterValues) {
    setApplied(siguientes);
    setOffset(0);
    setActionError(null);
  }

  function changeFilter(field: keyof FilterValues, value: string) {
    const siguientes = { ...draft, [field]: value };
    setDraft(siguientes);
    // The selects apply on change, but only their own value: applying the whole
    // draft would smuggle the half-typed text into the query.
    if (field !== 'q') {
      setApplied({ ...applied, [field]: value });
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
      await deactivateIndicacion(token, pending.id);
      setPending(null);
      setRefresh((valor) => valor + 1);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        goHome();
        return;
      }
      setActionError(
        error instanceof ApiError ? error.message : 'No se pudo eliminar la indicación',
      );
      setPending(null);
    } finally {
      setRemoving(false);
    }
  }

  const columns: Column<IndicacionMedica>[] = [
    { key: 'titulo', header: 'Título', render: (fila) => fila.titulo },
    {
      key: 'contenido',
      header: 'Contenido',
      render: (fila) => (
        <span title={fila.contenido}>{resumen(fila.contenido)}</span>
      ),
    },
    {
      key: 'tipo',
      header: 'Tipo de análisis',
      render: (fila) => fila.tipo_analisis_nombre || '—',
    },
    { key: 'estado', header: 'Estado', render: (fila) => estadoLabel(fila.estado) },
    {
      key: 'acciones',
      header: 'Acciones',
      render: (fila) => (
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label={`Editar ${fila.titulo}`}
            className="text-xs font-medium text-brand hover:underline"
            onClick={() => navigate(`/indicaciones/${fila.id}/editar`)}
          >
            Editar
          </button>
          {/* REC-12 paso 5: an inactive instruction is already out of the flow. */}
          {fila.estado === 'activa' && (
            <button
              type="button"
              aria-label={`Eliminar ${fila.titulo}`}
              className="text-xs font-medium text-red-700 hover:underline"
              onClick={() => setPending(fila)}
            >
              Eliminar
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-[28px] font-bold leading-tight tracking-tight text-gray-900">
          Indicaciones Médicas
        </h1>
        <Btn variant="primary" onClick={() => navigate('/indicaciones/nueva')}>
          Nueva Indicación
        </Btn>
      </div>

      <div className="mt-6 overflow-hidden rounded-md border border-gray-200 bg-white">
        <FilterBar
          label="Filtros de indicaciones"
          onSubmit={() => applyFilters(draft)}
          onReset={hasFilters ? clearFilters : undefined}
        >
          <label className="flex flex-col gap-1 text-xs text-muted">
            Buscar
            <input
              type="search"
              value={draft.q}
              onChange={(event) => changeFilter('q', event.target.value)}
              placeholder="Título o contenido"
              className={INPUT}
            />
          </label>

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
            Tipo de análisis
            <select
              value={draft.tipo_analisis_id}
              onChange={(event) => changeFilter('tipo_analisis_id', event.target.value)}
              className={INPUT}
            >
              <option value="">Todos</option>
              {tipos.map((tipo) => (
                <option key={tipo.id} value={tipo.id}>
                  {tipo.nombre}
                </option>
              ))}
            </select>
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
            rowKey={(fila) => fila.id}
            loading
          />
        ) : page && page.items.length === 0 ? (
          <div className="px-3 py-6">
            <EmptyState
              message={
                hasFilters
                  ? 'No se encontraron indicaciones con esos filtros'
                  : 'No hay indicaciones médicas registradas'
              }
            />
            {!hasFilters && (
              <Btn className="mt-2" variant="primary" onClick={() => navigate('/indicaciones/nueva')}>
                Nueva Indicación
              </Btn>
            )}
          </div>
        ) : page ? (
          <>
            <DataTable
              label={TABLE_LABEL}
              columns={columns}
              rows={page.items}
              rowKey={(fila) => fila.id}
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
        title="Eliminar indicación médica"
        onClose={() => setPending(null)}
        footer={
          <>
            <Btn onClick={() => setPending(null)}>Cancelar</Btn>
            <Btn variant="primary" disabled={removing} onClick={() => void confirmRemoval()}>
              {removing ? 'Eliminando…' : 'Confirmar'}
            </Btn>
          </>
        }
      >
        <p className="text-sm text-gray-800">
          {pending
            ? `Se va a desactivar «${pending.titulo}». Deja de enviarse en turnos nuevos, pero los turnos que ya la usaron la conservan.`
            : ''}
        </p>
      </Dialog>
    </div>
  );
}

const INPUT =
  'rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand focus:outline-none';
