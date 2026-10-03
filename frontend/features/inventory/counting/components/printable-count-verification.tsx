import * as React from 'react';

import type { CountPrint } from '../types/count';
import {
  formatCountDateFull,
  formatCountDateLong,
  formatDayMonthClock,
  formatSignedKes,
  formatVariance,
} from '../../_shared/components/stock-format';

/**
 * Printable count verification — A4, Times New Roman, like the delivery note
 * and purchase list (`1AMZ-0` flagged / `1AP7-0` clean; Milestone Six
 * Session 2). One document for daily and spot counts. With 5+ adjustments the
 * largest three print and the rest are summarised by their ADJ range.
 */
const label = 'text-[11px] font-bold uppercase leading-[14px] tracking-[0.06em] text-[#777777]';
const MAX_ROWS = 4;

function generatedAt(iso: string): string {
  return formatDayMonthClock(iso).replace(' · ', ', ');
}

export function PrintableCountVerification({ doc }: { doc: CountPrint }) {
  const { totals } = doc;
  const spot = doc.kind === 'SPOT';
  const title = spot ? 'SPOT COUNT VERIFICATION' : 'DAILY COUNT VERIFICATION';
  const clean = totals.varianceLines === 0;
  const shownRows = doc.adjustments.length > MAX_ROWS ? doc.adjustments.slice(0, MAX_ROWS - 1) : doc.adjustments;
  const rest = doc.adjustments.slice(shownRows.length);
  const restRefs = rest.map((a) => a.reference).sort();
  const statusText = doc.status === 'VERIFIED' ? 'Verified' : doc.status === 'SUBMITTED' ? 'Awaiting verification' : 'Sent back for recount';

  const alertNames = doc.directorAlertItems.map((i) => `${i.itemName} ${formatVariance(i.variance, i.usageUnit === 'units' ? '' : i.usageUnit)}`);
  const note = clean
    ? `All ${totals.lines} lines matched the expected quantity. No adjustments written.`
    : `${doc.directorAlertItems.length > 0 ? `${alertNames.join(', ')} ${doc.directorAlertItems.length === 1 ? 'was' : 'were'} above the Director threshold — a director was alerted on signing. ` : ''}${
        spot ? 'The Store Manager counted these items directly against the ledger. ' : "The attendant's figures were never editable; the Store Manager accepted or queried each line. "
      }${doc.adjustments.length === 1 ? 'The adjustment is' : `All ${doc.adjustments.length} adjustments are`} now written and immutable.`;

  return (
    <div className="mx-auto flex min-h-[1123px] w-[794px] flex-col bg-white font-['Times_New_Roman',serif] text-[#111111] print:w-full">
      <div className="flex flex-col gap-5 px-12 pt-10">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-0.5">
            <div className="text-[30px] font-bold leading-9 tracking-[0.01em]">Wendo Coffee Bistro</div>
            <div className="text-[12px] leading-4 tracking-[0.02em] text-[#555555]">Central Store</div>
          </div>
          <div className="flex flex-col items-end gap-[3px]">
            <div className="text-[20px] font-bold leading-6 tracking-[0.01em]">{title}</div>
            <div className="text-[13px] leading-4 text-[#333333]">No. {doc.reference}</div>
            <div className="text-[12px] leading-4 text-[#777777]">{formatCountDateFull(doc.countDate)}</div>
          </div>
        </div>
        <div className="h-[2px] shrink-0 bg-[#111111]" />
      </div>

      <div className="flex gap-8 border-b border-[#CCCCCC] px-12 py-5">
        <div className="flex grow basis-0 flex-col gap-[5px]">
          <div className={label}>Location</div>
          <div className="text-[14px] font-bold leading-[18px]">{doc.locationName} (Hub)</div>
          <div className="text-[13px] leading-4 text-[#555555]">
            {spot ? 'Spot count' : 'Daily count'} · {formatCountDateLong(doc.countDate)}
          </div>
        </div>
        <div className="flex grow basis-0 flex-col gap-[5px]">
          <div className={label}>Result</div>
          <div className="text-[14px] font-bold leading-[18px]">
            {totals.lines} lines · {totals.matchedLines} matched · {totals.varianceLines} variance
          </div>
          <div className="text-[13px] leading-4 text-[#555555]">
            {clean ? 'Net adjustment: none' : `Net adjustment: ${formatSignedKes(totals.netVarianceValue)}`}
          </div>
        </div>
        <div className="flex grow basis-0 flex-col gap-[5px]">
          <div className={label}>Status</div>
          <div className="text-[14px] font-bold uppercase leading-[18px] tracking-[0.04em] text-[#1F3A5F]">{statusText}</div>
        </div>
      </div>

      <div className="flex flex-col px-12 pt-5">
        <div className="mb-4 flex border border-[#DDDDDD]">
          {(
            [
              ['Lines', totals.lines],
              ['Match', totals.matchedLines],
              ['Variance', totals.varianceLines],
              ['Net Value', clean ? '—' : formatSignedKes(totals.netVarianceValue)],
            ] as const
          ).map(([k, v], i) => (
            <div key={k} className={`flex grow basis-0 flex-col gap-1 px-4 py-3.5 ${i < 3 ? 'border-r border-[#DDDDDD]' : ''}`}>
              <div className="text-[11px] font-bold uppercase leading-[14px] tracking-[0.04em] text-[#777777]">{k}</div>
              <div className="text-[22px] font-bold leading-7">{v}</div>
            </div>
          ))}
        </div>

        {!clean ? (
          <>
            <div className="flex gap-2.5 bg-[#1F3A5F] px-3 py-[9px]">
              <div className="grow-[2] basis-0 text-[12px] font-bold uppercase leading-4 tracking-[0.04em] text-white">Item</div>
              <div className="grow basis-0 text-right text-[12px] font-bold uppercase leading-4 tracking-[0.04em] text-white">Variance</div>
              <div className="grow-[1.3] basis-0 text-right text-[12px] font-bold uppercase leading-4 tracking-[0.04em] text-white">Adjustment</div>
              <div className="grow-[1.3] basis-0 text-right text-[12px] font-bold uppercase leading-4 tracking-[0.04em] text-white">Value</div>
            </div>
            {shownRows.map((a) => (
              <div key={a.reference} className="flex gap-2.5 border-b border-[#DDDDDD] px-3 py-[11px]">
                <div className="grow-[2] basis-0 text-[13px] leading-4">
                  {a.itemName}
                  {a.reason ? <span className="text-[#777777]"> — {a.reason.toLowerCase()}</span> : null}
                </div>
                <div className="grow basis-0 text-right text-[13px] leading-4 text-[#555555]">{formatVariance(a.variance, a.usageUnit).replace(/ \S+$/, '')}</div>
                <div className="grow-[1.3] basis-0 text-right text-[13px] leading-4">{a.reference}</div>
                <div className="grow-[1.3] basis-0 text-right text-[13px] font-bold leading-4">{formatSignedKes(a.value)}</div>
              </div>
            ))}
            {rest.length > 0 ? (
              <div className="px-3 py-[11px] text-[12px] italic leading-4 text-[#999999]">
                + {rest.length} more {rest.length === 1 ? 'adjustment' : 'adjustments'} ({restRefs[0]}
                {restRefs.length > 1 ? `–${restRefs[restRefs.length - 1]}` : ''})
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      <div className="mx-12 mt-4 flex items-start gap-2.5 border border-[#999999] px-4 py-3">
        {!clean ? <div className="shrink-0 text-[11px] font-bold uppercase leading-[14px] tracking-[0.06em]">Note</div> : null}
        <div className={`leading-[17px] text-[#555555] ${clean ? 'text-[13px]' : 'text-[12px]'}`}>{note}</div>
      </div>

      <div className="mx-12 my-6 flex gap-10">
        <div className="flex grow basis-0 flex-col gap-1">
          <div className={label}>Counted by</div>
          <div className="flex h-[34px] items-end pb-0.5 font-wds-signature text-[26px] leading-8">{doc.counter.name}</div>
          <div className="flex flex-col gap-0.5 border-t border-[#111111] pt-[5px]">
            <div className="text-[12px] font-bold leading-4">
              {doc.counter.name}, {doc.counter.roleLabel}
            </div>
            <div className="text-[11px] leading-[14px] text-[#777777]">
              {doc.counter.signedAt ? formatDayMonthClock(doc.counter.signedAt).replace(/(\d{2} \w{3}) · /, `$1 ${doc.countDate.slice(0, 4)} · `) : '—'}
              {spot ? '' : ' · blind count'}
            </div>
          </div>
        </div>
        {doc.verifier ? (
          <div className="flex grow basis-0 flex-col gap-1">
            <div className={label}>Verified and signed by</div>
            <div className="flex h-[34px] items-end pb-0.5 font-wds-signature text-[26px] leading-8">{doc.verifier.name}</div>
            <div className="flex flex-col gap-0.5 border-t border-[#111111] pt-[5px]">
              <div className="text-[12px] font-bold leading-4">
                {doc.verifier.name}, {doc.verifier.roleLabel}
              </div>
              <div className="text-[11px] leading-[14px] text-[#777777]">
                {doc.verifier.signedAt ? formatDayMonthClock(doc.verifier.signedAt).replace(/(\d{2} \w{3}) · /, `$1 ${doc.countDate.slice(0, 4)} · `) : '—'}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-auto flex items-center justify-between border-t border-[#CCCCCC] px-12 py-3">
        <div className="text-[11px] leading-[14px] text-[#999999]">Generated by Wendo RMS · {generatedAt(doc.generatedAt)}</div>
        <div className="text-[11px] leading-[14px] text-[#999999]">Page 1 of 1</div>
      </div>
    </div>
  );
}

