'use client';

import * as React from 'react';

import { Callout, ChoiceChips, DialogButton, KitDialog, RadioCards } from '../../../../_shared';
import type { ProbationVerdict } from '../../../_shared/types/people-types';
import { useLookups } from '../../../_shared/hooks/use-people-data';
import { formatDayMonth } from '../../../_shared/lib/people-dates';
import { peopleWrites } from '../../../_shared/services/people-writes';
import { useFileAction } from '../../hooks/use-file-action';
import { hasErrors, toProbationBody, validateProbation, type ProbationChoice, type ProbationForm } from '../../lib/dialog-forms';
import { firstName, probationCard } from '../../lib/file-model';
import { DialogError, DialogNumber, DialogTextArea, FooterNote } from './dialog-fields';
import type { FileDialogProps } from './file-dialogs';

/** Decide probation (Paper `11OV-0`): confirm, extend once (months and a reason), or end. The server holds the rules; the form mirrors them. */
export function ProbationDialog({ file, onClose, done }: FileDialogProps) {
  const lookups = useLookups();
  const probation = file.probation;
  const card = probationCard(file);
  const first = firstName(file.name);
  const [form, setForm] = React.useState<ProbationForm>({ choice: 'CONFIRM', months: '1', reason: '' });
  const [shown, setShown] = React.useState(false);
  const action = useFileAction((m) => done(m ?? 'Decided.'));
  const set = (patch: Partial<ProbationForm>): void => setForm((f) => ({ ...f, ...patch }));
  const rule = lookups.data?.probationRule ?? { defaultMonths: 3, maxExtensions: 1, maxExtensionMonths: 3 };
  const left = (probation?.extensionsAllowed ?? 0) - (probation?.extensions ?? 0);
  const errors = validateProbation(form, rule, left);

  const submit = (): void => {
    setShown(true);
    if (hasErrors(errors)) return;
    const said = form.choice === 'CONFIRM' ? `${first} is confirmed.` : form.choice === 'EXTEND' ? `Probation extended by ${form.months} ${form.months === '1' ? 'month' : 'months'}.` : 'Employment ended. The exit step is open.';
    void action.run(() => peopleWrites.decideProbation(file.id, toProbationBody(form)), said);
  };
  const ends = card ? formatDayMonth(card.endsOn) : '';
  const labels: Record<ProbationChoice, string> = { CONFIRM: `Confirm ${first}`, EXTEND: 'Extend probation', END: 'End employment' };
  return (
    <KitDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Decide ${file.name}'s probation`}
      description={card ? `Day ${card.dayNumber} of ${card.totalDays}. It ends on ${ends}. The rule: ${rule.defaultMonths} months, ${rule.maxExtensions} extension of up to ${rule.maxExtensionMonths} months.` : undefined}
      busy={action.busy}
      footer={
        <>
          <FooterNote>Written to the audit log.</FooterNote>
          <DialogButton kind="cancel" size="lg" onClick={onClose} disabled={action.busy}>Cancel</DialogButton>
          <DialogButton kind={form.choice === 'END' ? 'danger' : 'primary'} size="lg" onClick={submit} disabled={action.busy}>{action.busy ? 'Saving…' : labels[form.choice]}</DialogButton>
        </>
      }
    >
      <div className="grid grid-cols-2 border border-wds-border max-sm:grid-cols-1">
        <div className="flex flex-col gap-0.5 px-3.5 py-2.5">
          <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">Head&apos;s report</span>
          <span className="font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-ink">{card?.report?.replace('Report from ', '') ?? 'No report yet'}</span>
        </div>
        <div className="flex flex-col gap-0.5 border-l border-wds-border px-3.5 py-2.5 max-sm:border-l-0 max-sm:border-t">
          <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">Branch Manager</span>
          <span className="font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-ink">{probation?.notes.some((n) => n.authorKind === 'BRANCH_MANAGER') ? 'Note sent' : 'No note yet'}</span>
        </div>
      </div>
      <RadioCards
        legend="Your decision"
        legendStyle="caps"
        value={form.choice}
        onChange={(v) => set({ choice: v as ProbationChoice })}
        options={[
          { value: 'CONFIRM', title: `Confirm ${first}`, description: `${first} becomes permanent the day after probation ends. The contract must be signed first.` },
          { value: 'EXTEND', title: `Extend ${first}'s probation`, description: `Once only, by 1 to ${rule.maxExtensionMonths} months. ${first} is told, with the reason.`, disabled: left <= 0 },
          { value: 'END', title: 'End employment', description: `Opens the exit step with ${ends || 'the end date'} as the last day.` },
        ]}
      />
      {form.choice === 'EXTEND' ? (
        <div className="grid grid-cols-[140px_1fr] gap-3 max-sm:grid-cols-1">
          <DialogNumber label="Extend by" value={form.months} onChange={(v) => set({ months: v })} after="months" maxLength={2} error={shown ? errors.months : undefined} />
          <DialogTextArea label="Why" hint="required" value={form.reason} onChange={(v) => set({ reason: v })} rows={2} error={shown ? errors.reason : undefined} />
        </div>
      ) : null}
      {probation?.confirmationWaitingForContract || file.contractStatus !== 'ACTIVE' ? (
        <Callout tone="warning" size="sm">The contract is missing. You can decide now, but confirmation completes once it is recorded.</Callout>
      ) : null}
      <DialogError message={action.error} />
    </KitDialog>
  );
}

/** A note on a probation (W14): good or concerns, and a few words. It goes to HR with the head's report. */
export function NoteDialog({ file, onClose, done }: FileDialogProps) {
  const [verdict, setVerdict] = React.useState<ProbationVerdict | null>(null);
  const [note, setNote] = React.useState('');
  const [shown, setShown] = React.useState(false);
  const action = useFileAction((m) => done(m ?? 'Note sent to HR.'));
  const first = firstName(file.name);
  const needsWords = verdict === 'CONCERNS' && note.trim() === '';
  const send = (): void => {
    setShown(true);
    if (!verdict || needsWords) return;
    void action.run(() => peopleWrites.probationNote(file.id, { verdict, ...(note.trim() ? { note: note.trim() } : {}) }), 'Your note is with HR.');
  };
  return (
    <KitDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Your view on ${first}'s probation`}
      description="HR decides. Your note goes with the head's report."
      busy={action.busy}
      footer={
        <>
          <FooterNote>Logged, with your name.</FooterNote>
          <DialogButton kind="cancel" size="lg" onClick={onClose} disabled={action.busy}>Cancel</DialogButton>
          <DialogButton kind="primary" size="lg" onClick={send} disabled={action.busy}>{action.busy ? 'Sending…' : 'Send to HR'}</DialogButton>
        </>
      }
    >
      <ChoiceChips legend="How has it gone?" hint="required" value={verdict} onChange={(v) => setVerdict(v as ProbationVerdict)} options={[{ value: 'GOOD', label: 'Good' }, { value: 'CONCERNS', label: 'I have concerns' }]} />
      {shown && !verdict ? <p role="alert" className="m-0 font-wds-sans text-[12px] text-wds-error-fg">Choose one.</p> : null}
      <DialogTextArea label="A few words" hint={verdict === 'CONCERNS' ? 'required' : 'optional'} value={note} onChange={setNote} rows={3} error={shown && needsWords ? 'Say what the concerns are.' : undefined} />
      <DialogError message={action.error} />
    </KitDialog>
  );
}
