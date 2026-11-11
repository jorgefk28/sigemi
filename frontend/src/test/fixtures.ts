import { vi } from 'vitest';
import type { User } from '../api/auth';

/** A representative backend `UsuarioRead` payload. */
export const userFixture: User = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  nombre: 'Ana',
  apellido: 'García',
  correo_electronico: 'ana.garcia@unam.edu.ar',
  estado: 'activo',
  roles: ['bioquimico'],
};

/** Build a JSON `Response` for a mocked `fetch`. */
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Stub global `fetch` with a URL router. Values may be a `Response` or a
 * factory returning one (or rejecting). Unexpected URLs reject.
 */
export function stubFetchRouter(routes: Record<string, Response | (() => Promise<Response>)>) {
  const mock = vi.fn((input: unknown, _init?: unknown): Promise<Response> => {
    const url = String(input);
    const route = routes[url];
    if (route === undefined) {
      return Promise.reject(new Error(`Unexpected fetch URL: ${url}`));
    }
    return typeof route === 'function' ? route() : Promise.resolve(route);
  });
  vi.stubGlobal('fetch', mock);
  return mock;
}
