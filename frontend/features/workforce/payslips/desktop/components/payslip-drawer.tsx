'use client';

import * as React from 'react';

import { ErrorBlock, ListSkeleton, WorkforceDrawer, useRemote } from '../../../_shared';
import { EyeButton } from '../../_shared/components/amount';
import { Amount } from '../../_shared/components/amount';
import { PAYSLIP_COPY } from '../../_shared/lib/payslip-copy';
import { bankLine, dayShort, monthLong, payLine } from '../../_shared/lib/pay-words';
import { payslipReads } from '../../_shared/services/payslip-services';
import type { PayslipDetail } from '../../_shared/types/payslip-types';
import { PayslipBody, type PayslipView } from '../../detail/components/payslip-body';

/** The dark card at the top of the drawer (frame 13.10): number and pay day, the net (dots until shown), the bank line and the eye. */
function DrawerCard({ d, shown, view, onToggle }: { d: PayslipDetail; shown: boolean; view: PayslipView; onToggle: () => void }) {
  const net = view === 'month' ? d.thisMonth.net : d.ytd.net;
  return (
    <div className="flex items-start justify-between gap-4 bg-wds-sidebar-top px-6 py-5 text-wds-sidebar-fg-active">
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="font-wds-mono text-[11px] leading-[14px] tracking-[0.08em] text-wds-sidebar-fg-item">
          {[d.number, d.payDay ? `PAY DAY ${dayShort(d.payDay).toUpperCase()}` : payLine(d).text.toUpperCase()].filter(Boolean).join(' · ')}
        </span>
        <Amount value={net} shown={shown} dots={6} className="text-[38px] font-semibold leading-[44px] tracking-[0.02em]" />
        <span className="font-wds-sans text-[13px] leading-4 text-wds-sidebar-fg-item">
          {d.employeeSummary.role ? `${bankLine(d.bank)} · ${d.employeeSummary.role}, ${d.employeeSummary.organization}` : bankLine(d.bank)}
        </span>
      </div>
      <EyeButton shown={shown} onToggle={onToggle} />
    </div>
  );
}

/**
 * One payslip in a right drawer, 560 wide (frame 13.10), on a desktop. It closes on the X or Esc. The payslip is fetched only while the
 * drawer is open: opening it is written to the audit trail, so nothing is read ahead of time. `onVersion` switches between a corrected
 * payslip and the one it replaced without leaving the drawer.
 */
export function PayslipDrawer({ id, version, shown, onToggle, onClose, onVersion }: { id: string | null; version: number | null; shown: boolean; onToggle: () => void; onClose: () => void; onVersion: (version: number) => void }) {
  const [view, setView] = React.useState<PayslipView>('month');
  React.useEffect(() => setView('month'), [id, version]);
  const slip = useRemote(() => payslipReads.detail(id ?? '', version), `drawer:${id}:${version ?? 'latest'}`, Boolean(id));
  const d = slip.data && slip.data.id === id ? slip.data : null;
  return (
    <WorkforceDrawer width={560} open={Boolean(id)} onOpenChange={(o) => !o && onClose()} title={d ? `Payslip · ${monthLong(d.month)}${d.versionNumber > 1 ? ` · version ${d.versionNumber}` : ''}` : 'Payslip'} closeLabel="Close payslip">
      {slip.status === 'error' && !d ? (
        <ErrorBlock title={slip.error.status === 404 ? PAYSLIP_COPY.notFound : 'Your payslip did not load'} line={slip.error.code === 'NETWORK' ? PAYSLIP_COPY.offline : slip.error.status === 404 ? 'It may have been removed.' : PAYSLIP_COPY.loadError} onRetry={slip.error.status === 404 ? undefined : slip.reload} />
      ) : !d ? (
        <ListSkeleton rows={6} columns={['fill', 70]} label="Opening your payslip" />
      ) : (
        <>
          <DrawerCard d={d} shown={shown} view={view} onToggle={onToggle} />
          <PayslipBody d={d} shown={shown} view={view} onView={setView} onVersion={onVersion} wide />
        </>
      )}
    </WorkforceDrawer>
  );
}
