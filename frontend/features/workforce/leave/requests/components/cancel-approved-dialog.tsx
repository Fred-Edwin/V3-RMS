'use client';

import * as React from 'react';

import { ChoiceChips, FIELD_CLASS, FormField, WorkforcePinDialog } from '../../../_shared';
import { useIdempotencyKey } from '../../_shared/lib/idempotency';
import { CANCEL_CHIPS, leaveErrorText } from '../../_shared/lib/leave-copy';
import { daySmall } from '../../_shared/lib/leave-dates';
import { leaveWrites } from '../../_shared/services/leave-services';
import type { ApplicationDetail, CancelReason } from '../../_shared/types/leave-types';
import { toldLine } from './approve-dialog';

const CHANGED = new Set(['ALREADY_DECIDED', 'NOT_CANCELLABLE', 'LEAVE_NOT_FOUND']);

/** Cancel an approved leave that has not started (production; not in Paper): a reason chip and the PIN, because it voids a signed slip. */
export function CancelApprovedDialog({ open, onOpenChange, detail, onCancelled, onChanged }: { open: boolean; onOpenChange: (open: boolean) => void; detail: ApplicationDetail; onCancelled: () => void; onChanged: () => void }) {
  const [reason, setReason] = React.useState<CancelReason | null>(null);
  const [note, setNote] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | undefined>();
  const key = useIdempotencyKey();
  const a = detail.application;
  React.useEffect(() => {
    if (open) {
      setReason(null);
      setNote('');
      setError(undefined);
      key.fresh();
    }
  }, [open, key]);

  const other = reason === 'OTHER';
  const submit = async (pin: string): Promise<void> => {
    if (!reason) return setError('Choose a reason.');
    if (other && !note.trim()) return setError('Say why, in a few words.');
    setBusy(true);
    setError(undefined);
    try {
      await leaveWrites.cancelApproved(a.id, { reasonCode: reason, ...(note.trim() ? { note: note.trim() } : {}), pin }, key.current());
      onOpenChange(false);
      onCancelled();
    } catch (err) {
      const e = leaveErrorText(err, 'Could not cancel. Nothing was changed. Try again.');
      if (CHANGED.has(e.code)) {
        onChanged();
        onOpenChange(false);
      } else setError(e.text);
    } finally {
      setBusy(false);
    }
  };

  return (
    <WorkforcePinDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Cancel ${detail.person.name}'s approved leave?`}
      description={`${a.typeLabel} · ${daySmall(a.start)} to ${daySmall(a.end)} · ${a.slipCode ?? ''}`.trim()}
      summary={
        <div className="flex flex-col gap-3">
          <ChoiceChips legend="Why?" legendStyle="sentence" size="sm" options={CANCEL_CHIPS} value={reason} onChange={(v) => setReason(v as CancelReason)} />
          <FormField label={other ? 'A short note (needed for Other)' : 'A short note'} hint={other ? undefined : 'optional'}>
            {(ids) => <input id={ids.id} aria-describedby={ids.describedBy} autoComplete="off" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} className={FIELD_CLASS} />}
          </FormField>
        </div>
      }
      pinLabel="Your PIN, to cancel the signed slip"
      caption={`The days go back to the balance, the leave slip is marked cancelled and the rota days stay empty. ${toldLine(detail, '')}`}
      onSubmit={submit}
      submitting={busy}
      error={error}
      confirmLabel="Cancel the leave"
    />
  );
}
