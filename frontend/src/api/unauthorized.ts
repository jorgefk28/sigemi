/**
 * Expired-session signal shared by the HTTP layer and the session provider.
 *
 * The boot sequence is not the only moment the token can expire: `expires_in`
 * is one hour, so any screen can receive a `401` mid-session. Handling it per
 * screen would mean copying a redirect into every feature; handling it nowhere
 * leaves the user with a "Reintentar" that can never succeed.
 *
 * `apiRequest` reports the `401` here once; `AuthProvider` registers the logout
 * that sends the browser back to `/login`.
 */

type UnauthorizedHandler = () => void;

let handler: UnauthorizedHandler | null = null;

/** Register the handler. Returns an unsubscribe function. */
export function onUnauthorized(next: UnauthorizedHandler): () => void {
  handler = next;
  return () => {
    if (handler === next) {
      handler = null;
    }
  };
}

/** Called by the HTTP layer when a request carrying a token answers `401`. */
export function notifyUnauthorized(): void {
  handler?.();
}
