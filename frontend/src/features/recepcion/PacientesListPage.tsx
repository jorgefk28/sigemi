import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, type Paginated } from '../../api/http';
import {
  PACIENTES_PAGE_SIZE,
  listPacientes,
  type Paciente,
  type PacienteFilters,
} from '../../api/pacientes';
import { Btn } from '../../components/Btn';
import { DataTable, type Column } from '../../components/DataTable';
import { EmptyState } from '../../components/EmptyState';
import { FilterBar } from '../../components/FilterBar';
import { Pagination } from '../../components/Pagination';
import { loadToken } from '../../session/sessionStore';
import { formatFecha } from '../../lib/format';
import { useGoHome } from '../../routes/useGoHome';

/**
 * REC-U06 · Listado de pacientes (P1).
 *
 * Backing requirement: UCE-REC-18 pasos 1-5, UCE-REC-17 pasos 1-5,
 * UCE-REC-19 pasos 1-4, UCE-REC-S-01 paso 4b; RF-05.
 *
 * This screen is also the "Buscar Paciente" of REC-17 and REC-19 (S-01), so a
 * single match is highlighted and offers the way into the detail: it never
 * navigates on its own, because the invoking use case must receive the answer.
 *
 * "Edad" is not a column (REC-18 paso 6 names "Datos Personales", not age) and
 * the listing includes inactive patients, separated by the `estado` filter.
 */

const TABLE_LABEL = 'Pacientes registrados';

const STATE_LABELS: Record<string, string> = {
  activo: 'Activo',
  inactivo: 'Inactivo',
};

const STATE_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'activo', label: 'Activo' },
  { value: 'inactivo', label: 'Inactivo' },
];

interface FilterValues {
  q: string;
  dni: string;
  nombre: string;
  apellido: string;
  estado: string;
}

const NO_FILTERS: FilterValues = { q: '', dni: '', nombre: '', apellido: '', estado: '' };

function stateLabel(estado: string): string {
  return STATE_LABELS[estado] ?? estado;
}

export function PacientesListPage() {
  const navigate = useNavigate();
  const goHome = useGoHome();
  const token = loadToken();

  const [draft, setDraft] = useState<FilterValues>(NO_FILTERS);
  const [applied, setApplied] = useState<FilterValues>(NO_FILTERS);
  const [offset, setOffset] = useState(0);
  const [refresh, setRefresh] = useState(0);

  const [page, setPage] = useState<Paginated<Paciente> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    const filters: PacienteFilters = { ...applied, limit: PACIENTES_PAGE_SIZE, offset };
    listPacientes(token, filters)
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
          goHome();
          return;
        }
        setPage(null);
        setLoadError('No se pudieron cargar los pacientes');
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

  const hasFilters = Boolean(applied.q || applied.dni || applied.nombre || applied.apellido || applied.estado);

  function applyFilters(siguientes: FilterValues) {
    setApplied(siguientes);
    setOffset(0);
  }

  function changeFilter(field: keyof FilterValues, value: string) {
    const siguientes = { ...draft, [field]: value };
    setDraft(siguientes);
    // The select applies on change; the text criteria wait for the submit.
    if (field === 'estado') {
      applyFilters(siguientes);
    }
  }

  function clearFilters() {
    setDraft(NO_FILTERS);
    applyFilters(NO_FILTERS);
  }

  const singleMatch = page?.total === 1 && page.items.length === 1;

  const columns: Column<Paciente>[] = [
    { key: 'dni', header: 'DNI', render: (paciente) => paciente.dni },
    {
      key: 'nombre',
      header: 'Apellido y nombre',
      render: (paciente) => `${paciente.apellido}, ${paciente.nombre}`,
    },
    {
      key: 'nacimiento',
      header: 'Fecha de nacimiento',
      render: (paciente) => formatFecha(paciente.fecha_nacimiento),
    },
    { key: 'telefono', header: 'Teléfono', render: (paciente) => paciente.telefono },
    { key: 'estado', header: 'Estado', render: (paciente) => stateLabel(paciente.estado) },
    {
      key: 'acciones',
      header: 'Acciones',
      render: (paciente) => (
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label={`Ver ${paciente.apellido}, ${paciente.nombre}`}
            className="text-xs font-medium text-brand hover:underline"
            onClick={() => navigate(`/pacientes/${paciente.id}`)}
          >
            Ver
          </button>
          <button
            type="button"
            aria-label={`Editar ${paciente.apellido}, ${paciente.nombre}`}
            className="text-xs font-medium text-brand hover:underline"
            onClick={() => navigate(`/pacientes/${paciente.id}/editar`)}
          >
            Editar
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-[28px] font-bold leading-tight tracking-tight text-gray-900">
          Pacientes
        </h1>
        <Btn variant="primary" onClick={() => navigate('/pacientes/nuevo')}>
          Nuevo Paciente
        </Btn>
      </div>

      <div className="mt-6 overflow-hidden rounded-md border border-gray-200 bg-white">
        <FilterBar
          label="Filtros de pacientes"
          onSubmit={() => applyFilters(draft)}
          onReset={hasFilters ? clearFilters : undefined}
        >
          <FilterField label="Buscar">
            <input
              type="search"
              value={draft.q}
              onChange={(event) => changeFilter('q', event.target.value)}
              placeholder="DNI, nombre o apellido"
              className={INPUT}
            />
          </FilterField>

          <FilterField label="DNI">
            <input
              type="search"
              inputMode="numeric"
              value={draft.dni}
              onChange={(event) => changeFilter('dni', event.target.value)}
              className={INPUT}
            />
          </FilterField>

          <FilterField label="Nombre">
            <input
              type="search"
              value={draft.nombre}
              onChange={(event) => changeFilter('nombre', event.target.value)}
              className={INPUT}
            />
          </FilterField>

          <FilterField label="Apellido">
            <input
              type="search"
              value={draft.apellido}
              onChange={(event) => changeFilter('apellido', event.target.value)}
              className={INPUT}
            />
          </FilterField>

          <FilterField label="Estado">
            <select
              value={draft.estado}
              onChange={(event) => changeFilter('estado', event.target.value)}
              className={INPUT}
            >
              {STATE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FilterField>
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
            rowKey={(paciente) => paciente.id}
            loading
          />
        ) : page && page.items.length === 0 ? (
          <div className="px-3 py-6">
            <EmptyState
              message={
                hasFilters
                  ? 'No se encontraron pacientes con los criterios ingresados'
                  : 'No hay pacientes registrados'
              }
            />
            {!hasFilters && (
              <Btn className="mt-2" variant="primary" onClick={() => navigate('/pacientes/nuevo')}>
                Nuevo Paciente
              </Btn>
            )}
          </div>
        ) : page ? (
          <>
            {singleMatch && (
              <p role="status" className="border-b border-gray-200 px-3 py-2 text-xs text-muted">
                Una sola coincidencia: usá «Ver» para abrir la ficha.
              </p>
            )}
            <DataTable
              label={TABLE_LABEL}
              columns={columns}
              rows={page.items}
              rowKey={(paciente) => paciente.id}
              highlightedRowKey={singleMatch ? page.items[0].id : undefined}
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

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted">
      {label}
      {children}
    </label>
  );
}
