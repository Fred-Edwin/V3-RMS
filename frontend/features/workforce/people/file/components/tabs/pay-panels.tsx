import * as React from 'react';

import { Button } from '@/components/ui2/button';
import { cn } from '@/lib/cn';

import { KeyValueRows, VALUE_TONE_CLASS } from '../../../../_shared';
import { PANEL_ROWS, PanelCaption, TitledPanel } from '../../../_shared/components/titled-panel';
import { formatDayMonthYear, formatKes } from '../../../_shared/lib/people-dates';
import type { EmployeeFile, PayChangeRow, PayView } from '../../../_shared/types/people-types';
import { payHistoryLines, payRows } from '../../lib/file-rows';

/** "Pay · HR AND ACCOUNTANT ONLY": the amount (with "starts <date>" before its day), overtime, lateness. */
export function PayPanel({ pay, file, today }: { pay: PayView; file: EmployeeFile; today: string }) {
  return (
    <TitledPanel title="Pay" aside={<PanelCaption>HR AND ACCOUNTANT ONLY</PanelCaption>}>
      <KeyValueRows rows={payRows(pay, file.contractStatus, today)} aria-label="Pay" topRule={false} className={PANEL_ROWS} />
    </TitledPanel>
  );
}

/** A pay change waiting for the Director. Whoever may approve gets the two buttons; everyone else just sees it is waiting. */
export function PendingPayChange({ change, canDecide, onDecide }: { change: PayChangeRow; canDecide: boolean; onDecide: () => void }) {
  return (
    <section aria-label="Pay change waiting" className="flex items-center justify-between gap-4 border border-wds-warning-border border-l-4 border-l-wds-caramel-600 bg-wds-warning-bg px-4 py-3.5 max-sm:flex-col max-sm:items-start">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="font-wds-sans text-[14px] font-semibold leading-[18px] text-wds-text-ink">
          {formatKes(change.amount)} from {formatDayMonthYear(change.effectiveFrom)} is waiting for the Director
        </span>
        <span className="font-wds-sans text-[13px] leading-4 text-wds-text-secondary">Asked by {change.requestedByName ?? 'HR'} on {formatDayMonthYear(change.requestedOn)}. The pay stays as it is until it is approved.</span>
      </div>
      {canDecide ? (
        <Button type="button" onClick={onDecide}>
          Review
        </Button>
      ) : null}
    </section>
  );
}

/** "Pay history · NOTHING IS OVERWRITTEN": newest first, with the reason in the tone of what became of it. */
export function PayHistory({ history }: { history: PayChangeRow[] }) {
  const lines = payHistoryLines(history);
  return (
    <TitledPanel title="Pay history" aside={<PanelCaption>NOTHING IS OVERWRITTEN</PanelCaption>}>
      <table className="w-full border-collapse text-left">
        <thead>
          <tr>
            {['FROM', 'BASIC PAY', 'CHANGED BY', 'REASON'].map((h) => (
              <th key={h} scope="col" className="border-b border-wds-text-ink px-4 py-2.5 font-wds-mono text-[10px] font-normal leading-3 tracking-[0.06em] text-wds-text-secondary">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-4 py-4 font-wds-sans text-[13px] leading-4 text-wds-text-secondary">
                No pay has been set yet. Change pay records the first amount and the day it starts.
              </td>
            </tr>
          ) : null}
          {lines.map((l) => (
            <tr key={l.id}>
              <td className="border-b border-wds-neutral-100 whitespace-nowrap px-4 py-3 font-wds-mono text-[13px] leading-4 text-wds-text-ink">{l.from}</td>
              <td className="border-b border-wds-neutral-100 whitespace-nowrap px-4 py-3 font-wds-mono text-[13px] leading-4 text-wds-text-ink">{l.amount}</td>
              <td className="border-b border-wds-neutral-100 px-4 py-3 font-wds-sans text-[13px] leading-4 text-wds-text-ink">{l.by}</td>
              <td className={cn('border-b border-wds-neutral-100 px-4 py-3 font-wds-sans text-[13px] leading-4', VALUE_TONE_CLASS[l.tone])}>{l.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TitledPanel>
  );
}
