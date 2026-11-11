import { describe, expect, it, vi } from 'vitest';

import { login } from './auth';
import { jsonResponse } from '../test/fixtures';

/**
 * Pins the exact request the SPA sends. The backend is FastAPI
 * `OAuth2PasswordRequestForm`: a JSON body or an `email` field is rejected with
 * 422, so the encoding asserted here is part of the real contract.
 */
describe('auth request contract', () => {
  it('sends form-urlencoded credentials with reserved characters escaped', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ access_token: 'token', expires_in: 3600 }));
    vi.stubGlobal('fetch', fetchMock);

    await login('user+test@unam.edu.ar', 'P@ss&word=123%');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [unknown, RequestInit];
    expect(init.headers).toEqual({
      'Content-Type': 'application/x-www-form-urlencoded',
    });
    expect(init.body).toBe(
      'username=user%2Btest%40unam.edu.ar&password=P%40ss%26word%3D123%25',
    );
  });
});
