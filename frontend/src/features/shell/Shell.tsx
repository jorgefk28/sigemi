import { useState } from 'react';
import { PageShell } from '../../components/PageShell';
import { Sidebar } from '../../components/Sidebar';
import { useAuth } from '../../session/auth';
import { DashboardPage } from '../dashboard/DashboardPage';
import { PlaceholderPage } from '../placeholder/PlaceholderPage';
import {
  DEFAULT_PAGE_ID,
  findPage,
  groupOf,
  visibleGroups,
} from '../navigation/navigation';

/**
 * Authenticated shell: composes `PageShell` + `Sidebar` + the active page.
 * Owns the selected page state and maps the user's roles to visible groups.
 */
export function Shell() {
  const { user, logout } = useAuth();
  const [activePageId, setActivePageId] = useState<string>(() => {
    // Land on the first visible page: Panel de Control for administrators and
    // biochemists, the first permitted page for narrower roles.
    const groups = user ? visibleGroups(user.roles) : [];
    return groups[0]?.pages[0]?.id ?? DEFAULT_PAGE_ID;
  });

  if (!user) {
    // Unreachable under RequireAuth; defensive.
    return null;
  }

  const groups = visibleGroups(user.roles);
  const activePage = findPage(activePageId) ?? findPage(DEFAULT_PAGE_ID)!;
  const activeGroup = groupOf(activePage.id);

  return (
    <PageShell
      sidebar={
        <Sidebar
          user={user}
          groups={groups}
          activePageId={activePage.id}
          onSelectPage={setActivePageId}
          onLogout={logout}
        />
      }
      breadcrumb={{
        section: activeGroup?.label ?? '',
        title: activePage.title,
      }}
    >
      {activePage.id === 'dashboard' ? (
        <DashboardPage />
      ) : (
        <PlaceholderPage title={activePage.title} />
      )}
    </PageShell>
  );
}
