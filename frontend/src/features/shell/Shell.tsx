import { useCallback } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { PageShell } from '../../components/PageShell';
import { Sidebar } from '../../components/Sidebar';
import { UserMenu } from '../../components/UserMenu';
import { useAuth } from '../../session/auth';
import { DashboardPage } from '../dashboard/DashboardPage';
import { PlaceholderPage } from '../placeholder/PlaceholderPage';
import { ChangePasswordPage } from '../profile/ChangePasswordPage';
import { ProfilePage } from '../profile/ProfilePage';
import { AuditoriaPage } from '../seguridad/AuditoriaPage';
import { UsuariosPage } from '../seguridad/UsuariosPage';
import {
  accountRouteByPath,
  canSeePage,
  findPage,
  groupOf,
  homePath,
  pageByPath,
  visibleGroups,
} from '../navigation/navigation';

/**
 * Authenticated shell: composes `PageShell` + `Sidebar` + the active page.
 *
 * The active page is derived from the URL, not from component state, so a
 * reload, a deep link and the browser back button all resolve to the same
 * screen. An unknown or forbidden path is answered with a redirect to the
 * landing page — never with a raw 403 on screen (R2).
 */
export function Shell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const goHome = useCallback(() => {
    if (user) {
      navigate(homePath(user.roles), { replace: true });
    }
  }, [navigate, user]);

  if (!user) {
    // Unreachable under RequireAuth; defensive.
    return null;
  }

  const home = homePath(user.roles);
  const page = pageByPath(location.pathname);
  const account = accountRouteByPath(location.pathname);

  if (!page && !account) {
    return <Navigate to={home} replace />;
  }
  if (page && !canSeePage(page, user.roles)) {
    return <Navigate to={home} replace />;
  }

  const groups = visibleGroups(user.roles);
  const activeGroup = page ? groupOf(page.id) : undefined;

  return (
    <PageShell
      sidebar={
        <Sidebar
          user={user}
          groups={groups}
          activePageId={page?.id ?? ''}
          onSelectPage={(id) => {
            const target = findPage(id);
            if (target) {
              navigate(target.path);
            }
          }}
          onLogout={logout}
        />
      }
      breadcrumb={{
        section: account?.section ?? activeGroup?.label ?? '',
        title: account?.title ?? page?.title ?? '',
      }}
      actions={<UserMenu user={user} onOpenProfile={() => navigate('/perfil')} />}
    >
      {location.pathname === '/perfil/contrasena' ? (
        <ChangePasswordPage />
      ) : location.pathname === '/perfil' ? (
        <ProfilePage />
      ) : page?.id === 'dashboard' ? (
        <DashboardPage />
      ) : page?.id === 'usuarios' ? (
        <UsuariosPage onForbidden={goHome} />
      ) : page?.id === 'auditoria' ? (
        <AuditoriaPage onForbidden={goHome} />
      ) : (
        <PlaceholderPage title={page?.title ?? ''} />
      )}
    </PageShell>
  );
}
