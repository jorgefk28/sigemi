/**
 * Runtime configuration for API access.
 *
 * The base URL is configurable through `VITE_API_BASE_URL` and defaults to the
 * Vite dev proxy path (`/api/v1`). No secrets are embedded in the bundle.
 */
export const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL ?? '/api/v1';
