'use client';

import * as React from 'react';

import { DialogButton, KitDialog } from '../../../../_shared';
import { DialogError, DialogPicker, DialogText, FooterNote } from '../../../_shared/components/dialog-fields';
import { useAction } from '../../../_shared/hooks/use-action';
import { PositionChips } from '../../_shared/components/position-chips';
import { usePositions } from '../../_shared/hooks/use-org-data';
import { orgWrites } from '../../_shared/services/org-services';
import type { PositionView } from '../../_shared/types/org-types';
import { departmentNameError, toCreateBody } from '../lib/department-forms';

/**
 * Add a department (Paper Chapter 3 step 05; O3). Name, site, and the positions it offers when hiring. Paper also draws an optional
 * head; a new department has nobody in it yet, so nobody could be chosen: the line says approvals go to the Branch Manager until a head
 * is named from the department's own page.
 */
export function AddDepartmentDialog({
  sites,
  defaultSiteId,
  canCreatePositions,
  onClose,
  done,
}: {
  sites: readonly { id: string; name: string }[];
  defaultSiteId: string | null;
  canCreatePositions: boolean;
  onClose: () => void;
  done: (message: string, departmentId?: string) => void;
}) {
  const [name, setName] = React.useState('');
  const [siteId, setSiteId] = React.useState(defaultSiteId ?? (sites.length === 1 ? (sites[0]?.id ?? '') : ''));
  const [positionIds, setPositionIds] = React.useState<string[]>([]);
  const [made, setMade] = React.useState<PositionView[]>([]);
  const [shown, setShown] = React.useState(false);
  const positions = usePositions('');
  const created = React.useRef<string | undefined>(undefined);
  const action = useAction((m) => done(m ?? 'Department added.', created.current));

  const options = React.useMemo(() => [...(positions.data ?? []), ...made.filter((m) => !(positions.data ?? []).some((p) => p.id === m.id))], [positions.data, made]);
  const nameError = shown ? departmentNameError(name) : undefined;
  const siteError = shown && !siteId ? 'Choose the site.' : undefined;
  const siteName = sites.find((s) => s.id === siteId)?.name;

  const save = (): void => {
    setShown(true);
    if (departmentNameError(name) || !siteId) return;
    void action.run(async () => {
      const dept = await orgWrites.createDepartment(toCreateBody(name, siteId, positionIds));
      created.current = dept.id;
    }, `${name.trim()} is added${siteName ? ` at ${siteName}` : ''}. It is on Shifts, the Today board and the Organisation page now.`);
  };

  return (
    <KitDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Add a department"
      description="It appears at once on Shifts, the Today board and the head's phone."
      busy={action.busy}
      footer={
        <>
          <FooterNote>Written to the audit log.</FooterNote>
          <DialogButton kind="cancel" size="lg" onClick={onClose} disabled={action.busy}>Cancel</DialogButton>
          <DialogButton kind="primary" size="lg" onClick={save} disabled={action.busy}>{action.busy ? 'Saving…' : 'Add department'}</DialogButton>
        </>
      }
    >
      <DialogText label="Name" value={name} onChange={setName} autoFocus error={nameError} />
      <DialogPicker label="Site" value={siteId} onChange={setSiteId} options={sites.map((s) => ({ value: s.id, label: s.name }))} placeholder="Choose the site" error={siteError} />
      <p className="m-0 -mt-2 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
        Head: until one is named, approvals go to the Branch Manager. You will see it as a gap on the Organisation page, and can name a head from the department once someone works in it.
      </p>
      <PositionChips options={options} selected={positionIds} onChange={setPositionIds} onCreated={(p) => setMade((m) => [...m, p])} canCreate={canCreatePositions} disabled={action.busy} />
      <DialogError message={action.error} />
    </KitDialog>
  );
}
