'use client';

import * as React from 'react';

import { ChoiceChips, DialogButton, KitDialog } from '../../../../_shared';
import type { ProbationVerdict } from '../../../_shared/types/people-types';
import { useProbationReport } from '../../hooks/use-probation-report';
import { firstName } from '../../lib/file-model';
import { REPORT_CHOICES, VERDICT_LABELS, reportNeedsWords, reportReaders } from '../../lib/probation-report';
import { useAuthStore } from '@/store/authStore';
import { DialogError, DialogTextArea, FooterNote } from './dialog-fields';
import type { FileDialogProps } from './file-dialogs';

/**
 * The head's probation report on a desktop (Paper frame 9.3): Good, Needs work or Not good, a note, "Send report to HR". Only HR and the
 * Branch Manager read it; the person does not see it. The server allows a head to write it for their own department's people only.
 */
export function ProbationReportDialog({ file, onClose, done }: FileDialogProps) {
  const form = useProbationReport(file.id, done);
  const role = useAuthStore((s) => s.role);
  const first = firstName(file.name);
  return (
    <KitDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Report on ${file.name}`}
      description={`${reportReaders(role)} ${first} does not see it.`}
      busy={form.busy}
      footer={
        <>
          <FooterNote>Logged, with your name.</FooterNote>
          <DialogButton kind="cancel" size="lg" onClick={onClose} disabled={form.busy}>Cancel</DialogButton>
          <DialogButton kind="primary" size="lg" onClick={form.send} disabled={form.busy}>{form.busy ? 'Sending…' : 'Send report to HR'}</DialogButton>
        </>
      }
    >
      <ChoiceChips legend="How has probation gone?" hint="required" value={form.verdict} onChange={(v) => form.setVerdict(v as ProbationVerdict)} options={REPORT_CHOICES.map((v) => ({ value: v, label: VERDICT_LABELS[v] }))} />
      {form.shown && !form.verdict ? <p role="alert" className="m-0 font-wds-sans text-[12px] text-wds-error-fg">Choose one.</p> : null}
      <DialogTextArea label="A note" hint={reportNeedsWords(form.verdict) ? 'required' : 'optional'} value={form.note} onChange={form.setNote} rows={4} error={form.shown && form.needsWords ? 'Say what needs work, so HR can read it.' : undefined} />
      <DialogError message={form.error} />
    </KitDialog>
  );
}
