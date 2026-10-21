'use client';

import * as React from 'react';

import { ChoiceChips, DialogButton, FIELD_CLASS, FormField, KitDialog } from '../../../_shared';
import { useIdempotencyKey } from '../../_shared/lib/idempotency';
import { DECLINE_CHIPS, leaveErrorText } from '../../_shared/lib/leave-copy';
import { daySmall } from '../../_shared/lib/leave-dates';
import { leaveWrites } from '../../_shared/services/leave-services';
import type { ApplicationDetail, DeclineReason } from '../../_shared/types/leave-types';
import { toldLine } from './approve-dialog';

const CHANGED = new Set(['ALREADY_DECIDED', 'STALE_REQUEST', 'LEAVE_NOT_FOUND']);

/** Decline with a reason (spec Step 12): a reason chip is always required and the person sees it; no PIN (nothing is signed). */
export function DeclineDialog({ open, onOpenChange, detail, onDeclined, onChanged }: { open: boolean; onOpenChange: (open: boolean) => void; detail: ApplicationDetail; onDeclined: () => void; onChanged: () => void }) {
  const [reason, setReason] = React.useState<DeclineReason | null>(null);
  const [note, setNote] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const key = useIdempotencyKey();
  const a = detail.application;
  React.useEffect(() => {
    if (open) {
      setReason(null);
      setNote('');
      setError(null);
      key.fresh();
    }
  }, [open, key]);

  const other = reason === 'OTHER';
  const missing = !reason ? 'Choose a reason.' : other && !note.trim() ? 'Say why, in a few words.' : null;

  const submit = async (): Promise<void> => {
    if (!reason || missing) return;
    setBusy(true);
    setError(null);
    try {
      await leaveWrites.decline(a.id, { reasonCode: reason, ...(note.trim() ? { note: note.trim() } : {}), expectedVersion: a.version }, key.current());
      onOpenChange(false);
      onDeclined();
    } catch (err) {
      const e = leaveErrorText(err, 'Could not decline. Nothing was changed. Try again.');
      if (CHANGED.has(e.code)) {
        onChanged();
        onOpenChange(false);
      } else setError(e.text);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KitDialog
      open={open}
      onOpenChange={onOpenChange}
      plain
      width={520}
      busy={busy}
      title={`Decline ${detail.person.name}'s leave?`}
      description={`${a.typeLabel} · ${daySmall(a.start)} to ${daySmall(a.end)} · ${a.days} ${a.days === 1 ? 'day' : 'days'}`}
      footer={
        <div className="flex w-full flex-col gap-2">
          {missing ? <p className="m-0 text-right font-wds-sans text-[12px] leading-4 text-wds-text-secondary" role="status">{missing}</p> : null}
          <div className="flex justify-end gap-2.5">
            <DialogButton kind="cancel" size="lg" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</DialogButton>
            <DialogButton kind="primary" size="lg" onClick={submit} disabled={busy || missing !== null} aria-busy={busy}>{busy ? 'Declining…' : 'Decline leave'}</DialogButton>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <ChoiceChips legend="Why? (the person will see this)" legendStyle="sentence" size="sm" options={DECLINE_CHIPS} value={reason} onChange={(v) => setReason(v as DeclineReason)} />
        <FormField label={other ? 'A short note (needed for Other)' : 'A short note'} hint={other ? undefined : 'optional'} error={error ?? undefined}>
          {(ids) => <input id={ids.id} aria-describedby={ids.describedBy} aria-invalid={ids.invalid} autoComplete="off" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} className={FIELD_CLASS} />}
        </FormField>
        <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{toldLine(detail, 'This is recorded in the audit log with your name and the time.')}</p>
      </div>
    </KitDialog>
  );
}
