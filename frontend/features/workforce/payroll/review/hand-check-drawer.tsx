'use client';

import * as React from 'react';

import { ErrorBlock, FIELD_CLASS, ListSkeleton, WorkforceDrawer } from '../../_shared';
import { usePayslipDetail, usePayslipList } from '../_shared/hooks/use-payroll-data';
import { kes } from '../_shared/lib/format';

/**
 * "Check one person by hand" (spec S3): a person picker and that person's payslip lines, each with its working, so the Accountant can
 * compare them with a hand calculation. The first person is the example on the tax panels when there is one. Read only.
 */
export function HandCheckDrawer({ monthKey, defaultEmployeeId, onClose }: { monthKey: string; defaultEmployeeId: string | null; onClose: () => void }) {
  const [q, setQ] = React.useState('');
  const [chosen, setChosen] = React.useState<string | null>(null);
  const list = usePayslipList(monthKey, { q: q.trim() || undefined, page: 1, rows: 25 }, 0);
  const rows = list.data?.rows ?? [];
  const pickedId = chosen ?? rows.find((r) => r.employeeId === defaultEmployeeId)?.payslipId ?? rows[0]?.payslipId ?? null;
  const detail = usePayslipDetail(monthKey, pickedId);
  const d = detail.data;
  return (
    <WorkforceDrawer open onOpenChange={(o) => !o && onClose()} title="Check one person by hand" subtitle="Each line shows its working. Compare it with your own calculation.">
      <label className="flex flex-col gap-1.5 font-wds-sans text-[13px] font-medium leading-4 text-wds-text-ink">
        Find a person
        <input autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a name" className={FIELD_CLASS} />
      </label>
      {list.status === 'loading' && !list.data ? <ListSkeleton rows={3} columns={['fill', 80]} label="Loading people" /> : null}
      {list.status === 'error' && !list.data ? <ErrorBlock title="The people did not load" line={list.error.message} onRetry={list.reload} /> : null}
      {list.data && rows.length === 0 ? <p className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">Nobody matches that name.</p> : null}
      <ul className="m-0 flex max-h-40 list-none flex-col overflow-y-auto border border-wds-border p-0" aria-label="People">
        {rows.map((r) => (
          <li key={r.payslipId}>
            <label className="flex cursor-pointer items-center gap-2.5 border-b border-wds-neutral-100 px-3 py-2 font-wds-sans text-[13px] leading-4 text-wds-text-ink has-[:checked]:bg-wds-neutral-100">
              <input type="radio" name="hand-check-person" checked={pickedId === r.payslipId} onChange={() => setChosen(r.payslipId)} />
              <span className="flex-1">{r.name}</span>
              <span className="text-wds-text-secondary">{r.siteName}</span>
            </label>
          </li>
        ))}
      </ul>
      {detail.status === 'loading' && pickedId ? <ListSkeleton rows={6} columns={['fill', 90]} label="Loading the payslip" /> : null}
      {detail.status === 'error' && !d ? <ErrorBlock title="The payslip did not load" line={detail.error.message} onRetry={detail.reload} /> : null}
      {d ? (
        <table className="w-full border-collapse">
          <caption className="sr-only">Payslip lines of {d.employee.name}</caption>
          <thead>
            <tr className="border-b border-wds-text-ink">
              <th scope="col" className="py-2 text-left font-wds-mono text-[10px] font-normal tracking-[0.08em] text-wds-text-secondary">LINE</th>
              <th scope="col" className="py-2 text-right font-wds-mono text-[10px] font-normal tracking-[0.08em] text-wds-text-secondary">KES</th>
            </tr>
          </thead>
          <tbody>
            {d.lines.filter((l) => l.share !== 'EMPLOYER').map((line, i) => (
              <tr key={`${line.code}-${i}`} className="border-b border-wds-neutral-100 align-top">
                <td className="py-2 pr-3 font-wds-sans text-[13px] leading-[18px] text-wds-text-ink">
                  {line.label}
                  <span className="block font-wds-mono text-[11px] leading-[14px] text-wds-text-secondary">{line.workingText}</span>
                </td>
                <td className="py-2 text-right font-wds-mono text-[13px] leading-4 text-wds-text-ink">{kes(line.amount)}</td>
              </tr>
            ))}
            <tr>
              <td className="py-2 font-wds-sans text-[13px] font-semibold leading-4">Net pay</td>
              <td className="py-2 text-right font-wds-mono text-[13px] font-semibold leading-4">{kes(d.totals.net)}</td>
            </tr>
          </tbody>
        </table>
      ) : null}
    </WorkforceDrawer>
  );
}
