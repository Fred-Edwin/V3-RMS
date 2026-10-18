import { describe, expect, it } from 'vitest';
import { RULE_DEFAULTS } from '../../rules/rules-defaults';
import { instantAt, parseClockTime, parseNairobiDate } from '../../_shared/time/nairobi-time';
import type { AttendanceRuleSet, EntryRow } from '../attendance.types';
import { buildEntryDay } from '../days/day-model';
import { checkLocation, chooseEntryToClockIn, chooseEntryToClockOut, earlyLeaveReason, trustedMoment } from './clock-rules';

const DAY = parseNairobiDate('2026-10-12');
const at = (clock: string) => instantAt(DAY, parseClockTime(clock));
const RULES: AttendanceRuleSet = { attendance: RULE_DEFAULTS.ATTENDANCE, lateness: RULE_DEFAULTS.LATENESS };
const entry = (id: string, start: string, end: string): EntryRow => ({ id, employeeId: 'p1', date: DAY, templateName: id, colour: 'BLUE', startTime: start, endTime: end, unpaidBreakMinutes: 0 });
const days = (now: string, ...entries: EntryRow[]) => entries.map((e) => buildEntryDay(e, [], null, RULES, at(now)));
const MIN = 60_000;

describe('trustedMoment (decision A5)', () => {
  it('an online tap counts for the server\'s moment, whatever the phone says', () => {
    const server = at('06:00');
    expect(trustedMoment(server, undefined, undefined, 10)).toEqual({ occurredAt: server, deviceAt: null, skewMinutes: null, skewFlagged: false });
    const m = trustedMoment(server, new Date(server.getTime() + 2000), new Date(server.getTime() + 2000), 10);
    expect(m.occurredAt.getTime()).toBe(server.getTime());
    expect(m.skewFlagged).toBe(false);
  });

  it('an offline tap counts for when it was made, measured on the phone\'s own clock', () => {
    const server = at('06:30'); // the signal came back half an hour after the tap
    const m = trustedMoment(server, at('05:58'), at('06:30'), 10);
    expect(m.occurredAt.toISOString()).toBe(at('05:58').toISOString());
    expect(m.skewFlagged).toBe(false);
  });

  it('a phone that is 3 hours wrong cannot change the time (the delay is what counts) and is flagged', () => {
    const server = at('06:00');
    const wrong = (d: Date) => new Date(d.getTime() - 180 * MIN); // the phone thinks it is 03:00
    const m = trustedMoment(server, wrong(at('05:55')), wrong(at('06:00')), 10);
    expect(m.occurredAt.toISOString()).toBe(at('05:55').toISOString());
    expect(m.skewMinutes).toBe(-180);
    expect(m.skewFlagged).toBe(true);
  });

  it('never trusts a tap from the future or one older than twelve hours', () => {
    expect(() => trustedMoment(at('06:00'), at('06:05'), at('06:00'), 10)).toThrowError(/too old/);
    expect(() => trustedMoment(at('20:00'), at('06:00'), at('20:00'), 10)).toThrowError(/too old/);
  });
});

describe('which shift a clock-in is for', () => {
  it('picks the open shift, and says why when there is none', () => {
    expect(chooseEntryToClockIn(days('05:40', entry('a', '06:00', '14:00')), undefined).entryId).toBe('a');
    expect(chooseEntryToClockIn(days('06:30', entry('a', '06:00', '14:00')), undefined).state).toBe('NOT_IN'); // late, but still allowed
    expect(() => chooseEntryToClockIn(days('05:00', entry('a', '06:00', '14:00')), undefined)).toThrowError(/not opened/);
    expect(() => chooseEntryToClockIn(days('15:00', entry('a', '06:00', '14:00')), undefined)).toThrowError(/ended/);
    expect(() => chooseEntryToClockIn([], undefined)).toThrowError(/no shift/);
  });

  it('on a double shift the second is chosen once its own window opens', () => {
    const both = (now: string) => days(now, entry('am', '06:00', '10:00'), entry('pm', '14:00', '20:00'));
    expect(chooseEntryToClockIn(both('05:45'), undefined).entryId).toBe('am');
    expect(chooseEntryToClockIn(both('13:45'), 'pm').entryId).toBe('pm');
  });

  it('a clock-out needs an open clock-in', () => {
    expect(() => chooseEntryToClockOut(days('10:00', entry('a', '06:00', '14:00')), undefined)).toThrowError(/not clocked in/);
  });
});

describe('leaving early and the location check', () => {
  const shift = days('11:20', entry('a', '06:00', '14:00'))[0]!;
  it('before the scheduled end a reason chip is required; after it none is', () => {
    expect(() => earlyLeaveReason(shift, at('11:20'), undefined)).toThrowError(/why/);
    expect(() => earlyLeaveReason(shift, at('11:20'), 'BORED')).toThrowError(/why/);
    expect(earlyLeaveReason(shift, at('11:20'), 'UNWELL')).toBe('UNWELL');
    expect(earlyLeaveReason(shift, at('14:00'), undefined)).toBeNull();
  });

  const branch = { latitude: -0.4167, longitude: 36.95 };
  it('inside the radius passes with the distance; outside, or with no position, is refused in plain words', () => {
    expect(checkLocation(branch, { latitude: -0.4167, longitude: 36.9501 }, 50).distanceMetres).toBeLessThan(50);
    expect(() => checkLocation(branch, { latitude: -0.42, longitude: 36.95 }, 50)).toThrowError(/must be at the branch/);
    expect(() => checkLocation(branch, undefined, 50)).toThrowError(/where you are/);
  });
});
