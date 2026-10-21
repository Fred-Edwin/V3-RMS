import { describe, expect, it } from 'vitest';

import { areaKind, safeHref, whenExact, whenWords } from './notification-words';

// 20 Oct 2026, 12:00 in Nairobi.
const NOW = new Date('2026-10-20T09:00:00Z');

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

  it('sends Activity on my record to My phones until that screen exists', () => {
    expect(safeHref('/app/workforce/my-record')).toBe('/app/workforce/my-phones');
  });
});
