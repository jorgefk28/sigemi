import { describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../App';
import { jsonResponse, jsonRoute, stubFetchRouter } from '../../test/fixtures';
import { adminSession, anaActiva, betoActivo } from '../../test/accessFixtures';
import {
  auditoriaPage,
  cambiosDeEdicion,
  detalleConContrasena,
  detalleSinCambios,
  eventoAcceder,
  eventoCrear,
  usuariosSelector,
} from '../../test/auditoriaFixtures';
import type { AuditoriaDetalle } from '../../api/auditoria';

const TOKEN = 'token-admin';
const ME_URL = '/api/v1/auth/me';
const USERS_URL = '/api/v1/usuarios?limit=100&offset=0';
const LISTA_URL = '/api/v1/auditoria?limit=20&offset=0';
const DETALLE_URL = '/api/v1/auditoria/a-crear';

const FORMATO_FECHA = /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/;

const detalleCompleto: AuditoriaDetalle = {
  ...eventoCrear,
  entidad_id: '99999999-aaaa-bbbb-cccc-dddddddddddd',
  cambios: cambiosDeEdicion,
};

type Route = Response | (() => Promise<Response>);

/** Stub the network for a signed-in administrator and return the fetch mock. */
function arrancar(routes: Record<string, Route>) {
  sessionStorage.setItem('sigemi.access_token', TOKEN);
  return stubFetchRouter({
    [ME_URL]: jsonRoute(adminSession),
    [USERS_URL]: jsonRoute(usuariosSelector([anaActiva, betoActivo])),
    ...routes,
  });
}

/** Open the list and enter the detail of Ana García's event. */
async function abrirDetalle() {
  const user = userEvent.setup();
  await screen.findByRole('button', { name: 'Panel de Control' });
  await user.click(screen.getByRole('button', { name: 'Auditoría' }));
  await screen.findByRole('row', { name: /Ana García/ });
  await user.click(screen.getByRole('button', { name: 'Ver detalle de Ana García' }));
  return user;
}

describe('SEG-U05 detalle de evento de auditoría', () => {
  it('shows the event header with every declared field', async () => {
    arrancar({
      [LISTA_URL]: jsonRoute(auditoriaPage([eventoCrear])),
      [DETALLE_URL]: jsonRoute(detalleCompleto),
    });
    render(<App />);
    await abrirDetalle();

    expect(await screen.findByRole('heading', { name: 'Detalle del evento' })).toBeInTheDocument();
    // The header block renders only once the event loads; wait for its first field.
    await screen.findByText('Fecha y hora');
    for (const etiqueta of [
      'Fecha y hora',
      'Usuario',
      'Módulo',
      'Acción',
      'Entidad afectada',
      'Identificador de entidad',
      'Dirección IP',
    ]) {
      expect(screen.getByText(etiqueta)).toBeInTheDocument();
    }

    expect(screen.getByText(FORMATO_FECHA)).toHaveTextContent(/^12\/11\/2026 /);
    expect(screen.getByText('Ana García')).toBeInTheDocument();
    expect(screen.getByText('seguridad')).toBeInTheDocument();
    expect(screen.getByText('Crear')).toBeInTheDocument();
    expect(screen.getByText('192.168.1.10')).toBeInTheDocument();
    expect(screen.getByText(detalleCompleto.entidad_id)).toBeInTheDocument();
  });

  it('renders the field-change table with previous and new values', async () => {
    arrancar({
      [LISTA_URL]: jsonRoute(auditoriaPage([eventoCrear])),
      [DETALLE_URL]: jsonRoute(detalleCompleto),
    });
    render(<App />);
    await abrirDetalle();

    // Wait for a data row: the header columns alone also appear in the skeleton.
    const filaNombre = await screen.findByRole('row', { name: /nombre/ });
    expect(screen.getByRole('columnheader', { name: 'Campo' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Valor anterior' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Valor nuevo' })).toBeInTheDocument();
    expect(within(filaNombre).getByText('Ana Viejo')).toBeInTheDocument();
    expect(within(filaNombre).getByText('Ana')).toBeInTheDocument();

    const filaEstado = screen.getByRole('row', { name: /estado/ });
    expect(within(filaEstado).getByText('inactivo')).toBeInTheDocument();
  });

  it('labels a masked password change as Contraseña actualizada and never shows the hash', async () => {
    arrancar({
      [LISTA_URL]: jsonRoute(auditoriaPage([eventoCrear])),
      [DETALLE_URL]: jsonRoute(detalleConContrasena),
    });
    render(<App />);
    await abrirDetalle();

    expect(await screen.findByText('Contraseña actualizada')).toBeInTheDocument();
    expect(screen.queryByText('contrasena_hash')).not.toBeInTheDocument();
    expect(screen.queryByText('contrasena')).not.toBeInTheDocument();
  });

  it('shows Evento sin cambios de campo registrados when the event has no changes', async () => {
    arrancar({
      [LISTA_URL]: jsonRoute(auditoriaPage([eventoCrear])),
      [DETALLE_URL]: jsonRoute(detalleSinCambios),
    });
    render(<App />);
    await abrirDetalle();

    expect(
      await screen.findByText('Evento sin cambios de campo registrados'),
    ).toBeInTheDocument();
  });

  it('shows No se encontró el evento with Volver when the event does not exist', async () => {
    arrancar({
      [LISTA_URL]: jsonRoute(auditoriaPage([eventoCrear])),
      [DETALLE_URL]: jsonResponse({ detail: 'No se encontró el evento' }, 404),
    });
    render(<App />);
    await abrirDetalle();

    expect(await screen.findByText('No se encontró el evento')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Volver' })).toBeInTheDocument();
  });

  it('Volver returns to the list conserving the applied filters', async () => {
    const mock = arrancar({
      [LISTA_URL]: jsonRoute(auditoriaPage([eventoCrear, eventoAcceder])),
      '/api/v1/auditoria?accion=crear&limit=20&offset=0': jsonRoute(
        auditoriaPage([eventoCrear], { total: 1 }),
      ),
      [DETALLE_URL]: jsonRoute(detalleSinCambios),
    });
    render(<App />);

    const user = userEvent.setup();
    await screen.findByRole('button', { name: 'Panel de Control' });
    await user.click(screen.getByRole('button', { name: 'Auditoría' }));

    await screen.findByRole('row', { name: /Beto López/ });
    await user.selectOptions(screen.getByLabelText('Tipo de acción'), 'crear');
    await waitFor(() =>
      expect(screen.queryByRole('row', { name: /Beto López/ })).not.toBeInTheDocument(),
    );

    await user.click(screen.getByRole('button', { name: 'Ver detalle de Ana García' }));
    await screen.findByRole('heading', { name: 'Detalle del evento' });

    await user.click(screen.getByRole('button', { name: 'Volver' }));

    // The filter survives the round-trip: the control keeps its value and the
    // re-queried list only shows the filtered event.
    expect(await screen.findByRole('row', { name: /Ana García/ })).toBeInTheDocument();
    expect(screen.queryByRole('row', { name: /Beto López/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Tipo de acción')).toHaveValue('crear');
    expect(mock).toHaveBeenCalledWith(
      '/api/v1/auditoria?accion=crear&limit=20&offset=0',
      expect.anything(),
    );
  });

  it('redirects to the start page on 403 instead of showing a raw error', async () => {
    arrancar({
      [LISTA_URL]: jsonRoute(auditoriaPage([eventoCrear])),
      [DETALLE_URL]: jsonResponse({ detail: 'No autorizado' }, 403),
    });
    render(<App />);
    await abrirDetalle();

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Estado operativo del laboratorio' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('No se encontró el evento')).not.toBeInTheDocument();
  });

  it('shows a skeleton while the event loads', async () => {
    let resolver: (response: Response) => void = () => {};
    const pendiente = new Promise<Response>((resolve) => {
      resolver = resolve;
    });
    arrancar({
      [LISTA_URL]: jsonRoute(auditoriaPage([eventoCrear])),
      [DETALLE_URL]: () => pendiente,
    });
    render(<App />);
    await abrirDetalle();

    const tabla = await screen.findByRole('table', { name: 'Cambios de campos' });
    expect(tabla).toHaveAttribute('aria-busy', 'true');

    resolver(jsonResponse(detalleSinCambios));

    expect(
      await screen.findByText('Evento sin cambios de campo registrados'),
    ).toBeInTheDocument();
  });
});