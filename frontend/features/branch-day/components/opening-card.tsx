'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { Skeleton } from '@/components/ui2/skeleton';
import { useWdsToastStore } from '@/store/wdsToastStore';
import { formatClock } from '@/features/inventory';
import { formatApiErrorMessage } from '@/types/api';
import { acceptOpening, useOpening } from '../hooks/use-branch-day';
import { OpeningSheet } from './opening-sheet';

/**
 * "This morning" card on the Department Head landing — pending (`122U-0`: Review opening) and accepted (`1BIS-0`:
 * Confirmed · Accepted at 06:12). Owns the opening data and the review sheet, so the landing only places it.
 */
export function OpeningCard({ className }: { className?: string }) {
  const { opening, status, reload } = useOpening();
  const addToast = useWdsToastStore((s) => s.addToast);
  const [open, setOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const accept = React.useCallback(
    async (lines: { inventoryItemId: string; acceptedQty: string }[]) => {
      setSubmitting(true);
      setError(null);
      try {
        await acceptOpening(lines);
        await reload();
        setOpen(false);
        addToast({ variant: 'success', title: `Opening figures accepted — ${opening?.departmentName ?? 'your department'} is ready for the day` });
      } catch (err) {
        setError(formatApiErrorMessage(err, 'Something went wrong.'));
      } finally {
        setSubmitting(false);
      }
    },
    [reload, addToast, opening?.departmentName],
  );

  const accepted = opening?.status === 'ACCEPTED';

  return (
    <div className={cn('flex flex-col gap-2.5', className)}>
      {!accepted ? <span className="font-wds-mono text-wds-label font-semibold tracking-[0.06em] text-wds-neutral-500">THIS MORNING</span> : null}

      {status === 'error' && !opening ? (
        <div role="alert" className="flex flex-col gap-2 rounded-wds-sm border border-wds-border bg-wds-surface p-4">
          <span className="font-wds-sans text-[15px]/5 font-medium text-wds-text-ink">Couldn&apos;t load the opening figures</span>
          <button
            type="button"
            onClick={() => void reload()}
            className="w-max font-wds-sans text-[13px]/4 font-medium text-wds-primary underline underline-offset-[3px] outline-none focus-visible:shadow-wds-ring"
          >
            Retry
          </button>
        </div>
      ) : !opening ? (
        <div className="flex flex-col gap-3 rounded-wds-sm border border-wds-border bg-wds-surface p-4" role="status" aria-live="polite">
          <span className="sr-only">Loading this morning&apos;s opening</span>
          <div className="flex flex-col gap-1.5" aria-hidden>
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-2.5 w-48" />
          </div>
          <Skeleton className="h-9 w-full" aria-hidden />
        </div>
      ) : accepted ? (
        <div className="flex flex-col gap-2 rounded-[2px] border border-wds-border bg-wds-surface p-3.5">
          <span className="font-wds-sans text-[12px]/4 font-semibold uppercase tracking-[0.04em] text-wds-text-copy-muted">This morning</span>
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <span className="font-wds-sans text-[15px]/[18px] font-medium text-wds-text-ink">Opening count</span>
              <span className="font-wds-sans text-[12px]/4 text-wds-text-copy-muted">Accepted at {opening.acceptedAt ? formatClock(opening.acceptedAt) : '—'}</span>
            </div>
            <span className="flex shrink-0 items-center gap-[5px] rounded-[2px] bg-wds-success-bg px-2 py-1 font-wds-sans text-[12px]/4 font-medium text-wds-success-fg">
              <span className="size-1.5 shrink-0 rounded-full bg-wds-success-fg" aria-hidden />
              Confirmed
            </span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 rounded-wds-sm border border-wds-border bg-wds-surface p-4">
          <div className="flex flex-col gap-0.75">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-wds-sans text-[16px] font-semibold text-wds-text-ink">Opening count</span>
              <span className="flex shrink-0 items-center gap-[5px] font-wds-mono text-wds-mono-sm text-wds-warning-fg">
                <span className="size-1.5 shrink-0 rounded-full bg-wds-warning-fg" aria-hidden />
                awaiting review
              </span>
            </div>
            <span className="font-wds-mono text-wds-label text-wds-neutral-500">
              {opening.lines.length === 0 ? 'Nothing to open today' : opening.lastCloseAt ? 'Pre-filled from last night’s close' : 'Pre-filled from the ledger'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setOpen(true);
            }}
            className="flex h-9 shrink-0 touch-manipulation items-center justify-center rounded-wds-sm border border-wds-border-strong bg-wds-gradient-surface-raise font-wds-sans text-wds-body-sm text-wds-text-ink outline-none transition-[transform,filter] duration-150 ease-out hover:brightness-95 focus-visible:shadow-wds-ring motion-safe:active:scale-[0.98]"
          >
            Review opening
          </button>
        </div>
      )}

      <OpeningSheet
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setError(null);
        }}
        opening={opening}
        loadStatus={status}
        onRetryLoad={() => void reload()}
        submitting={submitting}
        error={error}
        onAccept={(lines) => void accept(lines)}
      />
    </div>
  );
}
