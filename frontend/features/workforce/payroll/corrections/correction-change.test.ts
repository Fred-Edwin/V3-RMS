import { describe, expect, it } from 'vitest';

import type { CorrectionInputs } from '../_shared/types/action-types';
import { buildChange, saveBlock, startDraft } from './correction-change';

const current: CorrectionInputs['current'] = {
  lateDaysCounted: 4,
  absentDays: 1,
  overtimeAuthorisedMinutes: { ordinaryDay: 120, restDay: 0, publicHoliday: 0 },
  basicAmount: '28000.00',
  extraLines: [{ id: 'adj-1', kind: 'ALLOWANCE', label: 'Airtime', amount: '500.00', taxable: true }],
};

describe('what a correction sends', () => {
  it('sends nothing until something differs', () => {
    expect(buildChange('LATE_DAYS', startDraft(current), current)).toBeNull();
  });
  it('sends late days when changed, and refuses a non-number', () => {
    expect(buildChange('LATE_DAYS', { ...startDraft(current), lateDays: '3' }, current)).toEqual({ kind: 'LATE_DAYS', changes: { lateDaysCounted: 3 } });
    expect(buildChange('LATE_DAYS', { ...startDraft(current), lateDays: 'x' }, current)).toBeNull();
    expect(buildChange('LATE_DAYS', { ...startDraft(current), lateDays: '40' }, current)).toBeNull();
  });
  it('allows half days of absence only', () => {
    expect(buildChange('UNPAID_ABSENCE', { ...startDraft(current), absentDays: '1.5' }, current)).toEqual({ kind: 'UNPAID_ABSENCE', changes: { absentDays: 1.5 } });
    expect(buildChange('UNPAID_ABSENCE', { ...startDraft(current), absentDays: '1.3' }, current)).toBeNull();
  });
  it('sends all three overtime day types together', () => {
    expect(buildChange('OVERTIME', { ...startDraft(current), ordinary: '60' }, current)).toEqual({ kind: 'OVERTIME', changes: { ordinaryDay: 60, restDay: 0, publicHoliday: 0 } });
  });
  it('sends a basic only for a monthly-salary payslip, as text', () => {
    expect(buildChange('BASIC', { ...startDraft(current), basic: '29000' }, current)).toEqual({ kind: 'BASIC', changes: { amount: '29000' } });
    expect(buildChange('BASIC', { ...startDraft(current), basic: '29000' }, { ...current, basicAmount: null })).toBeNull();
  });
  it('removes a line or adds one, and needs a name and an amount for an add', () => {
    expect(buildChange('EXTRA_LINE', { ...startDraft(current), removeIds: ['adj-1'] }, current)).toEqual({ kind: 'EXTRA_LINE', changes: { add: [], removeIds: ['adj-1'] } });
    expect(buildChange('EXTRA_LINE', { ...startDraft(current), addLabel: 'Bonus' }, current)).toBeNull();
    expect(buildChange('EXTRA_LINE', { ...startDraft(current), addLabel: 'Bonus', addAmount: '1000' }, current)?.changes).toMatchObject({ add: [{ label: 'Bonus', amount: '1000', taxable: true }] });
  });
  it('says why Save is off, in order', () => {
    const change = buildChange('LATE_DAYS', { ...startDraft(current), lateDays: '3' }, current);
    expect(saveBlock(null, 'x', null)).toBe('Change something first.');
    expect(saveBlock(change, 'x', 'This would make the net pay negative.')).toBe('This would make the net pay negative.');
    expect(saveBlock(change, 'no', null)).toBe('Add your reason.');
    expect(saveBlock(change, 'One day was excused', null)).toBeNull();
  });
});
