'use client';

import { EmptyState, ErrorBlock, ListSkeleton, Panel, StatBoxes } from '../../_shared';
import { useCasual } from '../_shared/hooks/use-payroll-data';
import { dayOfDate, kes } from '../_shared/lib/format';

const TH = 'px-3.5 py-2.5 font-wds-mono text-[10px] font-normal leading-3 tracking-[0.08em] text-wds-text-secondary';
const TD = 'px-3.5 py-2.5 font-wds-sans text-[13px] leading-4 text-wds-text-ink';

/** Paper draws these four figures at 24 px (the kit's figures size is 30), so "Not included" stays on one line. */
const figure = (text: string) => <span className="text-[24px] leading-7">{text}</span>;

/** Casual pay (spec S4): a memo of what was paid from petty cash, by department, with the latest approved pay sheets. Never in the monthly run. */
export function CasualTab({ monthKey, refresh }: { monthKey: string; refresh: number }) {
  const casual = useCasual(monthKey, refresh);
  if (casual.status === 'loading' && !casual.data) return <ListSkeleton rows={5} columns={['fill', 100]} label="Loading casual pay" />;
  if (casual.status === 'error' && !casual.data) return <ErrorBlock title="Casual pay did not load" line={casual.error.message} onRetry={casual.reload} reference={casual.error.code} />;
  const c = casual.data;
  if (!c) return null;
  return (
    <div className="flex flex-col gap-4">
      <StatBoxes
        variant="figures"
        cells={[
          { label: 'CASUAL DAYS', value: figure(String(c.days)) },
          { label: 'CASUAL WORKERS', value: figure(String(c.workers)) },
          { label: 'PAID FROM PETTY CASH (KES)', value: figure(kes(c.paidTotal)) },
          { label: 'IN THE MONTHLY RUN', value: figure('Not included') },
        ]}
      />
      {c.source === 'NONE' ? (
        <EmptyState kind="nothingYet" title="No casual pay sheets in the new system yet" line={c.message ?? 'Casual pay for this month is on the old pay sheets.'} />
      ) : (
        <>
          <Panel title="By department" padded={false}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse">
                <caption className="sr-only">Casual pay by department</caption>
                <thead>
                  <tr className="border-b border-wds-text-ink">
                    <th scope="col" className={`${TH} text-left`}>DEPARTMENT</th>
                    <th scope="col" className={`${TH} text-left`}>SITE</th>
                    <th scope="col" className={`${TH} text-right`}>DAYS</th>
                    <th scope="col" className={`${TH} text-right`}>PAID (KES)</th>
                  </tr>
                </thead>
                <tbody>
                  {c.byDepartment.map((d) => (
                    <tr key={`${d.siteId}-${d.departmentId}`} className="border-b border-wds-neutral-100">
                      <td className={TD}>{d.departmentName}</td>
                      <td className={`${TD} text-wds-text-secondary`}>{d.siteName}</td>
                      <td className={`${TD} text-right font-wds-mono`}>{d.days}</td>
                      <td className={`${TD} text-right font-wds-mono`}>{kes(d.total)}</td>
                    </tr>
                  ))}
                  <tr className="bg-wds-neutral-50 font-semibold">
                    <td className={TD} colSpan={2}>Total</td>
                    <td className={`${TD} text-right font-wds-mono`}>{c.days}</td>
                    <td className={`${TD} text-right font-wds-mono`}>{kes(c.paidTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Panel>
          <Panel title="The latest casual pay sheets" padded={false}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse">
                <caption className="sr-only">Latest approved casual pay sheets</caption>
                <thead>
                  <tr className="border-b border-wds-text-ink">
                    <th scope="col" className={`${TH} text-left`}>DAY</th>
                    <th scope="col" className={`${TH} text-left`}>DEPARTMENT</th>
                    <th scope="col" className={`${TH} text-right`}>WORKERS</th>
                    <th scope="col" className={`${TH} text-right`}>KES</th>
                    <th scope="col" className={`${TH} text-left`}>PAY SHEET</th>
                  </tr>
                </thead>
                <tbody>
                  {c.latestSheets.map((s) => (
                    <tr key={s.id} className="border-b border-wds-neutral-100">
                      <td className={TD}>{dayOfDate(s.date)}</td>
                      <td className={TD}>{s.departmentName} · {s.siteName}</td>
                      <td className={`${TD} text-right font-wds-mono`}>{s.workers}</td>
                      <td className={`${TD} text-right font-wds-mono`}>{kes(s.total)}</td>
                      <td className={`${TD} font-wds-mono`}>{s.number ?? 'Not numbered'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
          {c.waiting.length > 0 ? <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{c.waiting.length} pay sheet{c.waiting.length === 1 ? ' is' : 's are'} not approved yet and not counted.</p> : null}
        </>
      )}
    </div>
  );
}
