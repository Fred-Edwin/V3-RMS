'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { useAuthStore } from '@/store/authStore';
import { Skeleton } from '@/components/ui2/skeleton';
import { PhoneColumn } from '../../../_shared/components/phone-column';
import { LoadingAnnouncer } from '../../../_shared/components/scw-states';
import { B2Header } from '../../../_shared/components/block2-phone-parts';
import { BRANCH_DAY_MESSAGES, BRANCH_DAY_STATES_COPY } from '../../_shared/lib/branch-day-copy';
import { useMyDay } from '../hooks/use-phone-day';
import { dayText, figureText, timeText } from '../lib/phone-format';
import { DAY_PAST } from '../lib/phone-routes';
import { BodyState } from './phone-parts';

const HEAD = 'font-wds-mono text-[10px] leading-3 tracking-[0.04em] text-wds-text-secondary';
const COLUMNS = [
  { key: 'openingQty', short: 'OPEN', full: 'Opening stock', width: 'w-[46px]' },
  { key: 'receivedQty', short: 'IN', full: 'Received', width: 'w-[44px]' },
  { key: 'wasteQty', short: 'WASTE', full: 'Waste', width: 'w-10' },
  { key: 'closingQty', short: 'CLOSE', full: 'Closing stock', width: 'w-[44px]' },
  { key: 'usedQty', short: 'USED', full: 'Used today', width: 'w-[50px]' },
] as const;

/** Paper step 20: one past day, my department. Read only, quantities only (no values, no costs). */
export function PastDayScreen({ id }: { id: string }) {
  const router = useRouter();
  const { data, status, error, reload } = useMyDay(id);
  const orgName = useAuthStore((s) => s.user?.organizationName ?? '');
  const copy = BRANCH_DAY_STATES_COPY.myHistory;

  return (
    <PhoneColumn>
      <B2Header
        title={data ? `${data.department.name} · ${dayText(data.day.date)}` : 'Past day'}
        subtitle={data ? `${data.day.reference} · I signed at ${timeText(data.signedAt)}` : ''}
        mono
        leading="back"
        onBack={() => router.push(DAY_PAST)}
        place={orgName}
      />
      <main className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-wds-canvas p-4">
        {status === 'loading' || status === 'idle' ? (
          <div className="border border-wds-border bg-wds-surface" aria-busy="true">
            <LoadingAnnouncer text={copy.loading} />
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} aria-hidden="true" className="flex items-center justify-between gap-3 border-b border-wds-border px-3 py-2.5 last:border-b-0">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-40" />
              </div>
            ))}
          </div>
        ) : status === 'error' || !data ? (
          <BodyState kind="error" text={error ?? 'Could not load this day. Try again.'} onRetry={() => void reload()} />
        ) : data.lines.length === 0 ? (
          <BodyState kind="empty" text="This day has no items." />
        ) : (
          <>
            {/* Paper step 20: the column heads are their own card above the rows card. Table roles keep it a table for a screen reader. */}
            <div role="table" aria-label={`${data.department.name} on ${dayText(data.day.date)}: opening stock, received, waste, closing stock and used today`} className="flex flex-col gap-3">
              <div role="rowgroup" className="border border-wds-border bg-wds-surface">
                <div role="row" className="flex items-center px-3 py-2">
                  <div role="columnheader" className={`${HEAD} w-[100px] shrink-0`}>
                    ITEM
                  </div>
                  {COLUMNS.map((c) => (
                    <div key={c.key} role="columnheader" aria-label={c.full} className={`${HEAD} ${c.width} shrink-0 text-right`}>
                      {c.short}
                    </div>
                  ))}
                </div>
              </div>
              <div role="rowgroup" className="border border-wds-border bg-wds-surface">
                {data.lines.map((line) => (
                  <div key={line.itemName} role="row" className="flex items-center border-b border-wds-neutral-100 px-3 py-2.5 last:border-b-0">
                    <div role="rowheader" className="w-[100px] shrink-0 font-wds-sans text-[13px] leading-4 text-wds-text-ink">
                      {line.itemName}
                    </div>
                    {COLUMNS.map((c) => (
                      <div key={c.key} role="cell" className={`${c.width} shrink-0 text-right font-wds-mono text-[12px] leading-4 text-wds-text-ink ${c.key === 'usedQty' ? 'font-semibold' : ''}`}>
                        {figureText(line[c.key])}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <p className="border border-wds-info-border bg-wds-info-bg px-3 py-2.5 font-wds-sans text-[12px] leading-4 text-wds-info-fg">
              {BRANCH_DAY_MESSAGES.pastDayNote} OPEN is Opening stock, IN is Received, CLOSE is Closing stock and USED is Used today.
            </p>
          </>
        )}
      </main>
    </PhoneColumn>
  );
}
