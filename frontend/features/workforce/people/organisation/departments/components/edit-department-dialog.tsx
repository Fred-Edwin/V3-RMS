'use client';

import * as React from 'react';

import { DialogButton, KitDialog } from '../../../../_shared';
import { DialogError, DialogText, FooterNote } from '../../../_shared/components/dialog-fields';
import { useAction } from '../../../_shared/hooks/use-action';
import { PositionChips } from '../../_shared/components/position-chips';
import { usePositions } from '../../_shared/hooks/use-org-data';
import { orgWrites } from '../../_shared/services/org-services';
import type { DepartmentView, PositionView } from '../../_shared/types/org-types';
import { departmentNameError, toUpdateBody } from '../lib/department-forms';

/** Edit a department (O4): its name, a line about it, and the positions it offers. A position someone here holds cannot be taken off (`POSITION_HELD`, in the server's words). */
export function EditDepartmentDialog({ department, canCreatePositions, onClose, done }: { department: DepartmentView; canCreatePositions: boolean; onClose: () => void; done: (message: string) => void }) {
  const before = React.useMemo(() => ({ name: department.name, description: department.description, positionIds: department.positions.map((p) => p.id) }), [department]);
  const [name, setName] = React.useState(department.name);
  const [description, setDescription] = React.useState(department.description ?? '');
  const [positionIds, setPositionIds] = React.useState<string[]>(before.positionIds);
  const [made, setMade] = React.useState<PositionView[]>([]);
  const [shown, setShown] = React.useState(false);
  const positions = usePositions('');
  const action = useAction((m) => done(m ?? 'Saved.'));
  const options = React.useMemo(() => [...(positions.data ?? []), ...made.filter((m) => !(positions.data ?? []).some((p) => p.id === m.id))], [positions.data, made]);
  const body = toUpdateBody(before, { name, description, positionIds });
  const nameError = shown ? departmentNameError(name) : undefined;

  const save = (): void => {
    setShown(true);
    if (departmentNameError(name) || !body) return;
    void action.run(() => orgWrites.updateDepartment(department.id, body), `${department.name} is updated.`);
  };

  return (
    <KitDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Edit ${department.name}`}
      description={department.organizationName}
      busy={action.busy}
      footer={
        <>
          <FooterNote>{body ? 'Written to the audit log.' : 'Nothing has changed yet.'}</FooterNote>
          <DialogButton kind="cancel" size="lg" onClick={onClose} disabled={action.busy}>Cancel</DialogButton>
          <DialogButton kind="primary" size="lg" onClick={save} disabled={action.busy || !body}>{action.busy ? 'Saving…' : 'Save changes'}</DialogButton>
        </>
      }
    >
      <DialogText label="Name" value={name} onChange={setName} autoFocus error={nameError} />
      <DialogText label="What it does" hint="optional" value={description} onChange={setDescription} helper="One line, shown under the department's name." />
      <PositionChips options={options} selected={positionIds} onChange={setPositionIds} onCreated={(p) => setMade((m) => [...m, p])} canCreate={canCreatePositions} disabled={action.busy} />
      <DialogError message={action.error} />
    </KitDialog>
  );
}
