import * as React from 'react';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui2/button';
import { Skeleton } from '@/components/ui2/skeleton';
import { formatDayAndClock, withUnit } from '../../_shared/lib/prep-format';
import { PREP_STATES_COPY } from '../../_shared/lib/states-copy';
import type { NeedsLookList, RunSummary } from '../../_shared/types/prep-contract';

type Item = NeedsLookList['items'][number];

/** The band shows this many; the rest are one click away in the table below. */
export const BAND_ROWS = 5;

/** What the Attendant said and "Corrected" are context, not alarms: they get the quiet chip. Everything else is a warning chip. */
const isQuietReason = (reason: string): boolean => reason.startsWith('Said:') || reason === 'Corrected';

export function ReasonChip({ reason }: { reason: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center border px-2 py-[3px] font-wds-sans text-wds-caption leading-4',
        isQuietReason(reason) ? 'border-wds-border bg-wds-neutral-50 text-wds-text-copy-muted' : 'border-wds-warning-border bg-wds-warning-bg text-wds-warning-fg'
      )}
    >
      {reason}
    </span>
  );
}

const bandShell = 'flex flex-col border bg-wds-surface';

export interface NeedsLookBandProps {
  data: NeedsLookList | null;
  status: 'loading' | 'ready' | 'error';
  error?: string | null;
  onRetry: () => void;
  /** Opens the run drawer for this run (Mark reviewed lives there). */
  onReview: (run: RunSummary) => void;
  /** Shows only the runs that need a look in the table below. */
  onShowAll: () => void;
}

/**
 * The "Needs a look" band (Paper step 10 `7GT-0`): each run the manager should open, with the reasons as chips and a Review action.
 * Loading is one skeleton row inside the band; empty is a green "All clear"; an error keeps the header and offers Try again
 * (wording from Paper step 23). Review opens the run drawer, where Mark reviewed is.
 */
export function NeedsLookBand({ data, status, error, onRetry, onReview, onShowAll }: NeedsLookBandProps) {
  if (status === 'ready' && data && data.count === 0) {
    return (
      <section aria-label="Needs a look" className={cn(bandShell, 'border-wds-success-border')}>
        <div className="flex items-center gap-[10px] bg-wds-success-bg px-[18px] py-3">
          <span aria-hidden className="size-2 shrink-0 rounded-full bg-wds-success-fg" />
          <h2 className="font-wds-sans text-[15px] font-semibold leading-5 text-wds-text-ink">{PREP_STATES_COPY.needsLook.emptyTitle}</h2>
          <span className="font-wds-sans text-wds-body-sm text-wds-text-copy-muted">{PREP_STATES_COPY.needsLook.emptyDescription}</span>
        </div>
      </section>
    );
  }

  const shown = data?.items.slice(0, BAND_ROWS) ?? [];
  return (
    <section aria-label="Needs a look" className={cn(bandShell, 'border-wds-warning-border')}>
      <div className="flex items-center gap-[10px] border-b border-wds-warning-border bg-wds-warning-bg px-[18px] py-3">
        <span aria-hidden className="size-2 shrink-0 rounded-full bg-wds-warning-fg" />
        <h2 className="font-wds-sans text-[15px] font-semibold leading-5 text-wds-text-ink">Needs a look</h2>
        {data ? (
          <span className="inline-flex h-5 min-w-5 items-center justify-center bg-wds-sidebar-badge-bg px-1.5 font-wds-mono text-[11px] font-semibold leading-[14px] text-wds-sidebar-badge-fg" aria-label={`${data.count} waiting`}>
            {data.count}
          </span>
        ) : null}
      </div>

      {status === 'error' ? (
        <div role="alert" className="flex items-center justify-between gap-wds-3 px-[18px] py-[14px]">
          <span className="font-wds-sans text-wds-body-sm text-wds-text-copy-muted">
            {PREP_STATES_COPY.needsLook.errorTitle}.{error ? ` ${error}` : ''}
          </span>
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Try again
          </Button>
        </div>
      ) : !data ? (
        <div className="flex items-center gap-5 px-[18px] py-[14px]" aria-busy="true" aria-label="Loading runs that need a look">
          <div className="flex flex-1 flex-col gap-[7px]">
            <Skeleton className="h-[18px] w-48" />
            <Skeleton className="h-6 w-80 max-w-full" />
          </div>
          <Skeleton className="hidden h-8 w-20 sm:block" />
        </div>
      ) : (
        <>
          <ul className="m-0 list-none divide-y divide-wds-warning-border p-0">
            {shown.map((run) => (
              <li key={run.id} className="flex flex-col gap-3 px-[18px] py-[14px] sm:flex-row sm:items-center sm:gap-5">
                <div className="flex min-w-0 flex-1 flex-col gap-[7px]">
                  <span className="truncate font-wds-sans text-wds-body font-medium leading-[18px] text-wds-text-ink">
                    {run.outputName} · {withUnit(run.made, run.unit)}
                  </span>
                  <ul className="m-0 flex list-none flex-wrap gap-2 p-0" aria-label="Why it needs a look">
                    {run.reasons.map((reason) => (
                      <li key={reason}>
                        <ReasonChip reason={reason} />
                      </li>
                    ))}
                  </ul>
                </div>
                <span className="shrink-0 font-wds-mono text-wds-caption text-wds-text-copy-muted sm:w-[220px]">
                  {run.by.name} · {formatDayAndClock(run.at)}
                </span>
                <Button variant="secondary" className="shrink-0 max-sm:h-11 max-sm:w-full" onClick={() => onReview(run)} aria-label={`Review ${run.outputName}, ${run.reference}`}>
                  Review
                </Button>
              </li>
            ))}
          </ul>
          {data.count > shown.length ? (
            <div className="flex items-center justify-between border-t border-wds-warning-border px-[18px] py-2.5">
              <span className="font-wds-sans text-wds-caption text-wds-text-copy-muted">
                Showing {shown.length} of {data.count}
              </span>
              <Button variant="link" size="sm" onClick={onShowAll}>
                See all {data.count} in the table
              </Button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
