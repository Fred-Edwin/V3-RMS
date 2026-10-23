'use client';

import Link from 'next/link';
import * as React from 'react';

import { cn } from '@/lib/cn';

import { EmptyState, ErrorBlock, FOCUS_RING, ListSkeleton, useRemote } from '../../../_shared';
import { Amount, HiddenNote } from '../../_shared/components/amount';
import { OldPayslipsCard } from '../../_shared/components/old-payslips-card';
import { PAYSLIP_COPY } from '../../_shared/lib/payslip-copy';
import { dayShort, monthLong, monthName, payLine } from '../../_shared/lib/pay-words';
import { payslipReads } from '../../_shared/services/payslip-services';
import { P9CardBlock } from '../../history/components/p9-card';

/** Months shown before "Earlier in {year}" folds the rest (spec S4). */
const SHOWN_MONTHS = 6;

const HEAD = 'px-5 py-2.5 text-left font-wds-mono text-[10px] font-normal leading-3 tracking-[0.08em] text-wds-text-secondary';

/**
 * "All your payslips" on a desktop (frame 13.9): the title with year chips, the months as a table (month, pay day, net), "Earlier in
 * {year}" that opens in place, and the year's tax card. A row opens that payslip in the drawer. Dots stand in for every net until the eye.
 */
export function AllPayslipsPanel({ shown, openId, onOpen }: { shown: boolean; openId: string | null; onOpen: (id: string, version: number) => void }) {
  const [year, setYear] = React.useState<number | undefined>(undefined);
  const [folded, setFolded] = React.useState(true);
  const history = useRemote(() => payslipReads.history(year), `history:${year ?? 'newest'}`);
  const d = history.data;
  const rows = d?.items ?? [];
  const chosen = d?.p9?.year ?? d?.years[0];
  const head = folded ? rows.slice(0, SHOWN_MONTHS) : rows;
  const rest = rows.slice(SHOWN_MONTHS);

  if (history.status === 'loading') return <ListSkeleton rows={6} columns={['fill', 100, 60]} label="Opening your payslips" />;
  if (history.status === 'error' && !d) return <ErrorBlock title="Your payslips did not load" line={history.error.code === 'NETWORK' ? PAYSLIP_COPY.offline : PAYSLIP_COPY.loadError} onRetry={history.reload} />;
  if (!d) return null;
  return (
    <div className="flex flex-col gap-4">
      {d.legacy.card ? <OldPayslipsCard /> : null}
      {d.years.length === 0 && !d.legacy.card ? <EmptyState kind="nothingYet" {...(d.legacy.emptyReason === 'BRANCH_NOT_MOVED' ? PAYSLIP_COPY.emptyBranchNotMoved : PAYSLIP_COPY.empty)} /> : null}
      {rows.length > 0 ? (
        <section aria-label="All your payslips" className="border border-wds-border bg-wds-surface">
          <header className="flex items-center justify-between gap-4 px-5 pb-3 pt-4">
            <div className="flex flex-col gap-0.5">
              <h2 className="m-0 font-wds-sans text-[16px] font-semibold leading-5 text-wds-text-ink">All your payslips</h2>
              <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
                {chosen} · {rows.length} {rows.length === 1 ? 'payslip' : 'payslips'} · amounts {shown ? 'shown' : 'hidden'}
              </p>
            </div>
            {d.years.length > 1 ? (
              <div role="group" aria-label="Year" className="flex gap-2">
                {d.years.map((y) => (
                  <button
                    key={y}
                    type="button"
                    aria-pressed={y === chosen}
                    onClick={() => {
                      setYear(y);
                      setFolded(true);
                    }}
                    className={cn('h-9 border px-4 font-wds-sans text-[14px] leading-[18px]', FOCUS_RING, y === chosen ? 'border-wds-text-ink bg-wds-text-ink text-wds-canvas' : 'border-wds-border-strong bg-transparent text-wds-text-ink hover:bg-wds-neutral-50')}
                  >
                    {y}
                  </button>
                ))}
              </div>
            ) : null}
          </header>
          <table className="w-full border-collapse border-t border-wds-text-ink">
            <caption className="sr-only">Your payslips for {chosen}</caption>
            <thead>
              <tr>
                <th scope="col" className={HEAD}>MONTH</th>
                <th scope="col" className={HEAD}>PAY DAY</th>
                <th scope="col" className={HEAD}>NET</th>
                <th scope="col" className="w-10"><span className="sr-only">Open</span></th>
              </tr>
            </thead>
            <tbody>
              {head.map((p) => {
                const line = payLine(p);
                const selected = p.id === openId;
                return (
                  <tr key={p.id} data-state={selected ? 'selected' : undefined} className={cn('border-t border-wds-neutral-100 hover:bg-wds-neutral-50', selected && 'bg-[#FBF1E1]')}>
                    <td className={cn('px-5 py-3.5 font-wds-sans text-[15px] leading-5 text-wds-text-ink', selected && 'font-semibold')}>
                      <button type="button" onClick={() => onOpen(p.id, p.versionNumber)} aria-label={`${monthLong(p.month)}${p.versionNumber > 1 ? `, version ${p.versionNumber}` : ''}, ${line.text}${shown ? '' : ', amount hidden'}`} className={cn('text-left', FOCUS_RING)}>
                        {monthLong(p.month)}
                      </button>
                    </td>
                    <td className={cn('px-5 py-3.5 font-wds-sans text-[13px] leading-4', line.paid ? 'text-wds-success-fg' : 'text-wds-text-secondary')}>
                      {p.status === 'PAID' ? `Paid ${p.paidOn ? dayShort(p.paidOn) : ''}`.trim() : p.payDay ? dayShort(p.payDay) : 'To be announced'}
                    </td>
                    <td className="px-5 py-3.5"><Amount value={p.net} shown={shown} className="text-[14px] leading-[18px] text-wds-text-ink" /></td>
                    <td aria-hidden className="pr-5 text-right text-wds-neutral-400">›</td>
                  </tr>
                );
              })}
              {folded && rest.length > 0 ? (
                <tr className="border-t border-wds-neutral-100">
                  <td colSpan={4}>
                    <button type="button" onClick={() => setFolded(false)} className={cn('flex w-full items-center justify-between px-5 py-3.5 text-left font-wds-sans text-[14px] font-semibold leading-[18px] text-wds-text-ink', FOCUS_RING)}>
                      <span>Earlier in {chosen}: {rest.map((p) => monthName(p.month)).join(', ')}</span>
                      <span aria-hidden className="font-normal text-wds-neutral-400">›</span>
                    </button>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
          <HiddenNote shown={shown} />
        </section>
      ) : null}
      {d.p9 ? <P9CardBlock p9={d.p9} wide /> : null}
      {d.legacy.historyRow ? (
        <Link href="/app/payslips" className={cn('inline-flex min-h-[44px] items-center border border-wds-border bg-wds-surface px-3.5 font-wds-sans text-[14px] text-wds-text-ink', FOCUS_RING)}>
          {PAYSLIP_COPY.oldRow} ›
        </Link>
      ) : null}
    </div>
  );
}
