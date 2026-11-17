import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthError, fetchMe, type User } from '../../api/auth';
import { Btn } from '../../components/Btn';
import { useAuth } from '../../session/auth';
import { loadToken } from '../../session/sessionStore';
import { roleLabel } from '../navigation/navigation';

/**
 * SEG-U08 · Mi perfil (P2).
 *
 * Backing requirement: UCE-SEG-08 paso 1. The screen only reads the account the
 * token belongs to: `GET /auth/me` derives it from the token and accepts no id,
 * so there is nothing the UI could point at another user (R2). Nothing here is
 * editable — no UCE backs editing own data, and the roles are a closed catalog
 * (R4).
 */

const STATE_LABELS: Record<string, string> = {
  activo: 'Activo',
  inactivo: 'Inactivo',
};

function stateLabel(estado: string): string {
  return STATE_LABELS[estado] ?? estado;
}

function DataRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex border-b border-gray-100 px-3 py-2 last:border-0">
      <dt className="w-48 shrink-0 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </dt>
      <dd className="text-sm text-gray-800">{children}</dd>
    </div>
  );
}

export function ProfilePage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const token = loadToken();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    if (!token) {
      logout();
      return;
    }

    setLoading(true);
    setFailed(false);

    fetchMe(token)
      .then((me) => {
        if (!cancelled) {
          setUser(me);
        }
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        // A rejected token means the session is gone: the profile is the
        // account itself, so there is no "forbidden" state to show (R2).
        if (error instanceof AuthError && (error.status === 401 || error.status === 403)) {
          logout();
          return;
        }
        setUser(null);
        setFailed(true);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token, attempt, logout]);

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-[28px] font-bold leading-tight tracking-tight text-gray-900">
          Mi perfil
        </h1>
        <div className="flex shrink-0 items-center gap-2">
          <Btn onClick={() => navigate('/perfil/contrasena')}>Cambiar contraseña</Btn>
          <Btn onClick={logout}>Cerrar sesión</Btn>
        </div>
      </div>

      <div className="mt-6 max-w-2xl overflow-hidden rounded-md border border-gray-200 bg-white">
        {loading ? (
          <div role="status" aria-live="polite" className="px-3 py-6 text-sm text-muted">
            Cargando…
          </div>
        ) : failed ? (
          <div className="px-3 py-6">
            <p className="text-sm text-gray-800">No se pudieron cargar tus datos</p>
            <Btn className="mt-2" onClick={() => setAttempt((valor) => valor + 1)}>
              Reintentar
            </Btn>
          </div>
        ) : user ? (
          <dl aria-label="Datos de la cuenta">
            <DataRow label="Nombre y apellido">
              {user.nombre} {user.apellido}
            </DataRow>
            <DataRow label="Correo">{user.correo_electronico}</DataRow>
            {/* R4: every role is shown, never just the first one. */}
            <DataRow label="Roles">
              {user.roles.length > 0 ? user.roles.map(roleLabel).join(', ') : '—'}
            </DataRow>
            <DataRow label="Estado">{stateLabel(user.estado)}</DataRow>
          </dl>
        ) : null}
      </div>
    </div>
  );
}
