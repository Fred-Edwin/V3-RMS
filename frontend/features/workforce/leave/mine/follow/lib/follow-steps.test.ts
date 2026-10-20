import { describe, expect, it } from 'vitest';

import type { ApplicationDetail } from '../../../_shared/types/leave-types';
import { circleStepsOf } from './follow-steps';

const base: ApplicationDetail = {
  application: { id: 'a', employeeId: 'e', typeCode: 'ANNUAL', typeLabel: 'Annual leave', paid: true, start: '2026-10-26', end: '2026-10-28', days: 3, unpaidTailDays: 0, status: 'WAITING', phase: 'WAITING', stage: 'MANAGER', decidingRole: 'Branch Manager', askedAt: '2026-10-09T12:10:00.000Z', movesToHrAt: '2026-10-12T12:10:00.000Z', decidedAt: null, slipNumber: null, version: 1, slipCode: null },
  person: { id: 'e', name: 'Cynthia Wairimu', roleLabel: 'Barista', department: 'Barista', site: 'Nyeri Town', head: null },
  note: null,
  decision: null,
  steps: [],
  figures: { asked: 3, leftNow: 12, ifApproved: 9 },
  can: { cancel: true, askAgain: false, slip: false, approve: false, decline: false, cancelApproved: false },
  whyNot: null,
};

describe('circleStepsOf', () => {
  it('words a waiting request with the day it moves to HR', () => {
    const steps = circleStepsOf({
      ...base,
      steps: [
        { kind: 'ASKED', state: 'DONE', at: base.application.askedAt, byRole: null, line: 'Sent to Branch Manager' },
        { kind: 'DECIDER', state: 'CURRENT', at: base.application.askedAt, byRole: 'Branch Manager', line: 'The Branch Manager decides. With no answer in 3 days it moves to HR' },
        { kind: 'ENDING', state: 'TODO', at: null, byRole: null, line: 'You will be told here and in your Inbox' },
      ],
    });
    expect(steps.map((s) => s.state)).toEqual(['done', 'current', 'todo']);
    expect(steps[0]?.line).toContain('sent to your Branch Manager');
    expect(steps[1]?.title).toBe('Your Branch Manager decides');
    expect(steps[1]?.line).toContain('It moves to HR on');
  });

  it('shows the passed step and HR as the decider after 72 hours', () => {
    const steps = circleStepsOf({
      ...base,
      application: { ...base.application, stage: 'HR', decidingRole: 'HR', movesToHrAt: null },
      steps: [
        { kind: 'ASKED', state: 'DONE', at: base.application.askedAt, byRole: null, line: 'Sent to Branch Manager' },
        { kind: 'MOVED_TO_HR', state: 'PASSED', at: base.application.askedAt, byRole: null, line: 'No answer in 3 days. HR decides now.' },
        { kind: 'DECIDER', state: 'CURRENT', at: base.application.askedAt, byRole: 'HR', line: 'The HR decides' },
      ],
    });
    expect(steps[1]).toMatchObject({ state: 'passed', title: 'No answer in 3 days' });
    expect(steps[2]?.title).toBe('HR decides');
  });

  it('words the endings and cancellations', () => {
    const taken = circleStepsOf({ ...base, application: { ...base.application, status: 'APPROVED', phase: 'TAKEN' }, steps: [{ kind: 'ENDING', state: 'DONE', at: null, byRole: null, line: 'Approved · leave taken' }] });
    expect(taken[0]?.line).toBe('26 to 28 Oct · 3 days taken off your annual leave');
    const own = circleStepsOf({ ...base, steps: [{ kind: 'ENDING', state: 'DONE', at: null, byRole: null, line: 'Cancelled by the person. Nothing was taken off the balance.' }] });
    expect(own[0]).toMatchObject({ state: 'cancelled', title: 'You cancelled', line: 'Nothing was taken off the balance.' });
  });
});
