import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { jsonResponse, stubFetchRouter } from '../test/fixtures';
import type { User } from '../api/auth';

/**
 * Smoke coverage for the delivered back-office screens (spec S2 of
 * `odd/tasks/07-frontend-backoffice.md`).
 *
 * Every screen is a large component tree built on a global store; a broken
 * import, a missing token or a screen that throws on first render would not be
 * caught by the unit tests of the API layer. This test mounts the real
 * application behind an authenticated session and walks the sidebar.
 */

const ADMIN: User = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  nombre: 'Laura',
  apellido: 'Benítez',
  correo_electronico: 'laura@unam.edu.ar',
  estado: 'activo',
  roles: ['administrador'],
};

const EMPTY_PAGE = { items: [], total: 0, limit: 100, offset: 0 };

function stubBackend() {
  return stubFetchRouter({
    '/api/v1/auth/me': jsonResponse(ADMIN),
    '/api/v1/pacientes?limit=100&offset=0': jsonResponse(EMPTY_PAGE),
    '/api/v1/auditoria?limit=100&offset=0': jsonResponse(EMPTY_PAGE),
  });
}

beforeEach(() => {
  sessionStorage.setItem('sigemi.access_token', 'token-smoke');
});

afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

describe('back-office screens', () => {
  it('renders the analysis panel with the delivered dataset', async () => {
    stubBackend();
    render(<App />);

    // Landing screen of the prototype: the panel listing.
    expect(await screen.findByText('Panel de Análisis')).toBeInTheDocument();
    expect(screen.getByText('MIC-2026-0341')).toBeInTheDocument();
  });

  it('opens the patient list with the seeded patients', async () => {
    stubBackend();
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole('button', { name: /Pacientes/ }));

    expect(await screen.findByText(/Nuevo Paciente/)).toBeInTheDocument();
    expect(screen.getByText('Ramírez')).toBeInTheDocument();
  });

  it('renders the audit screen for an administrator', async () => {
    stubBackend();
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole('button', { name: /Auditoría/ }));

    expect(
      await screen.findByText(/Registro inmutable\. Solo lectura\./),
    ).toBeInTheDocument();
  });

  it('renders every module of the sidebar without throwing', async () => {
    stubBackend();
    const user = userEvent.setup();
    render(<App />);

    const pages = [
      'Insumos y Stock',
      'Control de Residuos',
      'Reportes y Estadísticas',
      'Usuarios y Roles',
      'Auditoría',
      'Agenda y Turnos',
      'Resultados',
      'Pacientes',
      'Panel de Control',
      'Análisis',
    ];

    // Wait for the session restore before walking the menu.
    await screen.findByRole('button', { name: /Insumos y Stock$/ });

    for (const page of pages) {
      await user.click(screen.getByRole('button', { name: new RegExp(`${page}$`) }));
      // A screen that throws during render fails the click above; a screen that
      // mounts keeps the shell's navigation available.
      expect(
        await screen.findByRole('button', { name: /Insumos y Stock/ }),
      ).toBeInTheDocument();
    }
  });

  it('hides the administration modules from a non-administrator', async () => {
    stubFetchRouter({
      '/api/v1/auth/me': jsonResponse({ ...ADMIN, roles: ['bioquimico'] }),
      '/api/v1/pacientes?limit=100&offset=0': jsonResponse(EMPTY_PAGE),
    });
    render(<App />);

    await screen.findByText('Panel de Análisis');

    expect(screen.queryByRole('button', { name: /Usuarios y Roles/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Auditoría/ })).not.toBeInTheDocument();
  });
});
