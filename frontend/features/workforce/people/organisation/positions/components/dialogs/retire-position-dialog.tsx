'use client';

import * as React from 'react';

import { Callout, ChangeDialog } from '../../../../../_shared';
import { DialogError } from '../../../../_shared/components/dialog-fields';
import { useAction } from '../../../../_shared/hooks/use-action';
import { orgWrites } from '../../../_shared/services/org-services';
import type { PositionView } from '../../../_shared/types/org-types';

/**
 * Retire or restore a position (O15; Paper Chapter 3 step 09). While anyone holds it the button stays off and the box says who has to
 * move first; the server still checks (`POSITION_HELD`, in its own words, lists the holders).
 */
export function RetirePositionDialog({ position, restore, onClose, done }: { position: PositionView; restore: boolean; onClose: () => void; done: (message: string) => void }) {
  const action = useAction((m) => done(m ?? 'Saved.'));
  const held = !restore && position.holderCount > 0;
  return (
    <ChangeDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={restore ? `Bring ${position.name} back?` : `Retire ${position.name}?`}
      description={restore ? 'Departments can offer it again.' : held ? `${position.holderCount} ${position.holderCount === 1 ? 'person holds' : 'people hold'} this position today.` : 'Nobody holds this position today.'}
      summaryCaption="WHAT HAPPENS"
      summaryLines={
        restore
          ? ['It is back on the hiring form for the departments that offer it.', 'This is written to the audit log.']
          : ['It disappears from the hiring form.', 'It stays in old payslips and in the audit log, and you can bring it back from Retired positions.']
      }
      confirmLabel={restore ? 'Bring it back' : 'Retire position'}
      destructive={!restore}
      busy={action.busy}
      confirmDisabledReason={held ? 'Move the people who hold it first.' : undefined}
      onConfirm={() => void action.run(() => (restore ? orgWrites.restorePosition(position.id) : orgWrites.retirePosition(position.id)), restore ? `${position.name} is back.` : `${position.name} is retired.`)}
    >
      {held ? (
        <Callout tone="warning" size="sm" title="If someone still holds it">
          {position.holderCount} {position.holderCount === 1 ? 'person holds' : 'people hold'} {position.name}. Move them to another position, then retire it.
        </Callout>
      ) : null}
      <DialogError message={action.error} />
    </ChangeDialog>
  );
}
