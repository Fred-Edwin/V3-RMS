'use client';

import * as React from 'react';
import Link from 'next/link';

import { cn } from '@/lib/cn';
import { MobileTopbar } from '@/components/app/shell/mobile-topbar';
import { PhoneSectionBar } from '@/components/app/shell/phone-section-bar';
import { Topbar } from '@/components/app/shell/topbar';
import { TopbarBell } from '@/components/app/shell/topbar-bell';
import { useAuthStore } from '@/store/authStore';

import { FOCUS_RING, MOTION, initialsOf, useWorkforceNavDrawer, useWorkforcePermissions } from '../../../_shared';
import { notificationWrites, useOpenNotifications, useUnreadStore } from '../../../notifications';
import { useAttendanceOn } from '../../../attendance/shell';
import { registerHomeCards } from '../../cards';
import { getHomeCards } from '../../lib/card-registry';
import { greetingFor, homeDate } from '../../lib/greeting';
import { HomeStack } from '../../components/home-stack';
import { useIsPhone } from '../hooks/use-is-phone';
import { useRoleHome } from '../hooks/use-role-home';
import { reachableKpis } from '../lib/role-home-reach';
import { greetingLine, needsYouHeadline } from '../lib/role-home-words';
import type { HomeAudience } from '../types/role-home-types';
import { HomeBody } from './home-body';
import { HomeBusy, HomeError, HomeLoading, isBusy, useBusyRetry } from './home-states';

export const NOTIFICATIONS_HREF = '/app/workforce/notifications';

/** The phone cards that stay as the action cards (clock, team today, this week, job cards); the old desktop cards are gone. */
const ACTION_CARD_IDS: readonly string[] = ['workforce.clock', 'workforce.job-cards-slot', 'workforce.team-today', 'workforce.this-week'];

/** The top bar's first words for each Home (Paper 1.1 to 1.11): "Workforce / Overview", the head's "Department / Overview", or just "Home". */
export function breadcrumbFor(audience: HomeAudience): { section: string; screen: string } {
  if (audience === 'HEAD') return { section: 'Department', screen: 'Overview' };
  if (audience === 'STAFF' || audience === 'SYSTEM_ADMIN') return { section: 'Home', screen: '' };
  return { section: 'Workforce', screen: 'Overview' };
}

const orgLabelOf = (name: string | null | undefined): string => (name ?? 'COMPANY').toUpperCase();

/**
 * Home for every role, `/app/workforce` (Paper 1.1 to 1.13): the greeting, five number cards, "Needs you" and "Latest". The server says
 * which Home the person has (`audience`) and fills it from the access table; this draws it. Below 768 px it is the phone Home.
 */
export function RoleHomeScreen() {
  const user = useAuthStore((s) => s.user);
  const permissions = useWorkforcePermissions();
  const { open: openMenu } = useWorkforceNavDrawer();
  const phone = useIsPhone();
  const home = useRoleHome();
  const unread = useUnreadStore((s) => s.unread);
  const openNotifications = useOpenNotifications();
  const setUnread = useUnreadStore((s) => s.setUnread);
  const [marking, setMarking] = React.useState(false);
  const now = new Date();
  const name = user?.name ?? '';
  const orgName = user?.organizationName ?? 'Wendo RMS';

  const view = home.data;
  // Cards that only count work in screens the menu hides (the clock is off) are left out.
  const role = useAuthStore((s) => s.role);
  const isDepartmentHead = useAuthStore((s) => s.isDepartmentHead);
  const attendanceOn = useAttendanceOn(role, isDepartmentHead);
  const reachable = React.useMemo(() => (view ? { ...view, kpis: reachableKpis(view.kpis, attendanceOn) } : null), [view, attendanceOn]);
  React.useEffect(() => {
    if (view) setUnread(view.unread);
  }, [view, setUnread]);

  const busy = home.status === 'error' && !view && isBusy(home.error);
  const { gaveUp } = useBusyRetry(busy, home.reload);

  const markAllRead = React.useCallback(async (): Promise<void> => {
    setMarking(true);
    try {
      setUnread((await notificationWrites.readAll()).unread);
      home.reload();
    } finally {
      setMarking(false);
    }
  }, [home, setUnread]);

  const actions = React.useMemo(() => {
    registerHomeCards();
    const cards = getHomeCards().filter((c) => ACTION_CARD_IDS.includes(c.id));
    return cards.length ? <HomeStack cards={cards} surface="phone" can={permissions.can} flush /> : null;
  }, [permissions.can]);

  const headline = view?.needsYou ? needsYouHeadline(view.needsYou.total, view.needsYou.overdue) : null;
  const greeting = greetingFor(now, name);
  const date = homeDate(now);
  const crumb = breadcrumbFor(view?.audience ?? 'STAFF');
  // The one button at the right of the top bar (Paper 1.1, 1.3): HR adds an employee, the Accountant opens payroll.
  const topAction =
    (view?.audience === 'HR' || view?.audience === 'DIRECTOR') && permissions.can('employee.write_basic')
      ? { href: '/app/workforce/employees/new', label: 'Add employee' }
      : view?.audience === 'ACCOUNTANT'
        ? { href: '/app/workforce/payroll', label: 'Open payroll' }
        : (view?.audience === 'BRANCH_MANAGER' || view?.audience === 'STORE_MANAGER') && attendanceOn
          ? { href: '/app/workforce/schedule/rota', label: 'Build shifts' }
          : view?.audience === 'SYSTEM_ADMIN'
            ? { href: '/app/admin', label: 'Add account' }
            : null;

  const body = !view || !reachable
    ?home.status === 'error'
      ? busy && !gaveUp
        ? <HomeBusy />
        : <HomeError error={home.error} onRetry={home.reload} />
      : <HomeLoading phone={phone} />
    : <HomeBody view={reachable} phone={phone} actions={actions} refreshError={home.status === 'error' ? home.error : null} onRetry={home.reload} onMarkAllRead={() => void markAllRead()} markingRead={marking} />;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Topbar
        breadcrumb={crumb}
        hideSearch
        actions={
          <>
            <TopbarBell href={NOTIFICATIONS_HREF} unread={unread} onClick={openNotifications} className="size-8" />
            {topAction ? (
              <Link href={topAction.href} className={cn('inline-flex h-8 items-center bg-wds-primary px-3.5 font-wds-sans text-[13px] font-medium text-wds-primary-fg hover:bg-wds-primary-hover', MOTION, FOCUS_RING)}>
                {topAction.label}
              </Link>
            ) : null}
          </>
        }
        className="hidden lg:flex"
      />
      {phone ? (
        <PhoneSectionBar
          title={view?.audience === 'HEAD' ? 'Overview' : 'Home'}
          kicker={view?.audience === 'HEAD' && user?.departmentTag ? `DEPARTMENT · ${user.departmentTag.toUpperCase()}` : orgLabelOf(user?.organizationName)}
          unread={unread}
          bellHref={NOTIFICATIONS_HREF}
          onMenu={openMenu}
        />
      ) : (
        <MobileTopbar title="Home" orgLabel={orgLabelOf(user?.organizationName)} initials={initialsOf(name)} onMenuClick={openMenu} className="lg:hidden" />
      )}
      <main aria-label="Workforce Home" className="min-h-0 flex-1 overflow-y-auto bg-wds-canvas">
        <div className={cn('flex flex-col', phone ? 'gap-5 px-4 pb-8 pt-5' : 'gap-6 px-8 pb-10 pt-8')}>
          <div className={cn('flex flex-col', phone ? 'gap-1' : 'gap-1.5')}>
            <h1 className={cn('m-0 font-wds-sans font-semibold tracking-[-0.02em] text-wds-text-ink', phone ? 'text-[22px] leading-7' : 'text-[26px] leading-8')}>{greeting}</h1>
            <p className={cn('m-0 font-wds-sans text-wds-neutral-700', phone ? 'text-[13px] leading-[19px]' : 'text-[14px] leading-5')}>
              {greetingLine(date, headline) + (phone && !view?.needsYou ? ` ${orgName}` : '')}
            </p>
          </div>
          {body}
        </div>
      </main>
    </div>
  );
}
