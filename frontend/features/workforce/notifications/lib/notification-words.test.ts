import { describe, expect, it } from 'vitest';

import { areaKind, clockText, dayHeading, groupByDay, safeHref, unreadLine, whenExact, whenWords } from './notification-words';

// 20 Oct 2026, 12:00 in Nairobi.
const NOW = new Date('2026-10-20T09:00:00Z');

describe('the drawer and the phone page', () => {
  it('writes the clock in Nairobi', () => {
    expect(clockText('2026-10-19T11:05:00Z')).toBe('14:05');
    expect(clockText('2026-10-20T21:30:00Z')).toBe('00:30');
  });

  it('heads a day: TODAY, YESTERDAY, then the weekday and date', () => {
    expect(dayHeading('2026-10-20T06:00:00Z', NOW)).toBe('TODAY');
    expect(dayHeading('2026-10-19T08:00:00Z', NOW)).toBe('YESTERDAY');
    expect(dayHeading('2026-10-16T08:00:00Z', NOW)).toBe('FRI 16 OCT');
  });

  it('counts the Nairobi day, not the UTC one', () => {
    // 21:30 UTC on the 19th is 00:30 on the 20th in Nairobi.
    expect(dayHeading('2026-10-19T21:30:00Z', NOW)).toBe('TODAY');
  });

  it('groups newest-first rows under their day, keeping the order', () => {
    const rows = [
      { id: 'a', createdAt: '2026-10-20T08:00:00Z' },
      { id: 'b', createdAt: '2026-10-20T05:00:00Z' },
      { id: 'c', createdAt: '2026-10-19T08:00:00Z' },
      { id: 'd', createdAt: '2026-10-16T08:00:00Z' },
    ];
    expect(groupByDay(rows, NOW).map((g) => [g.heading, g.items.map((r) => r.id)])).toEqual([
      ['TODAY', ['a', 'b']],
      ['YESTERDAY', ['c']],
      ['FRI 16 OCT', ['d']],
    ]);
  });

  it('says how many are unread', () => {
    expect(unreadLine(4)).toBe('4 unread');
    expect(unreadLine(0)).toBe('All read');
  });
});

describe('when', () => {
  it('reads Now, minutes, hours, Yesterday, then the date', () => {
    expect(whenWords('2026-10-20T08:59:40Z', NOW)).toBe('Now');
    expect(whenWords('2026-10-20T08:48:00Z', NOW)).toBe('12 min');
    expect(whenWords('2026-10-20T06:30:00Z', NOW)).toBe('2 h');
    expect(whenWords('2026-10-19T08:00:00Z', NOW)).toBe('Yesterday');
    expect(whenWords('2026-10-12T08:00:00Z', NOW)).toBe('Mon 12 Oct');
  });

  it('gives the exact time on Nairobi’s clock', () => {
    expect(whenExact('2026-10-19T11:05:00Z')).toBe('Mon 19 Oct, 14:05');
  });
});

describe('row labels and links', () => {
  it('writes the area and kind in capitals', () => {
    expect(areaKind({ area: 'PAY', tone: 'problem' })).toBe('PAY · PROBLEM');
    expect(areaKind({ area: 'TIME', tone: 'needsLook' })).toBe('TIME · NEEDS A LOOK');
  });

  it('keeps a link inside the app and drops anything else', () => {
    expect(safeHref('/app/workforce/my-payslips')).toBe('/app/workforce/my-payslips');
    expect(safeHref('https://example.com/x')).toBeNull();
    expect(safeHref('//evil.example/app')).toBeNull();
    expect(safeHref(null)).toBeNull();
  });

  it('leaves the Activity on my record link as it is', () => {
    expect(safeHref('/app/workforce/my-record')).toBe('/app/workforce/my-record');
  });
});
