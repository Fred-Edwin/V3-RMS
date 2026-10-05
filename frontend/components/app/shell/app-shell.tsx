'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { cn } from '@/lib/cn';
import { performLogout } from '@/lib/logout';
import { MobileTopbar } from './mobile-topbar';
import { ShellNavDrawer } from './shell-nav-drawer';
import { SidebarNav } from './sidebar-nav';
import { Topbar } from './topbar';
import { useShellNav } from './use-shell-nav';

const WENDO_LOGO_SRC = '/images/wendo-logo.jpg';

/**
 * The one desktop shell for every role: the sidebar from the navigation table (`nav-table.ts`) and the content column.
 *
 * - A page whose row is rebuilt draws its own top bar and scrolls itself, so it is passed straight through.
 * - An old page gets a thin breadcrumb top bar above it (group / link) and a scrolling content area. It keeps drawing its own
 *   header and padding; a page that looks wrong in this frame is fixed in its own file, not here.
 *
 * `desktop` shows the shell from `lg` up and nothing below (the legacy bottom-tab layout renders next to it; floor staff in the
 * desktop preview). `responsive` is the shell for the migrated roles at every width: one mount of the page, the sidebar hides
 * below `lg`, and old pages get a phone top bar whose menu button opens the same links as a drawer. Rebuilt screens draw their
 * own phone header and drawer.
 */
export interface AppShellProps {
  mode: 'desktop' | 'responsive';
  children: React.ReactNode;
}

const titleCase = (label: string): string => label.charAt(0) + label.slice(1).toLowerCase();

/** "/app/orders/new" with no row of its own: the last segment, as words. */
const fallbackScreen = (pathname: string): string => {
  const last = pathname.split('/').filter(Boolean).at(-1) ?? 'Home';
  const words = last.replace(/[-_]/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};

export function AppShell({ mode, children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { groups, active, user, orgLabel } = useShellNav();
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  const handleSignOut = React.useCallback(async (): Promise<void> => {
    await performLogout();
    router.replace('/login');
  }, [router]);

  const breadcrumb = React.useMemo(
    () => ({ section: active.groupLabel ? titleCase(active.groupLabel) : 'Wendo RMS', screen: active.label ?? fallbackScreen(pathname) }),
    [active.groupLabel, active.label, pathname]
  );

  return (
    <div className={cn('h-screen min-h-0 w-full bg-wds-canvas print:block print:h-auto', mode === 'desktop' ? 'hidden lg:flex' : 'flex')}>
      <div className={cn('print:hidden', mode === 'desktop' ? 'flex' : 'hidden lg:flex')}>
        <SidebarNav groups={groups} activeKey={active.activeKey} activeSubKey={active.activeSubKey} user={user} orgLabel={orgLabel} logoSrc={WENDO_LOGO_SRC} onSignOut={handleSignOut} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden print:overflow-visible">
        {active.framed ? (
          children
        ) : (
          <>
            <Topbar breadcrumb={breadcrumb} hideSearch className="hidden print:hidden lg:flex" />
            {mode === 'responsive' ? (
              <>
                <MobileTopbar title={breadcrumb.screen} orgLabel={orgLabel} initials={user.initials} onMenuClick={() => setDrawerOpen(true)} className="lg:hidden print:hidden" />
                <ShellNavDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
              </>
            ) : null}
            <main className="min-h-0 flex-1 overflow-y-auto print:overflow-visible">{children}</main>
          </>
        )}
      </div>
    </div>
  );
}
