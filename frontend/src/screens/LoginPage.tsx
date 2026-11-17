import { useState, type FormEvent } from 'react';
import { AuthError } from '../api/auth';
import { useAuth } from '../session/auth';
import { Btn, Field, inputCls } from './components/ui';

/**
 * Session entry point (spec S3). The delivered repository has no login screen,
 * so this one is derived from its design tokens: same palette, same type scale,
 * same Spanish copy. All copy is es-AR.
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
    } catch (err) {
      setError(err instanceof AuthError ? err.message : 'Error inesperado');
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-[360px]">
        <div className="mb-7 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-[5px] bg-accent text-[15px] font-bold tracking-[-0.5px] text-white">
            S
          </div>
          <div>
            <div className="text-[15px] font-bold tracking-[0.03em] text-text-primary">SIGEMI</div>
            <div className="mt-0.5 text-[10.5px] text-text-muted">Lab. Micología · UNaM</div>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          aria-label="Iniciar sesión"
          className="rounded-md border border-border-light bg-surface p-6 shadow-[0_2px_12px_rgba(17,24,39,0.06)]"
        >
          <h1 className="m-0 mb-1 text-[15px] font-bold text-text-primary">Iniciar sesión</h1>
          <p className="m-0 mb-5 text-[12px] text-text-secondary">
            Acceso al back-office del laboratorio.
          </p>

          <div className="mb-4">
            <Field label="Correo electrónico">
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={inputCls}
              />
            </Field>
          </div>

          <div className="mb-4">
            <Field label="Contraseña">
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={inputCls}
              />
            </Field>
          </div>

          {error && (
            <div role="alert" className="mb-4 rounded border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-[12px] text-[#991b1b]">
              {error}
            </div>
          )}

          <Btn type="submit" variant="primary" disabled={submitting} className="w-full justify-center">
            {submitting ? 'Ingresando…' : 'Ingresar'}
          </Btn>
        </form>

        <p className="mt-4 text-center text-[11px] text-text-muted">
          Sistema de Gestión de Micología — UNaM
        </p>
      </div>
    </div>
  );
}
