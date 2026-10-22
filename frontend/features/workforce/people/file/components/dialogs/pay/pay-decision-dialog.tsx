'use client';

import * as React from 'react';

import { Callout, DialogButton, KeyValueRows, KitDialog, PIN_LENGTH, PersonLabel, PinField } from '../../../../../_shared';
import { formatDayMonthYear, formatKes, nairobiDay } from '../../../../_shared/lib/people-dates';
import { peopleReads } from '../../../../_shared/services/people-reads';
import { peopleWrites } from '../../../../_shared/services/people-writes';
import type { PayChangeRow, PayView } from '../../../../_shared/types/people-types';
import { useFileAction } from '../../../hooks/use-file-action';
import { validateDecision } from '../../../lib/dialog-forms';
import { PAY_REASON_LABELS } from '../../../lib/file-rows';
import { askedAgo, overlappingChange, payDifference } from '../../../lib/pay-difference';
import { DialogError, DialogTextArea } from '../dialog-fields';
import type { FileDialogProps } from '../file-dialogs';

/**
 * The Director reviews a pay change (Paper frame 7.4): the person, then Now, New, the Difference, the start day, who asked and why,
 * a warning when another change is already agreed, and the PIN. Approving applies it on its start day; declining needs a reason the
 * sender sees.
 */
export function PayDecisionDialog({ file, requestId, onClose, done }: Pick<FileDialogProps, 'requestId' | 'onClose' | 'done'> & { file: { name: string } }) {
  const today = React.useMemo(() => nairobiDay(), []);
  const [change, setChange] = React.useState<PayChangeRow | null>(null);
  const [pay, setPay] = React.useState<PayView | null>(null);
  const [person, setPerson] = React.useState<{ position: string | null; site: string; photoUrl: string | null } | null>(null);
  const [decline, setDecline] = React.useState(false);
  const [note, setNote] = React.useState('');
  const [pin, setPin] = React.useState('');
  const [shown, setShown] = React.useState(false);
  const action = useFileAction((m) => done(m ?? 'Answered.'));

  React.useEffect(() => {
    let live = true;
    // The change names the employee; the pay now, the overlap check and the person label are read once it is known.
    peopleReads.payChanges('PENDING').then(
      (rows) => {
        const found = rows.find((r) => r.id === requestId) ?? null;
        if (live) setChange(found);
        if (!found) return;
        peopleReads.pay(found.employeeId).then((p) => live && setPay(p), () => undefined);
        peopleReads.file(found.employeeId).then((f) => live && setPerson({ position: f.position?.name ?? null, site: f.organization.name, photoUrl: f.photoUrl }), () => undefined);
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [requestId]);

  const decide = (decision: 'APPROVE' | 'DECLINE'): void => {
    if (!change) return;
    setShown(true);
    if (validateDecision(decision, note) || pin.length !== PIN_LENGTH) return;
    void action.run(() => peopleWrites.decidePayChange(change.id, { decision, pin, ...(note.trim() ? { note: note.trim() } : {}) }), decision === 'APPROVE' ? `Approved: ${change.employeeName}'s pay is ${formatKes(change.amount)} from ${formatDayMonthYear(change.effectiveFrom)}.` : `Declined: ${change.employeeName}'s pay stays as it is. The sender can see why.`);
  };

  const unit = pay?.payType === 'DAILY_RATE' ? 'day' : 'month';
  const difference = change ? payDifference(pay?.amount ?? null, change.amount) : null;
  const overlap = change && pay ? overlappingChange(pay.history, change.effectiveFrom, change.id) : null;
  const askedBy = change ? [change.requestedByName ?? 'HR', change.requestedByPosition, change.requestedBySite].filter(Boolean).join(' · ') : '';
  const cells = [
    { kicker: 'NOW', value: pay?.amount ? formatKes(pay.amount) : pay ? 'Not set yet' : '…', note: null },
    { kicker: 'NEW', value: change ? formatKes(change.amount) : '…', note: change ? `a ${unit}` : null },
    ...(difference ? [{ kicker: 'DIFFERENCE', value: difference.amount, note: difference.percent }] : []),
  ];
  return (
    <KitDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Review pay change"
      description="Approving applies it on its start day. Until then the old amount applies."
      busy={action.busy}
      footer={
        <>
          <DialogButton kind="cancel" size="lg" onClick={onClose} disabled={action.busy}>Cancel</DialogButton>
          {decline ? (
            <DialogButton kind="danger" size="lg" onClick={() => decide('DECLINE')} disabled={action.busy || !change}>Decline</DialogButton>
          ) : (
            <>
              <DialogButton kind="cancel" size="lg" onClick={() => setDecline(true)} disabled={action.busy || !change}>Decline</DialogButton>
              <DialogButton kind="primary" size="lg" onClick={() => decide('APPROVE')} disabled={action.busy || !change}>{action.busy ? 'Saving…' : 'Approve'}</DialogButton>
            </>
          )}
        </>
      }
    >
      <PersonLabel name={file.name} position={person?.position} site={person?.site} photoUrl={person?.photoUrl} />
      {change ? (
        <>
          <div role="group" aria-label="The change" className="grid border border-wds-border" style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }}>
            {cells.map((c) => (
              <div key={c.kicker} className="flex flex-col gap-1 border-l border-wds-border px-3.5 py-3 first:border-l-0">
                <span className="font-wds-mono text-[10px] leading-3 tracking-[0.08em] text-wds-text-secondary">{c.kicker}</span>
                <span className="font-wds-sans text-[18px] font-medium leading-6 text-wds-text-ink">{c.value}</span>
                {c.note ? <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{c.note}</span> : null}
              </div>
            ))}
          </div>
          <KeyValueRows
            aria-label="Start, sender and reason"
            rows={[
              { label: 'Starts on', value: formatDayMonthYear(change.effectiveFrom), mono: true },
              { label: 'Asked by', value: `${askedBy}, ${askedAgo(change.requestedOn, today)}` },
              { label: 'Reason', value: PAY_REASON_LABELS[change.reason] },
            ]}
          />
        </>
      ) : (
        <p role="status" className="m-0 font-wds-sans text-[13px] text-wds-text-secondary">Loading the change…</p>
      )}
      {overlap ? (
        <Callout tone="error" size="sm" role="status" title={`Another change is already ${overlap.status === 'PENDING' ? 'waiting' : 'approved'}`}>
          {formatKes(overlap.amount)} from {formatDayMonthYear(overlap.effectiveFrom)}. If both go ahead, the later start day wins.
        </Callout>
      ) : null}
      {decline ? <DialogTextArea label="If you decline, say why" hint="required" value={note} onChange={setNote} rows={2} error={shown ? (validateDecision('DECLINE', note) ?? undefined) : undefined} /> : null}
      <div className="flex flex-col gap-1.5">
        <span className="font-wds-sans text-[13px] leading-4 text-wds-text-ink">Your PIN</span>
        <PinField value={pin} onChange={setPin} label="Your signing PIN" invalid={shown && pin.length !== PIN_LENGTH} disabled={action.busy} />
        {shown && pin.length !== PIN_LENGTH ? <span role="alert" className="font-wds-sans text-[12px] leading-4 text-wds-error-fg">Enter your 4-digit PIN to answer.</span> : null}
      </div>
      <DialogError message={action.error} />
    </KitDialog>
  );
}
