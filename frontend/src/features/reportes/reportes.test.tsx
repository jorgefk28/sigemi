import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../App';
import { jsonResponse, jsonRoute, stubFetchRouter, userFixture, type RouteHandler } from '../../test/fixtures';

/**
 * REP-U01 · Generador de reportes (P8) and REP-U03 · detalle del indicador.
 *
 * Backing requirement: UCE-REP-01 pasos 1-9, UCE-REP-02 pasos 3-5, RF-15.
 * The pattern's three states are visible: parameters, preview and export. The
 * investment and waste reports are offered disabled with their reason, and the
 * export downloads the whole set (A-10).
 */

const TOKEN_KEY = 'sigemi.access_token';
const ME_URL = '/api/v1/auth/me';
const PREVIA_URL = '/api/v1/reportes/clinico?limit=10';
const EXPORT_URL = '/api/v1/reportes/clinico/exportar';

const preview = {
  items: [
    {
      paciente_clave: 'A1B2C3D4',
      fecha: '2026-11-14',
      tipo_analisis: 'Cultivo de uñas',
      tipo_muestra: 'Uña',
      estado: 'validado',
      edad: 36,
    },
  ],
  total: 1,
  limit: 10,
  offset: 0,
  columnas: ['paciente_clave', 'fecha', 'tipo_analisis', 'tipo_muestra', 'estado', 'edad'],
};

function renderReportes(extra: Record<string, Response | RouteHandler> = {}) {
  sessionStorage.setItem(TOKEN_KEY, 'token-rep');
  window.history.replaceState({}, '', '/reportes');
  const fetchMock = stubFetchRouter({
    [ME_URL]: jsonRoute({ ...userFixture, roles: ['bioquimico'] }),
    [PREVIA_URL]: jsonRoute(preview),
    ...extra,
  });
  render(<App />);
  return fetchMock;
}

describe('REP-U01 generador de reportes', () => {
  it('starts without a preview and asks for the parameters', async () => {
    renderReportes();

    expect(
      await screen.findByText('Configurá los parámetros y generá la previsualización'),
    ).toBeInTheDocument();
    // The export is impossible before generating: there is nothing to export.
    expect(screen.getByRole('button', { name: 'Exportar' })).toBeDisabled();
  });

  it('offers the reports without data as disabled, with the reason', async () => {
    renderReportes();

    await screen.findByLabelText('Tipo de reporte');
    const inventario = screen.getByRole('option', { name: /Inventario/ });
    const desechos = screen.getByRole('option', { name: /Desechos/ });

    expect(inventario).toBeDisabled();
    expect(desechos).toBeDisabled();
    expect(screen.getByRole('option', { name: 'Clínico' })).toBeEnabled();
  });

  it('previews the anonymized set with the declared columns', async () => {
    renderReportes();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Generar Previsualización' }));

    const tabla = await screen.findByRole('table', { name: 'Previsualización del reporte' });
    expect(within(tabla).getByText('A1B2C3D4')).toBeInTheDocument();
    expect(within(tabla).getByText('Cultivo de uñas')).toBeInTheDocument();
    // The header comes from the API's column list, not from the component.
    expect(within(tabla).getByRole('columnheader', { name: 'Paciente (clave)' })).toBeInTheDocument();
    expect(within(tabla).getByRole('columnheader', { name: 'Edad' })).toBeInTheDocument();
    expect(within(tabla).queryByText(/Nombre/)).not.toBeInTheDocument();
  });

  it('reports the empty set with the textual message of REP-01', async () => {
    renderReportes({
      [PREVIA_URL]: jsonRoute({ ...preview, items: [], total: 0 }),
    });
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Generar Previsualización' }));

    expect(
      await screen.findByText(
        'No existen registros transaccionales para los parámetros indicados',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Exportar' })).toBeDisabled();
  });

  it('sends the date filters and drops the preview when a parameter changes', async () => {
    const fetchMock = renderReportes({
      '/api/v1/reportes/clinico?fecha_desde=2026-11-01&limit=10': jsonRoute(preview),
    });
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText('Desde'), '2026-11-01');
    await user.click(screen.getByRole('button', { name: 'Generar Previsualización' }));

    await screen.findByRole('table', { name: 'Previsualización del reporte' });
    expect(
      fetchMock.mock.calls.some(
        ([url]) => url === '/api/v1/reportes/clinico?fecha_desde=2026-11-01&limit=10',
      ),
    ).toBe(true);

    // Changing a parameter invalidates the preview: it no longer describes the
    // export that the button would run.
    await user.type(screen.getByLabelText('Hasta'), '2026-11-30');
    expect(
      screen.queryByRole('table', { name: 'Previsualización del reporte' }),
    ).not.toBeInTheDocument();
  });

  it('downloads the whole set as a file through the export endpoint', async () => {
    const createObjectURL = vi.fn(() => 'blob:reporte');
    const revokeObjectURL = vi.fn();
    // jsdom does not implement the blob URL API; the constructor itself must stay
    // intact (the router uses it), so only the two methods are stubbed.
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = revokeObjectURL as unknown as typeof URL.revokeObjectURL;

    try {
      const fetchMock = renderReportes({
        [EXPORT_URL]: () =>
          Promise.resolve(
            new Response('\ufeffpaciente_clave;fecha\nA1B2C3D4;2026-11-14\n', {
              status: 200,
              headers: { 'Content-Type': 'text/csv; charset=utf-8' },
            }),
          ),
      });
      const user = userEvent.setup();

      await user.click(await screen.findByRole('button', { name: 'Generar Previsualización' }));
      await screen.findByRole('table', { name: 'Previsualización del reporte' });
      await user.click(screen.getByRole('button', { name: 'Exportar' }));

      // REP-01 pasos 7-9: the export is a file, fetched with the bearer token (a
      // plain link could not authenticate) and handed to the browser as a blob.
      await vi.waitFor(() => {
        expect(createObjectURL).toHaveBeenCalledTimes(1);
      });
      const llamada = fetchMock.mock.calls.find(([url]) => url === EXPORT_URL);
      expect(llamada).toBeDefined();
      expect((llamada?.[1] as RequestInit)?.headers).toEqual({
        Authorization: 'Bearer token-rep',
      });
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:reporte');
    } finally {
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
    }
  });

  it('shows the load error with the message of the backend', async () => {
    renderReportes({
      [PREVIA_URL]: () =>
        Promise.resolve(
          jsonResponse(
            {
              detail:
                'El reporte de inventario y el de desechos dependen de un subsistema que todavía no tiene datos',
            },
            400,
          ),
        ),
    });
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Generar Previsualización' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/todavía no tiene datos/);
  });
});

describe('REP-U03 detalle del indicador', () => {
  it('leads from the dashboard card to the module that owns the indicator', async () => {
    sessionStorage.setItem(TOKEN_KEY, 'token-rep');
    window.history.replaceState({}, '', '/panel-control');
    stubFetchRouter({ [ME_URL]: jsonRoute({ ...userFixture, roles: ['bioquimico'] }) });
    render(<App />);
    const user = userEvent.setup();

    await screen.findByRole('heading', { name: 'Estado operativo del laboratorio' });
    // A-10: the indicator detail is navigation, not a screen of its own.
    await user.click(screen.getByRole('link', { name: 'Ver análisis' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Análisis' }),
    ).toBeInTheDocument();
  });
});
