import { describe, expect, it } from 'vitest';
import type { NairobiDate } from '../_shared/time/nairobi-time';
import { isPastDay, needsReason, paidMinutes, requireReasonWhenNeeded, weekDaysOf, weekStartOf } from './rota-days';

const d = (s: string): NairobiDate => s as NairobiDate;
const today = d('2026-10-19'); // a Monday

describe('rota day rules', () => {
  it('past days are read-only, today is not', () => {
    expect(isPastDay(d('2026-10-18'), today)).toBe(true);
    expect(isPastDay(today, today)).toBe(false);
  });

  it('only today and tomorrow need a reason', () => {
    expect([d('2026-10-19'), d('2026-10-20')].every((x) => needsReason(x, today))).toBe(true);
    expect(needsReason(d('2026-10-21'), today)).toBe(false);
    expect(needsReason(d('2026-10-18'), today)).toBe(false);
  });

  it('asks for a reason (409 REASON_REQUIRED) on those days and trims it', () => {
    expect(() => requireReasonWhenNeeded([d('2026-10-20')], today, undefined)).toThrow(expect.objectContaining({ statusCode: 409, code: 'REASON_REQUIRED' }));
    expect(() => requireReasonWhenNeeded([d('2026-10-20')], today, ' ab ')).toThrow(expect.objectContaining({ code: 'REASON_REQUIRED' }));
    expect(requireReasonWhenNeeded([d('2026-10-20')], today, '  Cover a gap ')).toBe('Cover a gap');
    expect(requireReasonWhenNeeded([d('2026-10-25')], today, undefined)).toBeNull();
  });

  it('paid minutes are the window minus the unpaid break', () => {
    expect(paidMinutes({ startTime: '10:00', endTime: '18:00', unpaidBreakMinutes: 30 })).toBe(450);
    expect(paidMinutes({ startTime: '06:00', endTime: '14:00', unpaidBreakMinutes: 0 })).toBe(480);
  });

  it('a week is seven days from the week start day', () => {
    expect(weekDaysOf(today)).toHaveLength(7);
    expect(weekStartOf(d('2026-10-22'), 1)).toBe('2026-10-19');
    expect(weekStartOf(d('2026-10-22'), 7)).toBe('2026-10-18');
  });
});
