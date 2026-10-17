import * as React from 'react';

import { cn } from '@/lib/cn';

/**
 * Timelines.
 * - `LifeTimeline` ("Life at Wendo", Paper employee file 11LC-0): 20 px dots
 *   with the concentric ring (outer caramel ring, inner green dot) on a 1 px
 *   line; a dashed empty dot for something still to come.
 * - `ComingUpTimeline` (HR Home, POH-0): 9 px dots with a white gap and a thin
 *   coloured ring, joined by a line to the next item.
 *
 * Both are lists (`ol`), so a screen reader hears the order and the count. Dates
 * and words are props, written in the screen's copy; nothing is formatted here.
 */
export interface TimelineEvent {
  key: string;
  /** Mono caption, capitals ("14 JUL"). */
  date: string;
  text: string;
}

export interface LifeEvent extends TimelineEvent {
  /** `future` draws the dashed dot and the warning text: a decision still to come. */
  state?: 'done' | 'future';
}

export function LifeTimeline({ events, className }: { events: LifeEvent[]; className?: string }) {
  return (
    <ol className={cn('relative flex justify-between pt-0.5', className)}>
      <div aria-hidden className="absolute left-2.5 right-2.5 top-2.5 h-px bg-wds-border-strong" />
      {events.map((e) => {
        const future = e.state === 'future';
        return (
          <li key={e.key} className="relative flex w-[200px] shrink-0 flex-col gap-[5px]">
            <span
              aria-hidden
              className={cn(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-wds-caramel-600 bg-wds-canvas',
                future && 'border-dashed'
              )}
            >
              {future ? null : <span className="h-2 w-2 rounded-full bg-wds-success-fg" />}
            </span>
            <span className={cn('font-wds-mono text-[10px] leading-3', future ? 'text-wds-warning-fg' : 'text-wds-text-secondary')}>
              {e.date}
            </span>
            <span className={cn('font-wds-sans text-[13px] leading-4', future ? 'text-wds-warning-fg' : 'text-wds-text-ink')}>
              {e.text}
              {future ? <span className="sr-only"> (still to come)</span> : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export interface ComingUpEvent extends TimelineEvent {
  /** `good` is the green end-of-line item (payday); the rest are the brown-edged dots. */
  tone?: 'default' | 'good';
}

export function ComingUpTimeline({ events, className }: { events: ComingUpEvent[]; className?: string }) {
  return (
    <ol className={cn('flex items-start', className)}>
      {events.map((e, i) => {
        const good = e.tone === 'good';
        const last = i === events.length - 1;
        return (
          <li key={e.key} className="flex min-w-0 flex-1 flex-col gap-2.5">
            <span className="flex items-center" aria-hidden>
              <span
                className={cn(
                  'ml-1 h-[9px] w-[9px] shrink-0 rounded-full',
                  good
                    ? 'bg-wds-success-fg shadow-[0_0_0_3px_var(--wds-canvas),0_0_0_4px_var(--wds-success-fg)]'
                    : 'bg-wds-selected-edge shadow-[0_0_0_3px_var(--wds-canvas),0_0_0_4px_var(--wds-selected-edge)]'
                )}
              />
              <span className={cn('h-px flex-1', last ? 'bg-transparent' : 'bg-wds-border-strong')} />
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="font-wds-mono text-[11px] leading-[14px] tracking-[0.04em] text-wds-text-secondary">{e.date}</span>
              <span className="font-wds-sans text-[13px] leading-4 text-wds-text-ink">{e.text}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
