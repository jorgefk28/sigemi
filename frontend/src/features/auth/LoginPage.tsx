import { useState, type FormEvent } from 'react';
import { AuthError } from '../../api/auth';
import { useAuth } from '../../session/auth';

/**
 * Plain login screen (derived — the Figma prototype has no login view). Uses
 * the same design tokens as the shell. All copy is Spanish (es-AR).
 */
export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      // On success the app transitions to the authenticated area.
    } catch (err) {
      if (err instanceof AuthError) {
        setError(err.message);
      } else {
        setError('Error inesperado');
      }
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded bg-brand text-lg font-bold text-white">
            S
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">SIGEMI</h1>
            <p className="text-xs text-muted">Lab. Micología · UNaM</p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-lg bg-white p-6 shadow-sm"
          aria-label="Iniciar sesión"
        >
          <h2 className="mb-4 text-base font-semibold text-gray-900">
            Iniciar sesión
          </h2>

          <div className="mb-4">
            <label htmlFor="email" className="mb-1 block text-sm text-body">
              Correo electrónico
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
            />
          </div>

          <div className="mb-4">
            <label htmlFor="password" className="mb-1 block text-sm text-body">
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
            />
          </div>

          {error && (
            <div role="alert" className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {submitting ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
}
