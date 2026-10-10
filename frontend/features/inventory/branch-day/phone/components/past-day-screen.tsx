'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { useAuthStore } from '@/store/authStore';
import { Skeleton } from '@/components/ui2/skeleton';
import { PhoneColumn } from '../../../_shared/components/phone-column';
import { LoadingAnnouncer } from '../../../_shared/components/scw-states';
import { B2Header } from '../../../_shared/components/block2-phone-parts';
import { BRANCH_DAY_STATES_COPY } from '../../_shared/lib/branch-day-copy';
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
            <table className="w-full border-collapse border border-wds-border bg-wds-surface">
              <caption className="sr-only">
                {data.department.name} on {dayText(data.day.date)}: opening stock, received, waste, closing stock and used today
              </caption>
              <thead>
                <tr className="border-b border-wds-border">
                  <th scope="col" className={`${HEAD} py-2 pl-3 text-left font-normal`}>
                    ITEM
                  </th>
                  {COLUMNS.map((c) => (
                    <th key={c.key} scope="col" className={`${HEAD} ${c.width} py-2 pr-0 text-right font-normal last:pr-3`} aria-label={c.full}>
                      {c.short}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.lines.map((line) => (
                  <tr key={line.itemName} className="border-b border-wds-border last:border-b-0">
                    <th scope="row" className="py-2.5 pl-3 pr-1 text-left align-top font-wds-sans text-[13px] font-normal leading-4 text-wds-text-ink">
                      {line.itemName}
                    </th>
                    {COLUMNS.map((c) => (
                      <td key={c.key} className={`${c.width} py-2.5 text-right align-top font-wds-mono text-[12px] leading-4 text-wds-text-ink last:pr-3 ${c.key === 'usedQty' ? 'font-semibold' : ''}`}>
                        {figureText(line[c.key])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="border border-wds-info-border bg-wds-info-bg px-3 py-2.5 font-wds-sans text-[12px] leading-4 text-wds-info-fg">
              OPEN is Opening stock, IN is Received, CLOSE is Closing stock, USED is Used today. Waste is waste logged that day. Values are for the Branch Manager.
            </p>
          </>
        )}
      </main>
    </PhoneColumn>
  );
}
