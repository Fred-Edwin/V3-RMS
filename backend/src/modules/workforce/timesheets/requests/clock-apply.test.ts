import { describe, expect, it } from 'vitest';
import { instantAt, parseClockTime, parseNairobiDate } from '../../_shared/time/nairobi-time';
import { buildEntryDay } from '../../attendance/days/day-model';
import type { EntryRow, EventRow } from '../../attendance/attendance.types';
import { RULE_DEFAULTS } from '../../rules/rules-defaults';
import type { RequestRow } from '../timesheets.types';
import { planClockRequest } from './clock-apply';
import type { DaySnapshot } from './day-snapshot';

const DAY = parseNairobiDate('2026-10-09');
const at = (clock: string) => instantAt(DAY, parseClockTime(clock));
const RULES = { attendance: RULE_DEFAULTS.ATTENDANCE, lateness: RULE_DEFAULTS.LATENESS };
const entry: EntryRow = { id: 'e1', employeeId: 'p1', date: DAY, templateName: 'Morning', colour: 'BLUE', startTime: '06:00', endTime: '14:00', unpaidBreakMinutes: 0 };
let seq = 0;
const ev = (type: EventRow['type'], clock: string, extra: Partial<EventRow> = {}): EventRow => {
  seq += 1;
  return {
    id: `ev${seq}`, employeeId: 'p1', rotaEntryId: 'e1', shiftDate: DAY, type, source: 'PHONE', occurredAt: at(clock), serverAt: at(clock), createdAt: new Date(at(clock).getTime() + seq),
    clientEventId: null, correctsEventId: null, voidsCorrected: false, skewFlagged: false, reasonCode: null, reason: null, recordedById: null, ...extra,
  };
};
const snapshot = (events: EventRow[]): DaySnapshot => ({ entry: buildEntryDay(entry, events, null, RULES, at('20:00')), events });
const request = (kind: RequestRow['kind'], requested: Record<string, unknown>): RequestRow => ({
  id: 'r1', siteId: 's1', employeeId: 'p1', kind, shiftDate: DAY, state: 'WAITING', note: 'n', recorded: {}, requested, waitingOnRole: 'MANAGER', waitingOnUserId: null,
  escalatedAt: null, decidedById: null, decidedAt: null, decisionReason: null, answerAfter: null, appliedEventId: null, createdAt: at('15:00'),
});

describe('the corrections an approved request needs', () => {
  const day = [ev('IN', '06:00'), ev('OUT', '11:20')];

  it('"a clock time is wrong": edits the clock-out to the time the person says', () => {
    const plan = planClockRequest(request('CLOCK_TIME_WRONG', { type: 'OUT', at: at('14:00').toISOString() }), snapshot(day));
    expect(plan).toEqual([{ action: 'EDIT', eventId: day[1]!.id, at: at('14:00'), rotaEntryId: 'e1' }]);
  });

  it('"clocked out by mistake" with no time takes the clock-out away so the shift is open again', () => {
    expect(planClockRequest(request('CLOCKED_OUT_BY_MISTAKE', {}), snapshot(day))).toEqual([{ action: 'VOID', eventId: day[1]!.id, rotaEntryId: 'e1' }]);
  });

  it('"clocked out by mistake" with the real time edits the clock-out instead', () => {
    expect(planClockRequest(request('CLOCKED_OUT_BY_MISTAKE', { at: at('14:00').toISOString() }), snapshot(day))).toMatchObject([{ action: 'EDIT' }]);
  });

  it('"I worked but it is not recorded" adds both clock times when there are none', () => {
    const plan = planClockRequest(request('WORKED_NOT_RECORDED', { clockIn: at('06:00').toISOString(), clockOut: at('14:00').toISOString() }), snapshot([]));
    expect(plan.map((p) => p.action)).toEqual(['ADD', 'ADD']);
  });

  it('a day that already reads as requested needs nothing, so a retry cannot double the correction', () => {
    expect(planClockRequest(request('CLOCK_TIME_WRONG', { type: 'OUT', at: at('11:20').toISOString() }), snapshot(day))).toEqual([]);
    const voided = [...day, ev('CORRECTION', '11:20', { correctsEventId: day[1]!.id, voidsCorrected: true, source: 'MANAGER' })];
    expect(planClockRequest(request('CLOCKED_OUT_BY_MISTAKE', {}), snapshot(voided))).toEqual([]);
  });

  it('requests that change no clock (rota, overtime, pay) make no correction', () => {
    expect(planClockRequest(request('ROTA_WRONG', {}), snapshot(day))).toEqual([]);
    expect(planClockRequest(request('OVERTIME_MISSING', { minutes: 40 }), snapshot(day))).toEqual([]);
    expect(planClockRequest(request('PAY_OTHER', {}), snapshot(day))).toEqual([]);
  });
});
