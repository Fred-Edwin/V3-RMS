import { cn } from '@/lib/cn';

/**
 * NOW + ADD → NEW (spec Step 15): three fixed-width columns with fixed separators so the figures do not jump as they change. NEW is green
 * when the balance goes up and amber when it goes down. The ADD box is a real input the dialog owns.
 */
export function AdjustFigures({ now, next, loading, input }: { now: number | null; next: number | null; loading: boolean; input: React.ReactNode }) {
  const up = now !== null && next !== null && next > now;
  const down = now !== null && next !== null && next < now;
  const figure = (value: number | null): string => (loading || value === null ? '…' : `${value} d`);
  return (
    <div className="flex items-end gap-2 border border-wds-border bg-wds-canvas p-4" role="group" aria-label="Balance now, days to add, new balance">
      <div className="flex w-[84px] flex-col gap-1">
        <span className="font-wds-mono text-[10px] leading-3 tracking-[0.06em] text-wds-text-secondary">NOW</span>
        <span className="font-wds-mono text-[20px] leading-6 text-wds-text-ink">{figure(now)}</span>
      </div>
      <span aria-hidden className="w-4 pb-2 text-center font-wds-mono text-[16px] text-wds-text-faint">+</span>
      <div className="flex w-[120px] flex-col gap-1">
        <span className="font-wds-mono text-[10px] leading-3 tracking-[0.06em] text-wds-text-secondary">ADD</span>
        {input}
      </div>
      <span aria-hidden className="w-4 pb-2 text-center font-wds-mono text-[16px] text-wds-text-faint">→</span>
      <div className="flex w-[84px] flex-col gap-1" aria-live="polite">
        <span className="font-wds-mono text-[10px] leading-3 tracking-[0.06em] text-wds-text-secondary">NEW</span>
        <span className={cn('font-wds-mono text-[20px] leading-6', up ? 'text-wds-success-fg' : down ? 'text-wds-warning-fg' : 'text-wds-text-ink')}>{figure(next)}</span>
      </div>
    </div>
  );
}
