'use client';

import * as React from 'react';

import { ApiError } from '@/types/api';

import { DialogButton, ErrorBlock, KitDialog, ListSkeleton, useRemote } from '../../_shared';
import { PinActDialog } from '../_shared/components/pin-act-dialog';
import { hoursOf, newKey, people } from '../_shared/lib/format';
import { refusalWords } from '../_shared/lib/month-view';
import { payrollReads } from '../_shared/services/payroll-reads';
import { payrollWrites } from '../_shared/services/payroll-writes';
import type { MonthSite } from '../_shared/types/month-types';

/** Remind a site's manager (spec S1). A small confirm; the server allows one a day and says so if it was reminded already. */
export function RemindDialog({ monthKey, site, onClose, onDone }: { monthKey: string; site: MonthSite; onClose: () => void; onDone: (message: string) => void }) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const key = React.useRef(newKey());
  const send = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await payrollWrites.remind(monthKey, site.siteId, key.current);
      onDone(`Reminder sent to the Branch Manager of ${site.name}.`);
    } catch (err) {
      setError(err instanceof ApiError ? refusalWords(err.code, err.message) : 'The connection dropped. Nothing was sent. Try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <KitDialog
      open
      plain
      busy={busy}
      width={480}
      onOpenChange={(o) => !o && onClose()}
      title={`Remind ${site.name}?`}
      description="The Branch Manager is told once a day at most."
      footer={
        <>
          <DialogButton kind="cancel" size="lg" onClick={onClose} disabled={busy}>
            Cancel
          </DialogButton>
          <DialogButton kind="primary" size="lg" onClick={() => void send()} disabled={busy}>
            {busy ? 'Sending…' : 'Send reminder'}
          </DialogButton>
        </>
      }
    >
      {error ? (
        <p role="alert" className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-error-fg">
          {error}
        </p>
      ) : null}
    </KitDialog>
  );
}

/**
 * The Director approves a site's timesheet month for it, once the site has waited more than 5 days (spec S1, P4). It is the Timesheets
 * approval with the Director's own PIN; the totals shown are read now and travel with the PIN so the server can refuse if they moved.
 */
export function LateApproveDialog({ monthKey, site, onClose, onDone, onStale }: { monthKey: string; site: MonthSite; onClose: () => void; onDone: (message: string) => void; onStale: () => void }) {
  const [tick, setTick] = React.useState(0);
  const totals = useRemote(() => payrollReads.siteTimesheetTotals(monthKey, site.siteId), `late:${monthKey}:${site.siteId}:${tick}`);
  const t = totals.data;
  if (totals.status === 'error' && !t) {
    return (
      <KitDialog open plain width={520} onOpenChange={(o) => !o && onClose()} title={`Approve for ${site.name}?`}>
        <ErrorBlock title="We could not read the totals." line={totals.error.message} onRetry={totals.reload} />
      </KitDialog>
    );
  }
  return (
    <PinActDialog
      title={`Approve for ${site.name}?`}
      description={`You are approving for ${site.name}. The Branch Manager is told.`}
      rows={t ? [{ label: 'People', value: people(t.headcount), mono: true }, { label: 'Hours worked', value: hoursOf(t.workedMinutes), mono: true }, { label: 'Overtime authorised', value: hoursOf(t.overtimeAuthorisedMinutes), mono: true }] : undefined}
      confirmLabel="Approve for the site"
      busyLabel="Approving…"
      disabled={!t}
      width={560}
      note="Your name, the time and these totals are kept in the audit log."
      onClose={onClose}
      onStale={() => {
        setTick((n) => n + 1);
        onStale();
      }}
      onSign={async (pin, idempotencyKey) => {
        if (!t) return;
        await payrollWrites.approveSiteLate(monthKey, site.siteId, { pin, idempotencyKey, expectedTotals: t });
        onDone(`${site.name} approved for the site. The Branch Manager is told.`);
      }}
    >
      {totals.status === 'loading' && !t ? <ListSkeleton rows={3} columns={['fill', 100]} label="Loading the totals" /> : null}    </PinActDialog>
  );
}
