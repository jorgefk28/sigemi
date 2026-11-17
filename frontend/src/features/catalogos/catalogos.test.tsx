import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../App';
import { jsonResponse, jsonRoute, stubFetchRouter, type RouteHandler } from '../../test/fixtures';
import { adminSession } from '../../test/accessFixtures';

/**
 * DIAG-U06 · Catálogo clínico (P6, primera instancia del patrón).
 *
 * Backing requirement: UCE-DIAG-10 pasos 1-7, RF-16. Two catalogs, one editor:
 * create and edit in the table itself (that is what makes it P6 and not P1), and
 * deactivating is logical because historical records keep their type.
 */

const TOKEN_KEY = 'sigemi.access_token';
const ME_URL = '/api/v1/auth/me';
const ANALISIS_URL = '/api/v1/tipos-analisis?limit=100&offset=0';
const MUESTRA_URL = '/api/v1/tipos-muestra?limit=100&offset=0';

const cultivo = {
  id: 't-1',
  nombre: 'Cultivo de uñas',
  descripcion: 'Hongos filamentosos',
  estado: 'activo',
};

const inactivo = {
  id: 't-2',
  nombre: 'Directo micológico',
  descripcion: null,
  estado: 'inactivo',
};

const unaMuestra = {
  id: 'm-1',
  nombre: 'Uña',
  descripcion: null,
  estado: 'activo',
};

function renderCatalogo(extraRoutes: Record<string, Response | RouteHandler> = {}) {
  sessionStorage.setItem(TOKEN_KEY, 'token-cat');
  window.history.replaceState({}, '', '/catalogos');
  const fetchMock = stubFetchRouter({
    [ME_URL]: jsonRoute(adminSession),
    [ANALISIS_URL]: jsonRoute({ items: [cultivo, inactivo], total: 2, limit: 100, offset: 0 }),
    [MUESTRA_URL]: jsonRoute({ items: [unaMuestra], total: 1, limit: 100, offset: 0 }),
    ...extraRoutes,
  });
  render(<App />);
  return fetchMock;
}

describe('DIAG-U06 catálogo clínico', () => {
  it('shows both catalogs with name, description and state', async () => {
    renderCatalogo();

    expect(await screen.findByText('Cultivo de uñas')).toBeInTheDocument();
    const analisis = screen.getByRole('table', { name: 'Tipos de análisis' });
    expect(within(analisis).getByText('Hongos filamentosos')).toBeInTheDocument();
    expect(within(analisis).getByText('Activo')).toBeInTheDocument();
    expect(within(analisis).getByText('Inactivo')).toBeInTheDocument();
    // R4: a nullable column is an em dash, never a blank cell.
    expect(within(analisis).getAllByText('—').length).toBeGreaterThan(0);

    expect(screen.getByRole('table', { name: 'Tipos de muestra' })).toBeInTheDocument();
  });

  it('creates a type from the editor inside the table', async () => {
    const fetchMock = renderCatalogo({
      '/api/v1/tipos-analisis': () =>
        Promise.resolve(jsonResponse({ ...cultivo, id: 't-3', nombre: 'Nuevo tipo' }, 201)),
    });
    const user = userEvent.setup();

    await screen.findByText('Cultivo de uñas');
    const seccion = screen.getByRole('table', { name: 'Tipos de análisis' }).closest('section');
    await user.click(within(seccion as HTMLElement).getByRole('button', { name: 'Nuevo tipo de análisis' }));

    await user.type(screen.getByLabelText('Nombre'), '  Nuevo tipo  ');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    const call = fetchMock.mock.calls.find(
      ([url, init]) =>
        url === '/api/v1/tipos-analisis' && (init as RequestInit | undefined)?.method === 'POST',
    );
    expect(call).toBeDefined();
    expect(JSON.parse(String((call?.[1] as RequestInit).body))).toEqual({
      nombre: 'Nuevo tipo',
    });
  });

  it('edits a row without leaving the screen', async () => {
    const fetchMock = renderCatalogo({
      [ANALISIS_URL]: (_url, init) =>
        Promise.resolve(
          init?.method === 'PATCH'
            ? jsonResponse({ ...cultivo, nombre: 'Cultivo de piel' })
            : jsonResponse({ items: [cultivo], total: 1, limit: 100, offset: 0 }),
        ),
    });
    const user = userEvent.setup();

    await screen.findByText('Cultivo de uñas');
    await user.click(screen.getByRole('button', { name: 'Editar Cultivo de uñas' }));

    const nombre = screen.getByLabelText('Nombre');
    expect(nombre).toHaveValue('Cultivo de uñas');
    await user.clear(nombre);
    await user.type(nombre, 'Cultivo de piel');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    const patch = fetchMock.mock.calls.find(
      ([, init]) => (init as RequestInit | undefined)?.method === 'PATCH',
    );
    expect(patch).toBeDefined();
    expect(JSON.parse(String((patch?.[1] as RequestInit).body))).toEqual({
      nombre: 'Cultivo de piel',
      descripcion: 'Hongos filamentosos',
    });
  });

  it('reflects the duplicate-name 400 on the field', async () => {
    renderCatalogo({
      '/api/v1/tipos-analisis': () =>
        Promise.resolve(
          jsonResponse({ detail: 'Ya existe un tipo con el nombre «Uña»', campo: 'nombre' }, 400),
        ),
    });
    const user = userEvent.setup();

    await screen.findByText('Cultivo de uñas');
    const seccion = screen.getByRole('table', { name: 'Tipos de análisis' }).closest('section');
    await user.click(within(seccion as HTMLElement).getByRole('button', { name: 'Nuevo tipo de análisis' }));
    await user.type(screen.getByLabelText('Nombre'), 'Uña');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(
      await screen.findByText('Ya existe un tipo con el nombre «Uña»'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre')).toHaveAttribute('aria-invalid', 'true');
  });

  it('deactivates logically, with confirmation', async () => {
    const fetchMock = renderCatalogo({
      '/api/v1/tipos-analisis/t-1/baja': () =>
        Promise.resolve(jsonResponse({ ...cultivo, estado: 'inactivo' })),
    });
    const user = userEvent.setup();

    await screen.findByText('Cultivo de uñas');
    await user.click(screen.getByRole('button', { name: 'Desactivar Cultivo de uñas' }));

    const dialog = await screen.findByRole('dialog', { name: 'Desactivar tipo de análisis' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(
      fetchMock.mock.calls.some(([url]) => url === '/api/v1/tipos-analisis/t-1/baja'),
    ).toBe(false);

    await user.click(screen.getByRole('button', { name: 'Desactivar Cultivo de uñas' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));

    const call = fetchMock.mock.calls.find(
      ([url]) => url === '/api/v1/tipos-analisis/t-1/baja',
    );
    expect(call).toBeDefined();
    expect((call?.[1] as RequestInit)?.method).toBe('POST');
  });

  it('offers no Desactivar on an already inactive type', async () => {
    renderCatalogo();

    await screen.findByText('Directo micológico');

    expect(
      screen.queryByRole('button', { name: 'Desactivar Directo micológico' }),
    ).not.toBeInTheDocument();
  });

  it('says both catalogs are empty instead of showing an empty table', async () => {
    renderCatalogo({
      [ANALISIS_URL]: jsonRoute({ items: [], total: 0, limit: 100, offset: 0 }),
      [MUESTRA_URL]: jsonRoute({ items: [], total: 0, limit: 100, offset: 0 }),
    });

    expect(await screen.findByText('No hay tipos de análisis cargados')).toBeInTheDocument();
    expect(screen.getByText('No hay tipos de muestra cargados')).toBeInTheDocument();
  });
});
