import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../App';
import { jsonResponse, jsonRoute, stubFetchRouter, userFixture, type RouteHandler } from '../../test/fixtures';
import { adminSession } from '../../test/accessFixtures';
import { pacienteActivo } from '../../test/recepcionFixtures';

/**
 * DIAG-U01 · Panel de Análisis (P1), DIAG-U02 · detalle con acciones (P2) and
 * DIAG-U05 · ingreso de muestra (P3).
 *
 * Backing requirement: UCE-DIAG-02 a DIAG-09, DIAG-13, DIAG-14. The detail derives
 * its buttons from the state and the role (DIAG-09 paso 6) and the backend
 * re-checks both; «Reenviar OTP» is deliberately absent (A-14).
 */

const TOKEN_KEY = 'sigemi.access_token';
const ME_URL = '/api/v1/auth/me';
const CAMPOS_HALLAZGO_URL = '/api/v1/tipos-hallazgo';
const TIPOS_ANALISIS_URL = '/api/v1/tipos-analisis?limit=100&offset=0';
const TIPOS_MUESTRA_URL = '/api/v1/tipos-muestra?limit=100&offset=0';
const PANEL_URL = '/api/v1/analisis?limit=20&offset=0';
const PACIENTE_URL = '/api/v1/pacientes/p-ana';

const tiposHallazgo = [
  { codigo: 'examen_directo', etiqueta: 'Examen directo' },
  { codigo: 'observacion', etiqueta: 'Observación' },
];

const analisis = {
  id: 'a-1',
  ficha_clinica_id: 'f-1',
  paciente_id: 'p-ana',
  paciente_apellido: 'García',
  paciente_nombre: 'Ana',
  paciente_dni: '30123456',
  tipo_analisis_id: 't-cultivo',
  tipo_analisis_nombre: 'Cultivo de uñas',
  muestra_id: 'm-1',
  tipo_muestra_nombre: 'Uña',
  profesional_responsable_id: 'prof-1',
  profesional_responsable_nombre: 'Ada Bioquímica',
  profesional_validador_id: null,
  profesional_validador_nombre: null,
  version_actual: 1,
  estado: 'pendiente',
  fecha_creacion: '2026-11-14T09:30:00Z',
  fecha_validacion: null,
  motivo_invalidacion: null,
  hallazgos: [],
  addendum: null,
};

function rutas(extra: Record<string, Response | RouteHandler> = {}) {
  return {
    [ME_URL]: jsonRoute({ ...userFixture, roles: ['bioquimico'] }),
    [CAMPOS_HALLAZGO_URL]: jsonRoute(tiposHallazgo),
    [TIPOS_ANALISIS_URL]: jsonRoute({
      items: [{ id: 't-cultivo', nombre: 'Cultivo de uñas', descripcion: null, estado: 'activo' }],
      total: 1,
      limit: 100,
      offset: 0,
    }),
    [TIPOS_MUESTRA_URL]: jsonRoute({
      items: [{ id: 'm-una', nombre: 'Uña', descripcion: null, estado: 'activo' }],
      total: 1,
      limit: 100,
      offset: 0,
    }),
    [PANEL_URL]: jsonRoute({ items: [analisis], total: 1, limit: 20, offset: 0 }),
    [PACIENTE_URL]: jsonRoute(pacienteActivo),
    ...extra,
  };
}

function renderAt(
  path: string,
  extra: Record<string, Response | RouteHandler> = {},
) {
  sessionStorage.setItem(TOKEN_KEY, 'token-diag');
  window.history.replaceState({}, '', path);
  const fetchMock = stubFetchRouter(rutas(extra));
  render(<App />);
  return fetchMock;
}

function detalle(estado: string, extra: Record<string, unknown> = {}) {
  return jsonRoute({ ...analisis, estado, ...extra });
}

describe('DIAG-U01 panel de análisis', () => {
  it('lists the workload with patient, type, sample, responsible and state', async () => {
    renderAt('/analisis');

    expect(await screen.findByText('García, Ana')).toBeInTheDocument();
    const table = screen.getByRole('table', { name: 'Análisis micológicos' });

    expect(within(table).getByText('Cultivo de uñas')).toBeInTheDocument();
    expect(within(table).getByText('Uña')).toBeInTheDocument();
    expect(within(table).getByText('Ada Bioquímica')).toBeInTheDocument();
    expect(within(table).getByText('Pendiente')).toBeInTheDocument();
  });

  it('filters by state on change and does not smuggle the unsent text', async () => {
    const fetchMock = renderAt('/analisis', {
      '/api/v1/analisis?estado=validado&limit=20&offset=0': jsonRoute({
        items: [{ ...analisis, estado: 'validado' }],
        total: 1,
        limit: 20,
        offset: 0,
      }),
    });
    const user = userEvent.setup();

    await screen.findByText('García, Ana');
    await user.type(screen.getByLabelText('Buscar'), 'sin enviar');
    await user.selectOptions(screen.getByLabelText('Estado'), 'validado');

    const conEstado = fetchMock.mock.calls
      .map(([url]) => String(url))
      .filter((url) => url.includes('estado=validado'));
    expect(conEstado.length).toBeGreaterThan(0);
    expect(conEstado.every((url) => !url.includes('q='))).toBe(true);
  });

  it('shows the empty state and the load error separately', async () => {
    renderAt('/analisis', {
      [PANEL_URL]: jsonRoute({ items: [], total: 0, limit: 20, offset: 0 }),
    });
    expect(await screen.findByText('No hay análisis registrados')).toBeInTheDocument();
  });

  it('offers Reintentar when the panel cannot load', async () => {
    renderAt('/analisis', { [PANEL_URL]: () => Promise.reject(new Error('offline')) });

    expect(await screen.findByText('No se pudieron cargar los análisis')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });
});

describe('DIAG-U02 detalle de análisis', () => {
  it('offers only the actions the state allows (DIAG-09 paso 6)', async () => {
    renderAt('/analisis/a-1', { '/api/v1/analisis/a-1': detalle('pendiente') });

    await screen.findByLabelText('Datos del análisis');

    expect(screen.getByRole('button', { name: 'Actualizar estado' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Invalidar Análisis' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rechazar Muestra' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Validar Análisis' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Corregir / Addendum' }),
    ).not.toBeInTheDocument();
    // A-14: the OTP resend needs WhatsApp, so it is not offered at all.
    expect(screen.queryByRole('button', { name: /Reenviar OTP/ })).not.toBeInTheDocument();
  });

  it('offers Validar when the analysis is finished', async () => {
    renderAt('/analisis/a-1', { '/api/v1/analisis/a-1': detalle('terminado') });

    await screen.findByLabelText('Datos del análisis');
    expect(screen.getByRole('button', { name: 'Validar Análisis' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Actualizar estado' })).not.toBeInTheDocument();
  });

  it('lets the administrator invalidate but not validate (A-12)', async () => {
    sessionStorage.setItem(TOKEN_KEY, 'token-admin');
    window.history.replaceState({}, '', '/analisis/a-1');
    stubFetchRouter({
      ...rutas(),
      [ME_URL]: jsonRoute(adminSession),
      // DIAG-08 allows invalidation while the analysis is pending or in process.
      '/api/v1/analisis/a-1': detalle('en_proceso'),
    });
    render(<App />);

    await screen.findByLabelText('Datos del análisis');

    expect(screen.getByRole('button', { name: 'Invalidar Análisis' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Validar Análisis' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Actualizar estado' })).not.toBeInTheDocument();
  });

  it('advances the state and reloads the record in place', async () => {
    const fetchMock = renderAt('/analisis/a-1', {
      '/api/v1/analisis/a-1': detalle('pendiente'),
      '/api/v1/analisis/a-1/estado': (_url, init) =>
        Promise.resolve(
          init?.method === 'PATCH'
            ? jsonResponse({
                ...analisis,
                estado: 'en_proceso',
                hallazgos: [
                  {
                    id: 'h-1',
                    tipo_hallazgo: 'examen_directo',
                    dato: 'Sin hifas',
                    estado_alcanzado: 'en_proceso',
                    fecha: '2026-11-14T10:00:00Z',
                  },
                ],
              })
            : jsonResponse(analisis),
        ),
    });
    const user = userEvent.setup();

    await screen.findByLabelText('Datos del análisis');
    await user.click(screen.getByRole('button', { name: 'Actualizar estado' }));

    const dialog = await screen.findByRole('dialog', { name: 'Actualizar estado' });
    // Without a finding the action cannot be confirmed.
    expect(within(dialog).getByRole('button', { name: 'Confirmar' })).toBeDisabled();

    await user.type(within(dialog).getByLabelText('Hallazgo u observación'), 'Sin hifas');
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar' }));

    expect(await screen.findByText('Sin hifas')).toBeInTheDocument();
    expect(screen.getByText(/En proceso/)).toBeInTheDocument();

    const patch = fetchMock.mock.calls.find(
      ([, init]) => (init as RequestInit | undefined)?.method === 'PATCH',
    );
    expect(JSON.parse(String((patch?.[1] as RequestInit).body))).toEqual({
      estado: 'en_proceso',
      hallazgos: [
        { tipo_hallazgo: 'observacion', dato: 'Sin hifas', estado_alcanzado: 'en_proceso' },
      ],
    });
  });

  it('asks for the motive before invalidating', async () => {
    const fetchMock = renderAt('/analisis/a-1', {
      '/api/v1/analisis/a-1': detalle('pendiente'),
      '/api/v1/analisis/a-1/invalidar': () =>
        Promise.resolve(
          jsonResponse({ ...analisis, estado: 'invalidado', motivo_invalidacion: 'Se rompió' }),
        ),
    });
    const user = userEvent.setup();

    await screen.findByLabelText('Datos del análisis');
    await user.click(screen.getByRole('button', { name: 'Invalidar Análisis' }));

    const dialog = await screen.findByRole('dialog', { name: 'Invalidar análisis' });
    expect(within(dialog).getByRole('button', { name: 'Confirmar' })).toBeDisabled();

    await user.type(within(dialog).getByLabelText('Motivo de la invalidación'), 'Se rompió');
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar' }));

    expect(await screen.findByText('Se rompió')).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(([url]) => url === '/api/v1/analisis/a-1/invalidar'),
    ).toBe(true);
  });

  it('shows the addendum of a validated analysis and offers the correction', async () => {
    renderAt('/analisis/a-1', {
      '/api/v1/analisis/a-1': detalle('validado', {
        profesional_validador_id: 'prof-1',
        profesional_validador_nombre: 'Ada Bioquímica',
        fecha_validacion: '2026-11-15T12:00:00Z',
        version_actual: 2,
        addendum: { motivo: 'Error de tipeo', contenido: 'Donde dice hifas, dice esporas' },
      }),
    });

    await screen.findByLabelText('Datos del análisis');

    expect(screen.getByText('Addendum')).toBeInTheDocument();
    expect(screen.getByText('Donde dice hifas, dice esporas')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Corregir / Addendum' })).toBeInTheDocument();
  });

  it('offers no write action on an invalidated analysis', async () => {
    renderAt('/analisis/a-1', {
      '/api/v1/analisis/a-1': detalle('invalidado', { motivo_invalidacion: 'Contaminada' }),
    });

    await screen.findByLabelText('Datos del análisis');

    expect(screen.queryByRole('button', { name: 'Actualizar estado' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Invalidar Análisis' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rechazar Muestra' })).not.toBeInTheDocument();
  });
});

describe('DIAG-U05 ingreso de muestra', () => {
  it('registers the sample and opens the analysis it creates', async () => {
    const fetchMock = renderAt('/pacientes/p-ana/muestras/nueva', {
      '/api/v1/muestras': () =>
        Promise.resolve(
          jsonResponse(
            {
              id: 'm-1',
              paciente_id: 'p-ana',
              tipo_muestra_id: 'm-una',
              fecha_ingreso: '2026-11-14T09:30:00Z',
              observaciones: 'Uña del pie derecho',
              analisis,
            },
            201,
          ),
        ),
      '/api/v1/analisis/a-1': detalle('pendiente'),
    });
    const user = userEvent.setup();

    await screen.findByRole('option', { name: 'Uña' });
    await user.selectOptions(screen.getByLabelText('Tipo de muestra'), 'm-una');
    await user.selectOptions(screen.getByLabelText('Tipo de análisis'), 't-cultivo');
    await user.type(screen.getByLabelText('Observaciones iniciales'), 'Uña del pie derecho');    await user.click(screen.getByRole('button', { name: 'Registrar Muestra' }));

    // DIAG-02 paso 7: the screen lands on the analysis of the new sample.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'García, Ana' }),
    ).toBeInTheDocument();

    const call = fetchMock.mock.calls.find(([url]) => url === '/api/v1/muestras');
    expect(JSON.parse(String((call?.[1] as RequestInit).body))).toEqual({
      paciente_id: 'p-ana',
      tipo_muestra_id: 'm-una',
      tipo_analisis_id: 't-cultivo',
      observaciones: 'Uña del pie derecho',
    });
  });

  it('explains that the patient needs a clinical record first', async () => {
    renderAt('/pacientes/p-ana/muestras/nueva', {
      '/api/v1/muestras': () =>
        Promise.resolve(
          jsonResponse(
            {
              detail:
                'El paciente no tiene ficha clínica: registrá la consulta antes de ingresar la muestra',
              campo: 'ficha_clinica_id',
            },
            400,
          ),
        ),
    });
    const user = userEvent.setup();

    await screen.findByRole('option', { name: 'Uña' });
    await user.selectOptions(screen.getByLabelText('Tipo de muestra'), 'm-una');
    await user.selectOptions(screen.getByLabelText('Tipo de análisis'), 't-cultivo');
    await user.click(screen.getByRole('button', { name: 'Registrar Muestra' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/no tiene ficha clínica/);
  });

  it('says the catalog is incomplete instead of offering empty selects', async () => {
    renderAt('/pacientes/p-ana/muestras/nueva', {
      [TIPOS_MUESTRA_URL]: jsonRoute({ items: [], total: 0, limit: 100, offset: 0 }),
    });

    expect(
      await screen.findByText(/Faltan tipos de muestra o de análisis/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Registrar Muestra' })).toBeDisabled();
  });
});
