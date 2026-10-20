import { cn } from '@/lib/cn';

import type { LegacyRow } from '../types/conduct-types';
import { dayMonthYear } from '../lib/conduct-dates';

/**
 * Old HR records, read only, under "Before the new system" (spec C2). No letter, no download, no sign button, and they never count
 * towards the ladder. Used by the staff list and the employee file's Conduct tab, so both say it the same way.
 */
export function LegacyRows({ rows, className }: { rows: readonly LegacyRow[]; className?: string }) {
  return (
    <section aria-label="Before the new system" className={cn('flex flex-col gap-2', className)}>
      <h2 className="m-0 font-wds-mono text-[10px] leading-3 tracking-[0.08em] text-wds-text-secondary">BEFORE THE NEW SYSTEM · READ ONLY</h2>
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {rows.map((row) => (
          <li key={row.id} className="flex items-baseline justify-between gap-3 border border-wds-border bg-wds-neutral-50 px-3.5 py-3">
            <span className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{row.label}</span>
            <span className="shrink-0 font-wds-mono text-[11px] leading-[14px] text-wds-text-faint">{dayMonthYear(row.actionDate)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
