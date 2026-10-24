'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';

import { FOCUS_RING, FilterChip, MOTION, StateButton, onHover, formatReference, STATES_FIXED, useStillLoading } from '../../../_shared';
import type { TimeFilter, TimeMonth } from '../../_shared/types/attendance-types';
import { FILTER_LABELS, FILTER_ORDER, monthWords, shiftMonth, summaryCells, type EmptyCopy } from '../lib/time-view';

const stepper = cn('flex h-8 w-8 items-center justify-center border border-wds-border-strong bg-wds-surface font-wds-sans text-[14px] leading-4 text-wds-text-ink disabled:pointer-events-none disabled:opacity-40', MOTION, FOCUS_RING, onHover('bg-wds-neutral-50'));

/** The month picker of the Time tab: [‹] [October 2026] [›]. The next arrow stops at this month. */
export function MonthPicker({ month, thisMonth, onChange }: { month: string; thisMonth: string; onChange: (month: string) => void }) {
  const move = (by: number): void => onChange(shiftMonth(month, by));
  return (
    <div role="group" aria-label="Month" className="flex items-center gap-2">
      <button type="button" aria-label="Previous month" onClick={() => move(-1)} className={stepper}>
        <span aria-hidden>‹</span>
      </button>
      <span aria-live="polite" className="flex h-8 min-w-[150px] items-center justify-center border border-wds-border bg-wds-surface px-4 font-wds-sans text-[14px] font-semibold leading-[18px] text-wds-text-ink">
        {monthWords(month)}
      </span>
      <button type="button" aria-label="Next month" disabled={month >= thisMonth} onClick={() => move(1)} className={stepper}>
        <span aria-hidden>›</span>
      </button>
    </div>
  );
}

/** The five figures of the month (Paper 1.1): one bordered band, a cell each. Late and absent read red-brown when there is something to see. */
export function SummaryRow({ time }: { time: TimeMonth }) {
  return (
    <div role="group" aria-label={`${monthWords(time.month)}, in figures`} className="grid grid-cols-2 border border-wds-border bg-wds-surface md:grid-cols-5">
      {summaryCells(time).map((c, i) => (
        <div key={c.key} className={cn('flex min-w-0 flex-col gap-1.5 px-5 py-4', i > 0 && 'md:border-l md:border-l-wds-border')}>
          <span className="font-wds-mono text-[10px] leading-3 tracking-[0.06em] text-wds-text-secondary">{c.label}</span>
          <span className={cn('font-wds-sans text-[26px] font-semibold leading-8 tracking-[-0.025em]', c.tone === 'error' ? 'text-wds-error-fg' : 'text-wds-text-ink')}>{c.value}</span>
          <span className="font-wds-sans text-[13px] leading-4 text-wds-text-secondary">{c.detail}</span>
        </div>
      ))}
    </div>
  );
}

/** The chips with counts: All days 24, Late 2, Overtime 1, Absent 1. */
export function DayChips({ counts, value, onChange }: { counts: TimeMonth['counts']; value: TimeFilter; onChange: (filter: TimeFilter) => void }) {
  return (
    <div role="group" aria-label="Show" className="flex flex-wrap gap-2">
      {FILTER_ORDER.map((f) => (
        <FilterChip key={f} label={FILTER_LABELS[f]} count={counts[f]} selected={value === f} onClick={() => onChange(f)} />
      ))}
    </div>
  );
}

/** Loading (Paper 1.5): the summary and the days are grey blocks; the month picker stays. */
export function TimeSkeleton() {
  const late = useStillLoading(true);
  const bar = (w: number, h = 12, shade = 'bg-wds-neutral-100') => <span aria-hidden className={cn('block motion-safe:animate-pulse', shade)} style={{ width: w, height: h }} />;
  return (
    <div role="status" aria-busy="true" aria-label="Loading the time" className="flex flex-col gap-3">
      <div className="grid grid-cols-2 border border-wds-border bg-wds-surface md:grid-cols-5">
        {[80, 60, 70, 80, 60].map((w, i) => (
          <div key={i} className={cn('flex flex-col gap-2 px-5 py-4', i > 0 && 'md:border-l md:border-l-wds-border')}>
            {bar(80)}
            {bar(w - 20, 24)}
            {bar(100)}
          </div>
        ))}
      </div>
      <div className="border border-wds-border bg-wds-surface">
        <div className="h-9 border-b border-wds-text-ink" />
        {[0, 1, 2].map((r) => (
          <div key={r} className={cn('flex gap-4 px-5 py-4', r < 2 && 'border-b border-wds-neutral-100')}>
            {[90, 110, 60, 60, 70].map((w, i) => (
              <React.Fragment key={i}>{bar(w)}</React.Fragment>
            ))}
          </div>
        ))}
      </div>
      {late ? <p className="m-0 font-wds-sans text-[12px] leading-[18px] text-wds-text-secondary">{STATES_FIXED.stillLoading}</p> : null}
    </div>
  );
}

/** Busy and error (Paper 1.5): a card with a coloured top edge, a title, one line, a reference for an error, and Try again. */
export function TimeProblem({ busy, title, line, reference, onRetry }: { busy: boolean; title: string; line: string; reference?: string; onRetry: () => void }) {
  return (
    <div role="alert" className={cn('flex flex-col gap-2 border border-wds-border border-t-2 bg-wds-surface px-8 py-6', busy ? 'border-t-wds-caramel-600' : 'border-t-wds-espresso-700')}>
      <h3 className="m-0 font-wds-sans text-[18px] font-semibold leading-6 text-wds-text-ink">{title}</h3>
      <p className="m-0 font-wds-sans text-[14px] leading-5 text-wds-text-secondary">
        {line}
        {reference ? ` ${STATES_FIXED.referencePrefix} ${formatReference(reference)}.` : ''}
      </p>
      <div className="mt-2 flex">
        <StateButton primary={!busy} onClick={onRetry}>
          {STATES_FIXED.tryAgain}
        </StateButton>
      </div>
    </div>
  );
}

/** The empty states of Paper 1.4: a person who does not clock, a branch whose clock is off. Black top edge, title, one line. */
export function TimeEmpty({ copy }: { copy: EmptyCopy }) {
  return (
    <div className="flex flex-col gap-2 border border-wds-border border-t-2 border-t-wds-text-ink bg-wds-surface px-8 py-10">
      <h3 className="m-0 font-wds-sans text-[18px] font-semibold leading-6 text-wds-text-ink">{copy.title}</h3>
      <p className="m-0 max-w-[560px] font-wds-sans text-[14px] leading-5 text-wds-text-secondary">{copy.line}</p>
    </div>
  );
}

/** The dashed note at the foot (Paper 1.1). Not a feature: it keeps the place for Unaccounted items and the lateness actions. */
export function SpaceKept() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border border-dashed border-wds-border-strong px-5 py-4">
      <span className="font-wds-sans text-[13px] leading-4 text-wds-text-secondary">Space kept here for Unaccounted items and the lateness actions. They are drawn and built later.</span>
      <span className="bg-wds-neutral-100 px-2.5 py-1 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">Not part of this design</span>
    </div>
  );
}
