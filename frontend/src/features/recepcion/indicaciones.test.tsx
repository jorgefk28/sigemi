import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../App';
import { jsonResponse, jsonRoute, stubFetchRouter, userFixture, type RouteHandler } from '../../test/fixtures';
import type { IndicacionMedica } from '../../api/indicaciones';

/**
 * REC-U09 · Listado de indicaciones médicas (P1) and REC-U08 · formulario (P3).
 *
 * Backing requirement: UCE-REC-10 a REC-13. The listing shows the four columns of
 * REC-13 paso 3, filters by state and analysis type, and deletes logically with
 * confirmation; the form asks for the three mandatory fields and takes the
 * analysis type from the catalog, never from a hardcoded list.
 */

const TOKEN_KEY = 'sigemi.access_token';
const ME_URL = '/api/v1/auth/me';
const LIST_URL = '/api/v1/indicaciones-medicas?limit=20&offset=0';
const TIPOS_URL = '/api/v1/tipos-analisis?limit=100&offset=0';

const tipoCultivo = {
  id: 't-cultivo',
  nombre: 'Cultivo de uñas',
  descripcion: null,
  estado: 'activo',
};

const indicacionActiva: IndicacionMedica = {
  id: 'i-1',
  titulo: 'Retirar esmalte',
  contenido: 'Retirar el esmalte de la uña afectada 48 horas antes.',
  tipo_analisis_id: 't-cultivo',
  tipo_analisis_nombre: 'Cultivo de uñas',
  estado: 'activa',
  fecha_creacion: '2026-11-01T10:00:00Z',
  fecha_modificacion: '2026-11-01T10:00:00Z',
};

const indicacionInactiva: IndicacionMedica = {
  ...indicacionActiva,
  id: 'i-2',
  titulo: 'Ropa suelta',
  contenido: 'Ventar la zona.',
  estado: 'inactiva',
};

function page(items: IndicacionMedica[], envelope: Record<string, number> = {}) {
  return { items, total: items.length, limit: 20, offset: 0, ...envelope };
}

function renderListado(extraRoutes: Record<string, Response | RouteHandler> = {}) {
  sessionStorage.setItem(TOKEN_KEY, 'token-ind');
  window.history.replaceState({}, '', '/indicaciones');
  const fetchMock = stubFetchRouter({
    [ME_URL]: jsonRoute({ ...userFixture, roles: ['bioquimico'] }),
    [LIST_URL]: jsonRoute(page([indicacionActiva, indicacionInactiva])),
    [TIPOS_URL]: jsonRoute({
      items: [tipoCultivo],
      total: 1,
      limit: 100,
      offset: 0,
    }),
    ...extraRoutes,
  });
  render(<App />);
  return fetchMock;
}

function renderFormulario(path: string, extraRoutes: Record<string, Response | RouteHandler> = {}) {
  sessionStorage.setItem(TOKEN_KEY, 'token-ind');
  window.history.replaceState({}, '', path);
  const fetchMock = stubFetchRouter({
    [ME_URL]: jsonRoute({ ...userFixture, roles: ['bioquimico'] }),
    [TIPOS_URL]: jsonRoute({ items: [tipoCultivo], total: 1, limit: 100, offset: 0 }),
    [LIST_URL]: jsonRoute(page([indicacionActiva])),
    ...extraRoutes,
  });
  render(<App />);
  return fetchMock;
}

describe('REC-U09 listado de indicaciones', () => {
  it('shows the four columns of REC-13 paso 3', async () => {
    renderListado();

    expect(await screen.findByText('Retirar esmalte')).toBeInTheDocument();
    const table = screen.getByRole('table', { name: 'Indicaciones médicas registradas' });

    expect(
      within(table).getByText('Retirar el esmalte de la uña afectada 48 horas antes.'),
    ).toBeInTheDocument();
    expect(within(table).getAllByText('Cultivo de uñas').length).toBeGreaterThan(0);
    expect(within(table).getByText('Activa')).toBeInTheDocument();
    expect(within(table).getByText('Inactiva')).toBeInTheDocument();
  });

  it('offers Eliminar only on an active instruction', async () => {
    renderListado();

    await screen.findByText('Retirar esmalte');

    expect(screen.getByRole('button', { name: 'Eliminar Retirar esmalte' })).toBeInTheDocument();
    // REC-12 paso 5 leaves it inactive; there is nothing left to delete.
    expect(screen.queryByRole('button', { name: 'Eliminar Ropa suelta' })).not.toBeInTheDocument();
  });

  it('asks for confirmation and deactivates on confirm', async () => {
    const fetchMock = renderListado({
      '/api/v1/indicaciones-medicas/i-1/baja': () =>
        Promise.resolve(jsonResponse({ ...indicacionActiva, estado: 'inactiva' })),
    });
    const user = userEvent.setup();

    await screen.findByText('Retirar esmalte');
    await user.click(screen.getByRole('button', { name: 'Eliminar Retirar esmalte' }));

    const dialog = await screen.findByRole('dialog', { name: 'Eliminar indicación médica' });
    // REC-12 exc. del paso 4: cancelling changes nothing.
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(
      fetchMock.mock.calls.some(([url]) => url === '/api/v1/indicaciones-medicas/i-1/baja'),
    ).toBe(false);

    await user.click(screen.getByRole('button', { name: 'Eliminar Retirar esmalte' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));

    const call = fetchMock.mock.calls.find(
      ([url]) => url === '/api/v1/indicaciones-medicas/i-1/baja',
    );
    expect(call).toBeDefined();
    expect((call?.[1] as RequestInit)?.method).toBe('POST');
  });

  it('filters by state and by analysis type on change, not by the unsent text', async () => {
    const fetchMock = renderListado({
      '/api/v1/indicaciones-medicas?estado=inactiva&limit=20&offset=0': jsonRoute(
        page([indicacionInactiva]),
      ),
      '/api/v1/indicaciones-medicas?tipo_analisis_id=t-cultivo&limit=20&offset=0': jsonRoute(
        page([indicacionActiva]),
      ),
    });
    const user = userEvent.setup();

    await screen.findByText('Retirar esmalte');
    await user.type(screen.getByLabelText('Buscar'), 'sin enviar');
    await user.selectOptions(screen.getByLabelText('Estado'), 'inactiva');

    expect(
      fetchMock.mock.calls.some(
        ([url]) => url === '/api/v1/indicaciones-medicas?estado=inactiva&limit=20&offset=0',
      ),
    ).toBe(true);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('q='))).toBe(false);

    await user.selectOptions(screen.getByLabelText('Tipo de análisis'), 't-cultivo');
    // The type is added on top of the applied state, and the unsent text still
    // does not travel.
    const conTipo = fetchMock.mock.calls
      .map(([url]) => String(url))
      .filter((url) => url.includes('tipo_analisis_id=t-cultivo'));
    expect(conTipo.length).toBeGreaterThan(0);
    expect(conTipo.every((url) => !url.includes('q='))).toBe(true);
    expect(conTipo.some((url) => url.includes('estado=inactiva'))).toBe(true);
  });

  it('shows the textual empty state of REC-13 with the create action', async () => {
    renderListado({ [LIST_URL]: jsonRoute(page([])) });

    expect(
      await screen.findByText('No hay indicaciones médicas registradas'),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('button', { name: 'Nueva Indicación' }).length,
    ).toBeGreaterThan(0);
  });

  it('shows the load error with Reintentar', async () => {
    renderListado({ [LIST_URL]: () => Promise.reject(new Error('offline')) });

    expect(
      await screen.findByText('No se pudieron cargar las indicaciones'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });
});

describe('REC-U08 formulario de indicación', () => {
  it('creates the instruction with the three fields and returns to the listing', async () => {
    const fetchMock = renderFormulario('/indicaciones/nueva', {
      '/api/v1/indicaciones-medicas': () =>
        Promise.resolve(jsonResponse(indicacionActiva, 201)),
    });
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText('Título'), '  Retirar esmalte  ');
    await user.type(screen.getByLabelText('Contenido'), 'Retirar el esmalte.');
    await user.selectOptions(screen.getByLabelText('Tipo de análisis asociado'), 't-cultivo');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Indicaciones Médicas' }),
    ).toBeInTheDocument();

    const call = fetchMock.mock.calls.find(([url]) => url === '/api/v1/indicaciones-medicas');
    expect(JSON.parse(String((call?.[1] as RequestInit).body))).toEqual({
      titulo: 'Retirar esmalte',
      contenido: 'Retirar el esmalte.',
      tipo_analisis_id: 't-cultivo',
    });
  });

  it('blocks the submit when a mandatory field is missing (REC-10 paso 4)', async () => {
    const fetchMock = renderFormulario('/indicaciones/nueva');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('El título no puede estar vacío')).toBeInTheDocument();
    expect(screen.getByText('Seleccioná un tipo de análisis')).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(
        ([url, init]) =>
          url === '/api/v1/indicaciones-medicas' &&
          (init as RequestInit | undefined)?.method === 'POST',
      ),
    ).toBe(false);
  });

  it('places a 400 with campo on the offending field', async () => {
    renderFormulario('/indicaciones/nueva', {
      '/api/v1/indicaciones-medicas': () =>
        Promise.resolve(
          jsonResponse(
            { detail: 'El tipo de análisis seleccionado no existe', campo: 'tipo_analisis_id' },
            400,
          ),
        ),
    });
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText('Título'), 'Ayuno');
    await user.type(screen.getByLabelText('Contenido'), 'Sin cremas.');
    await user.selectOptions(screen.getByLabelText('Tipo de análisis asociado'), 't-cultivo');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(
      await screen.findByText('El tipo de análisis seleccionado no existe'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Tipo de análisis asociado')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  it('loads the record and patches only the field that changed', async () => {
    const fetchMock = renderFormulario('/indicaciones/i-1/editar', {
      '/api/v1/indicaciones-medicas/i-1': (_url, init) =>
        Promise.resolve(
          init?.method === 'PATCH'
            ? jsonResponse({ ...indicacionActiva, contenido: 'Nuevo contenido.' })
            : jsonResponse(indicacionActiva),
        ),
    });
    const user = userEvent.setup();

    expect(await screen.findByDisplayValue('Retirar esmalte')).toBeInTheDocument();

    const contenido = screen.getByLabelText('Contenido');
    await user.clear(contenido);
    await user.type(contenido, 'Nuevo contenido.');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    await screen.findByRole('heading', { level: 1, name: 'Indicaciones Médicas' });

    const calls = fetchMock.mock.calls.filter(
      ([, init]) => (init as RequestInit | undefined)?.method === 'PATCH',
    );
    expect(calls).toHaveLength(1);
    expect(JSON.parse(String((calls[0][1] as RequestInit).body))).toEqual({
      contenido: 'Nuevo contenido.',
    });
  });

  it('says the catalog is empty instead of offering an unusable select', async () => {
    renderFormulario('/indicaciones/nueva', {
      [TIPOS_URL]: jsonRoute({ items: [], total: 0, limit: 100, offset: 0 }),
    });

    expect(await screen.findByText('No hay tipos de análisis cargados.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Tipo de análisis asociado')).not.toBeInTheDocument();
    // The form cannot be submitted: there is no type to associate.
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
  });
});
