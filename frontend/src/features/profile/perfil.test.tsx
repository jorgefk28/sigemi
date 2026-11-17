import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../App';
import { jsonResponse, jsonRoute, stubFetchRouter, userFixture } from '../../test/fixtures';
import { adminSession } from '../../test/accessFixtures';

/**
 * SEG-U08 · Mi perfil (P2) and SEG-U09 · Cambiar contraseña (P3).
 *
 * Backing requirements: UCE-SEG-08 pasos 1-8. The profile only reads the account
 * the token belongs to, and the password form hands every rule to the backend,
 * which answers `400` with `campo`.
 */

const TOKEN_KEY = 'sigemi.access_token';

function renderAt(path: string, user = userFixture) {
  sessionStorage.setItem(TOKEN_KEY, 'token-perfil');
  window.history.replaceState({}, '', path);
  const fetchMock = stubFetchRouter({
    '/api/v1/auth/me': jsonRoute(user),
    '/api/v1/auth/password': () => Promise.resolve(new Response(null, { status: 204 })),
  });
  render(<App />);
  return fetchMock;
}

async function fillChangePasswordForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText('Contraseña actual'), 'claveActual1');
  await user.type(screen.getByLabelText('Nueva contraseña'), 'claveNueva2');
  await user.type(screen.getByLabelText('Repetir nueva contraseña'), 'claveNueva2');
}

describe('SEG-U08 Mi perfil', () => {
  it('shows the account data and every role, not just the first one', async () => {
    renderAt('/perfil', { ...userFixture, roles: ['bioquimico', 'profesor'] });

    await screen.findByRole('heading', { level: 1, name: 'Mi perfil' });

    expect(await screen.findByText('ana.garcia@unam.edu.ar')).toBeInTheDocument();
    // R4: both role labels appear, joined.
    expect(screen.getByText('Bioquímico/Doctor, Profesor')).toBeInTheDocument();
    expect(screen.getByText('Activo')).toBeInTheDocument();
  });

  it('is reached from the header user menu (D3), not from the sidebar', async () => {
    renderAt('/panel-control');
    const user = userEvent.setup();

    await screen.findByRole('heading', { name: 'Estado operativo del laboratorio' });
    // The sidebar keeps being the map of business modules.
    expect(
      screen.queryByRole('button', { name: 'Mi perfil' }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Ana García/ }));
    await user.click(screen.getByRole('menuitem', { name: 'Mi perfil' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Mi perfil' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Mi cuenta')).toBeInTheDocument();
  });

  it('offers Reintentar when the account cannot be loaded', async () => {
    sessionStorage.setItem(TOKEN_KEY, 'token-perfil');
    window.history.replaceState({}, '', '/perfil');
    // The boot call restores the session; the screen's own call is the one that
    // fails, which is the case the user can retry.
    let calls = 0;
    stubFetchRouter({
      '/api/v1/auth/me': () => {
        calls += 1;
        return calls === 1
          ? Promise.resolve(jsonResponse(userFixture))
          : Promise.reject(new Error('offline'));
      },
    });

    render(<App />);

    expect(await screen.findByText('No se pudieron cargar tus datos')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });

  it('opens the password screen from Mi perfil', async () => {
    renderAt('/perfil');
    const user = userEvent.setup();

    await screen.findByRole('heading', { level: 1, name: 'Mi perfil' });
    await user.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Cambiar contraseña' }),
    ).toBeInTheDocument();
  });

  it('is reachable for an administrator too', async () => {
    renderAt('/perfil', adminSession);

    await screen.findByRole('heading', { level: 1, name: 'Mi perfil' });
    expect(await screen.findByText('Administrador')).toBeInTheDocument();
  });
});

describe('SEG-U09 Cambiar contraseña', () => {
  it('posts both passwords with the bearer token and confirms the change', async () => {
    const fetchMock = renderAt('/perfil/contrasena');
    const user = userEvent.setup();

    await fillChangePasswordForm(user);
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(
      await screen.findByText('Tu contraseña se actualizó correctamente.'),
    ).toBeInTheDocument();

    const call = fetchMock.mock.calls.find(([url]) => url === '/api/v1/auth/password');
    expect(call).toBeDefined();
    const init = call?.[1] as RequestInit | undefined;
    expect(init?.method).toBe('POST');
    expect(init?.headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer token-perfil',
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      contrasena_actual: 'claveActual1',
      contrasena_nueva: 'claveNueva2',
    });
  });

  it('places a 400 with campo on the offending field and stays on the form', async () => {
    sessionStorage.setItem(TOKEN_KEY, 'token-perfil');
    window.history.replaceState({}, '', '/perfil/contrasena');
    stubFetchRouter({
      '/api/v1/auth/me': jsonRoute(userFixture),
      '/api/v1/auth/password': () =>
        Promise.resolve(
          jsonResponse(
            { detail: 'La contraseña actual no es correcta', campo: 'contrasena_actual' },
            400,
          ),
        ),
    });

    render(<App />);
    const user = userEvent.setup();
    await fillChangePasswordForm(user);
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('La contraseña actual no es correcta')).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña actual')).toHaveAttribute('aria-invalid', 'true');
    // It is a field message, not a generic banner.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Tu contraseña se actualizó correctamente.'),
    ).not.toBeInTheDocument();
  });

  it('rejects a mismatch before sending anything (R4)', async () => {
    const fetchMock = renderAt('/perfil/contrasena');
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText('Contraseña actual'), 'claveActual1');
    await user.type(screen.getByLabelText('Nueva contraseña'), 'claveNueva2');
    await user.type(screen.getByLabelText('Repetir nueva contraseña'), 'otraClave3');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('Las contraseñas no coinciden')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => url === '/api/v1/auth/password')).toBe(false);
  });
});
