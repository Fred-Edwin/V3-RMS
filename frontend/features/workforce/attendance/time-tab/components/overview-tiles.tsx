'use client';

import { cn } from '@/lib/cn';

import { useTimeTiles } from '../hooks/use-time-month';
import { tileViews } from '../lib/time-view';

/**
 * The three tiles on the employee file's Overview (Paper 1.3): On time, Overtime, Leave left, from T2. A person who does not clock reads
 * "Not tracked / Does not clock in". Shown only to a viewer with `timesheet.read` (the caller decides); while loading, or if T2 fails,
 * nothing is drawn, since the Overview works without them.
 */
export function TimeTiles({ employeeId }: { employeeId: string }) {
  const tiles = useTimeTiles(employeeId);
  if (!tiles.data) return null;
  return (
    <div role="group" aria-label="Time, in figures" className="grid w-full max-w-[560px] grid-cols-1 border border-wds-border bg-wds-surface sm:grid-cols-3">
      {tileViews(tiles.data).map((t, i) => (
        <div key={t.key} className={cn('flex min-w-0 flex-col gap-1.5 px-5 py-4', i > 0 && 'border-t border-t-wds-border sm:border-l sm:border-t-0 sm:border-l-wds-border')}>
          <span className="font-wds-mono text-[10px] leading-3 tracking-[0.06em] text-wds-text-secondary">{t.label}</span>
          <span className={cn('font-wds-sans text-[26px] font-semibold leading-8 tracking-[-0.025em]', t.muted ? 'text-wds-text-secondary' : 'text-wds-text-ink')}>{t.value}</span>
          <span className="font-wds-sans text-[13px] leading-[17px] text-wds-text-secondary">{t.detail}</span>
        </div>
      ))}
    </div>
  );
}
