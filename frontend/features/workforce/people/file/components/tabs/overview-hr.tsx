import * as React from 'react';

import { TimeTiles } from '@/features/workforce/attendance';

import { StatBoxes, useWorkforcePermissions } from '../../../../_shared';
import type { EmployeeFile } from '../../../_shared/types/people-types';
import { FileRingCard, LifeBand, NextStepsPanel, ProbationPanel, type OpenDialog } from './overview-parts';

/** The HR and Director overview (Paper `Y8C-0`): ring and probation, then next steps and the three numbers, then the life band. */
export function HrOverview({ file, open }: { file: EmployeeFile; open: OpenDialog }) {
  // Someone who has resigned (an exit is recorded) is not asked for work: no probation card, no open next steps (finding 23).
  const leaving = file.exit !== null;
  const canReadTime = useWorkforcePermissions().can('timesheet.read');
  const onProbation = !leaving && file.probation !== null && !file.probation.confirmedOn;
  return (
    <div className="flex flex-col gap-5">
      <div className={onProbation ? 'grid grid-cols-2 items-stretch gap-5 max-lg:grid-cols-1' : 'grid grid-cols-1'}>
        <FileRingCard file={file} open={open} />
        {leaving ? null : <ProbationPanel file={file} open={open} />}
      </div>
      <div className="grid grid-cols-2 items-start gap-5 max-lg:grid-cols-1">
        {leaving ? <div /> : <NextStepsPanel file={file} open={open} />}
        {/* On time, Overtime and Leave left come from the Time tab's read (Schedule V1); a viewer without `timesheet.read` sees the dashes. */}
        {canReadTime ? (
          <TimeTiles employeeId={file.id} />
        ) : (
          <StatBoxes
            variant="figures"
            cells={[
              { label: 'ON TIME', value: '—', detail: 'not available yet' },
              { label: 'OVERTIME', value: '—', detail: 'not available yet' },
              { label: 'LEAVE LEFT', value: '—', detail: 'not available yet' },
            ]}
          />
        )}
      </div>
      <LifeBand file={file} />
    </div>
  );
}
