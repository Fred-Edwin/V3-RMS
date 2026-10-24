import * as React from 'react';

import { Button } from '@/components/ui2/button';

import { TimeTiles } from '@/features/workforce/attendance';

import { Callout, KeyValueRows, Panel, WorkforceKpiStrip, useWorkforcePermissions, type WorkforceKpiCell } from '../../../../_shared';
import { correctionNote } from '../../lib/correction-note';
import { PANEL_ROWS } from '../../../_shared/components/titled-panel';
import type { EmployeeFile } from '../../../_shared/types/people-types';
import { formatDayMonth } from '../../../_shared/lib/people-dates';
import { firstName, probationCard, withWendo } from '../../lib/file-model';
import { ABOUT_NOTE, aboutRows } from '../../lib/file-rows';
import type { OpenDialog } from './overview-parts';

/** The numbers over a Branch Manager's view (Paper `ZTB-0`). Time and leave cells wait for their slices and are left out, not faked. */
export function branchKpiCells(file: EmployeeFile, today: string): WorkforceKpiCell[] {
  const wendo = withWendo(file.startDate, today);
  const cells: WorkforceKpiCell[] = [{ key: 'wendo', label: 'WITH WENDO', value: wendo.value, detail: wendo.detail }];
  const card = probationCard(file);
  if (card) cells.push({ key: 'probation', label: 'PROBATION', value: `${card.daysLeft} ${card.daysLeft === 1 ? 'day' : 'days'}`, detail: 'left, HR decides', actionable: true });
  return cells;
}

/** For someone who sees the site but not pay or IDs: "For you to do" (a probation note) and "About {first}" with the locked rows. */
export function BranchOverview({ file, open }: { file: EmployeeFile; open: OpenDialog }) {
  const first = firstName(file.name);
  const card = probationCard(file);
  const todo = file.actions.writeNote && card;
  const correction = correctionNote(file.correctUntil);
  const canReadTime = useWorkforcePermissions().can('timesheet.read');
  return (
    <div className="flex flex-col gap-4">
      {correction ? <Callout tone="neutral">{correction}</Callout> : null}
      {canReadTime ? <TimeTiles employeeId={file.id} /> : null}
      {/* With nothing to do, About takes the whole width instead of leaving the left half empty. */}
      <div className={todo ? 'grid grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] items-start gap-6 max-lg:grid-cols-1' : 'grid grid-cols-1 items-start gap-6'}>
      {todo ? (
        <Panel title="For you to do" caption="1 OPEN" padded={false}>
          <div className="flex items-center justify-between gap-3 border-t border-wds-border px-4 py-3">
            <div className="flex min-w-0 items-start gap-3">
              <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 bg-wds-caramel-600" />
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="font-wds-sans text-[15px] font-medium leading-5 text-wds-text-ink">Send your view on {first}’s probation</span>
                <span className="font-wds-sans text-[13px] leading-4 text-wds-text-secondary">HR decides by {formatDayMonth(card.endsOn)}. Your note goes with the head’s report.</span>
              </div>
            </div>
            <Button type="button" variant="flat" size="sm" onClick={() => open('note')}>
              Write a note
            </Button>
          </div>
        </Panel>
      ) : null}
      <Panel title={`About ${first}`} padded={false}>
        <KeyValueRows rows={aboutRows(file)} aria-label={`About ${first}`} topRule={false} className={PANEL_ROWS} />
        <p className="m-0 border-t border-wds-border px-4 py-3 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{ABOUT_NOTE}</p>
      </Panel>
      </div>
    </div>
  );
}

export function BranchKpis({ file, today }: { file: EmployeeFile; today: string }) {
  return <WorkforceKpiStrip aria-label={`${firstName(file.name)} in numbers`} cells={branchKpiCells(file, today)} />;
}
