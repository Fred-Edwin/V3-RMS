import { describe, expect, it } from 'vitest';

import type { NeedLookItem, PersonDayRow } from '../../_shared/types/month-types';
import { rangeFromUrl, defaultMonth } from '../../months/lib/month-pick';
import { rowAction, rowFill } from './days-view';
import { decisionLine, needLookAction, needLookTitle } from './person-view';

const item = (kind: NeedLookItem['kind'], patch: Partial<NeedLookItem> = {}): NeedLookItem => ({ date: '2026-09-12', kind, overtimeItemId: kind === 'OVERTIME' ? 'o1' : null, requestId: kind === 'REQUEST' ? 'r1' : null, minutes: 35, timeFixAllowed: true, ...patch });
const all = { overtime: true, fix: true, request: true, day: true };

describe('the button of a day that needs a look', () => {
  it('is one button per kind', () => {
    expect(needLookAction(item('OVERTIME'), all)?.label).toBe('Decide the overtime');
    expect(needLookAction(item('CLOCK_OUT_FIX'), all)?.label).toBe('Fix the clock-out');
    expect(needLookAction(item('REQUEST'), all)?.label).toBe('Answer the request');
    expect(needLookAction(item('DAY_LOOK'), all)?.label).toBe('Look at this day');
  });
  it('is absent for a viewer who may not use it', () => {
    expect(needLookAction(item('OVERTIME'), { ...all, overtime: false })).toBeNull();
    expect(needLookAction(item('CLOCK_OUT_FIX'), { ...all, fix: false })).toBeNull();
    expect(needLookAction(item('CLOCK_OUT_FIX', { timeFixAllowed: false }), all)).toBeNull();
  });
  it('titles the card with the day and the kind', () => {
    expect(needLookTitle(item('OVERTIME'), 'Sat 12 Sep')).toBe('Sat 12 Sep · overtime to decide');
  });
  it('writes quiet decision rows for an approved month', () => {
    expect(decisionLine('APPROVED', 35, 35)).toBe('Overtime 35 min approved');
    expect(decisionLine('APPROVED_PART', 20, 35)).toBe('Overtime 20 min of 35 min approved in part');
    expect(decisionLine('DECLINED', 0, 35)).toBe('Overtime 35 min not approved');
  });
});

describe('the day rows of the full month', () => {
  const day = (patch: Partial<PersonDayRow>): PersonDayRow => ({ date: '2026-09-12', weekday: 6, plannedStart: null, plannedEnd: null, clockIn: null, clockOut: null, extraShifts: [], workedMinutes: 0, overtimeMinutes: 0, lateMinutes: 0, resultKey: 'ON_ROTA', needsLook: false, status: 'MATCHED', overtimeItemId: null, requestId: null, editedById: null, beforeEmployment: false, ...patch });
  it('fills late and overtime rows amber and rest rows grey', () => {
    expect(rowFill(day({ resultKey: 'LATE' }))).toContain('warning-bg');
    expect(rowFill(day({ resultKey: 'REST' }))).toContain('neutral-50');
    expect(rowFill(day({ resultKey: 'ON_ROTA' }))).toBe('');
  });
  it('gives only the buttons the viewer may use', () => {
    const waiting = day({ resultKey: 'OVERTIME_TO_DECIDE', overtimeItemId: 'o1' });
    expect(rowAction(waiting, { decide: true, fix: false, request: false })?.label).toBe('Decide the overtime');
    expect(rowAction(waiting, { decide: false, fix: true, request: true })).toBeNull();
    expect(rowAction(day({ resultKey: 'CLOCK_OUT_MISSING' }), { decide: true, fix: true, request: false })?.label).toBe('Fix the clock-out');
  });
});

describe('which month opens', () => {
  const row = (monthKey: string, state: 'OPEN' | 'TO_APPROVE' | 'APPROVED') => ({ monthKey, label: monthKey, state, workedMinutes: 0, headcount: 0, soFarThroughDate: null, plannedSoFarMinutes: null, needsYouCount: 0, approvedAt: null, approvedBy: null, documentNumber: null });
  it('opens on the oldest month waiting for approval, else the open month', () => {
    expect(defaultMonth([row('2026-10', 'OPEN'), row('2026-09', 'TO_APPROVE'), row('2026-08', 'TO_APPROVE'), row('2026-07', 'APPROVED')])).toBe('2026-08');
    expect(defaultMonth([row('2026-10', 'OPEN'), row('2026-09', 'APPROVED')])).toBe('2026-10');
    expect(defaultMonth([])).toBeNull();
  });
  it('ignores a half or back-to-front range in the address', () => {
    expect(rangeFromUrl('2026-09-14', '2026-09-20')).toEqual({ from: '2026-09-14', to: '2026-09-20' });
    expect(rangeFromUrl('2026-09-20', '2026-09-14')).toBeNull();
    expect(rangeFromUrl('2026-09-14', null)).toBeNull();
  });
});
