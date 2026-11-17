import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ApiError, type Paginated } from '../../api/http';
import {
  CATALOGO_PAGE_SIZE,
  createTipoAnalisis,
  createTipoMuestra,
  deactivateTipoAnalisis,
  deactivateTipoMuestra,
  listTiposAnalisis,
  listTiposMuestra,
  updateTipoAnalisis,
  updateTipoMuestra,
  type TipoCatalogoPayload,
} from '../../api/catalogos';
import { Btn } from '../../components/Btn';
import { DataTable, type Column } from '../../components/DataTable';
import { Dialog } from '../../components/Dialog';
import { EmptyState } from '../../components/EmptyState';
import { FormField, INPUT_CLASSES, fieldDescribedBy } from '../../components/FormField';
import { loadToken } from '../../session/sessionStore';
import { useGoHome } from '../../routes/useGoHome';

/**
 * DIAG-U06 · Catálogo clínico (P6 — catálogo simple).
 *
 * Backing requirement: UCE-DIAG-10 pasos 1-7, RF-16. The administrator manages
 * the analysis types and the sample types; both catalogs have the same shape in
 * level 3, so they share one editor and one table component.
 *
 * P6 is «tabla + alta/edición en línea»: the editor opens inside the table, not
 * on its own route, because a catalog row is three fields and a navigation would
 * cost more than it saves. Deactivating is logical (excepción del paso 6): the
 * row stays so historical analyses keep resolving their type.
 */

interface Fila {
  id: string;
  nombre: string;
  descripcion: string | null;
  estado: string;
}

interface CatalogoApi {
  listar: (token: string | null, filters: { limit: number }) => Promise<Paginated<Fila>>;
  crear: (token: string | null, datos: TipoCatalogoPayload) => Promise<Fila>;
  actualizar: (
    token: string | null,
    id: string,
    cambios: Partial<TipoCatalogoPayload>,
  ) => Promise<Fila>;
  darDeBaja: (token: string | null, id: string) => Promise<Fila>;
}

const ANALISIS: CatalogoApi = {
  listar: listTiposAnalisis,
  crear: createTipoAnalisis,
  actualizar: updateTipoAnalisis,
  darDeBaja: deactivateTipoAnalisis,
};

const MUESTRA: CatalogoApi = {
  listar: listTiposMuestra,
  crear: createTipoMuestra,
  actualizar: updateTipoMuestra,
  darDeBaja: deactivateTipoMuestra,
};

const ESTADO_LABELS: Record<string, string> = {
  activo: 'Activo',
  inactivo: 'Inactivo',
};

type Editor = { mode: 'closed' } | { mode: 'create' } | { mode: 'edit'; fila: Fila };

function SeccionCatalogo({
  titulo,
  etiquetaFila,
  etiquetaPlural,
  api,
}: {
  titulo: string;
  /** Singular, used in the action labels. */
  etiquetaFila: string;
  /** Plural, used in the empty and error states. */
  etiquetaPlural: string;
  api: CatalogoApi;
}) {
  const token = loadToken();
  const goHome = useGoHome();

  const [filas, setFilas] = useState<Fila[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

  const [editor, setEditor] = useState<Editor>({ mode: 'closed' });
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [pending, setPending] = useState<Fila | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  const cargar = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    api
      .listar(token, { limit: CATALOGO_PAGE_SIZE * 5 })
      .then((pagina) => {
        if (!cancelled) {
          setFilas(pagina.items);
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
        setFilas([]);
        setLoadError(`No se pudo cargar el catálogo de ${etiquetaPlural}`);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [api, token, etiquetaPlural, goHome]);

  useEffect(() => cargar(), [cargar, refresh]);

  function abrirAlta() {
    setEditor({ mode: 'create' });
    setNombre('');
    setDescripcion('');
    setErrors({});
    setGeneralError(null);
  }

  function abrirEdicion(fila: Fila) {
    setEditor({ mode: 'edit', fila });
    setNombre(fila.nombre);
    setDescripcion(fila.descripcion ?? '');
    setErrors({});
    setGeneralError(null);
  }

  function cerrarEditor() {
    setEditor({ mode: 'closed' });
    setErrors({});
    setGeneralError(null);
  }

  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) {
      return;
    }

    if (!nombre.trim()) {
      setErrors({ nombre: 'El nombre no puede estar vacío' });
      return;
    }

    setSaving(true);
    try {
      const payload: TipoCatalogoPayload = {
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || undefined,
      };

      if (editor.mode === 'create') {
        await api.crear(token, payload);
      } else if (editor.mode === 'edit') {
        await api.actualizar(token, editor.fila.id, payload);
      }
      cerrarEditor();
      setRefresh((valor) => valor + 1);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        goHome();
        return;
      }
      // R3: the duplicate name is the rule that fails most, and it is a field.
      if (error instanceof ApiError && error.campo) {
        setErrors({ [error.campo]: error.message });
      } else {
        setGeneralError(
          error instanceof ApiError ? error.message : `No se pudo guardar el ${etiquetaFila}`,
        );
      }
    } finally {
      setSaving(false);
    }
  }

  async function confirmarBaja() {
    if (!pending || deactivating) {
      return;
    }
    setDeactivating(true);
    try {
      await api.darDeBaja(token, pending.id);
      setPending(null);
      setRefresh((valor) => valor + 1);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        goHome();
        return;
      }
      setPending(null);
      setLoadError(
        error instanceof ApiError ? error.message : `No se pudo desactivar el ${etiquetaFila}`,
      );
    } finally {
      setDeactivating(false);
    }
  }

  const columns: Column<Fila>[] = [
    { key: 'nombre', header: 'Nombre', render: (fila) => fila.nombre },
    {
      key: 'descripcion',
      header: 'Descripción',
      render: (fila) => fila.descripcion ?? '—',
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
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label={`Editar ${fila.nombre}`}
            className="text-xs font-medium text-brand hover:underline"
            onClick={() => abrirEdicion(fila)}
          >
            Editar
          </button>
          {fila.estado === 'activo' && (
            <button
              type="button"
              aria-label={`Desactivar ${fila.nombre}`}
              className="text-xs font-medium text-red-700 hover:underline"
              onClick={() => setPending(fila)}
            >
              Desactivar
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <section className="mt-6 overflow-hidden rounded-md border border-gray-200 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-3 py-2">
        <h2 className="text-sm font-semibold text-gray-900">{titulo}</h2>
        <Btn variant="primary" onClick={abrirAlta}>
          Nuevo {etiquetaFila}
        </Btn>
      </div>

      {editor.mode !== 'closed' && (
        <form
          aria-label={
            editor.mode === 'create' ? `Alta de ${etiquetaFila}` : `Edición de ${etiquetaFila}`
          }
          className="border-b border-gray-200 bg-gray-50 px-3 py-3"
          onSubmit={(event) => void guardar(event)}
        >
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-56 flex-1">
              <FormField id={`nombre-${etiquetaFila}`} label="Nombre" error={errors.nombre}>
                <input
                  id={`nombre-${etiquetaFila}`}
                  name="nombre"
                  type="text"
                  autoComplete="off"
                  maxLength={120}
                  value={nombre}
                  onChange={(event) => setNombre(event.target.value)}
                  className={INPUT_CLASSES}
                  aria-invalid={errors.nombre ? true : undefined}
                  aria-describedby={fieldDescribedBy(`nombre-${etiquetaFila}`, errors.nombre)}
                />
              </FormField>
            </div>
            <div className="min-w-56 flex-1">
              <FormField id={`descripcion-${etiquetaFila}`} label="Descripción (opcional)">
                <input
                  id={`descripcion-${etiquetaFila}`}
                  name="descripcion"
                  type="text"
                  autoComplete="off"
                  value={descripcion}
                  onChange={(event) => setDescripcion(event.target.value)}
                  className={INPUT_CLASSES}
                />
              </FormField>
            </div>
            <div className="mb-4 flex items-center gap-2">
              <Btn onClick={cerrarEditor}>Cancelar</Btn>
              <Btn type="submit" variant="primary" disabled={saving}>
                {saving ? 'Guardando…' : 'Guardar'}
              </Btn>
            </div>
          </div>

          {generalError && (
            <p role="alert" className="text-sm text-red-700">
              {generalError}
            </p>
          )}
        </form>
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
          label={titulo}
          columns={columns}
          rows={[]}
          rowKey={(fila) => fila.id}
          loading
        />
      ) : filas.length === 0 ? (
        <div className="px-3 py-6">
          <EmptyState message={`No hay ${etiquetaPlural} cargados`} />
          <p className="mt-1 text-xs text-muted">
            El formulario de indicaciones médicas y el ingreso de muestras los usan como
            selector.
          </p>
        </div>
      ) : (
        <DataTable label={titulo} columns={columns} rows={filas} rowKey={(fila) => fila.id} />
      )}

      <Dialog
        open={pending !== null}
        title={`Desactivar ${etiquetaFila}`}
        onClose={() => setPending(null)}
        footer={
          <>
            <Btn onClick={() => setPending(null)}>Cancelar</Btn>
            <Btn variant="primary" disabled={deactivating} onClick={() => void confirmarBaja()}>
              {deactivating ? 'Desactivando…' : 'Confirmar'}
            </Btn>
          </>
        }
      >
        <p className="text-sm text-gray-800">
          {pending
            ? `«${pending.nombre}» deja de poder elegirse en registros nuevos, pero se conserva para los registros históricos.`
            : ''}
        </p>
      </Dialog>
    </section>
  );
}

export function CatalogosPage() {
  return (
    <div>
      <h1 className="text-[28px] font-bold leading-tight tracking-tight text-gray-900">
        Catálogos Clínicos
      </h1>
      <p className="mt-1 text-sm text-muted">
        Tipos de análisis y de muestra disponibles. Los formularios clínicos los leen de acá.
      </p>

      <SeccionCatalogo
        titulo="Tipos de análisis"
        etiquetaFila="tipo de análisis"
        etiquetaPlural="tipos de análisis"
        api={ANALISIS}
      />
      <SeccionCatalogo
        titulo="Tipos de muestra"
        etiquetaFila="tipo de muestra"
        etiquetaPlural="tipos de muestra"
        api={MUESTRA}
      />
    </div>
  );
}
