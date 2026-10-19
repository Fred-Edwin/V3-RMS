import { describe, expect, it } from 'vitest';

import type { OvertimeDetail } from '../../_shared/types/month-types';
import { answerBody, choiceOf, evidenceLines, limitLines, overtimeWords, partStart, saveProblem, stepPart } from './overtime-view';

const detail = (patch: Partial<OvertimeDetail> = {}): OvertimeDetail => ({
  id: 'o1',
  version: 2,
  status: 'PENDING',
  shiftDate: '2026-09-12',
  person: { id: 'p', name: 'Cynthia Wairimu', role: 'Barista', department: 'Barista' },
  organization: { id: 's', name: 'Nyeri Town' },
  plannedStart: '14:00',
  plannedEnd: '22:00',
  workedStart: null,
  workedEnd: null,
  extraMinutes: 35,
  autoMinutes: 0,
  authorisedMinutes: 0,
  part: { min: 5, max: 30, step: 5 },
  evidence: { reasonGiven: 'BUSY_CUSTOMERS', openWork: { at: '22:00', orders: 3 }, colleagues: { team: 'Barista', rostered: 4, present: 3 }, ordersTaken: 6, ticketsCleared: 9, askedInAdvance: false, headNote: null },
  limits: { weekMinutes: 2495, weekCapMinutes: 2880, monthMinutes: 35, branchWeekMinutes: 245, branchBudgetMinutes: null, branchUsedMinutes: 35 },
  decision: null,
  month: { state: 'OPEN' },
  canDecide: true,
  canNote: false,
  ...patch,
});

describe('evidence and limits', () => {
  it('shows counts and notes, "none" when there is no head note, and no money', () => {
    const lines = evidenceLines(detail());
    expect(lines).toContain('Reason given: Busy customers');
    expect(lines).toContain('Open at 22:00: 3 orders');
    expect(lines).toContain('Colleagues in: 3 of 4, the Barista team');
    expect(lines).toContain("Head's note: none");
    expect(lines.join(' ')).not.toMatch(/KES|Ksh|price|takings/i);
  });
  it('names the head who left a note', () => {
    const note = { by: { name: 'Victor Maina', role: 'Barista head' }, text: 'saw it, no objection', at: '2026-09-12T20:00:00Z' };
    expect(evidenceLines(detail({ evidence: { ...detail().evidence, headNote: note } }))).toContain("Head's note: Victor Maina, Barista head: saw it, no objection");
  });
  it('reads the limits as information, with and without a weekly cap', () => {
    expect(limitLines(detail())[0]).toBe('That week: 41 h 35 of the 48 h limit');
    expect(limitLines(detail({ limits: { ...detail().limits, weekCapMinutes: null } }))[0]).toBe('That week: 41 h 35, no weekly limit set');
  });
});

describe('approving part', () => {
  const part = { min: 5, max: 30, step: 5 };
  it('starts at half the extra rounded down to 5 and stays in range', () => {
    expect(partStart(part, 35)).toBe(15);
    expect(partStart({ min: 5, max: 5, step: 5 }, 10)).toBe(5);
  });
  it('steps by 5 and stops at the ends', () => {
    expect(stepPart(part, 15, 1)).toBe(20);
    expect(stepPart(part, 5, -1)).toBe(5);
    expect(stepPart(part, 30, 1)).toBe(30);
  });
  it('opens "Change my answer" on the earlier choice', () => {
    expect(choiceOf('DECLINED')).toBe('DECLINE');
    expect(choiceOf('APPROVED_PART')).toBe('APPROVE_PART');
    expect(choiceOf('APPROVED')).toBe('APPROVE_ALL');
  });
});

describe('saving', () => {
  it('needs a reason of 5 characters for part or none, and the PIN', () => {
    expect(saveProblem('APPROVE_ALL', '', '')).toBe('Enter your PIN');
    expect(saveProblem('APPROVE_ALL', '', '1234')).toBeNull();
    expect(saveProblem('DECLINE', 'no', '1234')).toBe('Add your reason');
    expect(saveProblem('APPROVE_PART', 'busy hour', '1234')).toBeNull();
  });
  it('sends minutes only for a part, the reason when given, and the version shown', () => {
    expect(answerBody('APPROVE_ALL', 15, '', '1234', 2)).toEqual({ decision: 'APPROVE_ALL', pin: '1234', version: 2 });
    expect(answerBody('APPROVE_PART', 15, ' ok then ', '1234', 2)).toEqual({ decision: 'APPROVE_PART', approvedMinutes: 15, reason: 'ok then', pin: '1234', version: 2 });
  });
  it('says the spec sentences for refusals', () => {
    expect(overtimeWords('INVALID_PIN', '')).toBe('That PIN is not right.');
    expect(overtimeWords('CHANGED_UNDERNEATH', '')).toBe('This changed while you were looking. Check it again.');
  });
});
