'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';

import { Callout, ChoiceChips, EmptyState, ErrorBlock, FIELD_CLASS, ListSkeleton, Panel } from '../../_shared';
import { CorrectionDialog } from '../corrections/correction-dialog';
import { PayslipDrawer } from './payslip-drawer';
import { NumberedPager } from '../_shared/components/numbered-pager';
import { usePayslipList } from '../_shared/hooks/use-payroll-data';
import { kes } from '../_shared/lib/format';
import { LINK_BUTTON } from '../_shared/lib/link-style';
import type { MonthView } from '../_shared/types/month-types';
import type { PayslipRow } from '../_shared/types/tab-types';

type Status = 'all' | 'corrected';
type UrlLike = { get: (key: string) => string | null; set: (patch: Record<string, string | null>) => void };

const TH = 'px-3.5 py-2.5 font-wds-mono text-[10px] font-normal leading-3 tracking-[0.08em] text-wds-text-secondary';

const statusWord = (row: PayslipRow, published: boolean, locked: boolean): { text: string; tone: string } => {
  if (row.corrected) return { text: `Corrected · v${row.version}`, tone: locked ? 'text-wds-text-secondary' : 'text-wds-warning-fg' };
  return published ? { text: 'Published', tone: 'text-wds-success-fg' } : { text: 'Ready', tone: 'text-wds-text-secondary' };
};

/**
 * Payslips tab (spec S7, S11, S12): every payslip of the month, server paged. Search and filters come first. `View` opens the lines with
 * their workings; `Correct` shows only while the month is published and not paid, for HR and the Accountant, and never on one's own
 * payslip (the server refuses it in words). A paid month shows the lock and no `Correct`.
 */
export function PayslipsTab({ view, url, refresh, onChanged }: { view: MonthView; url: UrlLike; refresh: number; onChanged: (message?: string) => void }) {
  const q = url.get('q') ?? '';
  const status: Status = url.get('status') === 'corrected' ? 'corrected' : 'all';
  const page = Math.max(1, Number(url.get('page')) || 1);
  const rows = [25, 50, 100].includes(Number(url.get('rows'))) ? Number(url.get('rows')) : 50;
  const [search, setSearch] = React.useState(q);
  const [viewing, setViewing] = React.useState<PayslipRow | null>(null);
  const [correcting, setCorrecting] = React.useState<PayslipRow | null>(null);
  const list = usePayslipList(view.monthKey, { q: q || undefined, status, page, rows }, refresh);
  const data = list.data;
  const published = view.state === 'PUBLISHED' || view.state === 'PAID';
  const canCorrect = view.capabilities.canCorrect;

  React.useEffect(() => {
    const t = window.setTimeout(() => {
      if (search !== q) url.set({ q: search || null, page: null });
    }, 250);
    return () => window.clearTimeout(t);
  }, [search, q, url]);

  return (
    <div className="flex flex-col gap-4">
      {view.state === 'PAID' ? (
        <Callout tone="neutral" title={`Locked. ${view.label.split(' ')[0]} was marked paid`} role="status">
          The month can no longer be changed. If something is wrong, ask the developer to correct it, and the change is recorded. A mistake can also be put right as a line in next month&rsquo;s payroll.
        </Callout>
      ) : null}
      {view.state === 'PUBLISHED' ? (
        <Callout tone="warning" title="Corrections stay open until the Accountant marks the month paid" role="status">
          If a staff member reports a problem, HR or the Accountant corrects that payslip here. Each correction needs a reason and a PIN, is kept in the audit log, and the staff member is told.
        </Callout>
      ) : null}
      {view.state === 'TO_PUBLISH' ? (
        <Callout tone="warning" role="status">
          Nothing is visible to staff yet. After publishing, each person sees only their own payslip, on their phone under My payslips.
        </Callout>
      ) : null}
      <Panel title={`Payslips for ${view.label.split(' ')[0]}`} count={data?.counts.all} caption={data ? `${data.counts.corrected} CORRECTED` : undefined} padded={false}>
        <div className="flex flex-wrap items-end gap-3 p-3.5">
          <input autoComplete="off" aria-label="Search a name" placeholder="Search a name" value={search} onChange={(e) => setSearch(e.target.value)} className={cn(FIELD_CLASS, 'max-w-[260px]')} />
          <ChoiceChips
            legend="Show"
            legendStyle="caps"
            size="sm"
            value={status}
            onChange={(v) => url.set({ status: v === 'corrected' ? 'corrected' : null, page: null })}
            options={[{ value: 'all', label: `All${data ? ` · ${data.counts.all}` : ''}` }, { value: 'corrected', label: `Corrected${data ? ` · ${data.counts.corrected}` : ''}` }]}
          />
        </div>
        {list.status === 'loading' && !data ? <div className="p-3.5"><ListSkeleton rows={6} columns={['fill', 100, 90, 120]} label="Loading the payslips" /></div> : null}
        {list.status === 'error' && !data ? <div className="p-3.5"><ErrorBlock title="The payslips did not load" line={list.error.message} onRetry={list.reload} reference={list.error.code} /></div> : null}
        {data && data.rows.length === 0 && data.leftOut.length === 0 ? <div className="p-3.5"><EmptyState kind="nothingFound" title="No payslips match" line="Change the name or the filter." /></div> : null}
        {data && (data.rows.length > 0 || data.leftOut.length > 0) ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse">
              <caption className="sr-only">Payslips, {view.label}, {data.counts.all} people</caption>
              <thead>
                <tr className="border-y border-wds-text-ink">
                  <th scope="col" className={`${TH} text-left`}>NAME</th>
                  <th scope="col" className={`${TH} text-left`}>SITE</th>
                  <th scope="col" className={`${TH} text-right`}>NET PAY</th>
                  <th scope="col" className={`${TH} text-left`}>STATUS</th>
                  <th scope="col" className={`${TH} text-right`}>PAYSLIP</th>
                </tr>
              </thead>
              <tbody>
                {data.leftOut.map((l) => (
                  <tr key={`out-${l.employeeId}`} className="h-[35px] border-b border-wds-neutral-100">
                    <td className="px-3.5 font-wds-sans text-[14px] font-medium text-wds-text-ink">{l.name}</td>
                    <td className="px-3.5 font-wds-sans text-[13px] text-wds-text-secondary">{l.siteName}</td>
                    <td className="px-3.5 text-right font-wds-sans text-[13px] text-wds-text-secondary">None this month</td>
                    <td className="px-3.5 font-wds-sans text-[13px] text-wds-warning-fg">Left out of run</td>
                    <td />
                  </tr>
                ))}
                {data.rows.map((r) => {
                  const s = statusWord(r, published, view.state === 'PAID');
                  return (
                    <tr key={r.payslipId} className="h-[35px] border-b border-wds-neutral-100">
                      <td className="px-3.5 font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-ink">{r.name}</td>
                      <td className="px-3.5 font-wds-sans text-[13px] text-wds-text-secondary">{r.siteName}</td>
                      <td className="px-3.5 text-right font-wds-mono text-[13px] text-wds-text-ink">{kes(r.net)}</td>
                      <td className={cn('px-3.5 font-wds-sans text-[13px]', s.tone)}>{s.text}</td>
                      <td className="whitespace-nowrap px-3.5 text-right">
                        <span className="inline-flex gap-3 font-wds-sans text-[13px]">
                          <button type="button" aria-label={`View payslip of ${r.name}`} onClick={() => setViewing(r)} className={LINK_BUTTON}>
                            View
                          </button>
                          {canCorrect ? (
                            <button type="button" aria-label={`Correct payslip of ${r.name}`} onClick={() => setCorrecting(r)} className={LINK_BUTTON}>
                              Correct
                            </button>
                          ) : null}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
        {data ? <NumberedPager page={page} rows={rows} total={data.total} onPage={(n) => url.set({ page: n === 1 ? null : String(n) })} onRows={(n) => url.set({ rows: n === 50 ? null : String(n), page: null })} /> : null}
      </Panel>
      {view.state === 'TO_PUBLISH' || view.state === 'IN_REVIEW' || view.state === 'TO_APPROVE' ? (
        <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">These payslips are drafts. Only payroll roles can see them until they are published.</p>
      ) : null}
      {viewing ? <PayslipDrawer monthKey={view.monthKey} row={viewing} onClose={() => setViewing(null)} /> : null}
      {correcting ? (
        <CorrectionDialog
          view={view}
          row={correcting}
          onClose={() => setCorrecting(null)}
          onStale={() => onChanged()}
          onDone={(message) => {
            setCorrecting(null);
            onChanged(message);
          }}
        />
      ) : null}
    </div>
  );
}
