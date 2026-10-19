import { describe, expect, it } from 'vitest';
import { parseNairobiDate } from '../../_shared/time/nairobi-time';
import { day } from './month-fixtures';
import { soFar } from './so-far';

const today = parseNairobiDate('2026-10-19');

describe('the open month "so far" (D18)', () => {
  it('sums the days before today', () => {
    const s = soFar([day('2026-10-17'), day('2026-10-18', { workedMinutes: 500 })], today);
    expect(s).toEqual({ workedMinutes: 980, plannedMinutes: 960, throughDate: today });
  });
  it('leaves out days that have not happened', () => {
    expect(soFar([day('2026-10-20')], today).workedMinutes).toBe(0);
  });
  it('counts today only once nothing on it is running', () => {
    expect(soFar([day('2026-10-19', { status: 'MATCHED' })], today).workedMinutes).toBe(0); // matches so far, day not over
    expect(soFar([day('2026-10-19', { status: 'NEEDS_LOOK', reasons: ['OPEN_SHIFT'], workedMinutes: 300 })], today).workedMinutes).toBe(0); // open shift
    expect(soFar([day('2026-10-19', { status: 'AUTO_APPROVED' })], today).workedMinutes).toBe(480);
    expect(soFar([day('2026-10-19', { status: 'NEEDS_LOOK', reasons: ['LATE'] })], today).workedMinutes).toBe(480);
  });
  it('is the same number twice in a row (it does not move on its own)', () => {
    const days = [day('2026-10-18'), day('2026-10-19', { status: 'MATCHED' })];
    expect(soFar(days, today)).toEqual(soFar(days, today));
  });
});
