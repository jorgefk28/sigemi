import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../App';
import { jsonResponse, jsonRoute, stubFetchRouter, type RouteHandler } from '../../test/fixtures';
import { adminSession } from '../../test/accessFixtures';
import type { EntradaListaEspera } from '../../api/listaEspera';

/**
 * REC-U11 · Lista de espera (P1).
 *
 * Backing requirement: UCE-REC-29 pasos 1-4 (consultar, ordenar por prioridad,
 * filtrar) and UCE-REC-28 pasos 1-7 (quitar con confirmación, auditado).
 */

const TOKEN_KEY = 'sigemi.access_token';
const ME_URL = '/api/v1/auth/me';
const LIST_URL = '/api/v1/lista-espera?estado=pendiente&limit=20&offset=0';

const entradaPendiente: EntradaListaEspera = {
  id: 'e-1',
  paciente_id: 'p-ana',
  paciente_nombre: 'Ana',
  paciente_apellido: 'García',
  paciente_dni: '30123456',
  tipo_analisis_id: null,
  fecha_solicitud: '2026-11-14T09:30:00Z',
  estado: 'pendiente',
  observaciones: null,
};

const entradaRetirada: EntradaListaEspera = {
  ...entradaPendiente,
  id: 'e-2',
  paciente_nombre: 'Beto',
  paciente_apellido: 'López',
  paciente_dni: '28987654',
  estado: 'retirado',
};

function page(items: EntradaListaEspera[], envelope: Record<string, number> = {}) {
  return { items, total: items.length, limit: 20, offset: 0, ...envelope };
}

function renderLista(extraRoutes: Record<string, Response | RouteHandler> = {}) {
  sessionStorage.setItem(TOKEN_KEY, 'token-rec');
  window.history.replaceState({}, '', '/lista-espera');
  const fetchMock = stubFetchRouter({
    [ME_URL]: jsonRoute(adminSession),
    [LIST_URL]: jsonRoute(page([entradaPendiente])),
    ...extraRoutes,
  });
  render(<App />);
  return fetchMock;
}

describe('REC-U11 lista de espera', () => {
  it('lists the waiting patients with their resolved data and no raw UUID', async () => {
    renderLista();

    expect(await screen.findByText('García, Ana')).toBeInTheDocument();
    const table = screen.getByRole('table', { name: 'Entradas de la lista de espera' });

    expect(within(table).getByText('30123456')).toBeInTheDocument();
    expect(within(table).getByText('Pendiente')).toBeInTheDocument();
    // Nullable column: an em dash, never an empty cell (R4).
    expect(within(table).getByText('—')).toBeInTheDocument();
    // The entry only carries `tipo_analisis_id`, and there is no catalog: the
    // screen must not print a UUID as if it were a name.
    expect(within(table).queryByText(/[0-9a-f]{8}-[0-9a-f]{4}/)).not.toBeInTheDocument();
  });

  it('defaults to the entries that are still waiting (REC-28 postcondition)', async () => {
    const fetchMock = renderLista();

    await screen.findByText('García, Ana');

    // A removed patient is out of the list, so "pendiente" is the default view.
    expect(fetchMock.mock.calls.some(([url]) => url === LIST_URL)).toBe(true);
    expect(screen.getByLabelText('Estado')).toHaveValue('pendiente');
  });

  it('filters by state on change', async () => {
    const fetchMock = renderLista({
      '/api/v1/lista-espera?estado=retirado&limit=20&offset=0': jsonRoute(
        page([entradaRetirada]),
      ),
    });
    const user = userEvent.setup();

    await screen.findByText('García, Ana');
    await user.selectOptions(screen.getByLabelText('Estado'), 'retirado');

    expect(await screen.findByText('López, Beto')).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(
        ([url]) => url === '/api/v1/lista-espera?estado=retirado&limit=20&offset=0',
      ),
    ).toBe(true);
  });

  it('filters by request date range on submit', async () => {
    const fetchMock = renderLista({
      '/api/v1/lista-espera?estado=pendiente&fecha_desde=2026-11-01&fecha_hasta=2026-11-30&limit=20&offset=0':
        jsonRoute(page([])),
    });
    const user = userEvent.setup();

    await screen.findByText('García, Ana');
    await user.type(screen.getByLabelText('Solicitud desde'), '2026-11-01');
    await user.type(screen.getByLabelText('Solicitud hasta'), '2026-11-30');
    await user.click(screen.getByRole('button', { name: 'Buscar' }));

    expect(
      await screen.findByText('No se encontraron entradas con esos filtros'),
    ).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(
        ([url]) =>
          url ===
          '/api/v1/lista-espera?estado=pendiente&fecha_desde=2026-11-01&fecha_hasta=2026-11-30&limit=20&offset=0',
      ),
    ).toBe(true);
  });

  it('applies only its own value when the state changes, not the unsubmitted dates', async () => {
    const fetchMock = renderLista({
      '/api/v1/lista-espera?estado=asignado&limit=20&offset=0': jsonRoute(page([])),
    });
    const user = userEvent.setup();

    await screen.findByText('García, Ana');
    await user.type(screen.getByLabelText('Solicitud desde'), '2026-11-01');
    await user.selectOptions(screen.getByLabelText('Estado'), 'asignado');

    // A select applies on change, but a half-typed date stays in the draft.
    expect(
      fetchMock.mock.calls.some(
        ([url]) => url === '/api/v1/lista-espera?estado=asignado&limit=20&offset=0',
      ),
    ).toBe(true);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('fecha_desde'))).toBe(false);
  });

  it('steps back a page when the last entry of a page is removed', async () => {
    const primeraPagina = Array.from({ length: 20 }, (_, index) => ({
      ...entradaPendiente,
      id: `e-${index}`,
      paciente_apellido: `Paciente ${index}`,
      paciente_dni: String(30000000 + index),
    }));
    const ultimaEntrada: EntradaListaEspera = {
      ...entradaPendiente,
      id: 'e-last',
      paciente_apellido: 'Zárate',
      paciente_nombre: 'Última',
      paciente_dni: '39999999',
    };

    let segundaPaginaLlamadas = 0;
    const fetchMock = renderLista({
      [LIST_URL]: jsonRoute(page(primeraPagina, { total: 21 })),
      '/api/v1/lista-espera?estado=pendiente&limit=20&offset=20': () => {
        segundaPaginaLlamadas += 1;
        // After the removal the page is out of range and answers empty; the
        // screen must walk back instead of claiming the list is empty.
        return Promise.resolve(
          segundaPaginaLlamadas === 1
            ? jsonResponse(page([ultimaEntrada], { total: 21, offset: 20 }))
            : jsonResponse(page([], { total: 20, offset: 20 })),
        );
      },
      '/api/v1/lista-espera/e-last/quitar': () =>
        Promise.resolve(jsonResponse({ ...ultimaEntrada, estado: 'retirado' })),
    });
    const user = userEvent.setup();

    await screen.findByText('Paciente 0, Ana');
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    await screen.findByText('Zárate, Última');

    await user.click(screen.getByRole('button', { name: 'Quitar a Zárate, Última' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));

    // Back on page 1, with rows, and never the false "no hay pacientes".
    expect(await screen.findByText('Paciente 0, Ana')).toBeInTheDocument();
    expect(
      screen.queryByText('No hay pacientes en lista de espera'),
    ).not.toBeInTheDocument();
    expect(
      fetchMock.mock.calls.filter(
        ([url]) => url === '/api/v1/lista-espera?estado=pendiente&limit=20&offset=0',
      ).length,
    ).toBeGreaterThan(1);
  });

  it('shows the empty state with the textual message of REC-29', async () => {
    renderLista({ [LIST_URL]: jsonRoute(page([])) });

    expect(
      await screen.findByText('No hay pacientes en lista de espera'),
    ).toBeInTheDocument();
  });

  it('asks for confirmation before removing and audits through the endpoint', async () => {
    const fetchMock = renderLista({
      '/api/v1/lista-espera/e-1/quitar': () =>
        Promise.resolve(jsonResponse({ ...entradaPendiente, estado: 'retirado' })),
      '/api/v1/lista-espera?estado=pendiente&limit=20&offset=0': jsonRoute(
        page([entradaPendiente]),
      ),
    });
    const user = userEvent.setup();

    await screen.findByText('García, Ana');
    await user.click(screen.getByRole('button', { name: 'Quitar a García, Ana' }));

    const dialog = await screen.findByRole('dialog', { name: 'Quitar de la lista de espera' });
    expect(
      within(dialog).getByText(/Se va a quitar a García, Ana de la lista de espera/),
    ).toBeInTheDocument();

    // REC-28 exc. paso 4: cancelling changes nothing.
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(([url]) => url === '/api/v1/lista-espera/e-1/quitar'),
    ).toBe(false);

    await user.click(screen.getByRole('button', { name: 'Quitar a García, Ana' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));

    const call = fetchMock.mock.calls.find(([url]) => url === '/api/v1/lista-espera/e-1/quitar');
    expect(call).toBeDefined();
    expect((call?.[1] as RequestInit)?.method).toBe('POST');
  });

  it('offers no action on an already removed entry', async () => {
    renderLista({
      '/api/v1/lista-espera?estado=retirado&limit=20&offset=0': jsonRoute(
        page([entradaRetirada]),
      ),
    });
    const user = userEvent.setup();

    await screen.findByText('García, Ana');
    await user.selectOptions(screen.getByLabelText('Estado'), 'retirado');

    await screen.findByText('López, Beto');
    expect(
      screen.queryByRole('button', { name: 'Quitar a López, Beto' }),
    ).not.toBeInTheDocument();
  });

  it('shows the load error with Reintentar', async () => {
    renderLista({ [LIST_URL]: () => Promise.reject(new Error('offline')) });

    expect(await screen.findByText('No se pudo cargar la lista de espera')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });

  it('redirects a biochemist to the landing page (R2)', async () => {
    sessionStorage.setItem(TOKEN_KEY, 'token-rec');
    window.history.replaceState({}, '', '/lista-espera');
    stubFetchRouter({
      [ME_URL]: jsonRoute({ ...adminSession, roles: ['bioquimico'] }),
    });

    render(<App />);

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Estado operativo del laboratorio',
      }),
    ).toBeInTheDocument();
  });
});
