'use client';

import * as React from 'react';

import { ChoiceChips, DialogButton, KitDialog } from '../../../../_shared';
import type { ProbationVerdict } from '../../../_shared/types/people-types';
import { peopleWrites } from '../../../_shared/services/people-writes';
import { useFileAction } from '../../hooks/use-file-action';
import { firstName } from '../../lib/file-model';
import { REPORT_CHOICES, VERDICT_LABELS, reportNeedsWords } from '../../lib/probation-report';
import { DialogError, DialogTextArea, FooterNote } from './dialog-fields';
import type { FileDialogProps } from './file-dialogs';

/**
 * The head's probation report (Paper frames 9.1 and 9.3): Good, Needs work or Not good, a note, "Send report to HR". Only HR and the
 * Branch Manager read it; the person does not see it. The server allows a head to write it for their own department's people only.
 */
export function ProbationReportDialog({ file, onClose, done }: FileDialogProps) {
  const [verdict, setVerdict] = React.useState<ProbationVerdict | null>(null);
  const [note, setNote] = React.useState('');
  const [shown, setShown] = React.useState(false);
  const action = useFileAction((m) => done(m ?? 'Report sent to HR.'));
  const first = firstName(file.name);
  const needsWords = reportNeedsWords(verdict) && note.trim() === '';
  const send = (): void => {
    setShown(true);
    if (!verdict || needsWords) return;
    void action.run(() => peopleWrites.probationNote(file.id, { verdict, ...(note.trim() ? { note: note.trim() } : {}) }), 'Your report is with HR.');
  };
  return (
    <KitDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Report on ${file.name}`}
      description={`Only HR and your Branch Manager can read this. ${first} does not see it.`}
      busy={action.busy}
      footer={
        <>
          <FooterNote>Logged, with your name.</FooterNote>
          <DialogButton kind="cancel" size="lg" onClick={onClose} disabled={action.busy}>Cancel</DialogButton>
          <DialogButton kind="primary" size="lg" onClick={send} disabled={action.busy}>{action.busy ? 'Sending…' : 'Send report to HR'}</DialogButton>
        </>
      }
    >
      <ChoiceChips legend="How has probation gone?" hint="required" value={verdict} onChange={(v) => setVerdict(v as ProbationVerdict)} options={REPORT_CHOICES.map((v) => ({ value: v, label: VERDICT_LABELS[v] }))} />
      {shown && !verdict ? <p role="alert" className="m-0 font-wds-sans text-[12px] text-wds-error-fg">Choose one.</p> : null}
      <DialogTextArea label="A note" hint={reportNeedsWords(verdict) ? 'required' : 'optional'} value={note} onChange={setNote} rows={4} error={shown && needsWords ? 'Say what needs work, so HR can read it.' : undefined} />
      <DialogError message={action.error} />
    </KitDialog>
  );
}
