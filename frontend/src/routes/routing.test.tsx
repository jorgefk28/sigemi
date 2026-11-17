import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';
import { jsonResponse, jsonRoute, stubFetchRouter, userFixture } from '../test/fixtures';
import { pacienteActivo, pacientesPage } from '../test/recepcionFixtures';

/**
 * The active screen is derived from the URL (S6 + SEG-U07 entry contract), not
 * from component state. These tests pin the three consequences a back-office
 * user feels: a deep link opens the named screen, an unknown or forbidden path
 * is not a dead end, and the browser back button works.
 */

const TOKEN_KEY = 'sigemi.access_token';

function renderAt(path: string, roles: string[] = ['bioquimico']) {
  sessionStorage.setItem(TOKEN_KEY, 'token-routing');
  window.history.replaceState({}, '', path);
  stubFetchRouter({
    '/api/v1/auth/me': () => Promise.resolve(jsonResponse({ ...userFixture, roles })),
    // The list the screen fetches on mount: without it the screen renders its
    // error state and the heading assertion would pass for the wrong reason.
    '/api/v1/pacientes?limit=20&offset=0': jsonRoute(pacientesPage([pacienteActivo])),
  });
  render(<App />);
}

describe('URL-driven navigation', () => {
  it('opens the screen named by the URL on a cold load', async () => {
    renderAt('/pacientes');

    // A row proves the screen is alive, not just its heading.
    expect(await screen.findByText('30123456')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Pacientes' }),
    ).toBeInTheDocument();
    // The landing page is not rendered on top of it.
    expect(
      screen.queryByRole('heading', { name: 'Estado operativo del laboratorio' }),
    ).not.toBeInTheDocument();
  });

  it('sends an unknown path to the landing page instead of showing nothing', async () => {
    renderAt('/no-existe');

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Estado operativo del laboratorio',
      }),
    ).toBeInTheDocument();
  });

  it('sends a path the role cannot see to the landing page, never a raw 403', async () => {
    // `usuarios` is administrator-only; a biochemist asking for it lands home.
    renderAt('/usuarios');

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Estado operativo del laboratorio',
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Usuarios y Roles' })).not.toBeInTheDocument();
  });

  it('follows the URL when the browser goes back', async () => {
    renderAt('/panel-control');

    const user = userEvent.setup();
    await screen.findByRole('heading', { name: 'Estado operativo del laboratorio' });

    await user.click(screen.getByRole('button', { name: 'Pacientes' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Pacientes' })).toBeInTheDocument();

    window.history.back();

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: 'Estado operativo del laboratorio' }),
      ).toBeInTheDocument();
    });
  });
});
