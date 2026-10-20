import { cn } from '@/lib/cn';

import { Amount } from '../../_shared/components/amount';
import { money } from '../../_shared/lib/pay-words';
import type { LineView } from '../../_shared/types/payslip-types';

/**
 * One panel of the payslip (Earned / Taken off): a real table with a caption, header cells and one row per line. A line the correction
 * changed is filled and says "corrected from"; the old figure and every working line (they contain figures) appear only while amounts are shown.
 */
export function SectionTable({ caption, heading, lines, totalLabel, total, shown, zeroKeys = [] }: { caption: string; heading: string; lines: readonly LineView[]; totalLabel: string; total: string; shown: boolean; zeroKeys?: readonly string[] }) {
  const visible = lines.filter((l) => Number(l.amount) !== 0 || zeroKeys.includes(l.key) || l.correctedFrom !== null);
  return (
    <table className="w-full border-collapse border border-wds-border bg-wds-surface text-left">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr>
          <th scope="col" colSpan={2} className="border-b border-wds-text-ink px-3.5 py-2.5 font-wds-mono text-[10px] font-normal leading-3 tracking-[0.06em] text-wds-text-secondary">
            {heading}
          </th>
        </tr>
      </thead>
      <tbody>
        {visible.map((l) => {
          const zero = Number(l.amount) === 0 && l.correctedFrom === null;
          return (
            <tr key={l.key} className={cn('border-b border-wds-neutral-100 align-top', l.correctedFrom !== null && 'bg-wds-warning-bg')}>
              <th scope="row" className="px-3.5 py-2.5 font-wds-sans text-[14px] font-normal leading-[18px] text-wds-text-ink">
                {l.label}
                {l.correctedFrom !== null ? (
                  <span className="block text-[11px] leading-[14px] text-wds-warning-fg">{shown ? `corrected from ${money(l.correctedFrom)}` : 'corrected'}</span>
                ) : null}
                {shown && l.working ? <span className="block text-[11px] leading-[14px] text-wds-text-secondary">{l.working}</span> : null}
              </th>
              <td className="whitespace-nowrap px-3.5 py-2.5 text-right">
                <Amount value={l.amount} shown={shown} dots={4} className={cn('text-[14px] leading-[18px]', zero ? 'text-wds-neutral-400' : 'text-wds-text-ink')} />
              </td>
            </tr>
          );
        })}
      </tbody>
      <tfoot>
        <tr>
          <th scope="row" className="px-3.5 py-2.5 font-wds-sans text-[14px] font-semibold leading-[18px] text-wds-text-ink">
            {totalLabel}
          </th>
          <td className="px-3.5 py-2.5 text-right">
            <Amount value={total} shown={shown} dots={5} className="text-[14px] font-semibold leading-[18px] text-wds-text-ink" />
          </td>
        </tr>
      </tfoot>
    </table>
  );
}
