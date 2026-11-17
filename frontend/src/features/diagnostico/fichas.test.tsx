import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../App';
import { jsonResponse, jsonRoute, stubFetchRouter, userFixture, type RouteHandler } from '../../test/fixtures';
import { pacienteActivo } from '../../test/recepcionFixtures';

/**
 * DIAG-U03 · Ficha clínica (P3) and DIAG-U04 · detalle (P2).
 *
 * Backing requirement: UCE-DIAG-01 pasos 4-9, UCE-DIAG-06 pasos 4-6,
 * UCE-DIAG-07 pasos 1-8.
 *
 * The form renders the fields the **API declares**: the catalog of clinical keys
 * is A-04 in the decision log and exists in one place. Editing sends only the
 * fields that changed; a validated analysis blocks the modification with the
 * backend's reason.
 */

const TOKEN_KEY = 'sigemi.access_token';
const ME_URL = '/api/v1/auth/me';
const CAMPOS_URL = '/api/v1/fichas-clinicas/campos';
const PACIENTE_URL = '/api/v1/pacientes/p-ana';
const FICHAS_URL = '/api/v1/fichas-clinicas?paciente_id=p-ana&limit=20&offset=0';
const FICHA_URL = '/api/v1/fichas-clinicas/f-1';
const CREATE_URL = '/api/v1/fichas-clinicas';

const campos = [
  { campo: 'motivo_consulta', etiqueta: 'Motivo de consulta', obligatorio: true },
  { campo: 'sintomas', etiqueta: 'Síntomas', obligatorio: true },
  { campo: 'observaciones', etiqueta: 'Observaciones', obligatorio: false },
];

const ficha = {
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

function rutasBase(extra: Record<string, Response | RouteHandler> = {}) {
  return {
    [ME_URL]: jsonRoute({ ...userFixture, roles: ['bioquimico'] }),
    [CAMPOS_URL]: jsonRoute(campos),
    [PACIENTE_URL]: jsonRoute(pacienteActivo),
    [FICHAS_URL]: jsonRoute({ items: [ficha], total: 1, limit: 20, offset: 0 }),
    [FICHA_URL]: jsonRoute(ficha),
    ...extra,
  };
}

function renderAt(path: string, extra: Record<string, Response | RouteHandler> = {}) {
  sessionStorage.setItem(TOKEN_KEY, 'token-diag');
  window.history.replaceState({}, '', path);
  const fetchMock = stubFetchRouter(rutasBase(extra));
  render(<App />);
  return fetchMock;
}

describe('DIAG-U03 ficha clínica', () => {
  it('renders the fields the API declares, not a hardcoded list', async () => {
    renderAt('/pacientes/p-ana/fichas/nueva');

    expect(await screen.findByLabelText('Motivo de consulta *')).toBeInTheDocument();
    expect(screen.getByLabelText('Síntomas *')).toBeInTheDocument();
    // An optional field carries no asterisk.
    expect(screen.getByLabelText('Observaciones')).toBeInTheDocument();
  });

  it('blocks the submit when a mandatory field is empty', async () => {
    const fetchMock = renderAt('/pacientes/p-ana/fichas/nueva');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Guardar Ficha' }));

    expect(
      await screen.findByText('El campo «Motivo de consulta» no puede estar vacío'),
    ).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(
        ([url, init]) =>
          url === CREATE_URL && (init as RequestInit | undefined)?.method === 'POST',
      ),
    ).toBe(false);
  });

  it('creates the record with the typed data and opens it', async () => {
    const fetchMock = renderAt('/pacientes/p-ana/fichas/nueva', {
      [CREATE_URL]: () => Promise.resolve(jsonResponse(ficha, 201)),
    });
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText('Motivo de consulta *'), 'Uña con mancha');
    await user.type(screen.getByLabelText('Síntomas *'), 'Prurito');
    await user.type(screen.getByLabelText('Observaciones'), 'Sin antecedentes');
    await user.click(screen.getByRole('button', { name: 'Guardar Ficha' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Ficha clínica' }),
    ).toBeInTheDocument();

    const call = fetchMock.mock.calls.find(([url]) => url === CREATE_URL);
    expect(JSON.parse(String((call?.[1] as RequestInit).body))).toEqual({
      paciente_id: 'p-ana',
      datos: {
        motivo_consulta: 'Uña con mancha',
        sintomas: 'Prurito',
        observaciones: 'Sin antecedentes',
      },
    });
  });

  it('reports a missing professional profile on the field it names', async () => {
    renderAt('/pacientes/p-ana/fichas/nueva', {
      [CREATE_URL]: () =>
        Promise.resolve(
          jsonResponse(
            {
              detail: 'El usuario no tiene perfil profesional; pedile al administrador que lo cargue',
              campo: 'profesional',
            },
            400,
          ),
        ),
    });
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText('Motivo de consulta *'), 'Uno');
    await user.type(screen.getByLabelText('Síntomas *'), 'Dos');
    await user.click(screen.getByRole('button', { name: 'Guardar Ficha' }));

    // A-03: the message is shown, even when it is not a form field.
    expect(
      await screen.findByText(/no tiene perfil profesional/),
    ).toBeInTheDocument();
  });

  it('edits only the field that changed and keeps the version', async () => {
    const fetchMock = renderAt('/pacientes/p-ana/fichas/f-1/editar', {
      [FICHA_URL]: (_url, init) =>
        Promise.resolve(
          init?.method === 'PATCH'
            ? jsonResponse({ ...ficha, version_actual: 3, datos: { ...ficha.datos, sintomas: 'Prurito intenso' } })
            : jsonResponse(ficha),
        ),
    });
    const user = userEvent.setup();

    expect(await screen.findByDisplayValue('Uña con mancha')).toBeInTheDocument();

    const sintomas = screen.getByLabelText('Síntomas *');
    await user.clear(sintomas);
    await user.type(sintomas, 'Prurito intenso');
    await user.click(screen.getByRole('button', { name: 'Guardar Ficha' }));

    await screen.findByRole('heading', { level: 1, name: 'Ficha clínica' });

    const patch = fetchMock.mock.calls.find(
      ([, init]) => (init as RequestInit | undefined)?.method === 'PATCH',
    );
    expect(JSON.parse(String((patch?.[1] as RequestInit).body))).toEqual({
      datos: { sintomas: 'Prurito intenso' },
    });
  });
});

describe('DIAG-U04 detalle de ficha', () => {
  it('shows every declared field, with an em dash where there is no value', async () => {
    renderAt('/pacientes/p-ana/fichas/f-1');

    const datos = await screen.findByLabelText('Datos clínicos');

    expect(within(datos).getByText('Uña con mancha')).toBeInTheDocument();
    expect(within(datos).getByText('Prurito')).toBeInTheDocument();
    // R4: absent value is an em dash, never a blank cell.
    expect(within(datos).getAllByText('—').length).toBeGreaterThan(0);
    expect(within(datos).getByText('Observaciones')).toBeInTheDocument();
  });

  it('shows the version and the professional of the record', async () => {
    renderAt('/pacientes/p-ana/fichas/f-1');

    await screen.findByLabelText('Datos clínicos');

    expect(screen.getByText(/Versión 2/)).toBeInTheDocument();
    expect(screen.getByText(/Ada Bioquímica/)).toBeInTheDocument();
  });

  it('offers Editar and goes back to the patient', async () => {
    renderAt('/pacientes/p-ana/fichas/f-1');
    const user = userEvent.setup();

    await screen.findByLabelText('Datos clínicos');
    expect(screen.getByRole('button', { name: 'Volver' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Editar' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Editar ficha clínica' }),
    ).toBeInTheDocument();
  });

  it('shows the load error with Reintentar', async () => {
    renderAt('/pacientes/p-ana/fichas/f-1', {
      [FICHA_URL]: () => Promise.reject(new Error('offline')),
    });

    expect(await screen.findByText('No se pudo cargar la ficha clínica')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });
});
