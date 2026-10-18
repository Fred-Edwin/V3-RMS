import { describe, expect, it } from 'vitest';
import { parseNairobiDate } from '../../_shared/time/nairobi-time';
import { RULE_DEFAULTS } from '../../rules/rules-defaults';
import { windowAfter, windowForDay, windowOfPeriodContaining } from './period-window';

const d = parseNairobiDate;
// Default rule: four-week periods from Mon 21 Sep 2026, so 21 Sep to 18 Oct, then 19 Oct to 15 Nov. Cut-off 2 days early, 18:00.
const rules = RULE_DEFAULTS.WEEK_AND_BREAKS;

describe('timesheet period window', () => {
  it('closes two days before the period ends, at 18:00 Nairobi (15:00 UTC), on the Friday', () => {
    const w = windowOfPeriodContaining(d('2026-10-05'), rules);
    expect(w.end).toBe('2026-10-16');
    expect(w.cutoffAt.toISOString()).toBe('2026-10-16T15:00:00.000Z');
    expect(w.label).toBe('21 Sep to 18 Oct 2026');
  });

  it('starts the day after the previous cut-off, so the last weekend rolls forward', () => {
    const next = windowOfPeriodContaining(d('2026-10-20'), rules);
    expect(next.start).toBe('2026-10-17');
    expect(next.end).toBe('2026-11-13');
  });

  it('counts Sat 17 and Sun 18 Oct in the next timesheet and Fri 16 in this one', () => {
    expect(windowForDay(d('2026-10-16'), rules).end).toBe('2026-10-16');
    expect(windowForDay(d('2026-10-17'), rules).end).toBe('2026-11-13');
    expect(windowForDay(d('2026-10-18'), rules).start).toBe('2026-10-17');
  });

  it('with a cut-off on the last day the window is the plain period', () => {
    const plain = { ...rules, timesheetCutoff: { daysBeforePeriodEnd: 0, time: '23:59' } };
    const w = windowOfPeriodContaining(d('2026-10-05'), plain);
    expect([w.start, w.end]).toEqual(['2026-09-21', '2026-10-18']);
  });

  it('windowAfter moves to the next one', () => {
    const first = windowOfPeriodContaining(d('2026-10-05'), rules);
    expect(windowAfter(first, rules).start).toBe('2026-10-17');
  });

  it('does not depend on the server time zone: the cut-off is the same instant', () => {
    expect(windowOfPeriodContaining(d('2026-10-05'), rules).cutoffAt.getTime()).toBe(Date.UTC(2026, 9, 16, 15, 0, 0));
  });
});
