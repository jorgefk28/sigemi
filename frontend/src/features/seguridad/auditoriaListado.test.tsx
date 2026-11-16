import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../App';
import { jsonResponse, jsonRoute, stubFetchRouter } from '../../test/fixtures';
import { adminSession, anaActiva, betoActivo } from '../../test/accessFixtures';
import {
  auditoriaPage,
  eventoAcceder,
  eventoCrear,
  eventoSinIp,
  usuariosSelector,
} from '../../test/auditoriaFixtures';
import type { AuditoriaEvento } from '../../api/auditoria';

const TOKEN = 'token-admin';
const ME_URL = '/api/v1/auth/me';
const USERS_URL = '/api/v1/usuarios?limit=100&offset=0';
const LISTA_URL = '/api/v1/auditoria?limit=20&offset=0';
const TABLA = 'Registro de auditoría';

const FORMATO_FECHA = /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/;

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

/** Render the app, open Administración → Auditoría, and hand back the user. */
async function abrirAuditoria() {
  const user = userEvent.setup();
  await screen.findByRole('button', { name: 'Panel de Control' });
  await user.click(screen.getByRole('button', { name: 'Auditoría' }));
  return user;
}

function fila(nombre: string) {
  return screen.getByRole('row', { name: new RegExp(nombre) });
}

describe('SEG-U04 listado de auditoría', () => {
  it('lists each event with the formatted date, resolved user and Spanish action label', async () => {
    arrancar({ [LISTA_URL]: jsonRoute(auditoriaPage([eventoCrear, eventoAcceder])) });
    render(<App />);
    await abrirAuditoria();

    expect(await screen.findByRole('columnheader', { name: 'Fecha y hora' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Usuario' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Módulo' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Acción' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Entidad afectada' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Dirección IP' })).toBeInTheDocument();

    // R4: ISO-8601 UTC rendered as the viewer's local `dd/MM/yyyy HH:mm`.
    const ana = fila('Ana García');
    expect(within(ana).getByText(FORMATO_FECHA)).toHaveTextContent(/^12\/11\/2026 /);
    expect(within(ana).getByText('Crear')).toBeInTheDocument();
    expect(within(ana).getByText('192.168.1.10')).toBeInTheDocument();

    // accion `acceder` renders its closed-catalog label, not the raw code.
    expect(within(fila('Beto López')).getByText('Acceder')).toBeInTheDocument();
  });

  it('shows `—` for an event whose IP was not captured', async () => {
    arrancar({ [LISTA_URL]: jsonRoute(auditoriaPage([eventoSinIp])) });
    render(<App />);
    await abrirAuditoria();

    expect(await screen.findByText('—')).toBeInTheDocument();
  });

  it('requests the pinned envelope with the bearer token and reports the range', async () => {
    const mock = arrancar({
      [LISTA_URL]: jsonRoute(auditoriaPage([eventoCrear], { total: 2 })),
    });
    render(<App />);
    await abrirAuditoria();

    expect(await screen.findByText('Mostrando 1–1 de 2')).toBeInTheDocument();
    expect(mock).toHaveBeenCalledWith(
      LISTA_URL,
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
      }),
    );
  });

  it('filters by action from the closed catalog and applies on change', async () => {
    const mock = arrancar({
      [LISTA_URL]: jsonRoute(auditoriaPage([eventoCrear, eventoAcceder])),
      '/api/v1/auditoria?accion=crear&limit=20&offset=0': jsonRoute(
        auditoriaPage([eventoCrear], { total: 1 }),
      ),
    });
    render(<App />);
    const user = await abrirAuditoria();

    await screen.findByRole('row', { name: /Ana García/ });
    await user.selectOptions(screen.getByLabelText('Tipo de acción'), 'crear');

    await waitFor(() =>
      expect(screen.queryByRole('row', { name: /Beto López/ })).not.toBeInTheDocument(),
    );
    expect(mock).toHaveBeenCalledWith(
      '/api/v1/auditoria?accion=crear&limit=20&offset=0',
      expect.anything(),
    );
  });

  it('filters by user from the selector', async () => {
    const mock = arrancar({
      [LISTA_URL]: jsonRoute(auditoriaPage([eventoCrear, eventoAcceder])),
      '/api/v1/auditoria?usuario_id=u-beto&limit=20&offset=0': jsonRoute(
        auditoriaPage([eventoAcceder], { total: 1 }),
      ),
    });
    render(<App />);
    const user = await abrirAuditoria();

    await screen.findByRole('row', { name: /Ana García/ });
    await user.selectOptions(screen.getByLabelText('Usuario'), 'u-beto');

    await waitFor(() =>
      expect(screen.queryByRole('row', { name: /Ana García/ })).not.toBeInTheDocument(),
    );
    expect(mock).toHaveBeenCalledWith(
      '/api/v1/auditoria?usuario_id=u-beto&limit=20&offset=0',
      expect.anything(),
    );
  });

  it('filters by date range on submit', async () => {
    const mock = arrancar({
      [LISTA_URL]: jsonRoute(auditoriaPage([eventoCrear])),
      '/api/v1/auditoria?fecha_desde=2026-11-01&fecha_hasta=2026-11-30&limit=20&offset=0':
        jsonRoute(auditoriaPage([eventoCrear], { total: 1 })),
    });
    render(<App />);
    const user = await abrirAuditoria();

    await screen.findByRole('row', { name: /Ana García/ });
    fireEvent.change(screen.getByLabelText('Fecha desde'), {
      target: { value: '2026-11-01' },
    });
    fireEvent.change(screen.getByLabelText('Fecha hasta'), {
      target: { value: '2026-11-30' },
    });
    await user.click(screen.getByRole('button', { name: 'Buscar' }));

    await waitFor(() =>
      expect(mock).toHaveBeenCalledWith(
        '/api/v1/auditoria?fecha_desde=2026-11-01&fecha_hasta=2026-11-30&limit=20&offset=0',
        expect.anything(),
      ),
    );
  });

  it('shows the empty state when no event is registered and no filter is applied', async () => {
    arrancar({ [LISTA_URL]: jsonRoute(auditoriaPage([])) });
    render(<App />);
    await abrirAuditoria();

    expect(await screen.findByText('No hay eventos registrados')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).not.toBeInTheDocument();
  });

  it('shows the no-coincidence state and Limpiar filtros when a filtered search is empty', async () => {
    arrancar({
      [LISTA_URL]: jsonRoute(auditoriaPage([eventoCrear])),
      '/api/v1/auditoria?accion=bloquear&limit=20&offset=0': jsonRoute(auditoriaPage([])),
    });
    render(<App />);
    const user = await abrirAuditoria();

    await screen.findByRole('row', { name: /Ana García/ });
    await user.selectOptions(screen.getByLabelText('Tipo de acción'), 'bloquear');

    expect(await screen.findByText('No se encontraron eventos')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Limpiar filtros' })).toBeInTheDocument();
  });

  it('shows the load error and recovers with Reintentar', async () => {
    let llamadas = 0;
    arrancar({
      [LISTA_URL]: () => {
        llamadas += 1;
        return llamadas === 1
          ? Promise.reject(new Error('offline'))
          : Promise.resolve(jsonResponse(auditoriaPage([eventoCrear])));
      },
    });
    render(<App />);
    const user = await abrirAuditoria();

    expect(
      await screen.findByText('No se pudo cargar el registro de auditoría'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('row', { name: /Ana García/ })).toBeInTheDocument();
  });

  it('redirects to the start page on 403 instead of showing a raw error', async () => {
    arrancar({ [LISTA_URL]: jsonResponse({ detail: 'No autorizado' }, 403) });
    render(<App />);
    await abrirAuditoria();

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Estado operativo del laboratorio' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('No se pudo cargar el registro de auditoría'),
    ).not.toBeInTheDocument();
  });

  it('shows a table skeleton while loading and never an invented row', async () => {
    let resolver: (response: Response) => void = () => {};
    const pendiente = new Promise<Response>((resolve) => {
      resolver = resolve;
    });
    arrancar({ [LISTA_URL]: () => pendiente });
    render(<App />);
    await abrirAuditoria();

    const tabla = await screen.findByRole('table', { name: TABLA });
    expect(tabla).toHaveAttribute('aria-busy', 'true');
    expect(within(tabla).getAllByRole('row')).toHaveLength(1);

    resolver(jsonResponse(auditoriaPage([eventoCrear])));

    expect(await screen.findByRole('row', { name: /Ana García/ })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: TABLA })).toHaveAttribute('aria-busy', 'false');
  });

  it('exposes only Ver detalle as the row action: the log is immutable', async () => {
    arrancar({ [LISTA_URL]: jsonRoute(auditoriaPage([eventoCrear])) });
    render(<App />);
    await abrirAuditoria();

    await screen.findByRole('row', { name: /Ana García/ });
    const ana = fila('Ana García');
    expect(
      within(ana).getByRole('button', { name: 'Ver detalle de Ana García' }),
    ).toBeInTheDocument();
    // R1: no edit or delete exists for the append-only log.
    expect(
      screen.queryByRole('button', { name: /Editar|Desactivar|Eliminar|Borrar/ }),
    ).not.toBeInTheDocument();
  });

  it('advances with Siguiente and comes back with Anterior', async () => {
    const veinte: AuditoriaEvento[] = Array.from({ length: 20 }, (_, indice) => ({
      ...eventoCrear,
      id: `a-${indice}`,
      usuario_nombre: `Usuario${indice}`,
      usuario_apellido: 'Prueba',
    }));
    const diez: AuditoriaEvento[] = Array.from({ length: 10 }, (_, indice) => ({
      ...eventoCrear,
      id: `a-resto-${indice}`,
      usuario_nombre: `Resto${indice}`,
      usuario_apellido: 'Prueba',
    }));
    arrancar({
      [LISTA_URL]: jsonRoute(auditoriaPage(veinte, { total: 30 })),
      '/api/v1/auditoria?limit=20&offset=20': jsonRoute(
        auditoriaPage(diez, { total: 30, offset: 20 }),
      ),
    });
    render(<App />);
    const user = await abrirAuditoria();

    expect(await screen.findByText('Mostrando 1–20 de 30')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Siguiente' }));

    expect(await screen.findByText('Mostrando 21–30 de 30')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Anterior' }));
    expect(await screen.findByText('Mostrando 1–20 de 30')).toBeInTheDocument();
  });
});