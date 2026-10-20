'use client';

import { ErrorBlock, ListSkeleton, Panel } from '../../_shared';
import { PayoutCard } from '../payout/payout-card';
import { ReviewCard } from '../review/review-card';
import { useTotals } from '../_shared/hooks/use-payroll-data';
import { kes } from '../_shared/lib/format';
import type { MonthView } from '../_shared/types/month-types';

const TH = 'px-3.5 py-2.5 font-wds-mono text-[10px] font-normal leading-3 tracking-[0.08em] text-wds-text-secondary';
const NUM = 'px-3.5 py-[11px] text-right font-wds-mono text-[13px] leading-4 text-wds-text-ink';

/** Totals (spec S5, S8): gross to net by site, then the unusual lines HR checks while the month is in review, or the pay-out once it is published. */
export function TotalsTab({ view, refresh, onChanged, onOpenDialog }: { view: MonthView; refresh: number; onChanged: (message?: string) => void; onOpenDialog: (name: 'send' | 'sendBack') => void }) {
  const totals = useTotals(view.monthKey, refresh);
  const t = totals.data;
  const reviewing = view.state === 'IN_REVIEW' || view.state === 'TO_APPROVE';
  const paying = view.state === 'PUBLISHED' || view.state === 'PAID';
  return (
    <div className="flex flex-col gap-4">
      {totals.status === 'loading' && !t ? <ListSkeleton rows={5} columns={['fill', 90, 90, 90]} label="Loading the totals" /> : null}
      {totals.status === 'error' && !t ? <ErrorBlock title="The totals did not load" line={totals.error.message} onRetry={totals.reload} reference={totals.error.code} /> : null}
      {t ? (
        <Panel title="From gross to net, by site" padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse">
              <caption className="sr-only">Gross to net by site, {view.label}</caption>
              <thead>
                <tr className="border-b border-wds-text-ink">
                  <th scope="col" className={`${TH} text-left`}>SITE</th>
                  {['PEOPLE', 'GROSS', '− TAX, STATUTORY', '− OTHER', '= NET PAY'].map((h) => (
                    <th key={h} scope="col" className={`${TH} text-right`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {t.bySite.map((s) => (
                  <tr key={s.siteId} className="border-b border-wds-neutral-100">
                    <th scope="row" className="px-3.5 py-[11px] text-left font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-ink">{s.name}</th>
                    <td className={NUM}>{s.people}</td>
                    <td className={NUM}>{kes(s.gross)}</td>
                    <td className={NUM}>{kes(s.taxStatutory)}</td>
                    <td className={NUM}>{kes(s.other)}</td>
                    <td className={`${NUM} font-semibold`}>{kes(s.net)}</td>
                  </tr>
                ))}
                <tr className="bg-wds-neutral-50 font-semibold">
                  <th scope="row" className="px-3.5 py-[11px] text-left font-wds-sans text-[14px] font-semibold leading-[18px] text-wds-text-ink">Total</th>
                  <td className={NUM}>{t.total.people}</td>
                  <td className={NUM}>{kes(t.total.gross)}</td>
                  <td className={NUM}>{kes(t.total.taxStatutory)}</td>
                  <td className={NUM}>{kes(t.total.other)}</td>
                  <td className={`${NUM} font-semibold`}>{kes(t.total.net)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}
      {reviewing ? <ReviewCard view={view} refresh={refresh} onChanged={onChanged} onOpenDialog={onOpenDialog} /> : null}
      {paying ? <PayoutCard view={view} refresh={refresh} onChanged={onChanged} /> : null}
    </div>
  );
}
