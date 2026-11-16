import { useEffect, useState } from 'react';
import type { User } from '../../api/auth';
import { ApiError } from '../../api/http';
import {
  listAuditoria,
  type AuditoriaEvento,
  type AuditoriaFilters,
} from '../../api/auditoria';
import { listUsers, PAGE_SIZE, type Paginated } from '../../api/usuarios';
import { Btn } from '../../components/Btn';
import { DataTable, type Column } from '../../components/DataTable';
import { EmptyState } from '../../components/EmptyState';
import { FilterBar } from '../../components/FilterBar';
import { Pagination } from '../../components/Pagination';
import { loadToken } from '../../session/sessionStore';
import { AuditoriaDetallePage } from './AuditoriaDetallePage';

/**
 * SEG-U04 · Listado de auditoría (P1) and its SEG-U05 sub-view.
 *
 * Backing requirement: UCE-SEG-04 pasos 1-4 (listado y filtros) and 5-6
 * (detalle), both `administrador`-only. The detail is a view state of this
 * page, not a route, so the ``Volver`` action keeps the applied filters:
 * that is why the filter state lives here and not in the list child.
 */

const TABLE_LABEL = 'Registro de auditoría';

/** How many users the ``usuario_id`` selector reads (the backend caps at 100). */
const USER_CATALOG_SIZE = 100;

/** Closed ``accion`` catalog (D6). Insertion order is the filter's order. */
const ACCION_LABELS: Record<string, string> = {
  crear: 'Crear',
  modificar: 'Modificar',
  eliminar: 'Eliminar',
  consultar: 'Consultar',
  acceder: 'Acceder',
  bloquear: 'Bloquear',
};

const ACCION_OPTIONS = [
  { value: '', label: 'Todos' },
  ...Object.entries(ACCION_LABELS).map(([value, label]) => ({ value, label })),
];

const NO_FILTERS: AuditoriaFilters = {
  usuario_id: '',
  fecha_desde: '',
  fecha_hasta: '',
  accion: '',
};

/** Display label for a closed-catalog action code; unknown codes stay raw. */
export function accionLabel(codigo: string): string {
  return ACCION_LABELS[codigo] ?? codigo;
}

/** R4: ISO-8601 UTC rendered as the viewer's local `dd/MM/yyyy HH:mm`. */
export function formatFechaHora(iso: string): string {
  const fecha = new Date(iso);
  const parteFecha = new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(fecha);
  const parteHora = new Intl.DateTimeFormat('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(fecha);
  return `${parteFecha} ${parteHora}`;
}

type View = { mode: 'list' } | { mode: 'detail'; id: string };

interface AuditoriaPageProps {
  /** A `403` is not a raw error: the shell sends the user back to the start. */
  onForbidden: () => void;
}

export function AuditoriaPage({ onForbidden }: AuditoriaPageProps) {
  const [view, setView] = useState<View>({ mode: 'list' });

  // The filters live here, not in the list child, so the detail round-trip
  // keeps them (SEG-U05: "Volver" conserva los filtros).
  const [draft, setDraft] = useState<AuditoriaFilters>(NO_FILTERS);
  const [applied, setApplied] = useState<AuditoriaFilters>(NO_FILTERS);
  const [offset, setOffset] = useState(0);

  function changeFilter(field: keyof AuditoriaFilters, value: string) {
    const siguiente = { ...draft, [field]: value };
    setDraft(siguiente);
    // The selects apply on change; the date inputs wait for the submit.
    if (field === 'usuario_id' || field === 'accion') {
      setApplied(siguiente);
      setOffset(0);
    }
  }

  function applyDraft() {
    setApplied(draft);
    setOffset(0);
  }

  function clearFilters() {
    setDraft(NO_FILTERS);
    setApplied(NO_FILTERS);
    setOffset(0);
  }

  if (view.mode === 'list') {
    return (
      <AuditoriaList
        draft={draft}
        applied={applied}
        offset={offset}
        onChange={changeFilter}
        onSubmit={applyDraft}
        onReset={clearFilters}
        onOffsetChange={setOffset}
        onDetail={(id) => setView({ mode: 'detail', id })}
        onForbidden={onForbidden}
      />
    );
  }

  return (
    <AuditoriaDetallePage
      id={view.id}
      onBack={() => setView({ mode: 'list' })}
      onForbidden={onForbidden}
    />
  );
}

interface AuditoriaListProps {
  draft: AuditoriaFilters;
  applied: AuditoriaFilters;
  offset: number;
  onChange: (field: keyof AuditoriaFilters, value: string) => void;
  onSubmit: () => void;
  onReset: () => void;
  onOffsetChange: (offset: number) => void;
  onDetail: (id: string) => void;
  onForbidden: () => void;
}

function AuditoriaList({
  draft,
  applied,
  offset,
  onChange,
  onSubmit,
  onReset,
  onOffsetChange,
  onDetail,
  onForbidden,
}: AuditoriaListProps) {
  const token = loadToken();

  const [catalogo, setCatalogo] = useState<User[]>([]);
  const [page, setPage] = useState<Paginated<AuditoriaEvento> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

  // The Usuario filter reads the user catalog once. The table does not wait for
  // it: the listing already answers `usuario_nombre` + `usuario_apellido`.
  useEffect(() => {
    let cancelled = false;
    listUsers(token, { limit: USER_CATALOG_SIZE })
      .then((pagina) => {
        if (!cancelled) {
          setCatalogo(pagina.items);
        }
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        if (error instanceof ApiError && error.status === 403) {
          onForbidden();
          return;
        }
        setCatalogo([]);
      });
    return () => {
      cancelled = true;
    };
  }, [token, onForbidden]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    listAuditoria(token, { ...applied, limit: PAGE_SIZE, offset })
      .then((pagina) => {
        if (!cancelled) {
          setPage(pagina);
        }
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        // R2: no permission is a redirect, never a raw 403 on screen.
        if (error instanceof ApiError && error.status === 403) {
          onForbidden();
          return;
        }
        setPage(null);
        setLoadError('No se pudo cargar el registro de auditoría');
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [applied, offset, refresh, token, onForbidden]);

  const hasFilters = Boolean(
    applied.usuario_id || applied.fecha_desde || applied.fecha_hasta || applied.accion,
  );

  const columns: Column<AuditoriaEvento>[] = [
    {
      key: 'fecha_hora',
      header: 'Fecha y hora',
      render: (evento) => formatFechaHora(evento.fecha_hora),
    },
    {
      key: 'usuario',
      header: 'Usuario',
      render: (evento) => `${evento.usuario_nombre} ${evento.usuario_apellido}`,
    },
    { key: 'modulo', header: 'Módulo', render: (evento) => evento.modulo },
    { key: 'accion', header: 'Acción', render: (evento) => accionLabel(evento.accion) },
    {
      key: 'entidad_afectada',
      header: 'Entidad afectada',
      render: (evento) => evento.entidad_afectada,
    },
    {
      key: 'direccion_ip',
      header: 'Dirección IP',
      render: (evento) => evento.direccion_ip ?? '—',
    },
    {
      key: 'acciones',
      header: 'Acciones',
      render: (evento) => (
        // R1 + L24: the log is immutable, so the only action is the detail.
        <button
          type="button"
          aria-label={`Ver detalle de ${evento.usuario_nombre} ${evento.usuario_apellido}`}
          className="text-xs font-medium text-brand hover:underline"
          onClick={() => onDetail(evento.id)}
        >
          Ver detalle
        </button>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-[28px] font-bold leading-tight tracking-tight text-gray-900">
          Auditoría
        </h1>
      </div>

      <div className="mt-6 overflow-hidden rounded-md border border-gray-200 bg-white">
        <FilterBar
          label="Filtros de auditoría"
          onSubmit={onSubmit}
          onReset={hasFilters ? onReset : undefined}
        >
          <label className="flex flex-col gap-1 text-xs text-muted">
            Usuario
            <select
              value={draft.usuario_id ?? ''}
              onChange={(event) => onChange('usuario_id', event.target.value)}
              className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand focus:outline-none"
            >
              <option value="">Todos</option>
              {catalogo.map((usuario) => (
                <option key={usuario.id} value={usuario.id}>
                  {usuario.nombre} {usuario.apellido}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs text-muted">
            Fecha desde
            <input
              type="date"
              value={draft.fecha_desde ?? ''}
              onChange={(event) => onChange('fecha_desde', event.target.value)}
              className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand focus:outline-none"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs text-muted">
            Fecha hasta
            <input
              type="date"
              value={draft.fecha_hasta ?? ''}
              onChange={(event) => onChange('fecha_hasta', event.target.value)}
              className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand focus:outline-none"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs text-muted">
            Tipo de acción
            <select
              value={draft.accion ?? ''}
              onChange={(event) => onChange('accion', event.target.value)}
              className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand focus:outline-none"
            >
              {ACCION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
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
            rowKey={(evento) => evento.id}
            loading
          />
        ) : page && page.items.length === 0 ? (
          <div className="px-3 py-6">
            <EmptyState
              message={
                hasFilters
                  ? 'No se encontraron eventos'
                  : 'No hay eventos registrados'
              }
            />
          </div>
        ) : page ? (
          <>
            <DataTable
              label={TABLE_LABEL}
              columns={columns}
              rows={page.items}
              rowKey={(evento) => evento.id}
            />
            <Pagination
              total={page.total}
              limit={page.limit}
              offset={page.offset}
              items={page.items.length}
              onOffsetChange={onOffsetChange}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}