'use client';

import * as React from 'react';

import { Callout, DialogButton, PersonAvatar } from '../../../../_shared';
import { PanelCaption, TitledPanel } from '../../../_shared/components/titled-panel';
import { actingLine, headSince } from '../../departments/lib/department-copy';
import type { DepartmentView } from '../../_shared/types/org-types';

/**
 * The Head card (Paper Chapter 3 step 02, right side): who heads the department and what that means, and, for someone who may name
 * heads (`can.assignHead` from the server), the ways to change it: replace, name an acting head, make the acting head permanent, end.
 * The Central Store never has heads, so it says so and draws no buttons.
 */
export function HeadCard({
  department,
  positionOf,
  onReplace,
  onActing,
  onEnd,
}: {
  department: DepartmentView;
  positionOf: (employeeId: string) => string | null;
  onReplace: () => void;
  onActing: () => void;
  onEnd: (which: 'HEAD' | 'ACTING') => void;
}) {
  const { head, actingHead } = department;
  const canChange = department.can.assignHead && !department.isHub && department.isActive;

  if (department.isHub) {
    return (
      <TitledPanel title="Head" padded>
        <p className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">The Central Store has no heads. Its Store Manager looks after it.</p>
      </TitledPanel>
    );
  }
  return (
    <TitledPanel title="Head" aside={head ? <PanelCaption>{headSince(head.since)}</PanelCaption> : undefined}>
      <div className="flex flex-col gap-3.5 px-4 py-4">
        {head ? (
          <div className="flex items-center gap-3.5">
            <PersonAvatar name={head.name} size="md" />
            <div className="flex min-w-0 flex-col">
              <span className="font-wds-sans text-[15px] font-medium leading-5 text-wds-text-ink">{head.name}</span>
              <span className="font-wds-sans text-[13px] leading-4 text-wds-text-secondary">{positionOf(head.employeeId) ?? 'Works in this department'}</span>
            </div>
          </div>
        ) : (
          <Callout tone="warning" size="sm" title="No head">{actingHead ? 'The head role is open. An acting head covers it.' : 'Approvals for this department go to the Branch Manager for now.'}</Callout>
        )}
        {actingHead ? <Callout tone="info" size="sm">{actingLine(actingHead.name, actingHead.returnsOn)} Approvals go to them until then.</Callout> : null}
        {head ? (
          <div className="flex flex-col gap-1">
            <span className="font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-text-secondary">Approves for this department</span>
            <span className="font-wds-sans text-[14px] leading-[18px] text-wds-text-ink">Overtime inside the allowance · leave · Reports · casual days</span>
          </div>
        ) : null}
        {canChange ? (
          <div className="flex flex-wrap gap-2">
            <DialogButton kind="cancel" onClick={onReplace}>{head ? 'Replace head' : 'Assign head'}</DialogButton>
            <DialogButton kind="cancel" onClick={onActing}>{actingHead ? 'Change acting head' : 'Name an acting head'}</DialogButton>
            {actingHead ? <DialogButton kind="cancel" onClick={() => onEnd('ACTING')}>End acting head</DialogButton> : null}
            {head ? <DialogButton kind="cancel" onClick={() => onEnd('HEAD')}>End head</DialogButton> : null}
          </div>
        ) : null}
      </div>
    </TitledPanel>
  );
}
