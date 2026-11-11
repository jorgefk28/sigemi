import { describe, expect, it, vi } from 'vitest';
import { AuthError, fetchMe, login } from './auth';
import { jsonResponse, userFixture } from '../test/fixtures';

function stubFetch(impl: (input: string, init?: RequestInit) => Promise<Response>) {
  const mock = vi.fn(impl);
  vi.stubGlobal('fetch', mock);
  return mock;
}

describe('login', () => {
  it('encodes credentials as application/x-www-form-urlencoded', async () => {
    const fetchMock = stubFetch(() =>
      Promise.resolve(jsonResponse({ access_token: 'token-1', expires_in: 3600 })),
    );

    await login('ana@unam.edu.ar', 'clave123');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/v1/auth/login');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toEqual({ 'Content-Type': 'application/x-www-form-urlencoded' });
    expect(init?.body).toBe('username=ana%40unam.edu.ar&password=clave123');
  });

  it.each([
    [401, 'Credenciales inválidas'],
    [403, 'Usuario inactivo'],
    [423, 'Usuario bloqueado temporalmente'],
  ])('maps status %i to "%s"', async (status, message) => {
    stubFetch(() => Promise.resolve(jsonResponse({ detail: message }, status)));

    const error = await login('ana@unam.edu.ar', 'wrong').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AuthError);
    expect((error as AuthError).message).toBe(message);
    expect((error as AuthError).status).toBe(status);
  });

  it('maps a status code to its message when the body has no detail', async () => {
    stubFetch(() => Promise.resolve(new Response('', { status: 401 })));

    const error = await login('ana@unam.edu.ar', 'wrong').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AuthError);
    expect((error as AuthError).message).toBe('Credenciales inválidas');
  });

  it('reports a network failure as "No se pudo conectar con el servidor"', async () => {
    stubFetch(() => Promise.reject(new TypeError('Network request failed')));

    const error = await login('ana@unam.edu.ar', 'clave123').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AuthError);
    expect((error as AuthError).message).toBe('No se pudo conectar con el servidor');
    expect((error as AuthError).status).toBeUndefined();
  });
});

describe('fetchMe', () => {
  it('sends the bearer token to /auth/me', async () => {
    const fetchMock = stubFetch(() => Promise.resolve(jsonResponse(userFixture)));

    await fetchMe('token-abc');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/v1/auth/me');
    expect(init?.method).toBe('GET');
    expect(init?.headers).toEqual({ Authorization: 'Bearer token-abc' });
  });

  it('reports a network failure as "No se pudo conectar con el servidor"', async () => {
    stubFetch(() => Promise.reject(new TypeError('Network request failed')));

    const error = await fetchMe('token-abc').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AuthError);
    expect((error as AuthError).message).toBe('No se pudo conectar con el servidor');
  });
});
