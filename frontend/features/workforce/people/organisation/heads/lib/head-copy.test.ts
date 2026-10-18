import { describe, expect, it } from 'vitest';

import type { HeadCandidate, HeadPreview } from '../../_shared/types/org-types';
import { candidateChoices, previewLines, toAssignBody, validateReturnDay } from './head-copy';

const preview = (over: Partial<HeadPreview> = {}): HeadPreview => ({
  department: { id: 'd', name: 'Housekeeping' },
  employee: { id: 'e', name: 'Grace Wairimu' },
  mode: 'REPLACE',
  effectiveOn: '2026-10-18',
  returnsOn: null,
  endsHeadRoleOf: [],
  impacts: [],
  notified: [{ userId: 'u', name: 'Faith Njeri' }],
  ...over,
});

describe('candidateChoices', () => {
  it('writes the position, the month they started, and marks the recommended one', () => {
    const c: HeadCandidate[] = [{ employeeId: 'e1', userId: 'u1', name: 'Grace Wairimu', positionName: 'Housekeeper', startDate: '2025-03-04', isActingHere: false, recommended: true }];
    expect(candidateChoices(c)).toEqual([{ value: 'e1', name: 'Grace Wairimu', line: 'Housekeeper · since Mar 2025 · has a login', marker: 'Recommended' }]);
  });
});

describe('previewLines', () => {
  it('says who approvals move to, that pay does not change, who is told, and that it is logged', () => {
    const lines = previewLines(preview(), null);
    expect(lines[0]).toBe('Overtime, leave and Reports for Housekeeping go to Grace instead of the Branch Manager.');
    expect(lines.join(' ')).toContain('Their own job and pay do not change');
    expect(lines.at(-1)).toBe('Faith Njeri is told. This is written to the audit log with your name and the time.');
    expect(lines.join(' ')).not.toMatch(/\b(she|he|her|his)\b/i);
  });
  it('names the previous head when there is one, and the head who stops', () => {
    const lines = previewLines(preview({ endsHeadRoleOf: [{ employeeId: 'x', name: 'Kelvin Kings', isActing: false }] }), 'Kelvin Kings');
    expect(lines[0]).toContain('instead of Kelvin Kings');
    expect(lines.some((l) => l === 'Kelvin Kings stops being head of Housekeeping.')).toBe(true);
  });
  it('for an acting head, says when it ends by itself, and shows a later slice\'s impact as words', () => {
    const lines = previewLines(preview({ mode: 'ACTING', returnsOn: '2026-10-30', impacts: [{ code: 'APPROVALS_MOVE', count: 3, detail: {} }] }), null);
    expect(lines[0]).toContain('It ends by itself on 30 Oct');
    expect(lines).toContain('3 approvals move');
  });
});

describe('validateReturnDay', () => {
  it('needs a day after today and within a year', () => {
    expect(validateReturnDay(null, '2026-10-18')).toBe('Pick the day the head is back.');
    expect(validateReturnDay('2026-10-18', '2026-10-18')).toBe('It must be a day after today.');
    expect(validateReturnDay('2026-10-19', '2026-10-18')).toBeUndefined();
    expect(validateReturnDay('2028-01-01', '2026-10-18')).toBe('It cannot be more than a year away.');
  });
});

describe('toAssignBody', () => {
  it('sends a return day only for an acting head, as the API requires', () => {
    expect(toAssignBody('e', 'REPLACE', '2026-11-01', false)).toEqual({ employeeId: 'e', mode: 'REPLACE' });
    expect(toAssignBody('e', 'ACTING', '2026-11-01', true)).toEqual({ employeeId: 'e', mode: 'ACTING', returnsOn: '2026-11-01', replaceActing: true });
  });
});
