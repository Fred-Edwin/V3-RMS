'use client';

import * as React from 'react';

import { ChangeDialog } from '../../../../_shared';
import { DialogError } from '../../../_shared/components/dialog-fields';
import { useAction } from '../../../_shared/hooks/use-action';
import { orgWrites } from '../../_shared/services/org-services';

/**
 * Retire or restore a department (O5). The server refuses a retire while anyone who has not exited works there
 * (`DEPARTMENT_HAS_PEOPLE`) and always for the five standard departments (`DEPARTMENT_MANAGED_BY_INVENTORY`); its words are shown here.
 */
export function RetireDepartmentDialog({ id, name, restore, onClose, done }: { id: string; name: string; restore: boolean; onClose: () => void; done: (message: string) => void }) {
  const action = useAction((m) => done(m ?? 'Saved.'));
  return (
    <ChangeDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={restore ? `Bring ${name} back?` : `Retire ${name}?`}
      description={restore ? 'It comes back with no head. Name one from its page.' : 'Nobody works here today, so it can be retired.'}
      summaryCaption="WHAT HAPPENS"
      summaryLines={
        restore
          ? [`${name} appears again on Shifts, the Today board and the hiring form.`, 'It has no head until you name one. This is written to the audit log.']
          : [`${name} disappears from the hiring form, Shifts and the Today board.`, 'Its history and the audit log stay, and you can bring it back from the retired list.', 'This is written to the audit log with your name and the time.']
      }
      confirmLabel={restore ? 'Bring it back' : 'Retire department'}
      destructive={!restore}
      busy={action.busy}
      onConfirm={() => void action.run(() => (restore ? orgWrites.restoreDepartment(id) : orgWrites.retireDepartment(id)), restore ? `${name} is back.` : `${name} is retired.`)}
    >
      <DialogError message={action.error} />
    </ChangeDialog>
  );
}
