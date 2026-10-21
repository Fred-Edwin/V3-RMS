import { describe, expect, it } from 'vitest';

import { dayHeading, logLink, orderDays, spanWords, countWords } from '../../digest/lib/digest';
import { entriesWord, showing, thisMonth, timeWords } from './my-record-words';

const NOW = new Date('2026-10-19T09:30:00.000Z'); // 12:30 in Nairobi

describe('Activity on my record words', () => {
  it('words the time in Nairobi: today, yesterday, then the date', () => {
    expect(timeWords('2026-10-19T07:02:00.000Z', NOW)).toBe('Today 10:02');
    expect(timeWords('2026-10-18T13:40:00.000Z', NOW)).toBe('Yesterday 16:40');
    expect(timeWords('2026-10-12T06:15:00.000Z', NOW)).toBe('12 Oct 09:15');
  });

  it('counts and starts the month in Nairobi', () => {
    expect(entriesWord(23)).toBe('23 entries');
    expect(entriesWord(1)).toBe('1 entry');
    expect(showing(6, 23)).toBe('Showing 6 of 23');
    expect(showing(0, 0)).toBe('');
    expect(thisMonth(NOW)).toEqual({ from: '2026-10-01', to: '2026-10-19' });
  });
});

describe('the payslip-openings digest', () => {
  it('heads days TODAY, YESTERDAY, then the weekday and date', () => {
    expect(dayHeading('2026-10-19', '2026-10-19')).toBe('TODAY');
    expect(dayHeading('2026-10-18', '2026-10-19')).toBe('YESTERDAY');
    expect(dayHeading('2026-10-12', '2026-10-19')).toBe('Mon 12 Oct');
  });

  it('shows counts and a time span, never an amount', () => {
    expect(countWords(12)).toBe('12 payslips');
    expect(countWords(1)).toBe('1 payslip');
    expect(spanWords('2026-10-19T06:12:00.000Z', '2026-10-19T08:40:00.000Z')).toBe('09:12 to 11:40');
    expect(spanWords('2026-10-19T06:12:00.000Z', '2026-10-19T06:12:30.000Z')).toBe('09:12');
    expect(spanWords(null, null)).toBeNull();
  });

  it('orders newest day first, busiest opener first, and drops empty days', () => {
    const row = (openerId: string, day: string, count: number) => ({ openerId, name: 'N', role: 'HR_MANAGER', day, count, firstAt: null, lastAt: null, many: false });
    const days = orderDays([
      { day: '2026-10-17', rows: [row('a', '2026-10-17', 3)] },
      { day: '2026-10-19', rows: [row('a', '2026-10-19', 2), row('b', '2026-10-19', 9)] },
      { day: '2026-10-18', rows: [] },
    ]);
    expect(days.map((d) => d.day)).toEqual(['2026-10-19', '2026-10-17']);
    expect(days[0]?.rows.map((r) => r.openerId)).toEqual(['b', 'a']);
  });

  it('links a row to the Audit log on that opener and day', () => {
    expect(logLink({ openerId: 'abc', day: '2026-10-19' })).toBe('/app/workforce/audit-log?event=payslips&actor=abc&from=2026-10-19&to=2026-10-19');
  });
});
