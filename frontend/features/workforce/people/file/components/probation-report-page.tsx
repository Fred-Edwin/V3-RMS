'use client';

import * as React from 'react';

import { ChoiceChips, PhoneButton, PhoneScreen } from '../../../_shared';
import { formatDayMonth } from '../../_shared/lib/people-dates';
import type { EmployeeFile, ProbationVerdict } from '../../_shared/types/people-types';
import { useProbationReport } from '../hooks/use-probation-report';
import { firstName } from '../lib/file-model';
import { REPORT_CHOICES, VERDICT_LABELS, reportNeedsWords } from '../lib/probation-report';
import { DialogError, DialogTextArea } from './dialogs/dialog-fields';

/** The head's probation report as a full page on a phone (Paper frame 9.1): the dark band, the chips, the note, one wide button. */
export function ProbationReportPage({ file, done }: { file: EmployeeFile; done: () => void }) {
  const form = useProbationReport(file.id, done);
  const first = firstName(file.name);
  const where = [file.position?.name, file.organization.name].filter(Boolean).join(' · ');
  const ends = file.probation ? ` Probation ends on ${formatDayMonth(file.probation.endsOn)}. HR decides that day and needs your view.` : '';
  return (
    <PhoneScreen screen="Probation report" kicker="PROBATION REPORT" title={`Report on ${file.name}`} subtitle={`${where}.${ends}`} back="/app/workforce" desktopTitle={`Report on ${file.name}`}>
      <ChoiceChips legend={`How is ${first} doing?`} value={form.verdict} onChange={(v) => form.setVerdict(v as ProbationVerdict)} options={REPORT_CHOICES.map((v) => ({ value: v, label: VERDICT_LABELS[v] }))} />
      {form.shown && !form.verdict ? <p role="alert" className="m-0 font-wds-sans text-[12px] text-wds-error-fg">Choose one.</p> : null}
      <DialogTextArea
        label="Your note"
        hint={reportNeedsWords(form.verdict) ? 'required' : 'optional'}
        value={form.note}
        onChange={form.setNote}
        rows={5}
        helper="A few lines are enough. Say what went well and what to watch."
        error={form.shown && form.needsWords ? 'Say what needs work, so HR can read it.' : undefined}
      />
      <DialogError message={form.error} />
      <PhoneButton size="md" onClick={form.send} disabled={form.busy}>{form.busy ? 'Sending…' : 'Send report to HR'}</PhoneButton>
      <p className="m-0 text-center font-wds-sans text-[12px] leading-4 text-wds-text-secondary">Only HR and your Branch Manager can read this. {first} does not see it. It is written to the audit log.</p>
    </PhoneScreen>
  );
}
