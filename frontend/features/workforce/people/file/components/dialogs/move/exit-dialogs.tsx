'use client';

import * as React from 'react';

import { ChangeDialog, KitDialog, DialogButton, SingleDateField } from '../../../../../_shared';
import { addDays, nairobiDay } from '../../../../_shared/lib/people-dates';
import { peopleWrites } from '../../../../_shared/services/people-writes';
import { useFileAction } from '../../../hooks/use-file-action';
import { firstName } from '../../../lib/file-model';
import { toRehireBody, validateRehire } from '../../../lib/move-forms';
import { DialogError, FooterNote } from '../dialog-fields';
import type { FileDialogProps } from '../file-dialogs';

/** Undo exit (W22), from the banner or the top bar: puts the login, the rota place and the department back, as before. */
export function UndoExitDialog({ file, onClose, done }: FileDialogProps) {
  const action = useFileAction((m) => done(m ?? 'Exit undone.'));
  const first = firstName(file.name);
  return (
    <ChangeDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Undo ${first}'s exit?`}
      description="This is only possible inside the undo window."
      summaryCaption="WHAT CHANGES"
      summaryLines={[`${first}'s login works again.`, 'Their place in the department and rota is restored, exactly as before.', 'The undo is written to the audit log with your name.']}
      confirmLabel="Undo exit"
      busy={action.busy}
      onConfirm={() => void action.run(() => peopleWrites.undoExit(file.id), `Exit undone. ${first} is back.`)}
    >
      <DialogError message={action.error} />
    </ChangeDialog>
  );
}

/** Rehire (W23): reopens the same file with a new start day, a new probation and a new contract. There is never a second file. */
export function RehireDialog({ file, onClose, done }: FileDialogProps) {
  const today = React.useMemo(() => nairobiDay(), []);
  const [startsOn, setStartsOn] = React.useState(today);
  const [shown, setShown] = React.useState(false);
  const action = useFileAction((m) => done(m ?? 'Rehired.'));
  const first = firstName(file.name);
  const error = validateRehire({ startsOn }, today).startsOn;
  const go = (): void => {
    setShown(true);
    if (error) return;
    void action.run(() => peopleWrites.rehire(file.id, toRehireBody({ startsOn })), `${first} is rehired from ${startsOn}. The same file is open again.`);
  };
  return (
    <KitDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Rehire ${file.name}`}
      description="The same file reopens. Old pay, leave and history stay."
      busy={action.busy}
      footer={
        <>
          <FooterNote>Logged, with your name.</FooterNote>
          <DialogButton kind="cancel" size="lg" onClick={onClose} disabled={action.busy}>Cancel</DialogButton>
          <DialogButton kind="primary" size="lg" onClick={go} disabled={action.busy}>{action.busy ? 'Saving…' : `Rehire ${first}`}</DialogButton>
        </>
      }
    >
      <SingleDateField label="New start day" value={startsOn} onChange={setStartsOn} minDate={today} maxDate={addDays(today, 365)} error={shown ? error : undefined} />
      <p className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">A new probation starts with it, and a new contract is needed. The gap since the last day shows on the timeline.</p>
      <DialogError message={action.error} />
    </KitDialog>
  );
}
