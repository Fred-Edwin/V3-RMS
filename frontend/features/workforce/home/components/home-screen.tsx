'use client';

import * as React from 'react';

import { MobileTopbar } from '@/components/app/shell/mobile-topbar';
import { Topbar } from '@/components/app/shell/topbar';
import { useAuthStore } from '@/store/authStore';

import { ErrorBlock, ListSkeleton, initialsOf, useWorkforceNavDrawer, useWorkforcePermissions } from '../../_shared';
import { registerHomeCards } from '../cards';
import { getHomeCards, type HomeSurface } from '../lib/card-registry';
import { greetingFor, homeClock, homeDate } from '../lib/greeting';
import { HOME_COPY } from '../lib/home-copy';
import { BranchNowHeader } from './branch-board';
import { HomeStack } from './home-stack';
import { PhoneHomeBar } from './phone-home-bar';

/**
 * Workforce Home, `/app/workforce` (Paper Chapter 1, steps 02 to 05). One page for every role: the greeting, then whichever registered
 * cards this person may see, most urgent first. Nothing here knows a role: the cards say who sees them by capability.
 *
 * Below 768 px the phone stack is drawn (phone cards, the dark band with the shift-pill and primary-action slots); from 768 px the
 * desktop columns. The shell's sidebar shows from 1024 px, so between the two the page has the shell's compact top bar and drawer.
 */

const PHONE_QUERY = '(max-width: 767px)';

function subscribe(onChange: () => void): () => void {
  const mq = window.matchMedia(PHONE_QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

/** True below 768 px. The server render assumes desktop; the first client render corrects it. */
export function useIsPhone(): boolean {
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(PHONE_QUERY).matches,
    () => false
  );
}

const orgLabelOf = (name: string | null | undefined): string => (name ?? 'COMPANY').toUpperCase();

export function WorkforceHome() {
  const user = useAuthStore((s) => s.user);
  const permissions = useWorkforcePermissions();
  const { open: openMenu } = useWorkforceNavDrawer();
  const phone = useIsPhone();
  const surface: HomeSurface = phone ? 'phone' : 'desktop';
  const cards = React.useMemo(() => {
    registerHomeCards();
    return getHomeCards();
  }, []);
  // Whole minutes are enough for a greeting; the clock is read once per render, not ticked (Attendance owns anything live).
  const now = new Date();
  const name = user?.name ?? '';
  const orgName = user?.organizationName ?? 'Wendo RMS';
  const branchView = permissions.can('today.act');

  const heading =
    surface === 'phone' ? undefined : branchView ? (
      <BranchNowHeader title={`${orgName}, right now`} subtitle={`${homeDate(now)}, ${homeClock(now)}.`} live={false} />
    ) : (
      <div className="flex flex-col gap-1.5">
        <h1 className="m-0 font-wds-sans text-[24px] font-semibold leading-[30px] tracking-[-0.01em] text-wds-text-ink">{greetingFor(now, name)}</h1>
        <p className="m-0 font-wds-sans text-[14px] leading-[18px] text-wds-text-secondary">{homeDate(now)}.</p>
      </div>
    );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* ≥1024 px: the shell's top bar. The page draws it because a rebuilt screen always does. Search and the page's action arrive with the slices that own them. */}
      <Topbar breadcrumb={{ section: 'Workforce', screen: 'Home' }} hideSearch className="hidden lg:flex" />
      {phone ? (
        <PhoneHomeBar
          kicker={`WENDO RMS · ${orgLabelOf(user?.organizationName)}`}
          onMenu={openMenu}
          name={name}
          greeting={greetingFor(now, name)}
          subtitle={`${homeDate(now)} · ${orgName}`}
        />
      ) : (
        <MobileTopbar title="Home" orgLabel={orgLabelOf(user?.organizationName)} initials={initialsOf(name)} onMenuClick={openMenu} className="lg:hidden" />
      )}
      <main aria-label="Workforce Home" className="min-h-0 flex-1 overflow-y-auto bg-wds-canvas">
        {permissions.failed ? (
          <div className="p-8">
            <ErrorBlock title={HOME_COPY.permissionsError.title} line={HOME_COPY.permissionsError.line} onRetry={permissions.retry} />
          </div>
        ) : !permissions.ready ? (
          <div className="p-8">
            <ListSkeleton rows={4} columns={[120, 'fill', 80]} label="Loading Home" />
          </div>
        ) : (
          <HomeStack cards={cards} surface={surface} can={permissions.can} heading={heading} />
        )}
      </main>
    </div>
  );
}
