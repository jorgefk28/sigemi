import { describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../App';
import { jsonResponse, jsonRoute, stubFetchRouter } from '../../test/fixtures';
import {
  adminSession,
  anaActiva,
  betoActivo,
  betoInactivo,
  rolesPage,
  usuariosPage,
} from '../../test/accessFixtures';
import type { User } from '../../api/auth';

const TOKEN = 'token-admin';
const ME_URL = '/api/v1/auth/me';
const ROLES_URL = '/api/v1/roles?limit=100';
const LISTA_URL = '/api/v1/usuarios?limit=20&offset=0';
const TABLA = 'Usuarios registrados';

type Route = Response | (() => Promise<Response>);

/** Stub the network for a signed-in administrator and return the fetch mock. */
function arrancar(routes: Record<string, Route>) {
  sessionStorage.setItem('sigemi.access_token', TOKEN);
  return stubFetchRouter({
    [ME_URL]: jsonRoute(adminSession),
    [ROLES_URL]: jsonRoute(rolesPage()),
    ...routes,
  });
}

/** Render the app, open Seguridad → Usuarios y Roles, and hand back the user. */
async function abrirUsuarios() {
  const user = userEvent.setup();
  await screen.findByRole('button', { name: 'Panel de Control' });
  await user.click(screen.getByRole('button', { name: 'Usuarios y Roles' }));
  return user;
}

function fila(nombre: string) {
  return screen.getByRole('row', { name: new RegExp(nombre) });
}

describe('SEG-U02 listado de usuarios', () => {
  it('lists every user with all of their roles and the Spanish state', async () => {
    arrancar({ [LISTA_URL]: jsonRoute(usuariosPage([anaActiva, betoInactivo])) });
    render(<App />);
    await abrirUsuarios();

    expect(
      await screen.findByRole('columnheader', { name: 'Nombre y apellido' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Correo' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Roles' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Estado' })).toBeInTheDocument();

    const ana = fila('Ana García');
    expect(within(ana).getByText('ana@unam.edu.ar')).toBeInTheDocument();
    // R4: every role is shown, not just the first one.
    expect(within(ana).getByText('Bioquímico, Profesor')).toBeInTheDocument();
    expect(within(ana).getByText('Activo')).toBeInTheDocument();

    expect(within(fila('Beto López')).getByText('Inactivo')).toBeInTheDocument();
  });

  it('requests the pinned envelope with the bearer token and reports the range', async () => {
    const mock = arrancar({
      [LISTA_URL]: jsonRoute(usuariosPage([anaActiva], { total: 2 })),
    });
    render(<App />);
    await abrirUsuarios();

    expect(await screen.findByText('Mostrando 1–1 de 2')).toBeInTheDocument();
    expect(mock).toHaveBeenCalledWith(
      LISTA_URL,
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
      }),
    );
  });

  it('filters by role from the closed catalog', async () => {
    const mock = arrancar({
      [LISTA_URL]: jsonRoute(usuariosPage([anaActiva, betoActivo])),
      '/api/v1/usuarios?rol=profesor&limit=20&offset=0': jsonRoute(
        usuariosPage([betoActivo], { total: 1 }),
      ),
    });
    render(<App />);
    const user = await abrirUsuarios();

    await screen.findByText('Ana García');
    await user.selectOptions(screen.getByLabelText('Rol'), 'profesor');

    await waitFor(() => expect(screen.queryByText('Ana García')).not.toBeInTheDocument());
    expect(mock).toHaveBeenCalledWith(
      '/api/v1/usuarios?rol=profesor&limit=20&offset=0',
      expect.anything(),
    );
  });

  it('searches by q on submit and offers Limpiar filtros when nothing matches', async () => {
    arrancar({
      [LISTA_URL]: jsonRoute(usuariosPage([anaActiva])),
      '/api/v1/usuarios?q=zzz&limit=20&offset=0': jsonRoute(usuariosPage([])),
    });
    render(<App />);
    const user = await abrirUsuarios();

    await screen.findByText('Ana García');
    await user.type(screen.getByLabelText('Buscar'), 'zzz');
    await user.click(screen.getByRole('button', { name: 'Buscar' }));

    expect(
      await screen.findByText('No se encontraron usuarios con esos filtros'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    expect(await screen.findByText('Ana García')).toBeInTheDocument();
  });

  it('shows the empty state with the Nuevo usuario action when nobody is registered', async () => {
    arrancar({ [LISTA_URL]: jsonRoute(usuariosPage([])) });
    render(<App />);
    await abrirUsuarios();

    expect(await screen.findByText('Sin usuarios registrados')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nuevo usuario' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).not.toBeInTheDocument();
  });

  it('deactivates a user with a PATCH and refreshes the list', async () => {
    let llamadas = 0;
    const mock = arrancar({
      [LISTA_URL]: () => {
        llamadas += 1;
        return Promise.resolve(
          jsonResponse(
            usuariosPage(llamadas === 1 ? [anaActiva, betoActivo] : [anaActiva, betoInactivo]),
          ),
        );
      },
      '/api/v1/usuarios/u-beto': jsonRoute(betoInactivo),
    });
    render(<App />);
    const user = await abrirUsuarios();

    await screen.findByText('Beto López');
    await user.click(screen.getByRole('button', { name: 'Desactivar Beto López' }));

    await waitFor(() =>
      expect(within(fila('Beto López')).getByText('Inactivo')).toBeInTheDocument(),
    );
    expect(mock).toHaveBeenCalledWith(
      '/api/v1/usuarios/u-beto',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ estado: 'inactivo' }),
      }),
    );
  });

  it('hides Desactivar on the administrator own row and on inactive users', async () => {
    arrancar({
      [LISTA_URL]: jsonRoute(usuariosPage([adminSession, anaActiva, betoInactivo])),
    });
    render(<App />);
    await abrirUsuarios();

    await screen.findByRole('row', { name: /Ada Administradora/ });
    expect(
      screen.queryByRole('button', { name: 'Desactivar Ada Administradora' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Desactivar Beto López' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Desactivar Ana García' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar Ada Administradora' })).toBeInTheDocument();
  });

  it('shows the load error and recovers with Reintentar', async () => {
    let llamadas = 0;
    arrancar({
      [LISTA_URL]: () => {
        llamadas += 1;
        return llamadas === 1
          ? Promise.reject(new Error('offline'))
          : Promise.resolve(jsonResponse(usuariosPage([anaActiva])));
      },
    });
    render(<App />);
    const user = await abrirUsuarios();

    expect(await screen.findByText('No se pudieron cargar los usuarios')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByText('Ana García')).toBeInTheDocument();
  });

  it('redirects to the start page on 403 instead of showing a raw error', async () => {
    arrancar({ [LISTA_URL]: jsonResponse({ detail: 'No autorizado' }, 403) });
    render(<App />);
    await abrirUsuarios();

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Estado operativo del laboratorio' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('No se pudieron cargar los usuarios')).not.toBeInTheDocument();
  });

  it('shows a table skeleton while loading and never an invented row', async () => {
    let resolver: (response: Response) => void = () => {};
    const pendiente = new Promise<Response>((resolve) => {
      resolver = resolve;
    });
    arrancar({ [LISTA_URL]: () => pendiente });
    render(<App />);
    await abrirUsuarios();

    const tabla = await screen.findByRole('table', { name: TABLA });
    expect(tabla).toHaveAttribute('aria-busy', 'true');
    // Only the header row is exposed: the skeleton cells are hidden from the tree.
    expect(within(tabla).getAllByRole('row')).toHaveLength(1);

    resolver(jsonResponse(usuariosPage([anaActiva])));

    expect(await screen.findByText('Ana García')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: TABLA })).toHaveAttribute('aria-busy', 'false');
  });

  it('advances with Siguiente and comes back with Anterior', async () => {
    const veinte: User[] = Array.from({ length: 20 }, (_, indice) => ({
      ...anaActiva,
      id: `u-${indice}`,
      nombre: `Usuario${indice}`,
    }));
    const diez: User[] = Array.from({ length: 10 }, (_, indice) => ({
      ...anaActiva,
      id: `u-resto-${indice}`,
      nombre: `Resto${indice}`,
    }));
    arrancar({
      [LISTA_URL]: jsonRoute(usuariosPage(veinte, { total: 30 })),
      '/api/v1/usuarios?limit=20&offset=20': jsonRoute(
        usuariosPage(diez, { total: 30, offset: 20 }),
      ),
    });
    render(<App />);
    const user = await abrirUsuarios();

    expect(await screen.findByText('Mostrando 1–20 de 30')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Siguiente' }));

    expect(await screen.findByText('Mostrando 21–30 de 30')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Anterior' }));
    expect(await screen.findByText('Mostrando 1–20 de 30')).toBeInTheDocument();
  });
});
