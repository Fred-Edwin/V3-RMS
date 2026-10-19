import { describe, expect, it } from 'vitest';
import { instantAt, parseClockTime, parseNairobiDate } from '../../_shared/time/nairobi-time';
import { buildEntryDay } from '../../attendance/days/day-model';
import type { AttendanceRuleSet, EntryRow, EventRow } from '../../attendance/attendance.types';
import { RULE_DEFAULTS } from '../../rules/rules-defaults';
import { assessDay, type AssessRules } from './day-assess';
import { resolveDay, weekStatus } from './day-merge';

const RULES: AttendanceRuleSet = { attendance: RULE_DEFAULTS.ATTENDANCE, lateness: { ...RULE_DEFAULTS.LATENESS, graceMinutes: 5 } };
const ASSESS: AssessRules = { graceMinutes: 5, makeUpSameDay: false, serviceTailMinutes: 15 };
const DAY = parseNairobiDate('2026-10-12');
const TODAY = parseNairobiDate('2026-10-14');
const at = (clock: string) => instantAt(DAY, parseClockTime(clock));

const entry: EntryRow = { id: 'e1', employeeId: 'p1', date: DAY, templateName: 'Morning', colour: 'BLUE', startTime: '06:00', endTime: '14:00', unpaidBreakMinutes: 0 };
let seq = 0;
const ev = (type: EventRow['type'], clock: string, extra: Partial<EventRow> = {}): EventRow => {
  seq += 1;
  return {
    id: `ev${seq}`, employeeId: 'p1', rotaEntryId: 'e1', shiftDate: DAY, type, source: 'PHONE', occurredAt: at(clock), serverAt: at(clock),
    createdAt: new Date(at(clock).getTime() + seq), clientEventId: null, correctsEventId: null, voidsCorrected: false, skewFlagged: false,
    reasonCode: null, reason: null, recordedById: null, ...extra,
  };
};
const day = (events: EventRow[], now = at('23:00')) => buildEntryDay(entry, events, null, RULES, now);
const assess = (events: EventRow[], extra: { openWork?: boolean; today?: typeof TODAY; now?: Date } = {}) =>
  assessDay({
    date: DAY,
    today: extra.today ?? TODAY,
    entries: [day(events, extra.now)],
    unscheduledCount: 0,
    openWork: new Map([['e1', extra.openWork ?? false]]),
    rules: ASSESS,
  });

describe('assessDay: matching the rota', () => {
  it('a day on time and clocked out at the end approves itself', () => {
    const result = assess([ev('IN', '05:58'), ev('OUT', '14:02')]);
    expect(result?.status).toBe('AUTO_APPROVED');
    expect(result?.reasons).toEqual([]);
    expect(result?.workedMinutes).toBe(480);
  });

  it('is within the grace on both ends (5 minutes late, 5 minutes over)', () => {
    expect(assess([ev('IN', '06:05'), ev('OUT', '14:05')])?.status).toBe('AUTO_APPROVED');
  });

  it('a late day needs a look and keeps the minutes', () => {
    const result = assess([ev('IN', '06:20'), ev('OUT', '14:00')]);
    expect(result).toMatchObject({ status: 'NEEDS_LOOK', reasons: ['LATE'], minutesLate: 20, minutesAfterGrace: 15 });
  });

  it('leaving early past the grace needs a look', () => {
    expect(assess([ev('IN', '06:00'), ev('OUT', '13:30')])?.reasons).toEqual(['LEFT_EARLY']);
  });

  it('an absence needs a look once the shift is over, and shows nothing before it starts', () => {
    expect(assess([])?.reasons).toEqual(['ABSENT']);
    const before = buildEntryDay(entry, [], null, RULES, at('04:00'));
    expect(assessDay({ date: DAY, today: DAY, entries: [before], unscheduledCount: 0, openWork: new Map(), rules: ASSESS })).toBeNull();
  });

  it('a manager fix, a shift the phone closed and a wrong phone clock all stay out of the automatic path', () => {
    expect(assess([ev('IN', '06:00'), ev('OUT', '14:00', { source: 'MANAGER' })])?.reasons).toContain('EDITED');
    expect(assess([ev('IN', '06:00'), ev('AUTO_OUT', '14:15', { source: 'SYSTEM' })])?.reasons).toContain('AUTO_CLOSED');
    expect(assess([ev('IN', '06:00', { skewFlagged: true }), ev('OUT', '14:00')])?.reasons).toContain('PHONE_CLOCK');
  });

  it('a day still in progress today is only MATCHED', () => {
    const now = at('10:00');
    const result = assessDay({ date: DAY, today: DAY, entries: [day([ev('IN', '06:00')], now)], unscheduledCount: 0, openWork: new Map(), rules: ASSESS });
    expect(result?.status).toBe('MATCHED');
  });

  it('a shift still open on a past day is an exception', () => {
    expect(assess([ev('IN', '06:00')])?.reasons).toContain('OPEN_SHIFT');
  });

  it('work with no shift on the rota needs a look', () => {
    const result = assessDay({ date: DAY, today: TODAY, entries: [], unscheduledCount: 2, openWork: new Map(), rules: ASSESS });
    expect(result?.reasons).toEqual(['UNSCHEDULED']);
  });
});

describe('assessDay: overtime', () => {
  const longDay = [ev('IN', '06:00'), ev('OUT', '14:40')];

  it('time after the end beyond the service tail needs a decision', () => {
    const result = assess(longDay, { openWork: true });
    expect(result?.overtime).toMatchObject({ rawMinutes: 40, serviceTailMinutes: 15, autoMinutes: 15, needsMinutes: 25 });
    expect(result?.reasons).toEqual(['OVERTIME']);
  });

  it('no open work means no automatic recognition', () => {
    expect(assess(longDay, { openWork: false })?.overtime).toMatchObject({ autoMinutes: 0, needsMinutes: 40 });
  });

  it('a tail inside the service-tail minutes with open work is recognised by itself and the day still matches', () => {
    const result = assess([ev('IN', '06:00'), ev('OUT', '14:12')], { openWork: true });
    expect(result?.overtime).toMatchObject({ needsMinutes: 0, autoMinutes: 12 });
    expect(result?.status).toBe('AUTO_APPROVED');
  });
});

describe('mergeDay and weekStatus', () => {
  const clean = assess([ev('IN', '06:00'), ev('OUT', '14:00')])!;
  const late = assess([ev('IN', '06:30'), ev('OUT', '14:00')])!;

  it('a person decision survives while the evidence is the same', () => {
    expect(resolveDay({ status: 'APPROVED', evidenceHash: late.evidenceHash }, late, null)).toMatchObject({ status: 'APPROVED', decision: 'KEEP' });
  });

  it('an approved day whose evidence changed goes back for a look, with the reason', () => {
    const merged = resolveDay({ status: 'APPROVED', evidenceHash: 'old' }, late, null);
    expect(merged.status).toBe('NEEDS_LOOK');
    expect(merged.reasons).toContain('CHANGED_AFTER_APPROVAL');
    expect(merged.decision).toBe('CLEAR');
  });

  it('a decided day that now matches the rota becomes automatic', () => {
    expect(resolveDay({ status: 'HELD', evidenceHash: 'old' }, clean, null)).toMatchObject({ status: 'AUTO_APPROVED', decision: 'CLEAR' });
  });

  it('the system verdict is recomputed every time', () => {
    expect(resolveDay({ status: 'AUTO_APPROVED', evidenceHash: clean.evidenceHash }, late, null).status).toBe('NEEDS_LOOK');
  });

  it('answering the overtime settles a day whose only exception it was', () => {
    const overtimeDay = assess([ev('IN', '06:00'), ev('OUT', '14:40')])!;
    const answer = { by: 'mgr', at: new Date(), reason: null };
    expect(resolveDay(null, overtimeDay, null).status).toBe('NEEDS_LOOK');
    expect(resolveDay(null, overtimeDay, answer)).toMatchObject({ status: 'APPROVED', reasons: [], decision: answer });
  });

  it('answering the overtime does not hide other exceptions', () => {
    const both = assess([ev('IN', '06:30'), ev('OUT', '15:00')])!;
    const merged = resolveDay(null, both, { by: 'mgr', at: new Date(), reason: null });
    expect(merged.status).toBe('NEEDS_LOOK');
    expect(merged.reasons).toEqual(['LATE']);
  });

  it('a week follows its days', () => {
    expect(weekStatus(['AUTO_APPROVED', 'AUTO_APPROVED'])).toBe('AUTO_APPROVED');
    expect(weekStatus(['AUTO_APPROVED', 'APPROVED'])).toBe('APPROVED');
    expect(weekStatus(['AUTO_APPROVED', 'NEEDS_LOOK', 'HELD'])).toBe('NEEDS_LOOK');
    expect(weekStatus(['AUTO_APPROVED', 'HELD'])).toBe('HELD');
    expect(weekStatus(['AUTO_APPROVED', 'MATCHED'])).toBe('MATCHED');
  });
});
