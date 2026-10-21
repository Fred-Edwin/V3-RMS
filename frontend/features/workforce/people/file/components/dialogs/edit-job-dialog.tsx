'use client';

import * as React from 'react';

import { Callout, DialogButton, KitDialog } from '../../../../_shared';
import { useLookups } from '../../../_shared/hooks/use-people-data';
import { peopleWrites } from '../../../_shared/services/people-writes';
import { useReportsTo } from '../../../hire/hooks/use-reports-to';
import { useFileAction } from '../../hooks/use-file-action';
import { firstName } from '../../lib/file-model';
import { DialogError, DialogPicker, FooterNote, ReadOnlyField } from './dialog-fields';
import type { FileDialogProps } from './file-dialogs';

const NOBODY = '__nobody__';

/** Edit job (Paper `136W-0`): position and who they report to. Department and site move through Transfer, which keeps a dated history. */
export function EditJobDialog({ file, onClose, done }: FileDialogProps) {
  const lookups = useLookups();
  const reports = useReportsTo(file.department?.id ?? '');
  const [positionId, setPositionId] = React.useState(file.position?.id ?? '');
  const [reportsToId, setReportsToId] = React.useState(file.reportsTo?.id ?? NOBODY);
  const action = useFileAction((m) => done(m ?? 'Job saved.'));
  const first = firstName(file.name);

  const deptId = file.department?.id;
  const positions = (lookups.data?.positions ?? [])
    .filter((p) => p.isActive && (p.departmentIds.length === 0 || (deptId !== undefined && p.departmentIds.includes(deptId))))
    .map((p) => ({ value: p.id, label: p.name }));
  const heads = [{ value: NOBODY, label: 'Nobody' }, ...reports.options.filter((o) => o.id !== file.id).map((o) => ({ value: o.id, label: o.isHead ? `${o.name} (head)` : o.name }))];
  const changed = positionId !== (file.position?.id ?? '') || reportsToId !== (file.reportsTo?.id ?? NOBODY);

  const save = (): void => {
    void action.run(
      () =>
        peopleWrites.update(file.id, {
          ...(positionId !== (file.position?.id ?? '') ? { positionId } : {}),
          ...(reportsToId !== (file.reportsTo?.id ?? NOBODY) ? { reportsToId: reportsToId === NOBODY ? null : reportsToId } : {}),
        }),
      'Job saved.'
    );
  };
  return (
    <KitDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Edit ${first}'s job`}
      description="Changes take effect today and are kept in the history."
      width={560}
      busy={action.busy}
      footer={
        <>
          <FooterNote>Logged with before and after.</FooterNote>
          <DialogButton kind="cancel" size="lg" onClick={onClose} disabled={action.busy}>Cancel</DialogButton>
          <DialogButton kind="primary" size="lg" onClick={save} disabled={action.busy || !changed} title={changed ? undefined : 'Nothing has changed yet'}>{action.busy ? 'Saving…' : 'Save changes'}</DialogButton>
        </>
      }
    >
      <DialogPicker label="Position" value={positionId} onChange={setPositionId} options={positions} />
      <DialogPicker label="Reports to" value={reportsToId} onChange={setReportsToId} options={heads} />
      <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
        <ReadOnlyField label="Employment" value={file.employment === 'CASUAL' ? 'Casual, daily' : 'Monthly'} />
        <ReadOnlyField label="Clocks in and out" value={file.tracksTime ? 'Yes, from the position' : 'No'} />
      </div>
      <Callout tone="neutral" bullet size="sm">To change {first}&apos;s department or site, use Transfer or Send to another site. Those keep a dated history and tell the heads involved.</Callout>
      <DialogError message={action.error} />
    </KitDialog>
  );
}
