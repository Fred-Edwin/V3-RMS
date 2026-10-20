import { describe, expect, it } from 'vitest';

import type { CalendarBar } from '../../_shared/types/leave-types';
import { dayHeads, placeBar, tightDaysOf, weekStarts } from './calendar-layout';

const bar = (start: string, end: string): CalendarBar => ({ id: 'x', start, end, days: 3, status: 'APPROVED', typeLabel: 'Annual leave' });

describe('placeBar', () => {
  it('puts a bar on its columns', () => {
    expect(placeBar(bar('2026-10-14', '2026-10-16'), '2026-10-12')).toMatchObject({ column: 2, span: 3, continuesBefore: false, continuesAfter: false });
  });
  it('cuts a bar at both edges', () => {
    expect(placeBar(bar('2026-10-08', '2026-10-13'), '2026-10-12')).toMatchObject({ column: 0, span: 2, continuesBefore: true });
    expect(placeBar(bar('2026-10-31', '2026-11-05'), '2026-10-12')).toMatchObject({ column: 19, span: 2, continuesAfter: true });
  });
  it('drops a bar outside the three weeks', () => {
    expect(placeBar(bar('2026-11-02', '2026-11-04'), '2026-10-12')).toBeNull();
  });
});

describe('calendar helpers', () => {
  it('offers 13 Mondays starting this week', () => {
    const w = weekStarts('2026-10-15');
    expect(w[0]).toBe('2026-10-12');
    expect(w).toHaveLength(13);
  });
  it('heads 21 days', () => {
    const heads = dayHeads('2026-10-12');
    expect(heads).toHaveLength(21);
    expect(heads[0]).toMatchObject({ weekday: 'MON', day: 12 });
  });
  it('lists each tight day once with its first request', () => {
    const tight = tightDaysOf({
      coverRows: [{ date: '2026-10-27', working: 4, minimum: 4, planned: false }, { date: '2026-10-28', working: 3, minimum: 4, planned: false }],
      clashes: [{ date: '2026-10-28', applicationId: 'b' }, { date: '2026-10-27', applicationId: 'a' }, { date: '2026-10-27', applicationId: 'c' }],
    });
    expect(tight).toEqual([{ date: '2026-10-27', working: 4, minimum: 4, applicationId: 'a' }, { date: '2026-10-28', working: 3, minimum: 4, applicationId: 'b' }]);
  });
});
