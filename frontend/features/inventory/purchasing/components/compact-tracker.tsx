import * as React from 'react';

import { cn } from '@/lib/cn';
import type { TrackerItem } from '../types';

const LABEL: Record<TrackerItem['step'], string> = { RAISED: 'Raised', APPROVED: 'Approved', SENT: 'Sent', DELIVERED: 'Delivered', INVOICED: 'Invoiced', PAID: 'Paid' };

/** One 16 px stage circle (Paper 28 tracker): done is a green disc with a white check, current a white disc with a primary ring, to do a grey ring. */
function Circle({ state }: { state: TrackerItem['state'] }) {
  if (state === 'DONE') {
    return (
      <span aria-hidden="true" className="flex size-4 shrink-0 items-center justify-center rounded-full bg-wds-success-fg">
        <svg width="16" height="16" viewBox="0 0 16 16">
          <path d="M4.6 8.3l2.3 2.3 4.5-4.9" fill="none" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  return <span aria-hidden="true" className={cn('box-border size-4 shrink-0 rounded-full border-2 bg-white', state === 'CURRENT' ? 'border-[var(--wds-primary-btn-start)]' : 'border-wds-border-strong')} />;
}

const connector = (state: TrackerItem['state']): string => (state === 'DONE' ? 'bg-wds-success-fg' : 'bg-wds-border-strong');

/**
 * The stage tracker, one component in two forms (Paper 28A to 28L).
 * - `dots`: circles joined by connectors, no labels (the cards on My orders and Home, and the strip on a returned order).
 * - `labelled` (default): a word under each circle; five equal columns and a fixed 32 px last column (Paid). `strip` draws the white
 *   band with its bottom border that the phone order pages use; the drawers and the Receive screen leave it off.
 */
export function CompactTracker({ tracker, className, variant = 'labelled', strip = false }: { tracker: TrackerItem[]; className?: string; variant?: 'labelled' | 'dots'; strip?: boolean }) {
  if (variant === 'dots') {
    return (
      <ol className={cn('flex items-center', className)} aria-label="Order stages">
        {tracker.map((t, i) => (
          <li key={t.step} className={cn('flex items-center', i < tracker.length - 1 && 'grow')} aria-current={t.state === 'CURRENT' ? 'step' : undefined}>
            <Circle state={t.state} />
            <span className="sr-only">{`${LABEL[t.step]}, ${t.state === 'DONE' ? 'done' : t.state === 'CURRENT' ? 'now' : 'to come'}`}</span>
            {i < tracker.length - 1 ? <span aria-hidden="true" className={cn('h-0.5 grow', connector(t.state))} /> : null}
          </li>
        ))}
      </ol>
    );
  }
  return (
    <ol className={cn('flex items-start', strip && 'border-b border-wds-border bg-white px-5 py-3', className)} aria-label="Order stages">
      {tracker.map((t, i) => {
        const last = i === tracker.length - 1;
        return (
          <li key={t.step} className={cn('flex flex-col gap-[5px]', last ? 'w-8 shrink-0' : 'min-w-0 flex-[1_1_0]')} aria-current={t.state === 'CURRENT' ? 'step' : undefined}>
            <span className="flex items-center">
              <Circle state={t.state} />
              {!last ? <span aria-hidden="true" className={cn('h-0.5 grow', connector(t.state))} /> : null}
            </span>
            <span className={cn('font-wds-sans text-[10px] leading-3', t.state === 'CURRENT' ? 'font-semibold text-[var(--wds-primary-btn-start)]' : t.state === 'DONE' ? 'text-wds-text-ink' : 'text-wds-text-secondary')}>
              {LABEL[t.step]}
              <span className="sr-only">{t.state === 'DONE' ? ', done' : t.state === 'CURRENT' ? ', now' : ', to come'}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
