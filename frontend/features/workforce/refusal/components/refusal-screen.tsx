'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { cn } from '@/lib/cn';
import { MobileTopbar } from '@/components/app/shell/mobile-topbar';
import { PhoneSectionBar } from '@/components/app/shell/phone/phone-section-bar';
import { Topbar } from '@/components/app/shell/topbar';
import { TopbarBell } from '@/components/app/shell/menu/topbar-bell';
import { useAuthStore } from '@/store/authStore';

import { FOCUS_RING, MOTION, PRESSED, initialsOf, useWorkforceNavDrawer } from '../../_shared';
import { useOpenNotifications, useUnreadStore } from '../../notifications';
import { usePageFor } from '../hooks/use-page-for';
import { REFUSAL_TITLE, pageNameFromPath, refusalBody, refusalCaption, refusalFooter, safeFrom } from '../lib/refusal-words';

const PRIMARY = cn('flex h-11 items-center justify-center rounded-[2px] bg-wds-primary px-5 font-wds-sans text-sm font-medium leading-[18px] text-wds-primary-fg hover:bg-wds-primary-hover md:h-10', MOTION, FOCUS_RING, PRESSED);
const SECONDARY = cn('flex h-11 items-center justify-center border border-wds-border-strong bg-wds-surface px-5 font-wds-sans text-sm font-medium leading-[18px] text-wds-text-ink hover:bg-wds-neutral-50 md:h-10', MOTION, FOCUS_RING, PRESSED);

/** The amber padlock in a ring (Paper 10.1: 32 px). */
const Padlock = () => (
  <svg aria-hidden width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#8A5A16" className="shrink-0">
    <circle cx="12" cy="12" r="10" strokeWidth="1.75" />
    <rect x="8.5" y="11" width="7" height="5.5" strokeWidth="1.5" />
    <path d="M10 11V9a2 2 0 0 1 4 0v2" strokeWidth="1.5" />
  </svg>
);

/**
 * "Not available for your role" (Paper 10.1, 10.2), `/app/not-available?from=<path>`: the one screen for every page a person may not open,
 * in place of a silent redirect. The shell stays; the content is a top rule, the caption, an amber padlock, the title, who the page is
 * for (from the access table, through the server) and where to go instead, a primary and a secondary button, and the reference.
 * Nothing is changed by arriving here. If the server cannot say, the plain line shows and the way out still works.
 */
export function RefusalScreen({ from: fromPath }: { from?: string } = {}) {
  const params = useSearchParams();
  // A screen that finds out it may not be used (the server said no) shows this very screen in place, naming its own address.
  const from = safeFrom(fromPath ?? params.get('from'));
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const unread = useUnreadStore((s) => s.unread);
  const openNotifications = useOpenNotifications();
  const { open: openMenu } = useWorkforceNavDrawer();
  const info = usePageFor(from);
  const data = info.data;
  const page = data?.page && data.page !== 'This page' ? data.page : pageNameFromPath(from);
  const homeLabel = data?.homeLabel ?? 'Home';

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Topbar breadcrumb={{ section: 'Workforce', screen: page }} hideSearch actions={<TopbarBell href="/app/workforce/notifications" unread={unread} onClick={openNotifications} />} className="hidden lg:flex" />
      <PhoneSectionBar title={page} kicker="WORKFORCE" unread={unread} bellHref="/app/workforce/notifications" onMenu={openMenu} className="md:hidden" />
      <MobileTopbar title={page} orgLabel="WORKFORCE" initials={initialsOf(user?.name ?? '')} onMenuClick={openMenu} className="hidden md:flex lg:hidden" />
      <main aria-label="Not available" className="min-h-0 flex-1 overflow-y-auto bg-wds-canvas">
        <div className="px-4 pt-8 md:px-8 md:pt-12">
          <div className="flex w-full max-w-[560px] flex-col items-start gap-3 border-t border-t-wds-neutral-800 py-8">
          <p className="m-0 font-wds-mono text-[10px] leading-3 tracking-[0.06em] text-wds-text-secondary">{refusalCaption(page)}</p>
          <Padlock />
          <h1 className="m-0 font-wds-sans text-[22px] font-semibold leading-7 tracking-[-0.02em] text-wds-text-ink">{REFUSAL_TITLE}</h1>
          <p className="m-0 font-wds-sans text-sm leading-[21px] text-wds-neutral-700">{refusalBody(data ?? null, page)}</p>
          <div className="flex w-full flex-col gap-2 pt-2 md:w-auto md:flex-row">
            {data?.instead ? (
              <>
                <Link href={data.instead.href} className={PRIMARY}>
                  Open {data.instead.label}
                </Link>
                <Link href="/app/workforce" className={SECONDARY}>
                  Go to {homeLabel}
                </Link>
              </>
            ) : (
              <Link href="/app/workforce" className={PRIMARY}>
                Go to {homeLabel}
              </Link>
            )}
          </div>
          <p className="m-0 pt-3 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{refusalFooter(data?.reference ?? null, role)}</p>
          </div>
        </div>
      </main>
    </div>
  );
}
