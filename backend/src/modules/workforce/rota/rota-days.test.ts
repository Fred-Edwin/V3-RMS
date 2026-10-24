import { describe, expect, it } from 'vitest';
import type { NairobiDate } from '../_shared/time/nairobi-time';
import { isPastDay, needsReason, paidMinutes, reasonOfChange, weekDaysOf, weekStartOf } from './rota-days';

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

  it('the reason is optional on every day: trimmed when given, null when not', () => {
    expect(reasonOfChange(undefined)).toBeNull();
    expect(reasonOfChange('   ')).toBeNull();
    expect(reasonOfChange('  Cover a gap ')).toBe('Cover a gap');
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
