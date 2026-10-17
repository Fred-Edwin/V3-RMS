'use client';

import * as React from 'react';

import { ChangeDialog, ChoiceChips } from '../../../../_shared';
import { peopleWrites } from '../../../_shared/services/people-writes';
import type { FileRequestKind } from '../../../_shared/types/people-types';
import { useFileAction } from '../../hooks/use-file-action';
import { firstName, REQUEST_LABELS } from '../../lib/file-model';
import { DialogError } from './dialog-fields';
import type { FileDialogProps } from './file-dialogs';

/** Ask for a detail, or remind (W25): the person is told on their phone and adds it themselves. A reminder reuses the open request. */
export function AskDialog({ file, requestId, onClose, done }: FileDialogProps) {
  const first = firstName(file.name);
  const open = file.nextSteps.filter((s) => s.code === 'FILE_REQUEST');
  const asked = new Set(open.map((s) => s.fileRequestKind));
  const [kind, setKind] = React.useState<FileRequestKind | null>(null);
  const action = useFileAction((m) => done(m ?? 'Asked.'));
  const remind = requestId !== undefined;
  const kinds = (Object.keys(REQUEST_LABELS) as FileRequestKind[]).filter((k) => !asked.has(k));

  if (remind) {
    return (
      <ChangeDialog
        open
        onOpenChange={(o) => !o && onClose()}
        title={`Remind ${first}`}
        description="A reminder goes to their phone."
        summaryCaption="WHAT HAPPENS"
        summaryLines={[`${first} gets a reminder to add the detail asked.`, 'Nothing on the file changes. Logged, with your name.']}
        confirmLabel="Send reminder"
        busy={action.busy}
        onConfirm={() => void action.run(() => peopleWrites.remind(file.id, requestId), `Reminder sent to ${first}.`)}
      >
        <DialogError message={action.error} />
      </ChangeDialog>
    );
  }
  return (
    <ChangeDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Ask ${first} for a detail`}
      description={file.hasLogin ? 'They add it on their phone.' : 'They need a login to receive the request.'}
      summaryCaption="WHAT HAPPENS"
      summaryLines={[`${first} is told on their phone and adds it themselves.`, 'It shows on this file as waiting until they do. Logged, with your name.']}
      confirmLabel="Ask"
      confirmDisabledReason={kind === null ? 'Choose what to ask for.' : !file.hasLogin ? `${first} has no login yet. Create one first.` : undefined}
      busy={action.busy}
      onConfirm={() => kind && void action.run(() => peopleWrites.askForDetail(file.id, { kind }), `Asked ${first} for ${REQUEST_LABELS[kind].toLowerCase()}.`)}
    >
      <ChoiceChips legend="What do you need?" value={kind} onChange={(v) => setKind(v as FileRequestKind)} options={kinds.map((k) => ({ value: k, label: REQUEST_LABELS[k] }))} />
      <DialogError message={action.error} />
    </ChangeDialog>
  );
}

/** Verify the statutory numbers (W26): HR checks the NSSF and SHA numbers the person added. */
export function VerifyDialog({ file, onClose, done }: FileDialogProps) {
  const action = useFileAction((m) => done(m ?? 'Verified.'));
  const first = firstName(file.name);
  return (
    <ChangeDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Verify ${first}'s NSSF and SHA`}
      description="Confirms you have checked the numbers against the documents."
      summaryCaption="WHAT CHANGES"
      summaryLines={['The numbers are marked verified, with your name and today\'s date.', 'Payroll no longer waits on them. Logged.']}
      confirmLabel="Verify"
      busy={action.busy}
      onConfirm={() => void action.run(() => peopleWrites.verifyStatutory(file.id), `${first}'s NSSF and SHA are verified.`)}
    >
      <DialogError message={action.error} />
    </ChangeDialog>
  );
}
