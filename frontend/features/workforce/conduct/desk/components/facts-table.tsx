import { cn } from '@/lib/cn';

import { factsClock, factsDay } from '../../_shared/lib/conduct-dates';
import type { FactsRow } from '../../_shared/types/conduct-types';

/**
 * "What the timesheets say" (Paper 1GYE-0): DAY, IN, LATE for each unexcused day, then a TOTAL row under a 2 px ink rule. A day is tinted
 * only when the server could match a date typed in the appeal text to it (`named`); otherwise no row is tinted. An excused day says so.
 * It is a real table, with column scopes, so a screen reader reads each day as a row.
 */
export function FactsTable({ rows, totalMinutes, kind }: { rows: readonly FactsRow[]; totalMinutes: number; kind: string }) {
  const absence = kind !== 'LATENESS';
  return (
    <table aria-label="What the timesheets say" className="w-full border-collapse font-wds-sans text-[13px] leading-4">
      <thead>
        <tr className="border-b border-wds-border">
          <th scope="col" className="py-2 text-left font-wds-mono text-[10px] font-normal leading-3 tracking-[0.08em] text-wds-text-secondary">DAY</th>
          {absence ? null : <th scope="col" className="py-2 text-left font-wds-mono text-[10px] font-normal leading-3 tracking-[0.08em] text-wds-text-secondary">IN</th>}
          <th scope="col" className="py-2 text-right font-wds-mono text-[10px] font-normal leading-3 tracking-[0.08em] text-wds-text-secondary">{absence ? 'MINUTES' : 'LATE'}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.date} className={cn('border-b border-wds-neutral-100', row.named && 'bg-wds-warning-bg')}>
            <td className="py-2 pr-2 text-wds-text-ink">
              {factsDay(row.date)}
              {row.named ? <span className="sr-only"> (named in the appeal)</span> : null}
              {row.excused ? <span className="ml-2 text-[11px] text-wds-success-fg">excused</span> : null}
            </td>
            {absence ? null : <td className="py-2 pr-2 font-wds-mono text-wds-text-ink">{factsClock(row.clockIn)}</td>}
            <td className="py-2 text-right font-wds-mono text-wds-text-ink">{row.minutesLate} min</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t-2 border-wds-text-ink">
          <th scope="row" colSpan={absence ? 1 : 2} className="py-2 text-left font-wds-mono text-[10px] font-normal leading-3 tracking-[0.08em] text-wds-text-secondary">TOTAL</th>
          <td className="py-2 text-right font-wds-mono font-semibold text-wds-text-ink">{totalMinutes} min</td>
        </tr>
      </tfoot>
    </table>
  );
}
