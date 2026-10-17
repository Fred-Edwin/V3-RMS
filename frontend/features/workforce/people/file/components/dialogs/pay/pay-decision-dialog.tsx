'use client';

import * as React from 'react';

import { DialogButton, KeyValueRows, KitDialog } from '../../../../../_shared';
import { formatDayMonthYear, formatKes } from '../../../../_shared/lib/people-dates';
import { peopleReads } from '../../../../_shared/services/people-reads';
import { peopleWrites } from '../../../../_shared/services/people-writes';
import type { PayChangeRow } from '../../../../_shared/types/people-types';
import { useFileAction } from '../../../hooks/use-file-action';
import { validateDecision } from '../../../lib/dialog-forms';
import { PAY_REASON_LABELS } from '../../../lib/file-rows';
import { DialogError, DialogTextArea } from '../dialog-fields';
import type { FileDialogProps } from '../file-dialogs';

/** The Director's answer to a pay change (W11). Approving applies it on its start day; declining needs a reason the sender sees. */
export function PayDecisionDialog({ file, requestId, onClose, done }: FileDialogProps) {
  const [change, setChange] = React.useState<PayChangeRow | null>(null);
  const [decline, setDecline] = React.useState(false);
  const [note, setNote] = React.useState('');
  const [shown, setShown] = React.useState(false);
  const action = useFileAction((m) => done(m ?? 'Answered.'));

  React.useEffect(() => {
    let live = true;
    peopleReads.payChanges('PENDING').then((rows) => live && setChange(rows.find((r) => r.id === requestId) ?? null), () => undefined);
    return () => {
      live = false;
    };
  }, [requestId]);

  const decide = (decision: 'APPROVE' | 'DECLINE'): void => {
    if (!change) return;
    setShown(true);
    if (validateDecision(decision, note)) return;
    void action.run(() => peopleWrites.decidePayChange(change.id, { decision, ...(note.trim() ? { note: note.trim() } : {}) }), decision === 'APPROVE' ? 'Approved. The new pay applies from its start day.' : 'Declined. The sender can see why.');
  };
  return (
    <KitDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Pay change for ${file.name}`}
      description="Approving applies it on its start day. Until then the old amount applies."
      busy={action.busy}
      footer={
        <>
          <DialogButton kind="cancel" size="lg" onClick={onClose} disabled={action.busy}>Cancel</DialogButton>
          {decline ? (
            <DialogButton kind="danger" size="lg" onClick={() => decide('DECLINE')} disabled={action.busy || !change}>Decline</DialogButton>
          ) : (
            <>
              <DialogButton kind="cancel" size="lg" onClick={() => setDecline(true)} disabled={action.busy || !change}>Decline…</DialogButton>
              <DialogButton kind="primary" size="lg" onClick={() => decide('APPROVE')} disabled={action.busy || !change}>{action.busy ? 'Saving…' : 'Approve'}</DialogButton>
            </>
          )}
        </>
      }
    >
      {change ? (
        <KeyValueRows
          aria-label="The change"
          rows={[
            { label: 'New basic pay', value: formatKes(change.amount), mono: true },
            { label: 'Starts', value: formatDayMonthYear(change.effectiveFrom), mono: true },
            { label: 'Reason', value: PAY_REASON_LABELS[change.reason] },
            { label: 'Asked by', value: `${change.requestedByName ?? 'HR'} · ${formatDayMonthYear(change.requestedOn)}` },
          ]}
        />
      ) : (
        <p role="status" className="m-0 font-wds-sans text-[13px] text-wds-text-secondary">Loading the change…</p>
      )}
      {decline ? <DialogTextArea label="If you decline, say why" hint="required" value={note} onChange={setNote} rows={2} error={shown ? (validateDecision('DECLINE', note) ?? undefined) : undefined} /> : null}
      <DialogError message={action.error} />
    </KitDialog>
  );
}
