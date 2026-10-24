import { describe, expect, it } from 'vitest';

import type { EmployeeFile } from '../../../_shared/types/people-types';
import { contractLine, jobCardRows, probationLine } from '../tab-rows/job-card-rows';

const file = (over: Partial<EmployeeFile> = {}): EmployeeFile =>
  ({
    position: { id: 'p', name: 'Barista' },
    department: { id: 'd', name: 'Barista' },
    organization: { id: 's', name: 'Nyeri Town' },
    reportsTo: { id: 'h', name: 'Peter Ochieng', isHead: true, positionName: 'Head of Barista', organizationName: 'Nyeri Town' },
    employment: 'MONTHLY',
    contractStatus: 'ACTIVE',
    timeline: [{ on: '2025-02-03', kind: 'CONTRACT', detail: { type: 'Permanent' } }],
    probation: { endsOn: '2025-05-03', dayNumber: 90, totalDays: 90, daysLeft: 0, extensions: 0, extensionsAllowed: 1, decidedOn: null, confirmedOn: '2025-05-03', confirmationWaitingForContract: false, notes: [] },
    ...over,
  }) as unknown as EmployeeFile;

describe('the Job card rows (frames 7.1 and 12.1)', () => {
  it('has the six rows in the order of the frames', () => {
    expect(jobCardRows(file()).map((r) => [r.label, r.main])).toEqual([
      ['Position', 'Barista'],
      ['Department', 'Barista'],
      ['Site', 'Nyeri Town'],
      ['Reports to', 'Peter Ochieng'],
      ['Contract', 'Permanent · signed 3 Feb 2025'],
      ['Probation', 'Confirmed 3 May 2025'],
    ]);
  });
  it('puts the head\'s position and site under the name', () => {
    const row = jobCardRows(file()).find((r) => r.label === 'Reports to');
    expect(row).toMatchObject({ strong: true, sub: 'Head of Barista · Nyeri Town' });
  });
  it('says so when nobody is the head yet', () => {
    expect(jobCardRows(file({ reportsTo: null })).find((r) => r.label === 'Reports to')).toMatchObject({ main: 'No head yet', muted: true });
  });
});

describe('the contract and probation lines', () => {
  it('says a monthly person has no contract recorded', () => {
    expect(contractLine(file({ timeline: [] }))).toEqual({ text: 'None recorded yet', muted: true });
  });
  it('says a casual is paid by the day', () => {
    expect(contractLine(file({ timeline: [], employment: 'CASUAL' })).text).toBe('Casual, paid by the day');
  });
  it('gives the end day while probation runs, and nothing when there is none', () => {
    expect(probationLine(file({ probation: { ...file().probation!, confirmedOn: null } })).text).toBe('On probation, ends 3 May 2025');
    expect(probationLine(file({ probation: null }))).toEqual({ text: 'Not applicable', muted: true });
  });
});
