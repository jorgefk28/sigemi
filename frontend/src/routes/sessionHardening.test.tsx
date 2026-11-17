import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';
import { jsonResponse, jsonRoute, stubFetchRouter, userFixture } from '../test/fixtures';

/**
 * Hardening of the session boundary and of the SPA shell.
 *
 * Three behaviours that a back-office user feels and that the first work unit
 * left as advisories:
 * - a server that does not answer must not look like a logout;
 * - a browser that refuses `sessionStorage` must not break boot or login;
 * - a render crash must not leave a white screen.
 */

const TOKEN_KEY = 'sigemi.access_token';
const USER_KEY = 'sigemi.user';
const ME_URL = '/api/v1/auth/me';

describe('session restore failure', () => {
  it('keeps the token and offers a retry when the server does not answer', async () => {
    sessionStorage.setItem(TOKEN_KEY, 'token-keep');
    stubFetchRouter({ [ME_URL]: () => Promise.reject(new Error('offline')) });

    render(<App />);

    expect(await screen.findByText('No se pudo conectar con el servidor')).toBeInTheDocument();
    // The token may still be valid: discarding it would log the user out for a
    // network blip.
    expect(sessionStorage.getItem(TOKEN_KEY)).toBe('token-keep');
    // And it is not the login form, which would suggest the session is gone.
    expect(screen.queryByLabelText('Correo electrónico')).not.toBeInTheDocument();
  });

  it('recovers the session when the retry succeeds', async () => {
    sessionStorage.setItem(TOKEN_KEY, 'token-keep');
    let calls = 0;
    stubFetchRouter({
      [ME_URL]: () => {
        calls += 1;
        return calls === 1
          ? Promise.reject(new Error('offline'))
          : Promise.resolve(jsonResponse(userFixture));
      },
    });
    const user = userEvent.setup();

    render(<App />);
    await screen.findByText('No se pudo conectar con el servidor');
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(
      await screen.findByRole('heading', { name: 'Estado operativo del laboratorio' }),
    ).toBeInTheDocument();
  });

  it('discards the token and shows the login form on 401', async () => {
    sessionStorage.setItem(TOKEN_KEY, 'token-expired');
    stubFetchRouter({
      [ME_URL]: () => Promise.resolve(jsonResponse({ detail: 'Credenciales inválidas' }, 401)),
    });

    render(<App />);

    expect(await screen.findByLabelText('Correo electrónico')).toBeInTheDocument();
    expect(sessionStorage.getItem(TOKEN_KEY)).toBeNull();
  });
});

describe('storage that refuses to work', () => {
  it('boots without a session when sessionStorage throws on read', async () => {
    const getItem = Storage.prototype.getItem;
    Storage.prototype.getItem = () => {
      throw new Error('storage disabled');
    };
    try {
      stubFetchRouter({ [ME_URL]: jsonRoute(userFixture) });

      render(<App />);

      // No session is a login form, not a crash.
      expect(await screen.findByLabelText('Correo electrónico')).toBeInTheDocument();
    } finally {
      Storage.prototype.getItem = getItem;
    }
  });

  it('completes the login even when sessionStorage throws on write', async () => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error('quota exceeded');
    };
    try {
      stubFetchRouter({
        '/api/v1/auth/login': () =>
          Promise.resolve(jsonResponse({ access_token: 'token-live', expires_in: 3600 })),
        [ME_URL]: jsonRoute(userFixture),
      });
      const user = userEvent.setup();

      render(<App />);
      await user.type(await screen.findByLabelText('Correo electrónico'), 'ana@unam.edu.ar');
      await user.type(screen.getByLabelText('Contraseña'), 'clave123');
      await user.click(screen.getByRole('button', { name: 'Ingresar' }));

      // The session lives in memory for this tab instead of failing the login.
      expect(
        await screen.findByRole('heading', { name: 'Estado operativo del laboratorio' }),
      ).toBeInTheDocument();
    } finally {
      Storage.prototype.setItem = setItem;
    }
  });
});

describe('shell hygiene', () => {
  it('titles the document after the active screen', async () => {
    sessionStorage.setItem(TOKEN_KEY, 'token-title');
    stubFetchRouter({ [ME_URL]: jsonRoute(userFixture) });

    render(<App />);

    await screen.findByRole('heading', { name: 'Estado operativo del laboratorio' });
    await waitFor(() => {
      expect(document.title).toBe('Estado operativo del laboratorio · SIGEMI');
    });
  });

  it('moves focus to the content after a navigation', async () => {
    sessionStorage.setItem(TOKEN_KEY, 'token-focus');
    stubFetchRouter({
      [ME_URL]: jsonRoute(userFixture),
      '/api/v1/pacientes?limit=20&offset=0': jsonRoute({
        items: [],
        total: 0,
        limit: 20,
        offset: 0,
      }),
    });
    const user = userEvent.setup();

    render(<App />);
    await screen.findByRole('button', { name: 'Pacientes' });
    await user.click(screen.getByRole('button', { name: 'Pacientes' }));

    await screen.findByRole('heading', { level: 1, name: 'Pacientes' });
    expect(document.activeElement).toBe(screen.getByRole('main'));
  });

  it('offers a skip link to the content', async () => {
    sessionStorage.setItem(TOKEN_KEY, 'token-skip');
    stubFetchRouter({ [ME_URL]: jsonRoute(userFixture) });

    render(<App />);

    await screen.findByRole('main');
    expect(screen.getByRole('link', { name: 'Ir al contenido' })).toHaveAttribute(
      'href',
      '#contenido-principal',
    );
  });
});

describe('render crash', () => {
  it('shows an actionable message instead of a blank page', async () => {
    sessionStorage.setItem(TOKEN_KEY, 'token-crash');
    sessionStorage.setItem(USER_KEY, '{"roto": true}');
    // A user without `roles` makes the shell throw while deriving the menu.
    stubFetchRouter({ [ME_URL]: jsonRoute({ id: 'x', nombre: 'X', apellido: 'Y' }) });

    render(<App />);

    expect(await screen.findByText('Se produjo un error inesperado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recargar' })).toBeInTheDocument();
  });
});
