'use client';

import * as React from 'react';
import Link from 'next/link';

import { Skeleton } from '@/components/ui2/skeleton';
import { cn } from '@/lib/cn';
import { PhoneColumn, ScwPhoneHeader } from '../../../_shared/components/phone-column';
import { LoadingAnnouncer, ScwStatePanel } from '../../../_shared/components/scw-states';
import { useLoader } from '../../../_shared/hooks/use-async';
import { PHONE_PRIMARY_BUTTON } from '../../../_shared/lib/phone-styles';
import { todayLabel } from '../../_shared/lib/count-format';
import { COUNTING_STATES_COPY } from '../../_shared/lib/states-copy';
import { countingApi } from '../../_shared/services/counting-api';
import type { CountsHome } from '../../_shared/types/counting-contract';

const COUNTS = '/app/inventory/stock/counts';
export const PICK_SECTION_HREF = `${COUNTS}/sections`;
export const MY_COUNTS_HREF = `${COUNTS}/mine`;
const WASTE = '/app/inventory/stock/waste';

const GROUP_LABEL = 'font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-text-secondary';

function Chevron() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" className="shrink-0 text-wds-text-faint">
      <path d="M3 1.5 6.5 5 3 8.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
    </svg>
  );
}

function HomeRow({ href, title, line, badge, last }: { href: string; title: string; line: string; badge?: number; last?: boolean }) {
  return (
    <li className={cn(!last && 'border-b border-wds-neutral-100')}>
      <Link
        href={href}
        className="flex min-h-16 items-center gap-3 px-3.5 py-2 outline-none transition-colors duration-100 hover:bg-wds-neutral-50 focus-visible:shadow-[inset_0_0_0_2px_var(--wds-ring)] motion-safe:active:bg-wds-neutral-100"
      >
        <span className="flex min-w-0 grow flex-col">
          <span className="font-wds-sans text-[15px] leading-[18px] text-wds-text-ink">{title}</span>
          <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{line}</span>
        </span>
        {badge !== undefined ? (
          <span className="flex h-5 min-w-[22px] shrink-0 items-center justify-center bg-wds-espresso-700 px-1.5 font-wds-mono text-[11px] font-semibold leading-[14px] text-wds-sidebar-badge-fg">
            {badge}
            <span className="sr-only"> signed</span>
          </span>
        ) : null}
        <Chevron />
      </Link>
    </li>
  );
}

/** "8 sections · Samrat Supermarket last counted 3 days ago": the longest-waiting section is a name and a date, never a figure. */
function sectionsLine(home: CountsHome): string {
  const { total, longestAgo } = home.sections;
  const count = `${total} ${total === 1 ? 'section' : 'sections'}`;
  if (!longestAgo) return count;
  const when = longestAgo.lastCountedText === 'Never counted' ? 'was never counted' : `last counted ${longestAgo.lastCountedText.toLowerCase()}`;
  return `${count} · ${longestAgo.name} ${when}`;
}

const wasteLine = (n: number): string => `${n === 0 ? 'No entries' : `${n} ${n === 1 ? 'entry' : 'entries'}`} today · earlier days too`;

function HomeSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-3.5">
      <Skeleton className="h-[78px] w-full" />
      <Skeleton className="h-3 w-12" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-3 w-12" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

/**
 * Stock & counts home, the Store Attendant's front door (Paper step 52): Resume when a count of theirs is open, then Count (Pick a
 * section, My counts with the all-time signed badge) and Waste (Log waste, My waste), with Pick a section as the one big button.
 * Reads C31, which is blind: dates and counts of things, never a stock figure.
 */
export function AttendantHomeScreen() {
  const load = useLoader('counts-home', () => countingApi.home(), COUNTING_STATES_COPY.attendantHome.error);
  const home = load.data;
  const header = <ScwPhoneHeader leading="menu" title="Stock & counts" subtitle={`${todayLabel()} · Central Store`} />;

  if (load.status === 'error' && !home) {
    return (
      <PhoneColumn>
        {header}
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <ScwStatePanel kind="error" phone text={COUNTING_STATES_COPY.attendantHome.error} onRetry={() => void load.reload()} />
        </div>
      </PhoneColumn>
    );
  }
  if (!home) {
    return (
      <PhoneColumn>
        {header}
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <LoadingAnnouncer text={COUNTING_STATES_COPY.attendantHome.loading} />
          <HomeSkeleton />
        </div>
      </PhoneColumn>
    );
  }
  const open = home.openCount;
  return (
    <PhoneColumn>
      {header}
      <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto p-4">
        {open ? (
          <Link
            href={`${COUNTS}/${open.id}/count`}
            className="flex items-center gap-2.5 border border-wds-warning-border bg-wds-warning-bg px-3.5 py-3 outline-none focus-visible:shadow-wds-ring"
          >
            <span className="flex min-w-0 grow flex-col gap-0.5">
              <span className="font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-warning-fg">Your count is open · {open.reference}</span>
              <span className="truncate font-wds-sans text-[15px] font-semibold leading-[18px] text-wds-text-ink">{open.sectionsText}</span>
              <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{open.progressText}</span>
            </span>
            <span className="shrink-0 font-wds-sans text-[14px] font-semibold leading-[18px] text-wds-warning-fg">
              Resume<span className="sr-only"> {open.sectionsText}</span>
            </span>
          </Link>
        ) : null}
        <h2 className={GROUP_LABEL}>Count</h2>
        <ul className="border border-wds-border bg-wds-surface">
          <HomeRow href={PICK_SECTION_HREF} title="Pick a section" line={sectionsLine(home)} />
          <HomeRow href={MY_COUNTS_HREF} title="My counts" line="Every count I have signed, newest first" badge={home.signedCount} last />
        </ul>
        <h2 className={GROUP_LABEL}>Waste</h2>
        <ul className="border border-wds-border bg-wds-surface">
          <HomeRow href={`${WASTE}/new`} title="Log waste" line="What was thrown away, spoiled or broken" />
          <HomeRow href={WASTE} title="My waste" line={wasteLine(home.wasteToday)} last />
        </ul>
        <div className="grow" />
        <Link href={PICK_SECTION_HREF} className={cn(PHONE_PRIMARY_BUTTON, 'mb-5 h-[50px] text-[16px] leading-5')}>
          Pick a section
        </Link>
      </div>
    </PhoneColumn>
  );
}
