'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { cn } from '@/lib/cn';
import { MobileErrorState } from '@/components/app/shell/mobile-states';
import { Skeleton } from '@/components/ui2/skeleton';
import { PhoneColumn } from '../../../_shared/components/phone-column';
import { B2Footer, B2Header, B2PrimaryButton, SectionLabel } from '../../../_shared/components/block2-phone-parts';
import { LoadingAnnouncer } from '../../../_shared/components/scw-states';
import { couldNotLoad } from '../../../_shared/lib/block2-words';
import { useDispatchQueue, usePackReview } from '../../hooks/use-phone-dispatch';
import { countWord, shortSummary } from '../../lib/pack-logic';
import { DISPATCH_HOME, packDepartment, packReview } from '../../lib/phone-routes';

/** Every department packed (Paper D4), and the same list when not every department is ready (Block 2 gaps, chapter 10 D4). */
export function PackOverviewScreen({ requisitionId }: { requisitionId: string }) {
  const router = useRouter();
  const review = usePackReview(requisitionId);
  const queue = useDispatchQueue();
  const data = review.data;
  const card = queue.data?.cards.find((c) => c.requisitionId === requisitionId) ?? null;

  if (review.status === 'error' && !data) {
    return (
      <PhoneColumn>
        <B2Header title="Pack" subtitle="" leading="back" onBack={() => router.push(DISPATCH_HOME)} place="CENTRAL STORE" />
        <div role="alert" className="p-5">
          <MobileErrorState title="Could not load this requisition" description={couldNotLoad('this requisition')} onRetry={() => void review.reload()} />
        </div>
      </PhoneColumn>
    );
  }
  if (!data) {
    return (
      <PhoneColumn>
        <B2Header title="Pack" subtitle="" leading="back" onBack={() => router.push(DISPATCH_HOME)} place="CENTRAL STORE" />
        <LoadingAnnouncer text="Loading the departments" />
        <div className="flex flex-1 flex-col gap-4 bg-wds-canvas p-5" aria-hidden="true">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-1 w-full" />
          <div className="border border-wds-text-ink bg-wds-surface">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3.5 border-b border-wds-border px-4 py-3.5 last:border-b-0">
                <Skeleton className="size-[22px]" />
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3.5 w-36" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </PhoneColumn>
    );
  }

  const total = data.departments.length;
  const ready = data.departments.filter((d) => d.allTicked);
  const notReady = data.departments.filter((d) => !d.allTicked);
  const allPacked = notReady.length === 0;
  const title = allPacked ? `${data.branch.name} · all packed` : `${data.branch.name} · ${ready.length} of ${total} packed`;
  const names = notReady.map((d) => d.departmentName);
  const nameList = names.length === 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1] ?? ''}`;
  const rest = ready.length;

  return (
    <PhoneColumn>
      <B2Header title={title} subtitle={`${data.reference} · ${data.cycleLabel.split(' · ')[0] ?? data.cycleLabel} · ${data.lineCount} lines`} mono leading="back" onBack={() => router.push(DISPATCH_HOME)} place="CENTRAL STORE" />
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto bg-wds-canvas p-5">
        <div className="flex flex-col gap-2.5">
          <SectionLabel>
            {ready.length} of {total} departments packed
          </SectionLabel>
          <div className="flex gap-1.5" aria-hidden="true">
            {data.departments.map((d) => (
              <span key={d.departmentId} className={cn('h-1 grow basis-0', d.allTicked ? 'bg-wds-success-fg' : 'bg-wds-border-strong')} />
            ))}
          </div>
        </div>
        <ul className="border border-wds-text-ink bg-wds-surface">
          {data.departments.map((d) => {
            const packedCount = card?.departments.find((c) => c.departmentId === d.departmentId)?.packedCount;
            const summary = shortSummary(d);
            return (
              <li key={d.departmentId} className="border-b border-wds-border last:border-b-0">
                <Link
                  href={packDepartment(requisitionId, d.departmentId)}
                  className={cn('flex items-center gap-3.5 px-4 py-3.5 outline-none transition-colors duration-100 hover:bg-wds-neutral-50 focus-visible:shadow-[inset_0_0_0_2px_var(--wds-selected-edge)]', !d.allTicked && 'bg-wds-warning-bg hover:bg-wds-warning-bg')}
                >
                  <span aria-hidden="true" className={cn('flex size-[22px] shrink-0 items-center justify-center', d.allTicked ? 'bg-wds-success-fg' : 'border-[1.5px] border-wds-border-strong bg-white')}>
                    {d.allTicked ? (
                      <svg width="12" height="12" viewBox="0 0 12 12">
                        <path d="M2 6.5L5 9.5L10 3" fill="none" stroke="#FFFFFF" strokeWidth="1.8" />
                      </svg>
                    ) : null}
                  </span>
                  <span className="flex min-w-0 grow basis-0 flex-col gap-0.5">
                    <span className="font-wds-sans text-[16px] font-medium leading-5 text-wds-text-ink">
                      {d.departmentName}
                      <span className="sr-only">{d.allTicked ? ', packed' : ', not ready'}</span>
                    </span>
                    <span className={cn('font-wds-sans text-[13px] leading-[18px]', d.allTicked ? (summary.short ? 'text-wds-warning-fg' : 'text-wds-text-muted') : 'text-wds-warning-fg')}>
                      {d.allTicked
                        ? summary.short
                          ? summary.text
                          : `${d.lineCount} ${d.lineCount === 1 ? 'line' : 'lines'} · all in full`
                        : `Packing ${packedCount ?? 0} of ${d.lineCount} · stays in To pack`}
                    </span>
                  </span>
                  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="shrink-0">
                    <path d="M6 3L11 8L6 13" fill="none" stroke="var(--wds-neutral-500)" strokeWidth="1.5" />
                  </svg>
                </Link>
              </li>
            );
          })}
        </ul>
        <p className="font-wds-sans text-[15px] leading-[22px] text-wds-text-muted">
          {allPacked
            ? 'Tap a department to look at it again. Nothing leaves the store until you sign the final review.'
            : rest > 0
              ? `${nameList} ${names.length === 1 ? 'is' : 'are'} not ready, so ${names.length === 1 ? 'it stays' : 'they stay'} in To pack. You can go to the final review and send the other ${countWord(rest).toLowerCase()} now, or pack ${names.length === 1 ? nameList : 'them'} first. Nothing leaves the store until you sign.`
              : 'Tick every line of one department to open the final review.'}
        </p>
      </div>
      <B2Footer>
        <B2PrimaryButton disabled={rest === 0} onClick={() => router.push(packReview(requisitionId))}>
          Go to the final review
        </B2PrimaryButton>
      </B2Footer>
    </PhoneColumn>
  );
}
