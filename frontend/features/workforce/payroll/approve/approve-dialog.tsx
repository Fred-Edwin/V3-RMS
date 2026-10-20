'use client';

import * as React from 'react';

import { useAuthStore } from '@/store/authStore';

import { Callout, ErrorBlock, ListSkeleton } from '../../_shared';
import { PinActDialog } from '../_shared/components/pin-act-dialog';
import { useTotals } from '../_shared/hooks/use-payroll-data';
import { kesLabel, monthName, people } from '../_shared/lib/format';
import { LINK_BUTTON } from '../_shared/lib/link-style';
import { payrollWrites } from '../_shared/services/payroll-writes';
import type { MonthView } from '../_shared/types/month-types';

/** The name of whoever sent the month (the "Reviewed" stage), so the screen can say up front that this person cannot approve it. */
export const sentBy = (view: MonthView): string | null => view.stages.find((s) => s.key === 'REVIEWED')?.who ?? null;

/**
 * The Accountant approves the month (spec S6): figures, a PIN, the month numbered and frozen. The totals are read again on open and travel
 * with the PIN, so the server refuses if anything moved. The person who sent the month sees the blocked form. The first month of a site asks
 * for a tick that at least 3 payslips were checked by hand.
 */
export function ApproveDialog({ view, onClose, onDone, onStale, onCheckByHand }: { view: MonthView; onClose: () => void; onDone: (message: string) => void; onStale: () => void; onCheckByHand: () => void }) {
  const [tick, setTick] = React.useState(0);
  const fresh = useTotals(view.monthKey, tick);
  const me = useAuthStore((s) => s.user?.name ?? null);
  const [hand, setHand] = React.useState(false);
  const firstMonth = (view.firstMonthForSites?.length ?? 0) > 0;
  const preparer = sentBy(view);
  const prepared = me !== null && preparer !== null && me === preparer;
  const t = fresh.data;
  const name = monthName(view.monthKey);

  const blocked = prepared ? 'You sent this month to the Accountant, so someone else must approve it.' : firstMonth && !hand ? 'Tick that you checked 3 payslips by hand.' : null;

  if (fresh.status === 'error' && !t) {
    return (
      <PinActDialog title={`Approve the ${name} payroll?`} confirmLabel="Approve the payroll" busyLabel="Approving…" disabled onSign={async () => undefined} onClose={onClose}>
        <ErrorBlock title="We could not read the totals." line={fresh.error.message} onRetry={fresh.reload} />
      </PinActDialog>
    );
  }
  return (
    <PinActDialog
      title={`Approve the ${name} payroll?`}
      description={`${t ? people(t.total.people) : ''} · prepared and reviewed by HR. You cannot approve a month you prepared.`}
      rows={
        t
          ? [
              { label: 'Gross pay', value: kesLabel(t.total.gross), mono: true },
              { label: `Tax and statutory${view.tablesConfirmed ? ` (version ${view.tablesConfirmed.version} tables)` : ''}`, value: kesLabel(t.total.taxStatutory), mono: true },
              { label: 'Other deductions', value: kesLabel(t.total.other), mono: true },
              { label: 'Net pay to staff', value: kesLabel(t.total.net), mono: true },
              { label: 'Casual pay, from petty cash', value: kesLabel(t.casual), mono: true },
              { label: "HR's review", value: 'Every line checked', tone: 'success' },
            ]
          : undefined
      }
      confirmLabel="Approve the payroll"
      busyLabel="Approving…"
      blockedReason={blocked}
      disabled={!t || prepared}
      note="HR is told to publish. Nobody on staff sees a payslip until it is published. Your name, the time and these totals are kept in the audit log."
      onClose={onClose}
      onStale={() => {
        setTick((n) => n + 1);
        onStale();
      }}
      onAlready={(code) => {
        if (code !== 'ALREADY_APPROVED') return false;
        onDone(`${name} was approved a moment ago.`);
        return true;
      }}
      onSign={async (pin, idempotencyKey) => {
        if (!t) return;
        await payrollWrites.approve(view.monthKey, {
          pin,
          idempotencyKey,
          stateVersion: view.stateVersion,
          expectedTotals: { gross: t.total.gross, net: t.total.net, taxStatutory: t.total.taxStatutory, other: t.total.other, headcount: t.total.people },
          ...(firstMonth ? { handChecked: hand } : {}),
        });
        onDone(`${name} approved. HR is told to publish.`);
      }}
    >
      {fresh.status === 'loading' && !t ? <ListSkeleton rows={4} columns={['fill', 120]} label="Loading the totals" /> : null}
      {prepared ? (
        <Callout tone="warning" size="sm" role="alert">
          You sent this month to the Accountant, so someone else must approve it.
        </Callout>
      ) : null}
      {firstMonth ? (
        <label className="flex items-start gap-2.5 font-wds-sans text-[13px] leading-[18px] text-wds-text-ink">
          <input type="checkbox" checked={hand} onChange={(e) => setHand(e.target.checked)} disabled={prepared} className="mt-0.5 size-4 accent-[var(--wds-primary)]" />
          <span>
            I checked at least 3 payslips by hand against the Tax and deductions tab.{' '}
            <button type="button" onClick={onCheckByHand} className={LINK_BUTTON}>
              Check one person by hand
            </button>
          </span>
        </label>
      ) : null}
    </PinActDialog>
  );
}
