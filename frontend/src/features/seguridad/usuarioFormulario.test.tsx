import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UserEvent } from '@testing-library/user-event';
import { App } from '../../App';
import { jsonResponse, jsonRoute, stubFetchRouter } from '../../test/fixtures';
import { adminSession, anaActiva, rolesPage, usuariosPage } from '../../test/accessFixtures';

const TOKEN = 'token-admin';
const ME_URL = '/api/v1/auth/me';
const ROLES_URL = '/api/v1/roles?limit=100';
const LISTA_URL = '/api/v1/usuarios?limit=20&offset=0';
const ALTA_URL = '/api/v1/usuarios';

type Route = Response | (() => Promise<Response>);

function arrancar(routes: Record<string, Route>) {
  sessionStorage.setItem('sigemi.access_token', TOKEN);
  return stubFetchRouter({
    [ME_URL]: jsonRoute(adminSession),
    [ROLES_URL]: jsonRoute(rolesPage()),
    ...routes,
  });
}

/** Wait for the shell, open Seguridad → Usuarios y Roles. */
async function abrirListado(user: UserEvent) {
  await screen.findByRole('button', { name: 'Panel de Control' });
  await user.click(screen.getByRole('button', { name: 'Usuarios y Roles' }));
}

/** Open the list and then the create form. */
async function abrirAlta(routes: Record<string, Route> = {}) {
  const mock = arrancar({ [LISTA_URL]: jsonRoute(usuariosPage([])), ...routes });
  render(<App />);
  const user = userEvent.setup();
  await abrirListado(user);
  await screen.findByText('Sin usuarios registrados');
  await user.click(screen.getByRole('button', { name: 'Nuevo usuario' }));
  await screen.findByRole('heading', { level: 1, name: 'Nuevo usuario' });
  return { user, mock };
}

/** Open the list and then the edit form for the given row. */
async function abrirEdicion(routes: Record<string, Route> = {}) {
  const mock = arrancar({ [LISTA_URL]: jsonRoute(usuariosPage([anaActiva])), ...routes });
  render(<App />);
  const user = userEvent.setup();
  await abrirListado(user);
  await screen.findByText('Ana García');
  await user.click(screen.getByRole('button', { name: 'Editar Ana García' }));
  await screen.findByRole('heading', { level: 1, name: 'Editar usuario' });
  return { user, mock };
}

async function completarAlta(user: UserEvent, valores: Record<string, string> = {}) {
  const datos = {
    Nombre: 'Carla',
    Apellido: 'Pérez',
    'Correo electrónico': 'carla@unam.edu.ar',
    Contraseña: 'secreta123',
    ...valores,
  };
  for (const [etiqueta, valor] of Object.entries(datos)) {
    if (valor) {
      await user.type(screen.getByLabelText(etiqueta), valor);
    }
  }
}

const creada = {
  id: 'u-carla',
  nombre: 'Carla',
  apellido: 'Pérez',
  correo_electronico: 'carla@unam.edu.ar',
  estado: 'activo',
  roles: ['bioquimico'],
};

// Typing every field through `userEvent` is realistic but slow on jsdom.
describe('SEG-U03 alta y edición de usuario', { timeout: 20000 }, () => {
  it('creates a user with the selected catalog roles and returns to the list', async () => {
    const { user, mock } = await abrirAlta({ [ALTA_URL]: jsonRoute(creada, 201) });

    // The selector reads the closed catalog: one checkbox per catalog row.
    expect(screen.getByLabelText('Bioquímico')).toBeInTheDocument();
    expect(screen.getByLabelText('Profesor')).toBeInTheDocument();
    expect(screen.getByLabelText('Administrador')).toBeInTheDocument();

    await completarAlta(user);
    await user.click(screen.getByLabelText('Bioquímico'));
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('Sin usuarios registrados')).toBeInTheDocument();
    expect(mock).toHaveBeenCalledWith(
      ALTA_URL,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: `Bearer ${TOKEN}`,
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          nombre: 'Carla',
          apellido: 'Pérez',
          correo_electronico: 'carla@unam.edu.ar',
          contrasena: 'secreta123',
          roles: ['bioquimico'],
        }),
      }),
    );
  });

  it('shows a field-scoped 400 on the password field and stays on the form', async () => {
    const { user } = await abrirAlta({
      [ALTA_URL]: jsonRoute(
        { detail: 'La contraseña debe incluir al menos un dígito', campo: 'contrasena' },
        400,
      ),
    });

    await completarAlta(user, { Contraseña: 'sinDigitos' });
    await user.click(screen.getByLabelText('Bioquímico'));
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() =>
      expect(screen.getByLabelText('Contraseña')).toHaveAccessibleDescription(
        'La contraseña debe incluir al menos un dígito',
      ),
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Nuevo usuario' })).toBeInTheDocument();
  });

  it('places the duplicate-email 400 on the email field', async () => {
    const { user } = await abrirAlta({
      [ALTA_URL]: jsonRoute(
        {
          detail: 'Ya existe un usuario con ese correo electrónico',
          campo: 'correo_electronico',
        },
        400,
      ),
    });

    await completarAlta(user);
    await user.click(screen.getByLabelText('Bioquímico'));
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() =>
      expect(screen.getByLabelText('Correo electrónico')).toHaveAccessibleDescription(
        'Ya existe un usuario con ese correo electrónico',
      ),
    );
  });

  it('requires at least one role and sends nothing when none is selected', async () => {
    const { user, mock } = await abrirAlta({ [ALTA_URL]: jsonRoute(creada, 201) });

    await completarAlta(user);
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() =>
      expect(screen.getByRole('group', { name: 'Roles' })).toHaveAccessibleDescription(
        'Debe asignar al menos un rol al usuario',
      ),
    );
    expect(mock).not.toHaveBeenCalledWith(ALTA_URL, expect.anything());
  });

  it('disables Guardar while saving so a double click cannot submit twice', async () => {
    let resolver: (response: Response) => void = () => {};
    const pendiente = new Promise<Response>((resolve) => {
      resolver = resolve;
    });
    const { user, mock } = await abrirAlta({ [ALTA_URL]: () => pendiente });

    await completarAlta(user);
    await user.click(screen.getByLabelText('Bioquímico'));
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    const guardando = screen.getByRole('button', { name: 'Guardando…' });
    expect(guardando).toBeDisabled();
    await user.click(guardando);

    resolver(jsonResponse(creada, 201));
    expect(await screen.findByText('Sin usuarios registrados')).toBeInTheDocument();

    const altas = mock.mock.calls.filter(([url]) => url === ALTA_URL);
    expect(altas).toHaveLength(1);
  });

  it('edits without a password field, patches only changed fields and replaces the whole role set', async () => {
    const { user, mock } = await abrirEdicion({
      '/api/v1/usuarios/u-ana': jsonRoute({
        ...anaActiva,
        apellido: 'García Ruiz',
        roles: ['administrador'],
      }),
      '/api/v1/usuarios/u-ana/roles': jsonRoute({ ...anaActiva, roles: ['administrador'] }),
    });

    // D1: the password is defined only on create; `estado` is not this form's business.
    expect(screen.queryByLabelText('Contraseña')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Estado')).not.toBeInTheDocument();

    const apellido = screen.getByLabelText('Apellido');
    await user.clear(apellido);
    await user.type(apellido, 'García Ruiz');
    await user.click(screen.getByLabelText('Bioquímico'));
    await user.click(screen.getByLabelText('Profesor'));
    await user.click(screen.getByLabelText('Administrador'));
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() =>
      expect(mock).toHaveBeenCalledWith(
        '/api/v1/usuarios/u-ana',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ apellido: 'García Ruiz' }),
        }),
      ),
    );
    expect(mock).toHaveBeenCalledWith(
      '/api/v1/usuarios/u-ana/roles',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ roles: ['administrador'] }),
      }),
    );
    expect(await screen.findByText('Ana García')).toBeInTheDocument();
  });

  it('sends no request and returns to the list when nothing changed', async () => {
    const { user, mock } = await abrirEdicion();

    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('Ana García')).toBeInTheDocument();
    expect(mock).not.toHaveBeenCalledWith('/api/v1/usuarios/u-ana', expect.anything());
    expect(mock).not.toHaveBeenCalledWith('/api/v1/usuarios/u-ana/roles', expect.anything());
  });

  it('cancels without writing anything', async () => {
    const { user, mock } = await abrirAlta({ [ALTA_URL]: jsonRoute(creada, 201) });

    await completarAlta(user, { Nombre: 'Descartada' });
    await user.click(screen.getAllByRole('button', { name: 'Cancelar' })[0]);

    expect(await screen.findByText('Sin usuarios registrados')).toBeInTheDocument();
    expect(mock).not.toHaveBeenCalledWith(ALTA_URL, expect.anything());
  });

  it('redirects to the start page on 403 instead of showing a raw error', async () => {
    const { user } = await abrirAlta({
      [ALTA_URL]: jsonRoute({ detail: 'No autorizado' }, 403),
    });

    await completarAlta(user);
    await user.click(screen.getByLabelText('Bioquímico'));
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Estado operativo del laboratorio' }),
    ).toBeInTheDocument();
  });

  it('caps nombre and apellido at the 120 characters the backend accepts', async () => {
    await abrirAlta();

    expect(screen.getByLabelText('Nombre')).toHaveAttribute('maxlength', '120');
    expect(screen.getByLabelText('Apellido')).toHaveAttribute('maxlength', '120');
  });
});
