import { API_BASE_URL } from './config';

/** Response of a successful login (backend `Token` schema). */
export interface TokenResponse {
  access_token: string;
  token_type?: string;
  expires_in: number;
}

/** Current user as exposed by `GET /auth/me` (backend `UsuarioRead` schema). */
export interface User {
  id: string;
  nombre: string;
  apellido: string;
  correo_electronico: string;
  estado: string;
  roles: string[];
}

/** Authentication error carrying an optional HTTP status for mapping. */
export class AuthError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

const LOGIN_URL = `${API_BASE_URL}/auth/login`;
const ME_URL = `${API_BASE_URL}/auth/me`;

const NETWORK_ERROR_MESSAGE = 'No se pudo conectar con el servidor';

/** Build the `application/x-www-form-urlencoded` body required by the backend. */
function encodeCredentials(username: string, password: string): string {
  return new URLSearchParams({ username, password }).toString();
}

/** Map a non-successful status code to the exact backend `detail` message. */
function messageForStatus(status: number): string {
  switch (status) {
    case 401:
      return 'Credenciales inválidas';
    case 403:
      return 'Usuario inactivo';
    case 423:
      return 'Usuario bloqueado temporalmente';
    default:
      return 'Error inesperado del servidor';
  }
}

/** Extract the backend `detail` string when the body is JSON with one. */
async function readDetail(response: Response): Promise<string | null> {
  try {
    const body: unknown = await response.json();
    if (
      typeof body === 'object' &&
      body !== null &&
      'detail' in body &&
      typeof (body as { detail: unknown }).detail === 'string'
    ) {
      return (body as { detail: string }).detail;
    }
  } catch {
    // Not JSON: fall back to the status-code mapping below.
  }
  return null;
}

/**
 * Authenticate with email + password.
 *
 * The backend consumes `application/x-www-form-urlencoded` (FastAPI
 * `OAuth2PasswordRequestForm`), so the body is NOT JSON.
 */
export async function login(
  username: string,
  password: string,
): Promise<TokenResponse> {
  let response: Response;
  try {
    response = await fetch(LOGIN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: encodeCredentials(username, password),
    });
  } catch {
    throw new AuthError(NETWORK_ERROR_MESSAGE);
  }

  if (!response.ok) {
    const detail = await readDetail(response);
    throw new AuthError(detail ?? messageForStatus(response.status), response.status);
  }

  return (await response.json()) as TokenResponse;
}

/** Fetch the current user for the given bearer token. */
export async function fetchMe(token: string): Promise<User> {
  let response: Response;
  try {
    response = await fetch(ME_URL, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new AuthError(NETWORK_ERROR_MESSAGE);
  }

  if (!response.ok) {
    const detail = await readDetail(response);
    throw new AuthError(detail ?? messageForStatus(response.status), response.status);
  }

  return (await response.json()) as User;
}
