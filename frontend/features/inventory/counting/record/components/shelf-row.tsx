'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import type { ShelfLine } from '../hooks/use-shelf';

/**
 * One row of "Count the shelf" (Paper step 2, `1WIL-0`; the recount rows of step 4, `1WQJ-0`). Three looks: counted (green tick,
 * number in a box), skipped (dashed ring, dashed "Skipped" box) and being counted (the warm tint, bold name, a larger box with the
 * caret). A row other than the one being counted is a button: tapping it makes it the one being counted so its number can be
 * changed. The caret blinks unless the person prefers reduced motion. `onMove` adds a small "Move" action on the row being counted
 * (needs owner decision: Paper draws no control for step 41).
 */
export interface ShelfRowProps {
  line: ShelfLine;
  active: boolean;
  draft: string;
  recount?: boolean;
  /** Recount only: this row is waiting its turn. */
  upNext?: boolean;
  onSelect: () => void;
  onMove?: () => void;
}

/** The caret's blink and the wrong-PIN shake, declared once by the screen that draws them (no global stylesheet is edited). */
export function ShelfKeyframes() {
  return (
    <style>{`@keyframes scw-caret{0%,100%{opacity:1}50%{opacity:0}}@keyframes scw-shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-6px)}40%,80%{transform:translateX(6px)}}`}</style>
  );
}

const tick = (
  <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 12l5 5 9-10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function ShelfRow({ line, active, draft, recount = false, upNext = false, onSelect, onMove }: ShelfRowProps) {
  const done = line.counted !== '';
  const label = `${line.name}, ${line.unit}. ${done ? `${line.counted} counted` : line.skipped ? 'Skipped' : 'Not counted yet'}`;

  const marker = active ? (
    <span className="size-5 shrink-0 rounded-[10px] border-[1.5px] border-wds-selected-edge" aria-hidden />
  ) : done ? (
    <span className="flex size-5 shrink-0 items-center justify-center rounded-[10px] bg-wds-success-fg text-white" aria-hidden>
      {tick}
    </span>
  ) : line.skipped ? (
    <span className="flex size-5 shrink-0 items-center justify-center rounded-[10px] border-[1.5px] border-dashed border-wds-neutral-400" aria-hidden />
  ) : (
    <span className="size-5 shrink-0 rounded-[10px] border-[1.5px] border-wds-neutral-400" aria-hidden />
  );

  const text = (
    <span className="flex min-w-0 grow flex-col text-left">
      <span className={cn('truncate font-wds-sans text-[16px] leading-5 text-wds-text-ink', active && 'font-semibold')}>{line.name}</span>
      <span className="flex items-center gap-2">
        <span className="font-wds-sans text-[12px] leading-[15px] text-wds-text-muted">{line.unit}</span>
        {recount && active ? (
          <span className="border border-wds-warning-border bg-wds-warning-bg px-1.5 py-px font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-warning-fg">Recount</span>
        ) : null}
        {active && onMove && !recount ? (
          <button
            type="button"
            onClick={onMove}
            className="-my-3 flex h-11 items-center px-1 font-wds-sans text-[12px] font-medium leading-4 text-wds-selected-edge underline-offset-4 outline-none hover:underline focus-visible:shadow-wds-ring"
          >
            Move
          </button>
        ) : null}
      </span>
    </span>
  );

  if (active) {
    return (
      <div className={cn('flex shrink-0 items-center gap-3 border-b border-wds-border bg-wds-espresso-50 px-4', recount ? 'h-[72px]' : 'h-16')}>
        {marker}
        {text}
        <div
          aria-hidden="true"
          className="flex h-12 w-24 shrink-0 items-center justify-end gap-0.5 border-[1.5px] border-wds-selected-edge bg-wds-surface px-3"
        >
          <span className="font-wds-mono text-[22px] leading-7 text-wds-text-ink">{draft}</span>
          <span className="h-6 w-0.5 shrink-0 bg-wds-selected-edge motion-safe:animate-[scw-caret_1.1s_steps(1)_infinite]" />
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={upNext}
      aria-label={label}
      className={cn(
        'flex h-15 w-full shrink-0 items-center gap-3 border-b border-wds-border px-4 outline-none transition-[background-color] duration-100 focus-visible:bg-wds-neutral-50 focus-visible:shadow-[inset_0_0_0_2px_var(--wds-ring)]',
        'enabled:[@media(hover:hover)]:hover:bg-wds-neutral-50 enabled:active:bg-wds-neutral-100 disabled:cursor-default',
      )}
    >
      {marker}
      {text}
      {upNext ? (
        <span className="flex h-11 w-24 shrink-0 items-center justify-center border border-dashed border-wds-border-strong">
          <span className="font-wds-sans text-[13px] leading-4 text-wds-text-faint">Up next</span>
        </span>
      ) : line.skipped ? (
        <span className="flex h-11 w-24 shrink-0 items-center justify-center gap-1.5 border border-dashed border-wds-border-strong px-3">
          <span className="font-wds-sans text-[13px] leading-4 text-wds-text-faint">Skipped</span>
        </span>
      ) : done ? (
        <span className="flex h-11 w-24 shrink-0 items-center justify-end border border-wds-border-strong bg-wds-surface px-3">
          <span className="font-wds-mono text-[20px] leading-6 text-wds-text-ink">{line.counted}</span>
        </span>
      ) : (
        <span className="flex h-11 w-24 shrink-0 items-center justify-end border border-wds-border bg-wds-surface px-3" aria-hidden />
      )}
    </button>
  );
}
