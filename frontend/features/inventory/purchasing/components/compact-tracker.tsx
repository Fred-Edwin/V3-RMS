import * as React from 'react';

import { cn } from '@/lib/cn';
import type { TrackerItem } from '../types';

const LABEL: Record<TrackerItem['step'], string> = { RAISED: 'Raised', APPROVED: 'Approved', SENT: 'Sent', DELIVERED: 'Delivered', INVOICED: 'Invoiced', PAID: 'Paid' };

/** Compact stage tracker used in the drawers and the phone screens (Paper "Compact tracker"): a dot and a word per stage. */
export function CompactTracker({ tracker, className }: { tracker: TrackerItem[]; className?: string }) {
  return (
    <ol className={cn('flex items-start', className)} aria-label="Order stages">
      {tracker.map((t, i) => (
        <li key={t.step} className={cn('flex flex-col gap-1.5', i < tracker.length - 1 ? 'grow' : '')} aria-current={t.state === 'CURRENT' ? 'step' : undefined}>
          <span className="flex items-center">
            <span
              className={cn(
                'size-2.5 shrink-0 rounded-full border-2',
                t.state === 'DONE' ? 'border-wds-success-fg bg-wds-success-fg' : t.state === 'CURRENT' ? 'border-wds-primary bg-wds-surface' : 'border-wds-neutral-300 bg-wds-surface'
              )}
            />
            {i < tracker.length - 1 ? <span className={cn('mx-1 h-0.5 grow', t.state === 'DONE' ? 'bg-wds-success-fg' : 'bg-wds-neutral-300')} /> : null}
          </span>
          <span className={cn('font-wds-sans text-[11px] leading-[14px]', t.state === 'TODO' ? 'text-wds-text-faint' : 'text-wds-neutral-950')}>{LABEL[t.step]}</span>
        </li>
      ))}
    </ol>
  );
}
