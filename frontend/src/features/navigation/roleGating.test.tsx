import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../App';
import { jsonResponse, stubFetchRouter, userFixture } from '../../test/fixtures';
import type { User } from '../../api/auth';

const TOKEN_KEY = 'sigemi.access_token';
const NAV_NAME = 'Menú de secciones';

const ALL_PAGES = [
  'Panel de Control',
  'Agenda y Turnos',
  'Pacientes',
  'Análisis',
  'Resultados',
  'Insumos y Stock',
  'Control de Residuos',
  'Reportes y Estadísticas',
  'Usuarios y Roles',
  'Auditoría',
];

const BIOQUIMICO_PAGES = ALL_PAGES.filter(
  (label) => label !== 'Usuarios y Roles' && label !== 'Auditoría',
);

function userWithRoles(roles: string[]): User {
  return { ...userFixture, roles };
}

/** Render the app authenticated as a user holding `roles` (via mocked /me). */
function renderAs(roles: string[]) {
  sessionStorage.setItem(TOKEN_KEY, 'token-roles');
  stubFetchRouter({
    '/api/v1/auth/me': jsonResponse(userWithRoles(roles)),
  });
  render(<App />);
}

function nav() {
  return within(screen.getByRole('navigation', { name: NAV_NAME }));
}

describe('role gating (S5)', () => {
  it('shows every page and group to the administrator', async () => {
    renderAs(['administrador']);

    await screen.findByRole('button', { name: 'Panel de Control' });

    for (const label of ALL_PAGES) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
    for (const group of ['Principal', 'Laboratorio', 'Insumos', 'Reportes', 'Administración']) {
      expect(nav().getByText(group)).toBeInTheDocument();
    }
  });

  it('shows the bioquimico pages and hides the Administración group', async () => {
    renderAs(['bioquimico']);

    await screen.findByRole('button', { name: 'Panel de Control' });

    for (const label of BIOQUIMICO_PAGES) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
    expect(screen.queryByRole('button', { name: 'Usuarios y Roles' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Auditoría' })).not.toBeInTheDocument();
    // The Administración group has no visible item, so it disappears entirely.
    expect(nav().queryByText('Administración')).not.toBeInTheDocument();
    expect(nav().getByText('Principal')).toBeInTheDocument();
  });

  it('shows only Insumos y Stock and Control de Residuos to the profesor', async () => {
    renderAs(['profesor']);

    await screen.findByRole('button', { name: 'Insumos y Stock' });

    expect(screen.getByRole('button', { name: 'Insumos y Stock' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Control de Residuos' })).toBeInTheDocument();

    for (const label of ALL_PAGES.filter(
      (l) => l !== 'Insumos y Stock' && l !== 'Control de Residuos',
    )) {
      expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument();
    }
    for (const group of ['Principal', 'Laboratorio', 'Reportes', 'Administración']) {
      expect(nav().queryByText(group)).not.toBeInTheDocument();
    }
    expect(nav().getByText('Insumos')).toBeInTheDocument();
  });

  it('unions several roles instead of intersecting them', async () => {
    renderAs(['bioquimico', 'profesor']);

    await screen.findByRole('button', { name: 'Panel de Control' });

    // "Análisis" is bioquimico-only: an intersection would hide it.
    expect(screen.getByRole('button', { name: 'Análisis' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Control de Residuos' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Usuarios y Roles' })).not.toBeInTheDocument();
  });

  it('grants nothing for an unknown role code', async () => {
    renderAs(['profesor', 'desconocido']);

    await screen.findByRole('button', { name: 'Insumos y Stock' });

    // Same two pages as a plain profesor: the unknown code adds nothing.
    expect(screen.getByRole('button', { name: 'Insumos y Stock' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Control de Residuos' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Panel de Control' })).not.toBeInTheDocument();
  });
});

describe('dashboard landing (S7)', () => {
  it('lands on Panel de Control with explicit empty states and no invented numbers', async () => {
    renderAs(['bioquimico']);

    await screen.findByRole('button', { name: 'Panel de Control' });

    expect(screen.getByRole('heading', { level: 1, name: 'Estado operativo del laboratorio' })).toBeInTheDocument();

    // Two empty lists.
    expect(screen.getAllByText('Sin datos todavía')).toHaveLength(2);
    // Seven KPI slots (3 turnos + 4 carga), every value the empty placeholder.
    expect(screen.getAllByText('—')).toHaveLength(7);
  });

  it('re-renders and sets the update label to the current time on Actualizar', async () => {
    renderAs(['bioquimico']);

    await screen.findByRole('button', { name: 'Panel de Control' });
    expect(screen.getByText('Última actualización: —')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Actualizar/ }));

    expect(screen.getByText(/Última actualización: \d{2}:\d{2}/)).toBeInTheDocument();
  });

  it('renders a placeholder, not fabricated content, for pages without a screen', async () => {
    renderAs(['bioquimico']);

    await screen.findByRole('button', { name: 'Análisis' });
    const user = userEvent.setup();
    // `Análisis` belongs to a subsystem that has no specification yet.
    await user.click(screen.getByRole('button', { name: 'Análisis' }));

    expect(screen.getByRole('heading', { level: 1, name: 'Análisis' })).toBeInTheDocument();
    expect(screen.getByText('Pantalla pendiente de implementación.')).toBeInTheDocument();
  });
});
