import * as React from 'react';

import { StatBoxes } from '../../../../_shared';
import type { EmployeeFile } from '../../../_shared/types/people-types';
import { FileRingCard, LifeBand, NextStepsPanel, ProbationPanel, type OpenDialog } from './overview-parts';

/** The HR and Director overview (Paper `Y8C-0`): ring and probation, then next steps and the three numbers, then the life band. */
export function HrOverview({ file, open }: { file: EmployeeFile; open: OpenDialog }) {
  const onProbation = file.probation !== null && !file.probation.confirmedOn;
  return (
    <div className="flex flex-col gap-5">
      <div className={onProbation ? 'grid grid-cols-2 items-stretch gap-5 max-lg:grid-cols-1' : 'grid grid-cols-1'}>
        <FileRingCard file={file} open={open} />
        <ProbationPanel file={file} open={open} />
      </div>
      <div className="grid grid-cols-2 items-start gap-5 max-lg:grid-cols-1">
        <NextStepsPanel file={file} open={open} />
        <StatBoxes
          variant="figures"
          cells={[
            { label: 'ON TIME', value: '—', detail: 'arrives with Attendance' },
            { label: 'OVERTIME', value: '—', detail: 'arrives with Attendance' },
            { label: 'LEAVE LEFT', value: '—', detail: 'arrives with Leave' },
          ]}
        />
      </div>
      <LifeBand file={file} />
    </div>
  );
}
