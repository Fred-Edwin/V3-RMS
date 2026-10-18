import { describe, expect, it } from 'vitest';
import { RULE_DEFAULTS } from '../../rules/rules-defaults';
import { instantAt, parseClockTime, parseNairobiDate } from '../../_shared/time/nairobi-time';
import type { AnswerRow, AttendanceRuleSet, EntryRow, EventRow } from '../attendance.types';
import { buildEntryDay, lastLiveEvent } from './day-model';

const RULES: AttendanceRuleSet = { attendance: RULE_DEFAULTS.ATTENDANCE, lateness: { ...RULE_DEFAULTS.LATENESS, graceMinutes: 5 } };
const DAY = parseNairobiDate('2026-10-12');
const at = (clock: string) => instantAt(DAY, parseClockTime(clock));
const ENTRY: EntryRow = { id: 'e1', employeeId: 'p1', date: DAY, templateName: 'Morning', colour: 'BLUE', startTime: '06:00', endTime: '14:00', unpaidBreakMinutes: 30 };

let seq = 0;
const ev = (type: EventRow['type'], clock: string, extra: Partial<EventRow> = {}): EventRow => {
  seq += 1;
  const when = at(clock);
  return {
    id: `ev${seq}`, employeeId: 'p1', rotaEntryId: 'e1', shiftDate: DAY, type, source: 'PHONE', occurredAt: when, serverAt: when,
    createdAt: new Date(when.getTime() + seq), clientEventId: null, correctsEventId: null, voidsCorrected: false, skewFlagged: false,
    reasonCode: null, reason: null, recordedById: null, ...extra,
  };
};
const day = (events: EventRow[], now: string, answer: AnswerRow | null = null) => buildEntryDay(ENTRY, events, answer, RULES, at(now));
const stay: AnswerRow = { rotaEntryId: 'e1', answer: 'STAY_ON', reasonCode: 'BUSY', estimateMinutes: 30, answeredAt: at('14:03') };

describe('a rostered shift through its day (06:00 to 14:00, clock-in opens 30 minutes before)', () => {
  it('walks from upcoming to missed when nobody clocks in', () => {
    expect(day([], '05:00').state).toBe('UPCOMING');
    expect(day([], '05:40').state).toBe('CLOCK_IN_OPEN');
    expect(day([], '06:10').state).toBe('NOT_IN');
    expect(day([], '14:01').state).toBe('MISSED');
    expect(day([], '05:40').opensAt.toISOString()).toBe(at('05:30').toISOString());
  });

  it('on time, within grace, and late after grace (Nairobi time on any server zone)', () => {
    expect(at('06:05').toISOString()).toBe('2026-10-12T03:05:00.000Z'); // 06:05 Nairobi is 03:05 UTC
    expect(day([ev('IN', '05:58')], '10:00').lateness).toMatchObject({ minutesLate: 0, countsAsLate: false });
    expect(day([ev('IN', '06:05')], '10:00').lateness).toMatchObject({ minutesLate: 5, countsAsLate: false }); // 5 is inside grace 5
    expect(day([ev('IN', '06:20')], '10:00').lateness).toMatchObject({ minutesLate: 20, countsAsLate: true, minutesAfterGrace: 15 });
    expect(day([ev('IN', '06:20')], '10:00').state).toBe('ON_SHIFT');
  });

  it('asks the shift-end question once the end passes, and notes a stay-on', () => {
    expect(day([ev('IN', '05:58')], '13:59').state).toBe('ON_SHIFT');
    expect(day([ev('IN', '05:58')], '14:05').state).toBe('PROMPT_DUE');
    expect(day([ev('IN', '05:58')], '14:05', stay).state).toBe('STAYING_ON');
    expect(day([ev('IN', '05:58')], '14:05').autoCloseAt.toISOString()).toBe(at('14:15').toISOString());
  });

  it('closes on a clock-out or on the phone closing it, and says which', () => {
    const done = day([ev('IN', '05:58'), ev('OUT', '14:02')], '15:00');
    expect(done).toMatchObject({ state: 'DONE', closedBy: 'OUT' });
    expect(done.hours.afterEndMinutes).toBe(2);
    const auto = day([ev('IN', '05:58'), ev('AUTO_OUT', '14:00', { source: 'SYSTEM', reasonCode: 'NO_ANSWER' })], '15:00');
    expect(auto).toMatchObject({ state: 'AUTO_CLOSED', closedBy: 'AUTO_OUT' });
    expect(auto.flags.autoClosed).toBe(true);
    expect(auto.flags.fixed).toBe(false);
  });

  it('leaving early is counted, with the break taken off worked time', () => {
    const early = day([ev('IN', '06:00'), ev('OUT', '11:20')], '12:00');
    expect(early.hours.leftEarlyMinutes).toBe(160);
    expect(early.hours.workedMinutes).toBe(5 * 60 + 20 - 30);
  });
});

describe('undo and corrections', () => {
  it('offers undo for the person\'s own newest tap for two minutes, counted from when the server got it', () => {
    const tap = ev('IN', '05:58');
    expect(day([tap], '05:59').undo).toMatchObject({ kind: 'IN', eventId: tap.id });
    expect(day([tap], '05:59').undo?.until.toISOString()).toBe(at('06:00').toISOString());
    expect(day([tap], '06:01').undo).toBeNull();
  });

  it('does not offer undo for a tap a manager made, or for an older tap', () => {
    expect(day([ev('IN', '06:10', { source: 'MANAGER', recordedById: 'm1' })], '06:11').undo).toBeNull();
    expect(day([ev('IN', '05:58'), ev('OUT', '14:00')], '14:01').undo?.kind).toBe('OUT');
  });

  it('an undone clock-in leaves nothing recorded and the shift waits again', () => {
    const tap = ev('IN', '05:58');
    const undone = ev('CORRECTION', '05:58', { correctsEventId: tap.id, voidsCorrected: true });
    const result = day([tap, undone], '06:10');
    expect(result.state).toBe('NOT_IN');
    expect(result.clockedInAt).toBeNull();
    expect(result.flags.fixed).toBe(false); // the person's own undo is not a manager fix
  });

  it('an undone clock-out puts the person back on shift with no gap', () => {
    const inn = ev('IN', '05:58');
    const out = ev('OUT', '11:20');
    const result = day([inn, out, ev('CORRECTION', '11:20', { correctsEventId: out.id, voidsCorrected: true })], '11:21');
    expect(result.state).toBe('ON_SHIFT');
    expect(result.clockedOutAt).toBeNull();
  });

  it('a manager\'s edit replaces the time and marks the day as fixed; the original stays in the list', () => {
    const inn = ev('IN', '05:58');
    const out = ev('OUT', '13:20');
    const edit = ev('CORRECTION', '14:00', { correctsEventId: out.id, source: 'MANAGER', recordedById: 'm1', reasonCode: 'FIX' });
    const result = day([inn, out, edit], '15:00');
    expect(result.clockedOutAt?.toISOString()).toBe(at('14:00').toISOString());
    expect(result.flags.fixed).toBe(true);
    expect(lastLiveEvent([inn, out, edit])?.id).toBe(inn.id); // the edited clock-out is no longer "live"
  });

  it('flags a phone whose clock was far off', () => {
    expect(day([ev('IN', '05:58', { skewFlagged: true })], '06:30').flags.skew).toBe(true);
  });
});
