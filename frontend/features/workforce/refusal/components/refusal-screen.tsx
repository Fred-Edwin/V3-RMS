'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { cn } from '@/lib/cn';
import { MobileTopbar } from '@/components/app/shell/mobile-topbar';
import { PhoneSectionBar } from '@/components/app/shell/phone-section-bar';
import { Topbar } from '@/components/app/shell/topbar';
import { TopbarBell } from '@/components/app/shell/topbar-bell';
import { useAuthStore } from '@/store/authStore';

import { FOCUS_RING, MOTION, PRESSED, initialsOf, useWorkforceNavDrawer } from '../../_shared';
import { useUnreadStore } from '../../notifications';
import { usePageFor } from '../hooks/use-page-for';
import { REFUSAL_TITLE, pageNameFromPath, refusalBody, refusalCaption, refusalFooter, safeFrom } from '../lib/refusal-words';

const PRIMARY = cn('flex h-11 items-center justify-center bg-wds-primary px-5 font-wds-sans text-[14px] font-semibold text-wds-primary-fg hover:bg-wds-primary-hover md:h-10', MOTION, FOCUS_RING, PRESSED);
const SECONDARY = cn('flex h-11 items-center justify-center border border-wds-border-strong bg-wds-surface px-5 font-wds-sans text-[14px] text-wds-text-ink hover:bg-wds-neutral-50 md:h-10', MOTION, FOCUS_RING, PRESSED);

/** The amber padlock in a ring. */
const Padlock = () => (
  <span aria-hidden className="flex size-8 items-center justify-center rounded-full border-2 border-wds-warning-fg text-wds-warning-fg">
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="6" width="9" height="6.5" rx="0.5" />
      <path d="M4.5 6V4.5a2.5 2.5 0 0 1 5 0V6" />
    </svg>
  </span>
);

/**
 * "Not available for your role" (Paper 10.1, 10.2), `/app/not-available?from=<path>`: the one screen for every page a person may not open,
 * in place of a silent redirect. The shell stays; the content is a top rule, the caption, an amber padlock, the title, who the page is
 * for (from the access table, through the server) and where to go instead, a primary and a secondary button, and the reference.
 * Nothing is changed by arriving here. If the server cannot say, the plain line shows and the way out still works.
 */
export function RefusalScreen() {
  const params = useSearchParams();
  const from = safeFrom(params.get('from'));
  const user = useAuthStore((s) => s.user);
  const unread = useUnreadStore((s) => s.unread);
  const { open: openMenu } = useWorkforceNavDrawer();
  const info = usePageFor(from);
  const data = info.data;
  const page = data?.page && data.page !== 'This page' ? data.page : pageNameFromPath(from);
  const homeLabel = data?.homeLabel ?? 'Home';

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Topbar breadcrumb={{ section: 'Workforce', screen: page }} hideSearch actions={<TopbarBell href="/app/workforce/notifications" unread={unread} />} className="hidden lg:flex" />
      <PhoneSectionBar title={page} kicker="WORKFORCE" unread={unread} bellHref="/app/workforce/notifications" onMenu={openMenu} className="md:hidden" />
      <MobileTopbar title={page} orgLabel="WORKFORCE" initials={initialsOf(user?.name ?? '')} onMenuClick={openMenu} className="hidden md:flex lg:hidden" />
      <main aria-label="Not available" className="min-h-0 flex-1 overflow-y-auto bg-wds-canvas">
        <div className="flex max-w-[600px] flex-col gap-4 px-4 py-8 md:px-8 md:py-12">
          <hr className="m-0 w-full border-0 border-t border-t-wds-neutral-800" />
          <p className="m-0 font-wds-mono text-[11px] leading-[14px] tracking-[0.06em] text-wds-text-secondary">{refusalCaption(page)}</p>
          <Padlock />
          <h1 className="m-0 font-wds-sans text-[24px] font-semibold leading-8 tracking-[-0.01em] text-wds-text-ink">{REFUSAL_TITLE}</h1>
          <p className="m-0 font-wds-sans text-[15px] leading-[22px] text-wds-text-ink">{refusalBody(data ?? null, page)}</p>
          <div className="flex flex-col gap-2 md:flex-row md:gap-2">
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
          <p className="m-0 font-wds-sans text-[12px] leading-[18px] text-wds-text-secondary">{refusalFooter(data?.reference ?? null)}</p>
        </div>
      </main>
    </div>
  );
}
