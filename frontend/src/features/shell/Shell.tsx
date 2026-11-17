import { useEffect } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { MAIN_CONTENT_ID, PageShell } from '../../components/PageShell';
import { Sidebar } from '../../components/Sidebar';
import { UserMenu } from '../../components/UserMenu';
import { useAuth } from '../../session/auth';
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
 * Authenticated layout: `PageShell` + `Sidebar` + the routed page in `<Outlet/>`.
 *
 * The active page is derived from the URL, not from component state, so a
 * reload, a deep link and the browser back button all resolve to the same
 * screen. A module path the user's roles cannot see (or a path inside a module)
 * is answered with a redirect to the landing page — never with a raw 403 (R2).
 */
export function Shell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const page = user ? pageByPath(location.pathname) : undefined;
  const account = user ? accountRouteByPath(location.pathname) : undefined;

  // SPA hygiene: the document title follows the screen, and focus moves to the
  // body so the next Tab starts inside the new content instead of the chrome.
  useEffect(() => {
    const title = account?.title ?? page?.title;
    if (title) {
      document.title = `${title} · SIGEMI`;
    }
    document.getElementById(MAIN_CONTENT_ID)?.focus();
  }, [location.pathname, page?.title, account?.title]);

  if (!user) {
    // Unreachable under RequireAuth; defensive.
    return null;
  }

  const home = homePath(user.roles);

  // `page` is matched by prefix, so every sub-route of a module (a form, a
  // detail screen) inherits its permission without declaring it again.
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
      <Outlet />
    </PageShell>
  );
}
