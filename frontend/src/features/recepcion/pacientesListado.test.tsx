import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../App';
import { jsonResponse, jsonRoute, stubFetchRouter, userFixture } from '../../test/fixtures';
import {
  pacienteActivo,
  pacienteInactivo,
  pacientesPage,
} from '../../test/recepcionFixtures';

/**
 * REC-U06 · Listado de pacientes (P1).
 *
 * Backing requirement: UCE-REC-18 pasos 1-5, UCE-REC-17 pasos 1-5,
 * UCE-REC-19 pasos 1-4, UCE-REC-S-01 paso 4b; RF-05.
 */

const TOKEN_KEY = 'sigemi.access_token';
const ME_URL = '/api/v1/auth/me';
const LIST_URL = '/api/v1/pacientes?limit=20&offset=0';

function renderList(extraRoutes: Record<string, Response | (() => Promise<Response>)> = {}) {
  sessionStorage.setItem(TOKEN_KEY, 'token-rec');
  window.history.replaceState({}, '', '/pacientes');
  const fetchMock = stubFetchRouter({
    [ME_URL]: jsonRoute({ ...userFixture, roles: ['bioquimico'] }),
    [LIST_URL]: jsonRoute(pacientesPage([pacienteActivo, pacienteInactivo])),
    ...extraRoutes,
  });
  render(<App />);
  return fetchMock;
}

describe('REC-U06 listado de pacientes', () => {
  it('lists each patient with the declared columns and no age column', async () => {
    renderList();

    // Wait for the first rendered row: while loading the table is a skeleton.
    expect(await screen.findByText('30123456')).toBeInTheDocument();
    const table = screen.getByRole('table', { name: 'Pacientes registrados' });

    // DNI, apellido y nombre, fecha de nacimiento (dd/MM/yyyy), teléfono, estado.
    expect(within(table).getByText('30123456')).toBeInTheDocument();
    expect(within(table).getByText('García, Ana')).toBeInTheDocument();
    expect(within(table).getByText('12/05/1980')).toBeInTheDocument();
    expect(within(table).getByText('3764123456')).toBeInTheDocument();
    expect(within(table).getByText('Activo')).toBeInTheDocument();
    expect(within(table).getByText('Inactivo')).toBeInTheDocument();

    // R4: age is derived, never a column.
    expect(within(table).queryByText('Edad')).not.toBeInTheDocument();
    expect(
      within(table).queryByRole('columnheader', { name: 'Edad' }),
    ).not.toBeInTheDocument();
  });

  it('requests the pinned envelope with the bearer token', async () => {
    const fetchMock = renderList();

    await screen.findByRole('table', { name: 'Pacientes registrados' });

    const call = fetchMock.mock.calls.find(([url]) => url === LIST_URL);
    expect(call).toBeDefined();
    const init = call?.[1] as RequestInit | undefined;
    expect(init?.headers).toEqual({ Authorization: 'Bearer token-rec' });
  });

  it('searches by free text on submit and keeps the page offset at zero', async () => {
    const fetchMock = renderList({
      '/api/v1/pacientes?q=garcia&limit=20&offset=0': jsonRoute(
        pacientesPage([pacienteActivo]),
      ),
    });
    const user = userEvent.setup();

    await screen.findByRole('table', { name: 'Pacientes registrados' });
    await user.type(screen.getByLabelText('Buscar'), 'garcia');
    await user.click(screen.getByRole('button', { name: 'Buscar' }));

    expect(
      fetchMock.mock.calls.some(([url]) => url === '/api/v1/pacientes?q=garcia&limit=20&offset=0'),
    ).toBe(true);
  });

  it('applies the estado filter on change', async () => {
    const fetchMock = renderList({
      '/api/v1/pacientes?estado=inactivo&limit=20&offset=0': jsonRoute(
        pacientesPage([pacienteInactivo]),
      ),
    });
    const user = userEvent.setup();

    await screen.findByRole('table', { name: 'Pacientes registrados' });
    await user.selectOptions(screen.getByLabelText('Estado'), 'inactivo');

    expect(
      fetchMock.mock.calls.some(
        ([url]) => url === '/api/v1/pacientes?estado=inactivo&limit=20&offset=0',
      ),
    ).toBe(true);
    expect(screen.queryByText('García, Ana')).not.toBeInTheDocument();
  });

  it('shows the empty state with the Nuevo Paciente action when nobody is registered', async () => {
    renderList({ [LIST_URL]: jsonRoute(pacientesPage([])) });

    expect(await screen.findByText('No hay pacientes registrados')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Nuevo Paciente' }).length).toBeGreaterThan(0);
  });

  it('offers Limpiar filtros when the criteria match nothing', async () => {
    renderList({
      '/api/v1/pacientes?q=zzz&limit=20&offset=0': jsonRoute(pacientesPage([])),
    });
    const user = userEvent.setup();

    await screen.findByRole('table', { name: 'Pacientes registrados' });
    await user.type(screen.getByLabelText('Buscar'), 'zzz');
    await user.click(screen.getByRole('button', { name: 'Buscar' }));

    expect(
      await screen.findByText('No se encontraron pacientes con los criterios ingresados'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Limpiar filtros' })).toBeInTheDocument();
  });

  it('highlights a single match and offers the way into the record without navigating', async () => {
    renderList({ [LIST_URL]: jsonRoute(pacientesPage([pacienteActivo])) });

    expect(await screen.findByText('30123456')).toBeInTheDocument();

    // S-01 paso 4a: a single match is returned to the invoking use case, so the
    // screen must not navigate on its own.
    expect(
      screen.getByText('Una sola coincidencia: usá «Ver» para abrir la ficha.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Pacientes registrados' })).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'García, Ana' }),
    ).not.toBeInTheDocument();
  });

  it('shows the load error with Reintentar', async () => {
    renderList({ [LIST_URL]: () => Promise.reject(new Error('offline')) });

    expect(await screen.findByText('No se pudieron cargar los pacientes')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });

  it('redirects to the landing page on 403 instead of showing a raw error', async () => {
    renderList({
      [LIST_URL]: () => Promise.resolve(jsonResponse({ detail: 'Sin permiso' }, 403)),
    });

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Estado operativo del laboratorio',
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Sin permiso')).not.toBeInTheDocument();
  });
});
