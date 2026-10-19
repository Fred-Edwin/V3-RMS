import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { Day, Overtime, PersonPeriod } from '../../_shared/types/timesheet-types';
import { DayList, type DayActions } from './day-list';

const day = (shiftDate: string, over: Partial<Day> = {}): Day => ({ id: shiftDate, periodId: 'p', employeeId: 'e', shiftDate, status: 'AUTO_APPROVED', reasons: [], scheduledMinutes: 480, workedMinutes: 480, minutesLate: 0, minutesAfterGrace: 0, leftEarlyMinutes: 0, afterEndMinutes: 0, lateExcused: false, decidedById: null, decidedAt: null, decisionReason: null, carriedFromPeriodId: null, ...over });

const overtime: Overtime = {
  id: 'o', periodId: 'p', employeeId: 'e', shiftDate: '2026-10-08', rawMinutes: 90, serviceTailMinutes: 0, autoMinutes: 0, needsMinutes: 90, authorisedMinutes: 0, status: 'PENDING',
  evidence: { openWorkAtEnd: false, ordersTaken: 0, ticketsCleared: 0, openOrdersAtEnd: 0 },
  limits: { weeklyCapMinutes: null, weekMinutes: 90, overCapMinutes: 0, branchBudgetMinutes: null, branchUsedMinutes: 90, insideAllowance: true }, decidedById: null, decidedAt: null, decisionReason: null,
};

const days = [day('2026-10-05'), day('2026-10-06', { status: 'NEEDS_LOOK', reasons: ['LATE'], minutesLate: 20, minutesAfterGrace: 15 }), day('2026-10-08', { status: 'NEEDS_LOOK', reasons: ['OVERTIME'] })];
const person = { period: {}, person: { id: 'e', name: 'Cynthia', departmentName: null }, days, weeks: [], overtime: [overtime], requests: [] } as unknown as PersonPeriod;

const html = (actions: DayActions): string => renderToStaticMarkup(h(DayList, { person, days, actions, onOvertime: () => undefined, onDecision: () => undefined, onFix: () => undefined, onChanged: () => undefined }));
const ALL: DayActions = { decide: true, overtime: true, fix: true };

describe('a person’s days', () => {
  it('shows the days the system approved as quiet rows and a card for each day that needs a person', () => {
    const out = html(ALL);
    expect(out).toContain('Approved by the system');
    expect(out).toContain('TUE 6 · needs you');
    expect(out).toContain('THU 8 · needs you');
    expect(out).toContain('Late 20 min');
  });

  it('offers each button the person may use: accept and excuse and hold on a late day; the overtime review first on an overtime day', () => {
    const out = html(ALL);
    expect(out).toContain('Excuse lateness');
    expect(out).toContain('Hold');
    expect(out).toContain('Edit time');
    expect(out).toContain('Review the overtime');
    // Overtime is answered first: the overtime day has no "Accept as recorded" (the server refuses it until then).
    expect(out.match(/Accept as recorded/g)).toHaveLength(1);
  });

  it('hides a button the person may not use, never greys it (a read-only viewer sees the facts and no buttons)', () => {
    const out = html({ decide: false, overtime: false, fix: false });
    expect(out).toContain('TUE 6 · needs you');
    for (const word of ['Accept as recorded', 'Excuse lateness', 'Hold', 'Edit time', 'Review the overtime']) expect(out).not.toContain(word);
  });

  it('lets a department head review overtime without the right to fix time', () => {
    const out = html({ decide: true, overtime: true, fix: false });
    expect(out).toContain('Review the overtime');
    expect(out).not.toContain('Edit time');
  });
});
