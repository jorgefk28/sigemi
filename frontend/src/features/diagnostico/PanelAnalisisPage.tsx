import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ANALISIS_PAGE_SIZE,
  ESTADO_LABELS,
  listAnalisis,
  type Analisis,
  type AnalisisFilters,
} from '../../api/analisis';
import { listTiposAnalisis, type TipoAnalisis } from '../../api/catalogos';
import { ApiError, type Paginated } from '../../api/http';
import { Btn } from '../../components/Btn';
import { DataTable, type Column } from '../../components/DataTable';
import { EmptyState } from '../../components/EmptyState';
import { FilterBar } from '../../components/FilterBar';
import { Pagination } from '../../components/Pagination';
import { loadToken } from '../../session/sessionStore';
import { formatFechaHora } from '../../lib/format';
import { useGoHome } from '../../routes/useGoHome';

/**
 * DIAG-U01 · Panel de Análisis (P1).
 *
 * Backing requirement: UCE-DIAG-09 pasos 1-5. It is the laboratory's workload:
 * every analysis, filterable by state, type, date and patient, without walking
 * patient by patient. Read-only; the actions live in the detail screen the panel
 * opens (paso 6).
 *
 * The «bioquímico que registró la última acción» filter of paso 3 is not offered
 * yet: its only source is the audit table (A-07) and the screen would need a
 * second query per row to label the selector. Recorded as pending, not faked.
 */

const TABLE_LABEL = 'Análisis micológicos';

const ESTADO_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'en_proceso', label: 'En proceso' },
  { value: 'terminado', label: 'Terminado' },
  { value: 'validado', label: 'Validado' },
  { value: 'invalidado', label: 'Invalidado' },
];

interface FilterValues {
  q: string;
  estado: string;
  tipo_analisis_id: string;
  fecha_desde: string;
  fecha_hasta: string;
}

const NO_FILTERS: FilterValues = {
  q: '',
  estado: '',
  tipo_analisis_id: '',
  fecha_desde: '',
  fecha_hasta: '',
};

export function PanelAnalisisPage() {
  const navigate = useNavigate();
  const goHome = useGoHome();
  const token = loadToken();

  const [draft, setDraft] = useState<FilterValues>(NO_FILTERS);
  const [applied, setApplied] = useState<FilterValues>(NO_FILTERS);
  const [offset, setOffset] = useState(0);
  const [refresh, setRefresh] = useState(0);

  const [page, setPage] = useState<Paginated<Analisis> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tipos, setTipos] = useState<TipoAnalisis[]>([]);

  useEffect(() => {
    let cancelled = false;
    listTiposAnalisis(token, { limit: 100 })
      .then((pagina) => {
        if (!cancelled) {
          setTipos(pagina.items);
        }
      })
      .catch(() => {
        // Without the catalog only the filter disappears.
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    const filters: AnalisisFilters = {
      q: applied.q,
      estado: applied.estado,
      tipo_analisis_id: applied.tipo_analisis_id,
      fecha_desde: applied.fecha_desde,
      fecha_hasta: applied.fecha_hasta,
      limit: ANALISIS_PAGE_SIZE,
      offset,
    };
    listAnalisis(token, filters)
      .then((pagina) => {
        if (cancelled) {
          return;
        }
        if (pagina.items.length === 0 && offset > 0) {
          setOffset(Math.max(0, offset - ANALISIS_PAGE_SIZE));
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
        setLoadError('No se pudieron cargar los análisis');
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

  const hasFilters = Boolean(
    applied.q || applied.estado || applied.tipo_analisis_id || applied.fecha_desde || applied.fecha_hasta,
  );

  function applyFilters(siguientes: FilterValues) {
    setApplied(siguientes);
    setOffset(0);
  }

  function changeFilter(field: keyof FilterValues, value: string) {
    const siguientes = { ...draft, [field]: value };
    setDraft(siguientes);
    // A select applies on change, but only its own value: the half-typed text and
    // dates wait for the submit.
    if (field === 'estado' || field === 'tipo_analisis_id') {
      setApplied({ ...applied, [field]: value });
      setOffset(0);
    }
  }

  function clearFilters() {
    setDraft(NO_FILTERS);
    applyFilters(NO_FILTERS);
  }

  const columns: Column<Analisis>[] = [
    {
      key: 'paciente',
      header: 'Paciente',
      render: (fila) => `${fila.paciente_apellido}, ${fila.paciente_nombre}`,
    },
    {
      key: 'tipo',
      header: 'Tipo de análisis',
      render: (fila) => fila.tipo_analisis_nombre,
    },
    {
      key: 'muestra',
      header: 'Muestra',
      render: (fila) => fila.tipo_muestra_nombre,
    },
    {
      key: 'creacion',
      header: 'Ingreso',
      render: (fila) => formatFechaHora(fila.fecha_creacion),
    },
    {
      key: 'responsable',
      header: 'Responsable',
      render: (fila) => fila.profesional_responsable_nombre || '—',
    },
    {
      key: 'estado',
      header: 'Estado',
      render: (fila) => ESTADO_LABELS[fila.estado] ?? fila.estado,
    },
    {
      key: 'acciones',
      header: 'Acciones',
      render: (fila) => (
        <button
          type="button"
          aria-label={`Ver el análisis de ${fila.paciente_apellido}, ${fila.paciente_nombre}`}
          className="text-xs font-medium text-brand hover:underline"
          onClick={() => navigate(`/analisis/${fila.id}`)}
        >
          Ver
        </button>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-[28px] font-bold leading-tight tracking-tight text-gray-900">
          Análisis
        </h1>
      </div>

      <div className="mt-6 overflow-hidden rounded-md border border-gray-200 bg-white">
        <FilterBar
          label="Filtros de análisis"
          onSubmit={() => applyFilters(draft)}
          onReset={hasFilters ? clearFilters : undefined}
        >
          <label className="flex flex-col gap-1 text-xs text-muted">
            Buscar
            <input
              type="search"
              value={draft.q}
              onChange={(event) => changeFilter('q', event.target.value)}
              placeholder="Apellido o DNI"
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

          <label className="flex flex-col gap-1 text-xs text-muted">
            Desde
            <input
              type="date"
              value={draft.fecha_desde}
              onChange={(event) => changeFilter('fecha_desde', event.target.value)}
              className={INPUT}
            />
          </label>

          <label className="flex flex-col gap-1 text-xs text-muted">
            Hasta
            <input
              type="date"
              value={draft.fecha_hasta}
              onChange={(event) => changeFilter('fecha_hasta', event.target.value)}
              className={INPUT}
            />
          </label>
        </FilterBar>

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
                  ? 'No se encontraron análisis con esos filtros'
                  : 'No hay análisis registrados'
              }
            />
            {hasFilters && (
              <Btn className="mt-2" onClick={clearFilters}>
                Limpiar filtros
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
    </div>
  );
}

const INPUT =
  'rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand focus:outline-none';
