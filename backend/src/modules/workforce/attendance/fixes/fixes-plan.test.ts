import { describe, expect, it } from 'vitest';
import { RULE_DEFAULTS } from '../../rules/rules-defaults';
import { instantAt, parseClockTime, parseNairobiDate } from '../../_shared/time/nairobi-time';
import type { AttendanceRuleSet, EntryRow, EventRow } from '../attendance.types';
import { planFix } from './fixes-plan';

const RULES: AttendanceRuleSet = { attendance: RULE_DEFAULTS.ATTENDANCE, lateness: { ...RULE_DEFAULTS.LATENESS, graceMinutes: 5 } };
const DAY = parseNairobiDate('2026-10-08');
const at = (clock: string) => instantAt(DAY, parseClockTime(clock));
const NOW = instantAt(parseNairobiDate('2026-10-12'), parseClockTime('09:00'));
const ENTRY: EntryRow = { id: 'e1', employeeId: 'p1', date: DAY, templateName: 'Afternoon', colour: 'BLUE', startTime: '14:00', endTime: '22:00', unpaidBreakMinutes: 0 };

let seq = 0;
const ev = (type: EventRow['type'], clock: string, extra: Partial<EventRow> = {}): EventRow => {
  seq += 1;
  return {
    id: `ev${seq}`, employeeId: 'p1', rotaEntryId: 'e1', shiftDate: DAY, type, source: 'PHONE', occurredAt: at(clock), serverAt: at(clock),
    createdAt: new Date(at(clock).getTime() + seq), clientEventId: null, correctsEventId: null, voidsCorrected: false, skewFlagged: false,
    reasonCode: null, reason: null, recordedById: null, ...extra,
  };
};
const plan = (events: EventRow[], request: Parameters<typeof planFix>[0]['request'], entry: EntryRow | null = ENTRY) => planFix({ entry, events, request, shiftDate: DAY, rules: RULES, now: NOW });

describe('fixing time (Chapter 7)', () => {
  const inn = ev('IN', '14:00');
  const out = ev('OUT', '21:20'); // Mark clocked out at 21:20; he worked to 22:00

  it('editing a clock-out makes a linked correction and shows the day before and after', () => {
    const result = plan([inn, out], { action: 'EDIT', eventId: out.id, at: at('22:00') });
    expect(result.draft).toMatchObject({ type: 'CORRECTION', correctsEventId: out.id, voidsCorrected: false, rotaEntryId: 'e1' });
    expect(result.draft.occurredAt.toISOString()).toBe(at('22:00').toISOString());
    expect(result.draft.was).toEqual({ type: 'OUT', at: at('21:20').toISOString() });
    expect(result.before).toMatchObject({ workedMinutes: 440, leftEarlyMinutes: 40 });
    expect(result.after).toMatchObject({ workedMinutes: 480, leftEarlyMinutes: 0 });
  });

  it('adds a missing clock-out as a new event', () => {
    const result = plan([inn], { action: 'ADD', type: 'OUT', at: at('22:05') });
    expect(result.draft).toMatchObject({ type: 'OUT', correctsEventId: null });
    expect(result.before?.clockedOutAt).toBeNull();
    expect(result.after).toMatchObject({ workedMinutes: 480, afterEndMinutes: 5 });
  });

  it('removing an event keeps it visible: the draft is a voiding correction, not a delete', () => {
    const extra = ev('OUT', '15:00');
    const result = plan([inn, extra], { action: 'VOID', eventId: extra.id });
    expect(result.draft).toMatchObject({ type: 'CORRECTION', voidsCorrected: true, correctsEventId: extra.id });
  });

  it('refuses a time on another day or in the future', () => {
    expect(() => plan([inn, out], { action: 'EDIT', eventId: out.id, at: instantAt(parseNairobiDate('2026-10-09'), parseClockTime('01:00')) })).toThrowError(/same day/);
    expect(() => plan([inn, out], { action: 'ADD', type: 'OUT', at: new Date(NOW.getTime() + 60_000) })).toThrowError();
  });

  it('refuses a fix that would leave a clock-out with no clock-in, or two clock-ins', () => {
    expect(() => plan([inn, out], { action: 'EDIT', eventId: out.id, at: at('13:00') })).toThrowError(/clock-out with no clock-in/);
    expect(() => plan([inn, out], { action: 'VOID', eventId: inn.id })).toThrowError(/clock-out with no clock-in/);
    expect(() => plan([inn], { action: 'ADD', type: 'IN', at: at('15:00') })).toThrowError(/two clock-ins/);
  });

  it('cannot edit an event that is not on the day, or that was already removed', () => {
    expect(() => plan([inn, out], { action: 'EDIT', eventId: 'nope', at: at('22:00') })).toThrowError(/not on this day/);
    const removed = ev('CORRECTION', '21:20', { correctsEventId: out.id, voidsCorrected: true });
    expect(() => plan([inn, out, removed], { action: 'EDIT', eventId: out.id, at: at('22:00') })).toThrowError(/not on this day/);
  });

  it('a day with no shift can still be corrected, without hours to compare', () => {
    const loose = ev('IN', '14:00', { rotaEntryId: null });
    const result = plan([loose], { action: 'ADD', type: 'OUT', at: at('18:00') }, null);
    expect(result.before).toBeNull();
    expect(result.draft.rotaEntryId).toBeNull();
  });
});
