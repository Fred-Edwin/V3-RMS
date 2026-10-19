import { describe, expect, it } from 'vitest';
import { nairobiDateOf, parseNairobiDate, type NairobiDate } from '../../_shared/time/nairobi-time';
import { amountSegments, daysSinceMonthEnd, employedRanges, monthHasEnded, monthWindow, previousMonthKey, rangeDays } from './month-calendar';

const d = (value: string): NairobiDate => parseNairobiDate(value);

describe('monthWindow', () => {
  it('knows the length of every kind of month', () => {
    expect(monthWindow('2026-09')).toMatchObject({ first: '2026-09-01', last: '2026-09-30', days: 30 });
    expect(monthWindow('2026-10').days).toBe(31);
    expect(monthWindow('2026-02').days).toBe(28);
    expect(monthWindow('2028-02').days).toBe(29);
  });
  it('steps back across a year', () => {
    expect(previousMonthKey('2027-01')).toBe('2026-12');
    expect(previousMonthKey('2026-10')).toBe('2026-09');
  });
});

describe('the Nairobi month boundary (not the UTC one)', () => {
  const september = monthWindow('2026-09');
  it('September is still running at 23:30 on 30 Sep Nairobi (20:30 UTC) and over at 00:00 on 1 Oct Nairobi (21:00 UTC on 30 Sep)', () => {
    expect(monthHasEnded(september, nairobiDateOf(new Date('2026-09-30T20:30:00Z')))).toBe(false);
    expect(monthHasEnded(september, nairobiDateOf(new Date('2026-09-30T21:00:00Z')))).toBe(true);
  });
  it('counts the days since the end by the Nairobi date', () => {
    expect(daysSinceMonthEnd(september, nairobiDateOf(new Date('2026-09-30T21:30:00Z')))).toBe(1); // already 1 Oct in Nairobi
    expect(daysSinceMonthEnd(september, nairobiDateOf(new Date('2026-10-06T08:00:00Z')))).toBe(6);
    expect(daysSinceMonthEnd(september, d('2026-09-15'))).toBe(0);
  });
});

describe('employedRanges', () => {
  const september = monthWindow('2026-09');
  it('takes the whole month for a person employed throughout', () => {
    expect(rangeDays(employedRanges(september, [{ startsOn: d('2025-01-01'), endedOn: null }]))).toBe(30);
  });
  it('cuts a joiner and a leaver at their dates', () => {
    expect(employedRanges(september, [{ startsOn: d('2026-09-12'), endedOn: null }])).toEqual([{ from: '2026-09-12', to: '2026-09-30' }]);
    expect(rangeDays(employedRanges(september, [{ startsOn: d('2026-09-12'), endedOn: null }]))).toBe(19); // Paper: paid 19 of 30 days
    expect(employedRanges(september, [{ startsOn: d('2025-01-01'), endedOn: d('2026-09-24') }])).toEqual([{ from: '2026-09-01', to: '2026-09-24' }]);
  });
  it('ignores a spell wholly outside the month and joins two spells that touch', () => {
    expect(employedRanges(september, [{ startsOn: d('2025-01-01'), endedOn: d('2026-08-31') }])).toEqual([]);
    expect(rangeDays(employedRanges(september, [{ startsOn: d('2026-01-01'), endedOn: d('2026-09-10') }, { startsOn: d('2026-09-11'), endedOn: null }]))).toBe(30);
  });
});

describe('amountSegments', () => {
  it('asks few questions for an unchanged month and makes one segment', async () => {
    let asked = 0;
    const out = await amountSegments([{ from: d('2026-09-01'), to: d('2026-09-30') }], async () => {
      asked += 1;
      return '30000.00';
    });
    expect(out.segments).toEqual([{ amount: '30000.00', days: 30 }]);
    expect(asked).toBe(2);
    expect(out.lastAmount).toBe('30000.00');
  });

  it('splits at a pay change on the 11th and finds the exact day', async () => {
    const out = await amountSegments([{ from: d('2026-09-01'), to: d('2026-09-30') }], async (date) => (date < d('2026-09-11') ? '30000.00' : '36000.00'));
    expect(out.segments).toEqual([
      { amount: '30000.00', days: 10 },
      { amount: '36000.00', days: 20 },
    ]);
    expect(out.lastAmount).toBe('36000.00');
  });

  it('leaves days with no amount in force unpriced', async () => {
    const out = await amountSegments([{ from: d('2026-09-01'), to: d('2026-09-30') }], async (date) => (date < d('2026-09-21') ? null : '30000.00'));
    expect(out.unpricedDays).toBe(20);
    expect(out.segments).toEqual([{ amount: '30000.00', days: 10 }]);
    const none = await amountSegments([{ from: d('2026-09-01'), to: d('2026-09-30') }], async () => null);
    expect(none.segments).toEqual([]);
    expect(none.lastAmount).toBeNull();
  });
});
