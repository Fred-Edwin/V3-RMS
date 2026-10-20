'use client';

import { ErrorBlock, KeyValueRows, ListSkeleton, WorkforceDrawer } from '../../_shared';
import { usePayslipDetail } from '../_shared/hooks/use-payroll-data';
import { dayMonthTime, kes } from '../_shared/lib/format';
import type { PayslipRow } from '../_shared/types/tab-types';

/** One payslip: totals, every line with its working, and the versions it has had. A draft is marked "Not yet published". */
export function PayslipDrawer({ monthKey, row, onClose }: { monthKey: string; row: PayslipRow; onClose: () => void }) {
  const detail = usePayslipDetail(monthKey, row.payslipId);
  const d = detail.data;
  return (
    <WorkforceDrawer open onOpenChange={(o) => !o && onClose()} title={row.name} subtitle={`${row.siteName}${d?.documentNumber ? ` · ${d.documentNumber}` : ''}${d ? ` · version ${d.version}` : ''}`}>
      {detail.status === 'loading' && !d ? <ListSkeleton rows={6} columns={['fill', 90]} label="Loading the payslip" /> : null}
      {detail.status === 'error' && !d ? <ErrorBlock title="The payslip did not load" line={detail.error.message} onRetry={detail.reload} reference={detail.error.code} /> : null}
      {d ? (
        <>
          {!d.published ? <p className="m-0 font-wds-mono text-[10px] uppercase leading-3 tracking-[0.08em] text-wds-warning-fg">Not yet published</p> : null}
          {d.replacedBy ? <p className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-warning-fg">Replaced by version {d.replacedBy}.</p> : null}
          <KeyValueRows
            aria-label="Totals"
            rows={[
              { label: 'Basic pay', value: kes(d.totals.basic), mono: true },
              { label: 'Gross pay', value: kes(d.totals.gross), mono: true },
              { label: 'Tax and statutory', value: kes(String(Number(d.totals.statutory) + Number(d.totals.incomeTax))), mono: true },
              { label: 'Other deductions', value: kes(d.totals.otherDeductions), mono: true },
              { label: 'Net pay', value: kes(d.totals.net), mono: true },
            ]}
          />
          <table className="w-full border-collapse">
            <caption className="sr-only">Lines of {row.name}</caption>
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
            </tbody>
          </table>
          {d.versions.length > 1 ? (
            <ul aria-label="Versions" className="m-0 flex list-none flex-col gap-1 p-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
              {d.versions.map((v) => (
                <li key={v.payslipId}>
                  Version {v.version}
                  {v.correctedAt ? ` · corrected ${dayMonthTime(v.correctedAt)}` : ''}
                  {v.reason ? ` · ${v.reason}` : ''}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </WorkforceDrawer>
  );
}
