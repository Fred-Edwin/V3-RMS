'use client';

import * as React from 'react';

import { DialogButton, KitDialog, SegmentedControl } from '../../../../_shared';
import { useLookups } from '../../../_shared/hooks/use-people-data';
import { nairobiDay } from '../../../_shared/lib/people-dates';
import { peopleWrites } from '../../../_shared/services/people-writes';
import { useFileAction } from '../../hooks/use-file-action';
import { useMovePreview } from '../../hooks/use-move-preview';
import { hasErrors } from '../../lib/dialog-forms';
import { firstName } from '../../lib/file-model';
import { longDate, toExitBody, toTransferBody, toldLine, validateExit, validateTransfer, type ExitForm, type TransferForm } from '../../lib/move-forms';
import { DialogError, FooterNote } from './dialog-fields';
import type { FileDialogProps } from './file-dialogs';
import { ExitPane } from './move/exit-pane';
import { TransferPane } from './move/transfer-pane';

type Mode = 'transfer' | 'exit';

/**
 * Move (Paper `ZJ7-0` and `127P-0`): Transfer or Exit in one dialog. Each shows what would change, asked of the server, before the
 * button saves anything. Only the choices the server allows are offered. After an exit the screen shows its Undo toast (rule 03).
 */
export function MoveDialog({ file, onClose, done }: FileDialogProps) {
  const today = React.useMemo(() => nairobiDay(), []);
  const lookups = useLookups();
  const first = firstName(file.name);
  const canTransfer = file.actions.transfer;
  const canExit = file.actions.exit;
  const [mode, setMode] = React.useState<Mode>(canTransfer ? 'transfer' : 'exit');
  const [transfer, setTransfer] = React.useState<TransferForm>({ toSiteId: '', toDepartmentId: '', toPositionId: '', startsOn: today });
  const [exit, setExit] = React.useState<ExitForm>({ lastDay: today, reason: '', uniformReturned: false, note: '' });
  const [shown, setShown] = React.useState(false);
  const modeRef = React.useRef(mode);
  modeRef.current = mode;
  const action = useFileAction((m) =>
    modeRef.current === 'exit'
      ? done(m ?? 'Saved.', async () => {
          await peopleWrites.undoExit(file.id);
          done(`Exit undone. ${first} is back, with their login and place restored.`);
        })
      : done(m ?? 'Saved.')
  );

  const tErrors = validateTransfer(transfer, file, today);
  const eErrors = validateExit(exit, today);
  const tReady = transfer.toSiteId !== '' && transfer.toDepartmentId !== '' && !hasErrors(tErrors);
  const tPreview = useMovePreview(JSON.stringify(transfer), mode === 'transfer' && tReady, () => peopleWrites.previewTransfer(file.id, toTransferBody(transfer)));
  const eReady = mode === 'exit' && !hasErrors(eErrors);
  const ePreview = useMovePreview(JSON.stringify(exit), eReady, () => peopleWrites.previewExit(file.id, toExitBody(exit)));

  const confirm = async (): Promise<void> => {
    setShown(true);
    if (mode === 'transfer') {
      if (hasErrors(tErrors)) return;
      await action.run(() => peopleWrites.transfer(file.id, toTransferBody(transfer)), `${first} moves on ${longDate(transfer.startsOn)}.`);
      return;
    }
    if (hasErrors(eErrors)) return;
    const body = toExitBody(exit);
    await action.run(() => peopleWrites.exit(file.id, body), `${first} leaves on ${longDate(exit.lastDay)}. You can undo this for ${lookups.data?.exitUndoDays ?? 7} days.`);
  };
  const modes = [canTransfer ? { value: 'transfer', label: 'Transfer' } : null, canExit ? { value: 'exit', label: 'Exit' } : null].filter((m): m is { value: string; label: string } => m !== null);
  const preview = mode === 'transfer' ? tPreview : ePreview;
  return (
    <KitDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Move ${file.name}`}
      description={[file.position?.name, file.department ? `${file.department.name} department` : null, file.organization.name].filter(Boolean).join(' · ')}
      width={620}
      busy={action.busy}
      footer={
        <>
          <FooterNote>{mode === 'exit' ? toldLine(ePreview.preview, 'Logged, and the Director is told.') : toldLine(tPreview.preview, 'Written to the audit log with the date.')}</FooterNote>
          <DialogButton kind="cancel" size="lg" onClick={onClose} disabled={action.busy}>Cancel</DialogButton>
          <DialogButton kind={mode === 'exit' ? 'danger' : 'primary'} size="lg" onClick={() => void confirm()} disabled={action.busy || (preview.loading && !preview.error)}>
            {action.busy ? 'Saving…' : mode === 'exit' ? `Exit ${first} on ${exit.lastDay ? longDate(exit.lastDay) : '…'}` : `Transfer on ${longDate(transfer.startsOn)}`}
          </DialogButton>
        </>
      }
    >
      {modes.length > 1 ? <SegmentedControl items={modes} value={mode} onChange={(v) => setMode(v as Mode)} label="What to do" className="self-start" /> : null}
      {mode === 'transfer' ? (
        <TransferPane file={file} form={transfer} set={(p) => setTransfer((f) => ({ ...f, ...p }))} errors={shown ? tErrors : {}} today={today} preview={tPreview.preview} loading={tPreview.loading} previewError={tPreview.error} />
      ) : (
        <ExitPane form={exit} set={(p) => setExit((f) => ({ ...f, ...p }))} errors={shown ? eErrors : {}} today={today} undoDays={lookups.data?.exitUndoDays ?? 7} preview={ePreview.preview} />
      )}
      <DialogError message={action.error} />
    </KitDialog>
  );
}
