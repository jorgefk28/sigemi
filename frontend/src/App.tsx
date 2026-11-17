import { useEffect } from 'react';
import { AuthProvider, useAuth } from './session/auth';
import { setSesion, ToastHost } from './screens/sigemi/core';
import { LoginPage } from './screens/LoginPage';
import { Workspace } from './screens/Workspace';
import { Btn } from './screens/components/ui';

/**
 * Application root.
 *
 * The screen tree belongs to the delivered back-office repository
 * (`odd/tasks/07-frontend-backoffice.md`); this file only decides *who* may see
 * it. Spec S3: nothing renders before the backend confirms the session.
 */
export function App() {
  return (
    <AuthProvider>
      <SessionGate />
    </AuthProvider>
  );
}

function SessionGate() {
  const { status, user, logout, reload } = useAuth();

  // The prototype reads the signed-in operator from a global store; feeding it
  // from `GET /auth/me` keeps every audit entry and role gate on the real user.
  useEffect(() => {
    if (user) {
      setSesion(user);
    }
  }, [user]);

  if (status === 'loading') {
    return <BootScreen text="Restaurando la sesión…" />;
  }

  if (status === 'unavailable') {
    return (
      <BootScreen text="No se pudo contactar al servidor.">
        <Btn variant="primary" onClick={reload}>
          Reintentar
        </Btn>
      </BootScreen>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <>
        <LoginPage />
        <ToastHost />
      </>
    );
  }

  return (
    <>
      <Workspace onLogout={logout} />
    </>
  );
}

function BootScreen({ text, children }: { text: string; children?: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg px-4">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-[5px] bg-accent text-[15px] font-bold text-white">
          S
        </div>
        <div className="text-[15px] font-bold tracking-[0.03em] text-text-primary">SIGEMI</div>
      </div>
      <p className="m-0 text-[12.5px] text-text-secondary">{text}</p>
      {children}
    </div>
  );
}
