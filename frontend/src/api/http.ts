import { API_BASE_URL } from './config';
import { notifyUnauthorized } from './unauthorized';

/**
 * Shared HTTP layer for the authenticated screens.
 *
 * `AGENTS.md` fixes the error shape: every `4xx`/`5xx` answers
 * `{"detail": "<mensaje>"}` and a field-scoped validation carries `campo`. This
 * module turns that body into a typed error so a form can place the message on
 * the field without special cases per endpoint.
 */

export const NETWORK_ERROR_MESSAGE = 'No se pudo conectar con el servidor';

/** Response envelope every list endpoint answers (`AGENTS.md`). */
export interface Paginated<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Build a query string, dropping the filters that were not applied. Every list
 * endpoint names its filters after the level-3 column, so the caller passes the
 * field name straight through.
 */
export function buildQuery(
  params: Record<string, string | number | undefined | null>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }
    search.set(key, String(value));
  }
  return search.toString();
}

/** Append a query string only when there is one: no trailing `?` on a bare path. */
export function withQuery(path: string, query: string): string {
  return query ? `${path}?${query}` : path;
}

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
    // A `401` on a request that carried a token means the session died while
    // the user was working. One signal, handled once by the session provider,
    // instead of a redirect copied into every screen.
    if (response.status === 401 && token) {
      notifyUnauthorized();
    }
    throw await errorFrom(response);
  }

  // `204 No Content` carries no body: the backend answers it on a successful
  // write that returns nothing (for example `POST /auth/password`).
  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
