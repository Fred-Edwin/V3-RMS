'use client';

import * as React from 'react';

import { Callout, DialogButton, KitDialog, RadioCards } from '../../../../_shared';
import { useLookups } from '../../../_shared/hooks/use-people-data';
import { formatDayMonth } from '../../../_shared/lib/people-dates';
import { peopleWrites } from '../../../_shared/services/people-writes';
import { useFileAction } from '../../hooks/use-file-action';
import { hasErrors, toProbationBody, validateProbation, type ProbationChoice, type ProbationForm } from '../../lib/dialog-forms';
import { firstName, probationCard } from '../../lib/file-model';
import { headReportBlock } from '../../lib/probation-report';
import { DialogError, DialogNumber, DialogTextArea, FooterNote } from './dialog-fields';
import type { FileDialogProps } from './file-dialogs';

/** Decide probation (Paper `11OV-0`): confirm, extend once (months and a reason), or end. The server holds the rules; the form mirrors them. */
export function ProbationDialog({ file, onClose, done }: FileDialogProps) {
  const lookups = useLookups();
  const probation = file.probation;
  const card = probationCard(file);
  const report = headReportBlock(file);
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
          <span className="font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-ink">{report ? report.verdictLabel : 'No report yet'}</span>
        </div>
        <div className="flex flex-col gap-0.5 border-l border-wds-border px-3.5 py-2.5 max-sm:border-l-0 max-sm:border-t">
          <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">Branch Manager</span>
          <span className="font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-ink">{probation?.notes.some((n) => n.authorKind === 'BRANCH_MANAGER') ? 'Note sent' : 'No note yet'}</span>
        </div>
      </div>
      {report ? (
        <section aria-label="The head's report" className="flex flex-col gap-1 border border-wds-border bg-wds-neutral-50 px-3.5 py-3">
          <div className="flex items-center justify-between gap-3">
            <span className="font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-ink">{report.from}</span>
            <span className="font-wds-mono text-[10px] leading-3 tracking-[0.06em] text-wds-text-secondary">{report.sent}</span>
          </div>
          {report.note ? <p className="m-0 font-wds-sans text-[14px] leading-5 text-wds-text-ink">{report.note}</p> : null}
        </section>
      ) : null}
      <RadioCards
        legend="Your decision"
        legendStyle="caps"
        value={form.choice}
        onChange={(v) => set({ choice: v as ProbationChoice })}
        options={[
          { value: 'CONFIRM', title: `Confirm ${first}`, description: `${first} becomes permanent the day after probation ends. Make sure the contract is recorded on the file.` },
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

