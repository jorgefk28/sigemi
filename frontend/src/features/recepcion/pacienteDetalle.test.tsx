import { describe, expect, it } from 'vitest';
import { render, screen, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../App';
import { jsonResponse, jsonRoute, stubFetchRouter, userFixture, type RouteHandler } from '../../test/fixtures';
import { adminSession } from '../../test/accessFixtures';
import { pacienteActivo } from '../../test/recepcionFixtures';

/**
 * REC-U07 · Detalle de paciente (P2).
 *
 * Backing requirement: UCE-REC-18 paso 6, UCE-REC-19 pasos 4-11; RF-05.
 * "Desactivar" is administrator-only and asks for the mandatory motive in a
 * dialog; the deactivation is logical and the motive goes to the audit.
 */

const TOKEN_KEY = 'sigemi.access_token';
const ME_URL = '/api/v1/auth/me';
const DETAIL_URL = '/api/v1/pacientes/p-ana';
const BAJA_URL = '/api/v1/pacientes/p-ana/baja';
const FICHAS_URL = '/api/v1/fichas-clinicas?paciente_id=p-ana&limit=20&offset=0';

const fichaFixture = {
  id: 'f-1',
  paciente_id: 'p-ana',
  paciente_apellido: 'García',
  paciente_nombre: 'Ana',
  paciente_dni: '30123456',
  profesional_id: 'prof-1',
  profesional_nombre: 'Ada Bioquímica',
  fecha_consulta: '2026-11-02T10:30:00Z',
  version_actual: 2,
  estado: 'activa',
  datos: { motivo_consulta: 'Uña con mancha', sintomas: 'Prurito' },
};

function fichasPage(items: unknown[] = [fichaFixture]) {
  return { items, total: items.length, limit: 20, offset: 0 };
}

function renderDetail(
  user = { ...userFixture, roles: ['bioquimico'] },
  extraRoutes: Record<string, Response | RouteHandler> = {},
) {
  sessionStorage.setItem(TOKEN_KEY, 'token-rec');
  window.history.replaceState({}, '', '/pacientes/p-ana');
  const fetchMock = stubFetchRouter({
    [ME_URL]: jsonRoute(user),
    [DETAIL_URL]: jsonRoute(pacienteActivo),
    [FICHAS_URL]: jsonRoute(fichasPage()),
    ...extraRoutes,
  });
  render(<App />);
  return fetchMock;
}

describe('REC-U07 detalle de paciente', () => {
  it('shows the personal data with the declared format', async () => {
    renderDetail();

    const datos = await screen.findByLabelText('Datos personales');

    expect(within(datos).getByText('30123456')).toBeInTheDocument();
    expect(within(datos).getByText('12/05/1980')).toBeInTheDocument();
    expect(within(datos).getByText('3764123456')).toBeInTheDocument();
    expect(within(datos).getByText('ana@correo.com')).toBeInTheDocument();
    // A nullable column is shown as an em dash, never as an empty cell (R4).
    expect(within(datos).getAllByText('OSDE')).toHaveLength(1);
  });

  it('shows the consultation history instead of a pending notice (DIAG-06 paso 4)', async () => {
    renderDetail();

    await screen.findByLabelText('Datos personales');

    // REC-U07 hosts DIAG-06: the records of the patient, newest first.
    expect(await screen.findByText(/Ada Bioquímica/)).toBeInTheDocument();
    expect(screen.getByText('Versión 2 · Ada Bioquímica')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Ver la consulta del/ }),
    ).toBeInTheDocument();
    // Without analyses the section says so, never sample data.
    expect(screen.getByText('Sin análisis registrados')).toBeInTheDocument();
  });

  it('offers Nueva consulta to a biochemist and not to an administrator (A-12)', async () => {
    renderDetail();

    await screen.findByLabelText('Datos personales');
    expect(screen.getByRole('button', { name: 'Nueva consulta' })).toBeInTheDocument();

    cleanup();
    renderDetail(adminSession, { [FICHAS_URL]: jsonRoute(fichasPage()) });
    await screen.findByLabelText('Datos personales');
    expect(screen.queryByRole('button', { name: 'Nueva consulta' })).not.toBeInTheDocument();
  });

  it('hides Desactivar from a biochemist (R2)', async () => {
    renderDetail();

    await screen.findByLabelText('Datos personales');

    expect(screen.queryByRole('button', { name: 'Desactivar' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument();
  });

  it('asks for the motive and deactivates the patient as administrator', async () => {
    const deactivated = { ...pacienteActivo, estado: 'inactivo' };
    const fetchMock = renderDetail(adminSession, {
      [BAJA_URL]: () => Promise.resolve(jsonResponse(deactivated)),
    });
    const user = userEvent.setup();

    await screen.findByLabelText('Datos personales');
    await user.click(screen.getByRole('button', { name: 'Desactivar' }));

    const dialog = await screen.findByRole('dialog', { name: 'Desactivar paciente' });
    const confirmar = within(dialog).getByRole('button', { name: 'Confirmar' });
    // R3: the motive is mandatory, so Confirmar stays disabled without it.
    expect(confirmar).toBeDisabled();

    await user.type(within(dialog).getByLabelText('Motivo de la baja'), 'Se mudó a otra provincia');
    expect(confirmar).toBeEnabled();
    await user.click(confirmar);

    // The record updates in place: badge Inactivo and no Desactivar action.
    expect(
      await within(await screen.findByLabelText('Datos personales')).findAllByText('Inactivo'),
    ).not.toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Desactivar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    const call = fetchMock.mock.calls.find(([url]) => url === BAJA_URL);
    const init = call?.[1] as RequestInit | undefined;
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({ motivo: 'Se mudó a otra provincia' });
  });

  it('reports the active-appointments rejection inside the dialog', async () => {
    renderDetail(adminSession, {
      [BAJA_URL]: () =>
        Promise.resolve(
          jsonResponse(
            {
              detail:
                'El paciente tiene turnos vigentes; cancelalos antes de desactivarlo',
            },
            400,
          ),
        ),
    });
    const user = userEvent.setup();

    await screen.findByLabelText('Datos personales');
    await user.click(screen.getByRole('button', { name: 'Desactivar' }));

    const dialog = await screen.findByRole('dialog', { name: 'Desactivar paciente' });
    await user.type(within(dialog).getByLabelText('Motivo de la baja'), 'Baja');
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar' }));

    expect(
      await within(dialog).findByText(
        'El paciente tiene turnos vigentes; cancelalos antes de desactivarlo',
      ),
    ).toBeInTheDocument();
    // The dialog stays open so the user can react.
    expect(screen.getByRole('dialog', { name: 'Desactivar paciente' })).toBeInTheDocument();
  });

  it('hides Desactivar on an already inactive patient', async () => {
    renderDetail(adminSession, {
      [DETAIL_URL]: jsonRoute({ ...pacienteActivo, estado: 'inactivo' }),
    });

    await screen.findByLabelText('Datos personales');

    expect(screen.queryByRole('button', { name: 'Desactivar' })).not.toBeInTheDocument();
  });

  it('shows the load error with Reintentar', async () => {
    renderDetail(
      { ...userFixture, roles: ['bioquimico'] },
      { [DETAIL_URL]: () => Promise.reject(new Error('offline')) },
    );

    expect(await screen.findByText('No se pudo cargar el paciente')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });
});
