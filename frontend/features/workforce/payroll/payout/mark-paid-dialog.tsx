'use client';

import * as React from 'react';

import { Callout, ErrorBlock, ListSkeleton } from '../../_shared';
import { PinActDialog } from '../_shared/components/pin-act-dialog';
import { usePayout } from '../_shared/hooks/use-payroll-data';
import { dayMonthTime, kesLabel, monthName, people } from '../_shared/lib/format';
import { payrollWrites } from '../_shared/services/payroll-writes';
import type { MonthView } from '../_shared/types/month-types';
import { markPaidBlock } from './payout-view';

/**
 * Mark the month paid (spec S8): the locking act. The pay-out card is read again on open; the hash of the bank file it shows travels with
 * the PIN, and the server refuses if the file was voided meanwhile. Blocked, with the reason as text, until a good file was downloaded and
 * nobody is left without a bank account.
 */
export function MarkPaidDialog({ view, onClose, onDone, onStale }: { view: MonthView; onClose: () => void; onDone: (message: string) => void; onStale: () => void }) {
  const [tick, setTick] = React.useState(0);
  const payout = usePayout(view.monthKey, tick, true);
  const p = payout.data;
  const bank = p?.methods[0];
  const name = monthName(view.monthKey);
  const blocked = p ? markPaidBlock(p) : null;

  if (payout.status === 'error' && !p) {
    return (
      <PinActDialog title={`Mark ${name} as paid?`} confirmLabel="Mark as paid and lock" busyLabel="Marking…" disabled onSign={async () => undefined} onClose={onClose} width={580}>
        <ErrorBlock title="We could not read the pay-out." line={payout.error.message} onRetry={payout.reload} />
      </PinActDialog>
    );
  }
  return (
    <PinActDialog
      title={`Mark ${name} as paid?`}
      description="Only do this once the bank has confirmed the payment. Marking the month paid locks it."
      rows={
        p && bank
          ? [
              { label: 'Net pay to staff', value: kesLabel(bank.amount), mono: true },
              { label: 'Paid to', value: `${people(bank.people)}, by bank transfer` },
              { label: 'Bank file', value: bank.file.filename && bank.file.downloadedAt ? `${bank.file.filename} · downloaded ${dayMonthTime(bank.file.downloadedAt)}` : 'Not downloaded yet', mono: true, tone: bank.file.state === 'DOWNLOADED' ? 'default' : 'warning' },
              { label: 'Staff told', value: `"Your ${name} pay has been sent"` },
            ]
          : undefined
      }
      confirmLabel="Mark as paid and lock"
      busyLabel="Marking…"
      blockedReason={blocked}
      disabled={!p}
      locking
      width={580}
      note="Recorded in the audit log with your name and the time."
      onClose={onClose}
      onStale={() => {
        setTick((n) => n + 1);
        onStale();
      }}
      onAlready={(code) => {
        if (code !== 'ALREADY_PAID') return false;
        onDone(`${name} was marked as paid a moment ago.`);
        return true;
      }}
      onSign={async (pin, idempotencyKey) => {
        await payrollWrites.markPaid(view.monthKey, { pin, idempotencyKey, stateVersion: view.stateVersion, ...(bank?.file.hash ? { bankFileHash: bank.file.hash } : {}) });
        onDone(`${name} marked as paid. Staff are told their pay has been sent.`);
      }}
    >
      {payout.status === 'loading' && !p ? <ListSkeleton rows={4} columns={['fill', 120]} label="Loading the pay-out" /> : null}
      {p && p.nothingToPay.length > 0 ? (
        <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
          {p.nothingToPay.length === 1 ? '1 person has nothing to pay and is not in the file.' : `${p.nothingToPay.length} people have nothing to pay and are not in the file.`}
        </p>
      ) : null}
      <Callout tone="warning" title="After this, nothing can be changed" role="alert">
        No payslip can be corrected. A mistake found later goes through the developer, or is put right as a line in next month&rsquo;s payroll.
      </Callout>
    </PinActDialog>
  );
}
