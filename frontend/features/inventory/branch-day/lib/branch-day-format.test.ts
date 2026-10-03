import { describe, expect, it } from 'vitest';
import { blockerSummary, formatGap, formatNetKes, liveGap, normalizeCount, railDetail, sanitizeCountInput } from './branch-day-format';
import type { CloseBlocker, DepartmentDaySummary } from '../types/branch-day';

const dept = (tag: DepartmentDaySummary['tag'], name: string, status: DepartmentDaySummary['status'], over: Partial<DepartmentDaySummary> = {}): DepartmentDaySummary => ({
  tag,
  name,
  status,
  blockingDispatches: [],
  countedBy: null,
  countedAt: null,
  itemCount: 10,
  countedLines: 0,
  gapsAboveThreshold: 0,
  netAdjustmentValue: '0',
  ...over,
});

describe('count input', () => {
  it('keeps digits and one decimal point', () => {
    expect(sanitizeCountInput('1a2.3.4')).toBe('12.34');
    expect(normalizeCount('')).toBeNull();
    expect(normalizeCount('.')).toBeNull();
    expect(normalizeCount('.5')).toBe('0.5');
    expect(normalizeCount('12.')).toBe('12');
    expect(normalizeCount(undefined)).toBeNull();
  });
});

describe('liveGap', () => {
  const chicken = { expectedQty: '14', unitCost: '145' };
  it('is empty until a figure is typed', () => {
    expect(liveGap(chicken, null, 1000)).toEqual({ gap: null, value: null, reasonRequired: false });
  });
  it('requires a reason only when the KES value reaches the threshold', () => {
    expect(liveGap(chicken, '14', 1000).reasonRequired).toBe(false); // no gap
    expect(liveGap(chicken, '8', 1000)).toMatchObject({ gap: -6, reasonRequired: false }); // −870 < 1,000
    expect(liveGap(chicken, '7', 1000)).toMatchObject({ gap: -7, reasonRequired: true }); // −1,015 ≥ 1,000
    expect(liveGap(chicken, '15', 100)).toMatchObject({ gap: 1, reasonRequired: true }); // surplus counts too
    expect(liveGap(chicken, '13', 0).reasonRequired).toBe(true); // 0 means always
    expect(liveGap(chicken, '14', 0).reasonRequired).toBe(false); // never for a zero gap
  });
});

describe('formatting', () => {
  it('signs gaps and net values', () => {
    expect(formatGap(-5, 'pcs')).toBe('−5 pcs');
    expect(formatGap(2.5, 'kg')).toBe('+2.5 kg');
    expect(formatNetKes('-1940')).toBe('−KES 1,940');
    expect(formatNetKes('0')).toBe('KES 0');
  });
});

describe('rail + blocker copy', () => {
  const clock = () => '08:20';
  const short = (n: string) => n;
  it('describes each department state', () => {
    expect(railDetail(dept('BARISTA', 'Barista', 'BLOCKED', { blockingDispatches: [{ id: '1', sequenceLabel: 'Dispatch 2 · Nyeri Town · 22 Sept' }] }), clock, short)).toBe('dispatch 2 unconfirmed');
    expect(railDetail(dept('KITCHEN', 'Kitchen', 'COUNTING', { countedLines: 5, itemCount: 22 }), clock, short)).toBe('5 of 22 counted');
    expect(railDetail(dept('PASTRY', 'Pastry', 'NOT_STARTED'), clock, short)).toBe('Count not yet begun');
    expect(railDetail(dept('SERVICE', 'Service', 'COUNTED', { itemCount: 9, countedAt: '2026-09-30T06:02:00Z' }), clock, short)).toBe('9 items · 08:20');
  });
  it('groups the close blockers into one short sentence', () => {
    const departments = [dept('KITCHEN', 'Kitchen', 'COUNTING'), dept('PASTRY', 'Pastry', 'NOT_STARTED'), dept('BARISTA', 'Barista', 'BLOCKED'), dept('SERVICE', 'Service', 'NOT_STARTED')];
    const blockers: CloseBlocker[] = [
      { code: 'NOT_COUNTED', departmentTag: 'KITCHEN', message: '' },
      { code: 'NOT_COUNTED', departmentTag: 'PASTRY', message: '' },
      { code: 'BLOCKED', departmentTag: 'BARISTA', message: '' },
      { code: 'NOT_COUNTED', departmentTag: 'SERVICE', message: '' },
    ];
    expect(blockerSummary(blockers, departments)).toBe("Kitchen is still counting · Barista is blocked · Pastry, Service aren't counted yet.");
    expect(blockerSummary([], departments)).toBe('');
  });
});
