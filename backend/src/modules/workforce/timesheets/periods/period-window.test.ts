import { describe, expect, it } from 'vitest';
import { nairobiToday, parseNairobiDate } from '../../_shared/time/nairobi-time';
import { RULE_DEFAULTS } from '../../rules/rules-defaults';
import { WeekAndBreaksRulesSchema } from '../../rules/rules-schemas';
import { windowAfter, windowForDay } from './period-window';

const d = parseNairobiDate;
const rules = RULE_DEFAULTS.WEEK_AND_BREAKS;

describe('timesheet period window (calendar month)', () => {
  it('is the whole month, 1st to last day', () => {
    const w = windowForDay(d('2026-10-17'), rules);
    expect([w.start, w.end, w.label]).toEqual(['2026-10-01', '2026-10-31', 'October 2026']);
  });

  it('can first be approved at 00:00 Nairobi on 1 Nov (21:00 UTC on 31 Oct)', () => {
    expect(windowForDay(d('2026-10-05'), rules).cutoffAt.toISOString()).toBe('2026-10-31T21:00:00.000Z');
  });

  it('does not read the retired cut-off rule at all', () => {
    const odd = { ...rules, timesheetCutoff: { daysAfterPeriodEnd: 9, time: '23:59' } };
    expect(windowForDay(d('2026-10-05'), odd).cutoffAt.toISOString()).toBe('2026-10-31T21:00:00.000Z');
  });

  it('moves no day between periods: the 1st and the last day stay in their own month', () => {
    expect(windowForDay(d('2026-10-31'), rules).start).toBe('2026-10-01');
    expect(windowForDay(d('2026-11-01'), rules).start).toBe('2026-11-01');
    expect(windowForDay(d('2026-11-02'), rules).end).toBe('2026-11-30');
  });

  it('handles February and a year change', () => {
    expect(windowForDay(d('2028-02-10'), rules).end).toBe('2028-02-29');
    const dec = windowForDay(d('2026-12-25'), rules);
    expect(dec.cutoffAt.toISOString()).toBe('2026-12-31T21:00:00.000Z');
    expect(windowAfter(dec, rules).start).toBe('2027-01-01');
  });

  it('windowAfter moves to the next month', () => {
    expect(windowAfter(windowForDay(d('2026-10-05'), rules), rules).label).toBe('November 2026');
  });

  it('puts 00:30 Nairobi on 1 Nov in November although it is still 31 Oct in UTC', () => {
    const instant = new Date('2026-10-31T21:30:00.000Z'); // 00:30 on 1 Nov in Nairobi (UTC+3)
    expect(instant.toISOString().slice(0, 10)).toBe('2026-10-31');
    expect(nairobiToday(instant)).toBe('2026-11-01');
    expect(windowForDay(nairobiToday(instant), rules).label).toBe('November 2026');
  });

  it('does not depend on the server time zone: the instant is the same', () => {
    expect(windowForDay(d('2026-10-05'), rules).cutoffAt.getTime()).toBe(Date.UTC(2026, 9, 31, 21, 0, 0));
  });

  it('keeps a stored four-week rule valid and cuts it into whole windows', () => {
    const old = WeekAndBreaksRulesSchema.parse({ weekStartsOn: 1, timesheetPeriod: { kind: 'FIXED_WEEKS', weeks: 4, anchorDate: '2026-09-21' }, timesheetCutoff: { daysBeforePeriodEnd: 2, time: '18:00' } });
    const w = windowForDay(d('2026-10-05'), old);
    expect([w.start, w.end]).toEqual(['2026-09-21', '2026-10-18']);
    expect(w.cutoffAt.toISOString()).toBe('2026-10-18T21:00:00.000Z');
  });
});
