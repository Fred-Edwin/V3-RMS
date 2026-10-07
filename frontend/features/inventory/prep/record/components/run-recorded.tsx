'use client';

import * as React from 'react';

import { Button } from '@/components/ui2/button';
import { YIELD_REASONS } from '../../_shared/lib/states-copy';
import { formatClock, formatDayAndClock, formatQuantity } from '../../_shared/lib/prep-format';
import type { RunDetail } from '../../_shared/types/prep-contract';

/**
 * "Recorded" (Paper steps 5 and 8): the check, "38 portions recorded", Used / Made / Recorded by, and either "Made a slip?" (the
 * 24-hour window) or, when the yield was off, "Sent to the Store Manager". The yield note is read off the run's own vs-usual figure,
 * which the Attendant already saw as a warning; the silent stock flag is never sent to them, so it cannot show here.
 */
export function RunRecorded({ run, onDone, onAgain }: { run: RunDetail; onDone: () => void; onAgain: () => void }) {
  const off = run.vsUsual.label === 'LOW' || run.vsUsual.label === 'HIGH';
  const isManager = run.flags !== undefined;
  const said = run.yieldReason ? YIELD_REASONS.find((r) => r.value === run.yieldReason)?.label : null;
  const used = run.inputs.map((l) => `${l.itemName} ${formatQuantity(l.quantity)} ${l.unit}`).join(' · ');
  const row = 'flex items-baseline justify-between gap-wds-4 border-b border-wds-neutral-100 px-wds-3 py-wds-3 last:border-b-0';

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-1 flex-col gap-wds-5 p-wds-4 md:py-wds-8">
      <div className="flex flex-col items-center gap-wds-3 pt-wds-6 text-center">
        <span className="flex size-14 items-center justify-center rounded-full border border-wds-success-border bg-wds-success-bg text-wds-success-fg" aria-hidden>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </span>
        <h2 className="font-wds-sans text-[20px] font-semibold leading-6 text-wds-text-ink" role="status">
          {formatQuantity(run.made)} {run.unit} recorded
        </h2>
        <p className="font-wds-mono text-wds-caption text-wds-text-copy-muted">{run.reference}</p>
      </div>

      <dl className="border border-wds-border bg-wds-surface">
        <div className={row}>
          <dt className="font-wds-sans text-wds-caption text-wds-text-copy-muted">Used</dt>
          <dd className="min-w-0 text-right font-wds-sans text-wds-body-sm font-medium text-wds-text-ink">{used}</dd>
        </div>
        <div className={row}>
          <dt className="font-wds-sans text-wds-caption text-wds-text-copy-muted">Made</dt>
          <dd className="min-w-0 text-right font-wds-sans text-wds-body-sm font-medium text-wds-text-ink">
            {run.outputName} {formatQuantity(run.made)} {run.unit}
          </dd>
        </div>
        <div className={row}>
          <dt className="font-wds-sans text-wds-caption text-wds-text-copy-muted">Recorded by</dt>
          <dd className="min-w-0 text-right font-wds-sans text-wds-body-sm font-medium text-wds-text-ink">
            {run.by.name} · {formatClock(run.at)}
          </dd>
        </div>
        {said ? (
          <div className={row}>
            <dt className="font-wds-sans text-wds-caption text-wds-text-copy-muted">You said</dt>
            <dd className="min-w-0 text-right font-wds-sans text-wds-body-sm font-medium text-wds-text-ink">{said}</dd>
          </div>
        ) : null}
      </dl>

      {off && !isManager ? (
        <div role="status" className="flex flex-col gap-0.5 border border-wds-warning-border bg-wds-warning-bg px-wds-3 py-wds-3 font-wds-sans text-wds-warning-fg">
          <span className="text-wds-body-sm font-medium">Sent to the Store Manager</span>
          <span className="text-wds-body-sm">The yield was {run.vsUsual.label === 'LOW' ? 'lower' : 'higher'} than usual, so the Store Manager will take a look. Nothing for you to do.</span>
        </div>
      ) : (
        <div className="flex flex-col gap-0.5 border border-wds-border bg-wds-neutral-50 px-wds-3 py-wds-3 font-wds-sans">
          <span className="text-wds-body-sm font-medium text-wds-text-ink">Made a slip?</span>
          <span className="text-wds-body-sm text-wds-text-copy-muted">
            {run.windowEndsAt ? `You can correct or cancel this run until ${formatDayAndClock(run.windowEndsAt)}, from Recent runs.` : 'You can correct or cancel this run for the next 24 hours, from Recent runs.'}
          </span>
        </div>
      )}

      <div className="mt-auto flex flex-col gap-wds-2 pb-wds-2">
        <Button className="h-12 w-full text-[15px]" onClick={onDone}>
          Done
        </Button>
        <Button variant="secondary" className="h-11 w-full text-[15px]" onClick={onAgain}>
          Prep this again
        </Button>
      </div>
    </div>
  );
}
