import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { Report, ReportRow } from '../../_shared/types/timesheet-types';
import { csvName, reportCsv } from '../lib/report-view';
import { ReportTable, onlySystem } from './report-table';

const row = (over: Partial<ReportRow>): ReportRow => ({ employeeId: 'e', name: 'Amina Hassan', departmentName: 'Barista', plannedMinutes: 2400, workedMinutes: 2290, lateMinutes: 0, absentDays: 0, overtimeAuthorisedMinutes: 0, notes: [], ...over });

const report: Report = {
  number: 'TSH-0007',
  organization: 'Nyeri Town',
  period: { id: 'p', organizationId: 's', start: '2026-10-01', end: '2026-10-31', label: 'October 2026', cutoffAt: '2026-11-02T15:00:00.000Z', state: 'CLOSED', reportNumber: 7, closeKind: 'AUTO', closedAt: '2026-11-02T15:00:00.000Z', closedById: null, signedById: null, signedAt: null, reopenedAt: null, reopenedById: null, reopenReason: null },
  summary: { people: 3, plannedMinutes: 7200, workedMinutes: 7000, overtimeAuthorisedMinutes: 35, lateMinutes: 5, lateDays: 1, absentDays: 0, autoApprovedDays: 60, needsLookDays: 0, needsLookPeople: 0, pendingOvertimeItems: 0 },
  rows: [
    row({ employeeId: '1', name: 'Amina Hassan', notes: [{ code: 'OPEN_MOVES_ON', by: null }] }),
    row({ employeeId: '2', name: 'Cynthia Wairimu', lateMinutes: 5, overtimeAuthorisedMinutes: 35, workedMinutes: 2465, notes: [{ code: 'OVERTIME_DECIDED', by: 'Faith Njeri (BM Nyeri Town)', minutes: 35, date: '2026-10-10' }] }),
    row({ employeeId: '3', name: 'Victor Maina', workedMinutes: 2400, notes: [{ code: 'APPROVED_BY_SYSTEM', by: null }] }),
  ],
  closed: { at: '2026-11-02T15:00:00.000Z', automatically: true, by: null },
  signatures: { signedBy: null, receivedByPayroll: null },
  carriedOnDays: 1,
  carriedOnOvertime: 0,
};

describe('the timesheet report', () => {
  it('counts a person with nothing but the system’s approval in one line, as Paper does, and lists everyone else', () => {
    expect(onlySystem(report.rows[2] as ReportRow)).toBe(true);
    expect(onlySystem(report.rows[1] as ReportRow)).toBe(false);
    const out = renderToStaticMarkup(h(ReportTable, { report }));
    expect(out).toContain('Amina Hassan');
    expect(out).toContain('Cynthia Wairimu');
    expect(out).not.toContain('Victor Maina');
    expect(out).toContain('1 more person, all approved by the system');
    expect(out).toContain('Overtime 0:35 approved by Faith Njeri');
    expect(out).toContain('1 day and 0 overtime answers were still open and moved to the next month for HR.');
  });

  it('is hours only: no money anywhere on the page or in the file', () => {
    const out = renderToStaticMarkup(h(ReportTable, { report })) + reportCsv(report);
    expect(out).not.toMatch(/KES|Ksh|pay rate|salary/i);
  });

  it('exports every person, hours as h:mm, in a file named for the report and month', () => {
    const csv = reportCsv(report);
    expect(csv.split('\r\n')).toHaveLength(2 + 3);
    expect(csv).toContain('"Victor Maina","Barista","40:00","40:00"');
    expect(csv).toContain('"Overtime 0:35 approved by Faith Njeri"');
    expect(csvName(report)).toBe('TSH-0007-2026-10.csv');
  });
});
