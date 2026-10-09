'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { cn } from '@/lib/cn';
import { MobileErrorState } from '@/components/app/shell/mobile-states';
import { Skeleton } from '@/components/ui2/skeleton';
import { PhoneColumn } from '../../../_shared/components/phone-column';
import { B2Footer, B2Header, B2SecondaryButton } from '../../../_shared/components/block2-phone-parts';
import { LoadingAnnouncer } from '../../../_shared/components/scw-states';
import { couldNotLoad } from '../../../_shared/lib/block2-words';
import { formatQty } from '../../../requisitions/lib/qty';
import { usePackReview } from '../../hooks/use-phone-dispatch';
import { reviewTotals } from '../../lib/pack-logic';
import { getLeftOut } from '../../lib/pack-session';
import { packReview } from '../../lib/phone-routes';

/** Every line, in detail (Paper D5b): all lines of the departments that ship, with sent quantities, then the groups that stay at the store. */
export function ReviewLinesScreen({ requisitionId }: { requisitionId: string }) {
  const router = useRouter();
  const review = usePackReview(requisitionId);
  const data = review.data;
  const [leftOut, setLeftOut] = React.useState<ReadonlySet<string>>(() => new Set());
  React.useEffect(() => {
    setLeftOut(getLeftOut(requisitionId));
  }, [requisitionId]);
  const back = (): void => router.push(packReview(requisitionId));

  if (review.status === 'error' && !data) {
    return (
      <PhoneColumn>
        <B2Header title="Everything you are sending" subtitle="" leading="back" onBack={back} place="CENTRAL STORE" />
        <div role="alert" className="p-5">
          <MobileErrorState title="Could not load the lines" description={couldNotLoad('the lines')} onRetry={() => void review.reload()} />
        </div>
      </PhoneColumn>
    );
  }
  if (!data) {
    return (
      <PhoneColumn>
        <B2Header title="Everything you are sending" subtitle="" leading="back" onBack={back} place="CENTRAL STORE" />
        <LoadingAnnouncer text="Loading the lines" />
        <div className="flex flex-1 flex-col bg-wds-canvas" aria-hidden="true">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between border-b border-wds-border bg-wds-surface px-5 py-3.5">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-4 w-6" />
            </div>
          ))}
        </div>
      </PhoneColumn>
    );
  }

  const valid = new Set(data.departments.filter((d) => d.canLeaveOut && leftOut.has(d.departmentId)).map((d) => d.departmentId));
  const totals = reviewTotals(data, valid);
  const staying = data.departments.filter((d) => !totals.shipping.some((s) => s.departmentId === d.departmentId));
  const stayingLines = staying.reduce((n, d) => n + d.lineCount, 0);

  return (
    <PhoneColumn>
      <B2Header
        title="Everything you are sending"
        subtitle={`${totals.lineCount} lines · ${totals.shipping.length} ${totals.shipping.length === 1 ? 'department' : 'departments'}${totals.shortCount > 0 ? ` · ${totals.shortCount} short` : ''}`}
        leading="back"
        onBack={back}
        place="CENTRAL STORE"
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-wds-surface">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-wds-text-ink bg-wds-surface px-5 py-3.5">
          <span className="font-wds-mono text-[11px] uppercase leading-[14px] tracking-[0.06em] text-wds-text-muted">Item</span>
          <span className="font-wds-mono text-[11px] uppercase leading-[14px] tracking-[0.06em] text-wds-text-muted">Sent</span>
        </div>
        {totals.shipping.map((d) => (
          <section key={d.departmentId} aria-label={d.departmentName}>
            <div className="flex items-center justify-between border-b border-wds-border bg-wds-neutral-100 px-5 py-2.5">
              <h2 className="font-wds-sans text-[15px] font-semibold leading-5 text-wds-text-ink">{d.departmentName}</h2>
              <span className="font-wds-sans text-[14px] leading-5 text-wds-text-muted">{d.lineCount} lines</span>
            </div>
            <ul>
              {data.lines
                .filter((l) => l.departmentId === d.departmentId)
                .map((l) => (
                  <li key={l.lineId} className={cn('flex items-center justify-between gap-3 border-b border-wds-border px-5 py-3', l.short ? 'bg-wds-warning-bg' : 'bg-wds-surface')}>
                    <div className="flex min-w-0 flex-col">
                      <span className="font-wds-sans text-[16px] leading-[22px] text-wds-text-ink">{l.itemName}</span>
                      {l.short ? <span className="font-wds-sans text-[13px] leading-[18px] text-wds-warning-fg">Short · {formatQty(l.requestedQty)} asked</span> : null}
                    </div>
                    <span className={cn('font-wds-sans text-[16px] leading-[22px]', l.short ? 'font-semibold text-wds-warning-fg' : 'text-wds-text-ink')}>{formatQty(l.sentQty)}</span>
                  </li>
                ))}
            </ul>
          </section>
        ))}
        {staying.length > 0 ? (
          <section aria-label="Staying at the store">
            <h2 className="border-b border-wds-border bg-wds-neutral-50 px-5 py-2.5 font-wds-mono text-[11px] font-normal uppercase leading-[14px] tracking-[0.06em] text-wds-text-muted">
              Staying at the store · {stayingLines} lines
            </h2>
            <ul>
              {staying.map((d) => (
                <li key={d.departmentId} className="flex items-center justify-between gap-3 border-b border-wds-border bg-wds-neutral-50 px-5 py-3">
                  <div className="flex flex-col">
                    <span className="font-wds-sans text-[16px] leading-[22px] text-wds-text-muted">{d.departmentName}</span>
                    <span className={cn('font-wds-sans text-[13px] leading-[18px]', d.allTicked ? 'text-wds-text-muted' : 'text-wds-warning-fg')}>{d.allTicked ? 'Left out · ships later' : 'Not ready · stays in To pack'}</span>
                  </div>
                  <span className="font-wds-sans text-[15px] leading-5 text-wds-text-muted">{d.lineCount} lines</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
      <B2Footer>
        <B2SecondaryButton onClick={back}>Back to the final review</B2SecondaryButton>
      </B2Footer>
    </PhoneColumn>
  );
}
