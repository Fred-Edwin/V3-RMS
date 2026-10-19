import { describe, expect, it } from 'vitest';
import { instantAt, parseClockTime, parseNairobiDate } from '../../_shared/time/nairobi-time';
import type { DayData, EntryRow, EventRow } from '../../attendance/attendance.types';
import { RULE_DEFAULTS } from '../../rules/rules-defaults';
import { clockTimesOf } from './me-clock-times';

const FRI = parseNairobiDate('2026-10-09');
const SAT = parseNairobiDate('2026-10-10');
const at = (day: typeof FRI, clock: string) => instantAt(day, parseClockTime(clock));
const RULES = { attendance: RULE_DEFAULTS.ATTENDANCE, lateness: RULE_DEFAULTS.LATENESS };
const entry: EntryRow = { id: 'e1', employeeId: 'p1', date: FRI, templateName: 'Morning', colour: 'BLUE', startTime: '06:00', endTime: '14:00', unpaidBreakMinutes: 0 };
let seq = 0;
const ev = (type: EventRow['type'], clock: string, extra: Partial<EventRow> = {}): EventRow => {
  seq += 1;
  return {
    id: `ev${seq}`, employeeId: 'p1', rotaEntryId: 'e1', shiftDate: FRI, type, source: 'PHONE', occurredAt: at(FRI, clock), serverAt: at(FRI, clock), createdAt: new Date(at(FRI, clock).getTime() + seq),
    clientEventId: null, correctsEventId: null, voidsCorrected: false, skewFlagged: false, reasonCode: null, reason: null, recordedById: null, ...extra,
  };
};
const NOW = at(SAT, '12:00');
const data = (events: EventRow[]): DayData => ({ entries: [entry], events, answers: [] });

describe('the clock times My time shows for a day', () => {
  it('reads the first shift’s clock-in and clock-out', () => {
    const out = clockTimesOf('p1', [FRI], data([ev('IN', '05:58'), ev('OUT', '14:01')]), RULES, NOW);
    expect(out.get(FRI)).toEqual({ clockIn: at(FRI, '05:58').toISOString(), clockOut: at(FRI, '14:01').toISOString() });
  });

  it('shows the corrected time, not the one that was replaced', () => {
    const early = ev('OUT', '11:20');
    const fixed = ev('CORRECTION', '14:00', { correctsEventId: early.id, source: 'MANAGER' });
    const out = clockTimesOf('p1', [FRI], data([ev('IN', '06:00'), early, fixed]), RULES, NOW);
    expect(out.get(FRI)?.clockOut).toBe(at(FRI, '14:00').toISOString());
  });

  it('shows no clock-out when it was taken away, so the shift reads as open', () => {
    const out1 = ev('OUT', '11:20');
    const voided = ev('CORRECTION', '11:20', { correctsEventId: out1.id, voidsCorrected: true, source: 'MANAGER' });
    const out = clockTimesOf('p1', [FRI], data([ev('IN', '06:00'), out1, voided]), RULES, NOW);
    expect(out.get(FRI)?.clockOut).toBeNull();
  });

  it('has nothing for a day with no rostered shift', () => {
    expect(clockTimesOf('p1', [SAT], data([ev('IN', '06:00')]), RULES, NOW).has(SAT)).toBe(false);
  });
});
