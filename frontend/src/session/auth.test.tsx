import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';
import { jsonResponse, stubFetchRouter, userFixture } from '../test/fixtures';

const TOKEN_KEY = 'sigemi.access_token';
const USER_KEY = 'sigemi.user';

describe('session lifecycle', () => {
  it('restores the session via /me when a token is stored', async () => {
    sessionStorage.setItem(TOKEN_KEY, 'token-1');
    const fetchMock = stubFetchRouter({
      '/api/v1/auth/me': jsonResponse(userFixture),
    });

    render(<App />);

    expect(await screen.findByText('Panel de Control')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/auth/me',
      expect.objectContaining({
        method: 'GET',
        headers: { Authorization: 'Bearer token-1' },
      }),
    );
    expect(sessionStorage.getItem(USER_KEY)).not.toBeNull();
  });

  it('discards the token when /me responds 401', async () => {
    sessionStorage.setItem(TOKEN_KEY, 'expired-token');
    stubFetchRouter({
      '/api/v1/auth/me': jsonResponse({ detail: 'Credenciales inválidas' }, 401),
    });

    render(<App />);

    expect(await screen.findByLabelText('Correo electrónico')).toBeInTheDocument();
    expect(sessionStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(sessionStorage.getItem(USER_KEY)).toBeNull();
  });

  it('discards the token when /me responds 403', async () => {
    sessionStorage.setItem(TOKEN_KEY, 'inactive-token');
    stubFetchRouter({
      '/api/v1/auth/me': jsonResponse({ detail: 'Usuario inactivo' }, 403),
    });

    render(<App />);

    expect(await screen.findByLabelText('Correo electrónico')).toBeInTheDocument();
    expect(sessionStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('shows the login screen and never the shell without a session', async () => {
    render(<App />);

    expect(await screen.findByLabelText('Correo electrónico')).toBeInTheDocument();
    expect(screen.queryByText('Panel de Control')).not.toBeInTheDocument();
  });

  it('logs in with form-encoded credentials and shows the authenticated area', async () => {
    const fetchMock = stubFetchRouter({
      '/api/v1/auth/login': jsonResponse({ access_token: 'token-2', expires_in: 3600 }),
      '/api/v1/auth/me': jsonResponse(userFixture),
    });

    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText('Correo electrónico'), 'ana@unam.edu.ar');
    await user.type(screen.getByLabelText('Contraseña'), 'clave123');
    await user.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(await screen.findByText('Panel de Control')).toBeInTheDocument();

    const loginCall = fetchMock.mock.calls.find(([url]) => url === '/api/v1/auth/login');
    expect(loginCall).toBeDefined();
    const init = loginCall?.[1] as RequestInit | undefined;
    expect(init?.headers).toEqual({ 'Content-Type': 'application/x-www-form-urlencoded' });
    expect(init?.body).toBe('username=ana%40unam.edu.ar&password=clave123');
    expect(sessionStorage.getItem(TOKEN_KEY)).toBe('token-2');
  });

  it('shows the mapped error message when login fails', async () => {
    stubFetchRouter({
      '/api/v1/auth/login': jsonResponse({ detail: 'Usuario bloqueado temporalmente' }, 423),
    });

    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText('Correo electrónico'), 'ana@unam.edu.ar');
    await user.type(screen.getByLabelText('Contraseña'), 'clave123');
    await user.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Usuario bloqueado temporalmente',
    );
    expect(screen.getByLabelText('Correo electrónico')).toBeInTheDocument();
    expect(screen.queryByText('Panel de Control')).not.toBeInTheDocument();
  });

  it('logs out, discarding the session and returning to login', async () => {
    sessionStorage.setItem(TOKEN_KEY, 'token-3');
    stubFetchRouter({
      '/api/v1/auth/me': jsonResponse(userFixture),
    });

    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByText('Panel de Control')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

    expect(await screen.findByLabelText('Correo electrónico')).toBeInTheDocument();
    expect(sessionStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(sessionStorage.getItem(USER_KEY)).toBeNull();
  });
});
