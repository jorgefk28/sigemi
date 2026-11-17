import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../App';
import { jsonResponse, jsonRoute, stubFetchRouter, userFixture, type RouteHandler } from '../../test/fixtures';
import { pacienteActivo, pacientesPage } from '../../test/recepcionFixtures';

/**
 * REC-U05 · Formulario de paciente, alta y edición (P3).
 *
 * Backing requirement: UCE-REC-16 pasos 2-6, UCE-REC-17 pasos 6-11; RF-05.
 * The eight fields of the UCE travel; the derived ones never do.
 */

const TOKEN_KEY = 'sigemi.access_token';
const ME_URL = '/api/v1/auth/me';
const DETAIL_URL = '/api/v1/pacientes/p-ana';
const CREATE_URL = '/api/v1/pacientes';
const LIST_URL = '/api/v1/pacientes?limit=20&offset=0';

function renderForm(
  path: string,
  extraRoutes: Record<string, Response | RouteHandler> = {},
) {
  sessionStorage.setItem(TOKEN_KEY, 'token-rec');
  window.history.replaceState({}, '', path);
  const fetchMock = stubFetchRouter({
    [ME_URL]: jsonRoute({ ...userFixture, roles: ['bioquimico'] }),
    [DETAIL_URL]: jsonRoute(pacienteActivo),
    [LIST_URL]: jsonRoute(pacientesPage([pacienteActivo])),
    ...extraRoutes,
  });
  render(<App />);
  return fetchMock;
}

async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText('DNI'), '30123456');
  await user.type(screen.getByLabelText('Nombre'), 'Ana');
  await user.type(screen.getByLabelText('Apellido'), 'García');
  await user.type(screen.getByLabelText('Fecha de nacimiento'), '1980-05-12');
  await user.type(screen.getByLabelText('Teléfono'), '3764123456');
}

describe('REC-U05 alta de paciente', () => {
  it('creates the patient with the eight fields and returns to the listing', async () => {
    const fetchMock = renderForm('/pacientes/nuevo', {
      [CREATE_URL]: () => Promise.resolve(jsonResponse(pacienteActivo, 201)),
    });
    const user = userEvent.setup();

    await fillRequired(user);
    await user.type(screen.getByLabelText('Correo electrónico'), 'ana@correo.com');
    await user.type(screen.getByLabelText('Dirección'), 'San Lorenzo 123');
    await user.type(screen.getByLabelText('Obra social'), 'OSDE');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    // REC-16 paso 6: the alta returns to REC-U06.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Pacientes' }),
    ).toBeInTheDocument();

    const call = fetchMock.mock.calls.find(([url]) => url === CREATE_URL);
    expect(call).toBeDefined();
    const init = call?.[1] as RequestInit | undefined;
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({
      dni: '30123456',
      nombre: 'Ana',
      apellido: 'García',
      fecha_nacimiento: '1980-05-12',
      telefono: '3764123456',
      correo_electronico: 'ana@correo.com',
      domicilio: 'San Lorenzo 123',
      obra_social: 'OSDE',
    });
  });

  it('sends optional fields as null when they are left empty', async () => {
    const fetchMock = renderForm('/pacientes/nuevo', {
      [CREATE_URL]: () => Promise.resolve(jsonResponse(pacienteActivo, 201)),
    });
    const user = userEvent.setup();

    await fillRequired(user);
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await screen.findByRole('heading', { level: 1, name: 'Pacientes' });

    const body = JSON.parse(
      String((fetchMock.mock.calls.find(([url]) => url === CREATE_URL)?.[1] as RequestInit).body),
    );
    expect(body.correo_electronico).toBeNull();
    expect(body.domicilio).toBeNull();
    expect(body.obra_social).toBeNull();
  });

  it('blocks the submit with local messages when a required field is empty', async () => {
    const fetchMock = renderForm('/pacientes/nuevo');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('El DNI no puede estar vacío')).toBeInTheDocument();
    expect(screen.getByText('El teléfono no puede estar vacío')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => url === CREATE_URL)).toBe(false);
  });

  it('offers the existing record when the DNI is already registered', async () => {
    const fetchMock = renderForm('/pacientes/nuevo', {
      [CREATE_URL]: () =>
        Promise.resolve(
          jsonResponse({ detail: 'El paciente ya se encuentra registrado', campo: 'dni' }, 400),
        ),
      '/api/v1/pacientes?dni=30123456&limit=1&offset=0': jsonRoute(
        pacientesPage([pacienteActivo]),
      ),
      [DETAIL_URL]: jsonRoute(pacienteActivo),
    });
    const user = userEvent.setup();

    await fillRequired(user);
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    // REC-16 exc. paso 4: message on the field plus a way into the existing one.
    expect(await screen.findByText('El paciente ya se encuentra registrado')).toBeInTheDocument();
    expect(screen.getByLabelText('DNI')).toHaveAttribute('aria-invalid', 'true');

    await user.click(screen.getByRole('button', { name: 'Abrir la ficha del paciente existente' }));

    // REC-16 exc. paso 4: the existing patient opens in edit mode.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Editar paciente' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('DNI')).toHaveValue('30123456');
    expect(
      fetchMock.mock.calls.some(
        ([url]) => url === '/api/v1/pacientes?dni=30123456&limit=1&offset=0',
      ),
    ).toBe(true);
  });
});

describe('REC-U05 edición de paciente', () => {
  it('loads the record and patches only the field that changed', async () => {
    const fetchMock = renderForm('/pacientes/p-ana/editar', {
      // Same URL for the read and the write: the method decides.
      [DETAIL_URL]: (_url, init) =>
        Promise.resolve(
          init?.method === 'PATCH'
            ? jsonResponse({ ...pacienteActivo, telefono: '3764999999' })
            : jsonResponse(pacienteActivo),
        ),
    });
    const user = userEvent.setup();

    expect(await screen.findByDisplayValue('30123456')).toBeInTheDocument();

    const telefono = screen.getByLabelText('Teléfono');
    await user.clear(telefono);
    await user.type(telefono, '3764999999');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    // REC-17 pasos 9-11: the edition returns to the patient's record.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'García, Ana' }),
    ).toBeInTheDocument();

    const calls = fetchMock.mock.calls.filter(([, init]) => (init as RequestInit)?.method === 'PATCH');
    expect(calls).toHaveLength(1);
    expect(JSON.parse(String((calls[0][1] as RequestInit).body))).toEqual({
      telefono: '3764999999',
    });
  });

  it('sends no request and returns to the record when nothing changed', async () => {
    const fetchMock = renderForm('/pacientes/p-ana/editar');
    const user = userEvent.setup();

    await screen.findByDisplayValue('30123456');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'García, Ana' })).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(([, init]) => (init as RequestInit)?.method === 'PATCH'),
    ).toBe(false);
  });

  it('blocks the birth date with the rule message the backend sends', async () => {
    renderForm('/pacientes/p-ana/editar', {
      [DETAIL_URL]: (_url, init) =>
        Promise.resolve(
          init?.method === 'PATCH'
            ? jsonResponse(
                {
                  detail:
                    'No se puede modificar la fecha de nacimiento de un paciente con análisis registrados',
                  campo: 'fecha_nacimiento',
                },
                400,
              )
            : jsonResponse(pacienteActivo),
        ),
    });
    const user = userEvent.setup();

    const fecha = await screen.findByLabelText('Fecha de nacimiento');
    await user.clear(fecha);
    await user.type(fecha, '1990-02-02');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(
      await screen.findByText(
        'No se puede modificar la fecha de nacimiento de un paciente con análisis registrados',
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Fecha de nacimiento')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  it('cancels without writing anything', async () => {
    const fetchMock = renderForm('/pacientes/p-ana/editar');
    const user = userEvent.setup();

    await screen.findByDisplayValue('30123456');
    await user.click(screen.getAllByRole('button', { name: 'Cancelar' })[0]);

    expect(await screen.findByRole('heading', { level: 1, name: 'García, Ana' })).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(([, init]) => ['POST', 'PATCH'].includes(String((init as RequestInit)?.method))),
    ).toBe(false);
  });

  it('reports a network failure as a retry, never as a duplicate DNI', async () => {
    renderForm('/pacientes/nuevo', {
      [CREATE_URL]: () => Promise.reject(new Error('offline')),
    });
    const user = userEvent.setup();

    await fillRequired(user);
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudo conectar con el servidor',
    );
    expect(
      screen.queryByText('El paciente ya se encuentra registrado'),
    ).not.toBeInTheDocument();
  });
});
