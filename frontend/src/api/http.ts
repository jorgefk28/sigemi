import { API_BASE_URL } from './config';

/**
 * Shared HTTP layer for the authenticated screens.
 *
 * `AGENTS.md` fixes the error shape: every `4xx`/`5xx` answers
 * `{"detail": "<mensaje>"}` and a field-scoped validation carries `campo`. This
 * module turns that body into a typed error so a form can place the message on
 * the field without special cases per endpoint.
 */

export const NETWORK_ERROR_MESSAGE = 'No se pudo conectar con el servidor';

/** A failed request: HTTP status plus, when present, the offending field. */
export class ApiError extends Error {
  readonly status?: number;
  readonly campo?: string;

  constructor(message: string, options: { status?: number; campo?: string } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = options.status;
    this.campo = options.campo;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT';
  /** Bearer token; the backend is the authority and rejects anonymous calls. */
  token: string | null;
  /** JSON body; omitted for `GET`. */
  body?: unknown;
}

interface ErrorBody {
  detail?: unknown;
  campo?: unknown;
}

async function errorFrom(response: Response): Promise<ApiError> {
  let body: ErrorBody | null;
  try {
    body = (await response.json()) as ErrorBody;
  } catch {
    body = null;
  }

  const detail =
    typeof body?.detail === 'string' ? body.detail : 'Error inesperado del servidor';
  const campo = typeof body?.campo === 'string' ? body.campo : undefined;
  return new ApiError(detail, { status: response.status, campo });
}

/** Send one request and decode the JSON answer, throwing `ApiError` on failure. */
export async function apiRequest<T>(path: string, options: RequestOptions): Promise<T> {
  const { method = 'GET', token, body } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new ApiError(NETWORK_ERROR_MESSAGE);
  }

  if (!response.ok) {
    throw await errorFrom(response);
  }

  return (await response.json()) as T;
}
