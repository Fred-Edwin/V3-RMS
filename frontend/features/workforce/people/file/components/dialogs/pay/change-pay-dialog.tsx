'use client';

import * as React from 'react';

import { DialogButton, KitDialog, SingleDateField } from '../../../../../_shared';
import { useLookups } from '../../../../_shared/hooks/use-people-data';
import { formatDayMonthYear, formatKes, nairobiDay } from '../../../../_shared/lib/people-dates';
import { peopleReads } from '../../../../_shared/services/people-reads';
import { peopleWrites } from '../../../../_shared/services/people-writes';
import { useFileAction } from '../../../hooks/use-file-action';
import { hasErrors, payChangeSteps, toPayChangeBody, validatePayChange, type PayChangeForm } from '../../../lib/dialog-forms';
import { PAY_REASON_LABELS } from '../../../lib/file-rows';
import { firstName } from '../../../lib/file-model';
import { DialogError, DialogNumber, DialogPicker, DialogTextArea, FooterNote, ReadOnlyField } from '../dialog-fields';
import type { FileDialogProps } from '../file-dialogs';

/** Change pay (Paper `13F3-0`): it asks for the day it starts and goes to the Director; the old amount applies until then. */
export function ChangePayDialog({ file, onClose, done }: FileDialogProps) {
  const today = React.useMemo(() => nairobiDay(), []);
  const lookups = useLookups();
  const [current, setCurrent] = React.useState<{ amount: string | null; unit: string } | null>(null);
  const [form, setForm] = React.useState<PayChangeForm>({ amount: '', startsOn: today, reason: '', note: '' });
  const [shown, setShown] = React.useState(false);
  const action = useFileAction((m) => done(m ?? 'Sent to the Director.'));
  const first = firstName(file.name);
  const set = (patch: Partial<PayChangeForm>): void => setForm((f) => ({ ...f, ...patch }));

  React.useEffect(() => {
    let live = true;
    peopleReads.pay(file.id).then((p) => live && setCurrent({ amount: p.amount, unit: p.payType === 'DAILY_RATE' ? 'day' : 'month' }), () => live && setCurrent({ amount: null, unit: 'month' }));
    return () => {
      live = false;
    };
  }, [file.id]);

  const errors = validatePayChange(form, today, current?.amount ?? null);
  const send = (): void => {
    setShown(true);
    if (hasErrors(errors)) return;
    void action.run(() => peopleWrites.requestPayChange(file.id, toPayChangeBody(form)), `Pay change sent to the Director: ${formatKes(form.amount)} from ${formatDayMonthYear(form.startsOn)}.`);
  };
  const reasons = (lookups.data?.payChangeReasons ?? []).map((r) => ({ value: r, label: PAY_REASON_LABELS[r] }));
  const unit = current?.unit ?? 'month';
  return (
    <KitDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Change ${first}'s pay`}
      description="The old amount stays in the history. Nothing is overwritten."
      busy={action.busy}
      footer={
        <>
          <FooterNote>Logged, with your name.</FooterNote>
          <DialogButton kind="cancel" size="lg" onClick={onClose} disabled={action.busy}>Cancel</DialogButton>
          <DialogButton kind="primary" size="lg" onClick={send} disabled={action.busy}>{action.busy ? 'Sending…' : 'Send to the Director'}</DialogButton>
        </>
      }
    >
      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3 max-sm:grid-cols-1">
        <ReadOnlyField label="Now" value={current?.amount ? `${formatKes(current.amount)} / ${unit}` : current ? 'Not set yet' : '…'} mono />
        <span aria-hidden className="pb-2 text-wds-text-faint max-sm:hidden">→</span>
        <DialogNumber label="New basic pay" value={form.amount} onChange={(v) => set({ amount: v })} before="KES" after={`/ ${unit}`} decimal maxLength={9} autoFocus error={shown ? errors.amount : undefined} />
      </div>
      <div className="grid grid-cols-2 items-end gap-3 max-sm:grid-cols-1">
        <SingleDateField label="Starts on" value={form.startsOn} onChange={(d) => set({ startsOn: d })} minDate={today} maxDate={`${Number(today.slice(0, 4)) + 2}-12-31`} error={shown ? errors.startsOn : undefined} />
        <DialogPicker label="Reason" value={form.reason} onChange={(v) => set({ reason: v as PayChangeForm['reason'] })} options={reasons} error={shown ? errors.reason : undefined} />
      </div>
      {form.reason === 'OTHER' ? <DialogTextArea label="What is the reason?" value={form.note} onChange={(v) => set({ note: v })} error={shown ? errors.note : undefined} rows={2} /> : null}
      <section aria-label="Who decides" className="flex flex-col gap-2.5 border border-wds-border bg-wds-neutral-50 px-4 py-3.5">
        <h3 className="m-0 font-wds-mono text-[10px] font-normal leading-3 tracking-[0.06em] text-wds-text-secondary">WHO DECIDES</h3>
        <ol className="m-0 flex list-none flex-col gap-2 p-0">
          {payChangeSteps(form.startsOn).map((s, i) => (
            <li key={s} className="flex items-center gap-2.5 font-wds-sans text-[13px] leading-[18px] text-wds-text-ink">
              <span aria-hidden className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-wds-primary text-[11px] leading-none text-wds-primary">{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
      </section>
      <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">The Branch Manager and {first}&apos;s head never see these amounts. {first} is told when it starts.</p>
      <DialogError message={action.error} />
    </KitDialog>
  );
}
