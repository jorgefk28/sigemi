import { useEffect, useState } from 'react';
import type { User } from '../../api/auth';
import { ApiError } from '../../api/http';
import {
  PAGE_SIZE,
  listRoles,
  listUsers,
  updateUser,
  type Paginated,
  type Rol,
} from '../../api/usuarios';
import { Btn } from '../../components/Btn';
import { DataTable, type Column } from '../../components/DataTable';
import { EmptyState } from '../../components/EmptyState';
import { FilterBar } from '../../components/FilterBar';
import { Pagination } from '../../components/Pagination';
import { useAuth } from '../../session/auth';
import { loadToken } from '../../session/sessionStore';
import { UsuarioFormPage } from './UsuarioFormPage';

/**
 * SEG-U02 · Listado de usuarios (P1) and its SEG-U03 sub-view.
 *
 * Backing requirement: UCE-SEG-02 pasos 1-2 (listado) and 3-6 (alta/edición),
 * both `administrador`-only. The screen has no identity of its own in the
 * sidebar, so the form is a view state of this page: there is no direct URL to
 * it.
 */

const TABLE_LABEL = 'Usuarios registrados';

const STATE_LABELS: Record<string, string> = {
  activo: 'Activo',
  inactivo: 'Inactivo',
};

const STATE_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'activo', label: 'Activo' },
  { value: 'inactivo', label: 'Inactivo' },
];

interface Filters {
  q: string;
  estado: string;
  rol: string;
}

const NO_FILTERS: Filters = { q: '', estado: '', rol: '' };

function stateLabel(estado: string): string {
  return STATE_LABELS[estado] ?? estado;
}

type View =
  | { mode: 'list' }
  | { mode: 'create' }
  | { mode: 'edit'; usuario: User };

interface UsuariosPageProps {
  /** A `403` is not a raw error: the shell sends the user back to the start. */
  onForbidden: () => void;
}

export function UsuariosPage({ onForbidden }: UsuariosPageProps) {
  const [view, setView] = useState<View>({ mode: 'list' });

  if (view.mode === 'list') {
    return (
      <UsersList
        onNew={() => setView({ mode: 'create' })}
        onEdit={(usuario) => setView({ mode: 'edit', usuario })}
        onForbidden={onForbidden}
      />
    );
  }

  return (
    <UsuarioFormPage
      usuario={view.mode === 'edit' ? view.usuario : undefined}
      onCancel={() => setView({ mode: 'list' })}
      onSaved={() => setView({ mode: 'list' })}
      onForbidden={onForbidden}
    />
  );
}

interface UsersListProps {
  onNew: () => void;
  onEdit: (usuario: User) => void;
  onForbidden: () => void;
}

function UsersList({ onNew, onEdit, onForbidden }: UsersListProps) {
  const token = loadToken();
  const { user } = useAuth();

  const [draft, setDraft] = useState<Filters>(NO_FILTERS);
  const [applied, setApplied] = useState<Filters>(NO_FILTERS);
  const [offset, setOffset] = useState(0);
  const [refresh, setRefresh] = useState(0);

  const [page, setPage] = useState<Paginated<User> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deactivating, setDeactivating] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<Rol[]>([]);
  const [catalogSettled, setCatalogSettled] = useState(false);

  // The Roles column and the Rol filter read the closed catalog once (S3).
  // The table waits for it: a raw role code is never a column value.
  useEffect(() => {
    let cancelled = false;
    listRoles(token)
      .then((pagina) => {
        if (!cancelled) {
          setCatalog(pagina.items);
          setCatalogSettled(true);
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
        setCatalog([]);
        setCatalogSettled(true);
      });
    return () => {
      cancelled = true;
    };
  }, [token, onForbidden]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    listUsers(token, { ...applied, limit: PAGE_SIZE, offset })
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
        setLoadError('No se pudieron cargar los usuarios');
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

  const hasFilters = Boolean(applied.q || applied.estado || applied.rol);

  function applyFilters(siguientes: Filters) {
    setApplied(siguientes);
    setOffset(0);
    setActionError(null);
  }

  function changeFilter(field: keyof Filters, value: string) {
    const siguientes = { ...draft, [field]: value };
    setDraft(siguientes);
    // The selects apply on change; only the free-text box waits for a submit.
    if (field !== 'q') {
      applyFilters(siguientes);
    }
  }

  function clearFilters() {
    setDraft(NO_FILTERS);
    applyFilters(NO_FILTERS);
  }

  async function deactivate(usuario: User) {
    setActionError(null);
    setDeactivating(usuario.id);
    try {
      await updateUser(token, usuario.id, { estado: 'inactivo' });
      setRefresh((valor) => valor + 1);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        onForbidden();
        return;
      }
      setActionError(
        error instanceof ApiError ? error.message : 'No se pudo desactivar el usuario',
      );
    } finally {
      setDeactivating(null);
    }
  }

  function roleNames(usuario: User): string {
    return usuario.roles
      .map((codigo) => catalog.find((rol) => rol.codigo === codigo)?.nombre ?? codigo)
      .join(', ');
  }

  const columns: Column<User>[] = [
    {
      key: 'nombre',
      header: 'Nombre y apellido',
      render: (usuario) => `${usuario.nombre} ${usuario.apellido}`,
    },
    { key: 'correo', header: 'Correo', render: (usuario) => usuario.correo_electronico },
    { key: 'roles', header: 'Roles', render: roleNames },
    { key: 'estado', header: 'Estado', render: (usuario) => stateLabel(usuario.estado) },
    {
      key: 'acciones',
      header: 'Acciones',
      render: (usuario) => (
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label={`Editar ${usuario.nombre} ${usuario.apellido}`}
            className="text-xs font-medium text-brand hover:underline"
            onClick={() => onEdit(usuario)}
          >
            Editar
          </button>
          {/* R1: the administrator cannot deactivate its own account; an
              inactive account has no action because no reactivation exists (G4). */}
          {usuario.id !== user?.id && usuario.estado === 'activo' && (
            <button
              type="button"
              aria-label={`Desactivar ${usuario.nombre} ${usuario.apellido}`}
              className="text-xs font-medium text-red-700 hover:underline disabled:opacity-60"
              disabled={deactivating === usuario.id}
              onClick={() => void deactivate(usuario)}
            >
              Desactivar
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
          Usuarios y Roles
        </h1>
        <Btn variant="primary" onClick={onNew}>
          Nuevo usuario
        </Btn>
      </div>

      <div className="mt-6 overflow-hidden rounded-md border border-gray-200 bg-white">
        <FilterBar
          label="Filtros de usuarios"
          onSubmit={() => applyFilters(draft)}
          onReset={hasFilters ? clearFilters : undefined}
        >
          <label className="flex flex-col gap-1 text-xs text-muted">
            Buscar
            <input
              type="search"
              value={draft.q}
              onChange={(event) => changeFilter('q', event.target.value)}
              placeholder="Nombre, apellido o correo"
              className="w-56 rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand focus:outline-none"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs text-muted">
            Estado
            <select
              value={draft.estado}
              onChange={(event) => changeFilter('estado', event.target.value)}
              className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand focus:outline-none"
            >
              {STATE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs text-muted">
            Rol
            <select
              value={draft.rol}
              onChange={(event) => changeFilter('rol', event.target.value)}
              className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand focus:outline-none"
            >
              <option value="">Todos</option>
              {catalog.map((rol) => (
                <option key={rol.codigo} value={rol.codigo}>
                  {rol.nombre}
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
        ) : loading || !catalogSettled ? (
          <DataTable
            label={TABLE_LABEL}
            columns={columns}
            rows={[]}
            rowKey={(usuario) => usuario.id}
            loading
          />
        ) : page && page.items.length === 0 ? (
          <div className="px-3 py-6">
            <EmptyState
              message={
                hasFilters
                  ? 'No se encontraron usuarios con esos filtros'
                  : 'Sin usuarios registrados'
              }
            />
          </div>
        ) : page ? (
          <>
            <DataTable
              label={TABLE_LABEL}
              columns={columns}
              rows={page.items}
              rowKey={(usuario) => usuario.id}
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
