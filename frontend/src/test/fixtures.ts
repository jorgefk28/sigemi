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
 * Route factory that builds a fresh `Response` per request. A `Response` body
 * can be read only once, so a URL hit more than once needs this instead of a
 * single `jsonResponse` instance.
 */
export function jsonRoute(body: unknown, status = 200): () => Promise<Response> {
  return () => Promise.resolve(jsonResponse(body, status));
}

/** A route answers either a fixed `Response` or a factory that builds one. */
export type RouteHandler = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * Stub global `fetch` with a URL router. Values may be a `Response` or a
 * factory returning one (or rejecting). A factory receives the URL and the
 * request init, so a route can answer `GET` and `PATCH` differently.
 * Unexpected URLs reject.
 */
export function stubFetchRouter(routes: Record<string, Response | RouteHandler>) {
  const mock = vi.fn((input: unknown, init?: unknown): Promise<Response> => {
    const url = String(input);
    const route = routes[url];
    if (route === undefined) {
      return Promise.reject(new Error(`Unexpected fetch URL: ${url}`));
    }
    return typeof route === 'function'
      ? route(url, init as RequestInit | undefined)
      : Promise.resolve(route);
  });
  vi.stubGlobal('fetch', mock);
  return mock;
}
