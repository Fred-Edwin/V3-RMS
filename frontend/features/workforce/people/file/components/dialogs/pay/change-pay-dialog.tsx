'use client';

import * as React from 'react';

import { DialogButton, KitDialog, PIN_LENGTH, PinField, SingleDateField } from '../../../../../_shared';
import { useLookups } from '../../../../_shared/hooks/use-people-data';
import { formatDayMonthYear, formatKes, nairobiDay } from '../../../../_shared/lib/people-dates';
import { peopleReads } from '../../../../_shared/services/people-reads';
import { peopleWrites } from '../../../../_shared/services/people-writes';
import type { PayChangeRow } from '../../../../_shared/types/people-types';
import { useFileAction } from '../../../hooks/use-file-action';
import { hasErrors, toPayChangeBody, validatePayChange, type PayChangeForm } from '../../../lib/dialog-forms';
import { PAY_REASON_LABELS } from '../../../lib/file-rows';
import { overlappingChange, payDifference, payNowSince } from '../../../lib/pay-difference';
import { DialogError, DialogNumber, DialogPicker, DialogTextArea, FooterNote, ReadOnlyField } from '../dialog-fields';
import type { FileDialogProps } from '../file-dialogs';

interface Current {
  amount: string | null;
  since: string | null;
  unit: string;
  history: PayChangeRow[];
}

/**
 * Edit pay / Change pay (Paper frame 7.3). Both the Pay card's "Edit" and the header's "Change pay" open this. Pay is never edited
 * in place: it is a dated change that goes to the Director, and the old amount applies until then.
 */
export function ChangePayDialog({ file, onClose, done }: FileDialogProps) {
  const today = React.useMemo(() => nairobiDay(), []);
  const lookups = useLookups();
  const [current, setCurrent] = React.useState<Current | null>(null);
  const [form, setForm] = React.useState<PayChangeForm>({ amount: '', startsOn: today, reason: '', note: '' });
  const [pin, setPin] = React.useState('');
  const [shown, setShown] = React.useState(false);
  const action = useFileAction((m) => done(m ?? 'Sent to the Director.'));
  const set = (patch: Partial<PayChangeForm>): void => setForm((f) => ({ ...f, ...patch }));

  React.useEffect(() => {
    let live = true;
    peopleReads.pay(file.id).then(
      (p) => live && setCurrent({ amount: p.amount, since: payNowSince(p.history, today)?.since ?? null, unit: p.payType === 'DAILY_RATE' ? 'day' : 'month', history: p.history }),
      () => live && setCurrent({ amount: null, since: null, unit: 'month', history: [] }),
    );
    return () => {
      live = false;
    };
  }, [file.id, today]);

  const errors = validatePayChange(form, today, current?.amount ?? null);
  const send = (): void => {
    setShown(true);
    if (hasErrors(errors) || pin.length !== PIN_LENGTH) return;
    void action.run(() => peopleWrites.requestPayChange(file.id, { ...toPayChangeBody(form), pin }), `Pay change sent to the Director: ${formatKes(form.amount)} from ${formatDayMonthYear(form.startsOn)}.`);
  };
  const reasons = (lookups.data?.payChangeReasons ?? []).map((r) => ({ value: r, label: PAY_REASON_LABELS[r] }));
  const unit = current?.unit ?? 'month';
  const difference = payDifference(current?.amount ?? null, form.amount);
  // A change already agreed or sent that has not started yet (finding 16): a new one dated before it would be replaced by it.
  const overlap = current ? overlappingChange(current.history, form.startsOn) : null;
  return (
    <KitDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Edit pay"
      description={file.name}
      busy={action.busy}
      footer={
        <>
          <FooterNote>Logged, with your name.</FooterNote>
          <DialogButton kind="cancel" size="lg" onClick={onClose} disabled={action.busy}>Cancel</DialogButton>
          <DialogButton kind="primary" size="lg" onClick={send} disabled={action.busy}>{action.busy ? 'Sending…' : 'Send to the Director'}</DialogButton>
        </>
      }
    >
      <ReadOnlyField label="Pay now" value={current?.amount ? `${formatKes(current.amount)} a ${unit}${current.since ? ` · since ${formatDayMonthYear(current.since)}` : ''}` : current ? 'Not set yet' : '…'} mono />
      <DialogNumber label={`New pay a ${unit}`} value={form.amount} onChange={(v) => set({ amount: v })} before="KES" decimal maxLength={9} autoFocus error={shown ? errors.amount : undefined} />
      <div className="grid grid-cols-2 items-end gap-3 max-sm:grid-cols-1">
        <SingleDateField plainLabel label="Starts on" value={form.startsOn} onChange={(d) => set({ startsOn: d })} minDate={today} maxDate={`${Number(today.slice(0, 4)) + 2}-12-31`} error={shown ? errors.startsOn : undefined} />
        <DialogPicker label="Reason" value={form.reason} onChange={(v) => set({ reason: v as PayChangeForm['reason'] })} options={reasons} error={shown ? errors.reason : undefined} />
      </div>
      {form.reason === 'OTHER' ? <DialogTextArea label="What is the reason?" value={form.note} onChange={(v) => set({ note: v })} error={shown ? errors.note : undefined} rows={2} /> : null}
      {difference ? <ReadOnlyField label="Difference" value={`${difference.amount} · ${difference.percent}`} mono /> : null}
      {overlap ? (
        <p role="status" className="m-0 border border-wds-warning-fg px-3 py-2 font-wds-sans text-[13px] leading-[18px] text-wds-warning-fg">
          Another change is already {overlap.status === 'PENDING' ? 'waiting' : 'approved'}: {formatKes(overlap.amount)} from {formatDayMonthYear(overlap.effectiveFrom)}. If it goes ahead, it replaces this one on that day. Pick a later day, or ask the Director to decline the other first.
        </p>
      ) : null}
      <p className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">Pay is never edited in place. This goes to the Director, and the new amount starts on the date above once approved.</p>
      <div className="flex flex-col gap-1.5">
        <span className="font-wds-sans text-[13px] leading-4 text-wds-text-ink">Your PIN</span>
        <PinField value={pin} onChange={setPin} label="Your signing PIN" invalid={shown && pin.length !== PIN_LENGTH} disabled={action.busy} />
        {shown && pin.length !== PIN_LENGTH ? <span role="alert" className="font-wds-sans text-[12px] leading-4 text-wds-error-fg">Enter your 4-digit PIN to send this.</span> : null}
      </div>
      <DialogError message={action.error} />
    </KitDialog>
  );
}
