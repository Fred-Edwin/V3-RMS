'use client';

import * as React from 'react';

import { ApiError } from '@/types/api';

import { DialogButton, FIELD_CLASS, FormField, KeyValueRows, KitDialog } from '../../_shared';
import { kesLabel, monthName, newKey, people } from '../_shared/lib/format';
import { refusalWords, STALE_CODES } from '../_shared/lib/month-view';
import { payrollWrites } from '../_shared/services/payroll-writes';
import type { MonthView } from '../_shared/types/month-types';

/** Send the reviewed month to the Accountant (spec S5). HR's step is a review: no PIN, the Accountant's PIN is the signature. */
export function SendDialog({ view, onClose, onDone, onStale }: { view: MonthView; onClose: () => void; onDone: (message: string) => void; onStale: () => void }) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const key = React.useRef(newKey());
  const k = view.kpis;
  const name = monthName(view.monthKey);
  const send = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await payrollWrites.send(view.monthKey, { idempotencyKey: key.current, stateVersion: view.stateVersion });
      onDone(`${name} sent to the Accountant.`);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : '';
      setError(err instanceof ApiError ? refusalWords(code, err.message) : 'The connection dropped. Nothing was changed. Try again.');
      if (STALE_CODES.includes(code)) {
        key.current = newKey();
        onStale();
      }
    } finally {
      setBusy(false);
    }
  };
  return (
    <KitDialog
      open
      plain
      busy={busy}
      width={600}
      onOpenChange={(o) => !o && onClose()}
      title={`Send the ${name} payroll to the Accountant?`}
      description={`${k ? people(k.headcount) : ''} · ${view.sites.filter((s) => s.timesheetState !== 'NOT_ON_NEW_SYSTEM').length} sites. After this, only the Accountant can send it back.`}
      footer={
        <>
          <DialogButton kind="cancel" size="lg" onClick={onClose} disabled={busy}>
            Cancel
          </DialogButton>
          <DialogButton kind="primary" size="lg" onClick={() => void send()} disabled={busy}>
            {busy ? 'Sending…' : 'Send to the Accountant'}
          </DialogButton>
        </>
      }
    >
      <KeyValueRows
        aria-label="What you are sending"
        rows={[
          { label: 'Gross pay', value: kesLabel(k?.gross), mono: true },
          { label: 'Net pay to staff', value: kesLabel(k?.net), mono: true },
          { label: 'Casual pay, from petty cash', value: kesLabel(k?.casual), mono: true },
          { label: "HR's review", value: 'Every line checked', tone: 'success' },
        ]}
      />
      {error ? (
        <p role="alert" className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-error-fg">
          {error}
        </p>
      ) : null}
    </KitDialog>
  );
}

/** The Accountant doubts the month: back to HR with a reason, ticks kept (spec S5, beyond Paper). No PIN. */
export function SendBackDialog({ view, onClose, onDone, onStale }: { view: MonthView; onClose: () => void; onDone: (message: string) => void; onStale: () => void }) {
  const [reason, setReason] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const key = React.useRef(newKey());
  const trimmed = reason.trim();
  const tooShort = trimmed.length < 5;
  const go = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await payrollWrites.sendBack(view.monthKey, { reason: trimmed, idempotencyKey: key.current, stateVersion: view.stateVersion });
      onDone(`${monthName(view.monthKey)} sent back to HR.`);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : '';
      setError(err instanceof ApiError ? refusalWords(code, err.message) : 'The connection dropped. Nothing was changed. Try again.');
      if (STALE_CODES.includes(code)) {
        key.current = newKey();
        onStale();
      }
    } finally {
      setBusy(false);
    }
  };
  return (
    <KitDialog
      open
      plain
      busy={busy}
      width={560}
      onOpenChange={(o) => !o && onClose()}
      title={`Send the ${monthName(view.monthKey)} payroll back to HR?`}
      description="HR keeps their ticks and is told why. Say what to look at, not how much."
      footer={
        <>
          <DialogButton kind="cancel" size="lg" onClick={onClose} disabled={busy}>
            Cancel
          </DialogButton>
          <DialogButton kind="primary" size="lg" onClick={() => void go()} disabled={busy || tooShort}>
            {busy ? 'Sending…' : 'Send back to HR'}
          </DialogButton>
        </>
      }
    >
      <FormField label="Why?" hint="required" helper={tooShort ? 'Add your reason (at least 5 characters).' : undefined} error={error ?? undefined}>
        {({ id, describedBy, invalid }) => (
          <textarea id={id} autoComplete="off" aria-describedby={describedBy} aria-invalid={invalid} value={reason} maxLength={280} rows={3} onChange={(e) => setReason(e.target.value)} className={`${FIELD_CLASS} h-auto py-2`} />
        )}
      </FormField>
    </KitDialog>
  );
}
