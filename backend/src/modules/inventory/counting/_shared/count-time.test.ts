import { describe, expect, it } from 'vitest';
import {
  clockText,
  dateClockText,
  daysBetween,
  fullDateClockText,
  inQuietHours,
  lastCountedText,
  nairobiDay,
  nairobiDayEnd,
  nairobiDayStart,
  nextQuietHoursEnd,
  signedText,
  weekdayDateText,
} from './count-time';

// Nairobi is UTC+3: 07:42 Nairobi is 04:42Z.
const at = (iso: string) => new Date(iso);

describe('Nairobi days', () => {
  it('reads the Nairobi calendar day, not the UTC one', () => {
    expect(nairobiDay(at('2026-10-13T04:42:00Z'))).toBe('2026-10-13');
    expect(nairobiDay(at('2026-10-12T21:00:00Z'))).toBe('2026-10-13'); // 00:00 Nairobi
    expect(nairobiDay(at('2026-10-12T20:59:59Z'))).toBe('2026-10-12');
  });

  it('a day runs from 00:00 to the next 00:00 Nairobi', () => {
    expect(nairobiDayStart(at('2026-10-13T04:42:00Z')).toISOString()).toBe('2026-10-12T21:00:00.000Z');
    expect(nairobiDayEnd(at('2026-10-13T04:42:00Z')).toISOString()).toBe('2026-10-13T21:00:00.000Z');
  });

  it('counts whole Nairobi days between two instants', () => {
    expect(daysBetween(at('2026-10-12T20:50:00Z'), at('2026-10-12T21:10:00Z'))).toBe(1); // 23:50 then 00:10 next day
    expect(daysBetween(at('2026-10-07T05:30:00Z'), at('2026-10-13T04:42:00Z'))).toBe(6);
    expect(daysBetween(at('2026-10-13T01:00:00Z'), at('2026-10-13T18:00:00Z'))).toBe(0);
  });
});

describe('words', () => {
  const now = at('2026-10-13T06:00:00Z');

  it('last counted: Today, Yesterday, N days ago, Never counted', () => {
    expect(lastCountedText(at('2026-10-13T01:00:00Z'), now)).toBe('Today');
    expect(lastCountedText(at('2026-10-12T05:30:00Z'), now)).toBe('Yesterday');
    expect(lastCountedText(at('2026-10-07T05:30:00Z'), now)).toBe('6 days ago');
    expect(lastCountedText(null, now)).toBe('Never counted');
  });

  it('signed text: Today 07:42, Yesterday 16:10, then weekday, date and time', () => {
    expect(signedText(at('2026-10-13T04:42:00Z'), now)).toBe('Today 07:42');
    expect(signedText(at('2026-10-12T13:10:00Z'), now)).toBe('Yesterday 16:10');
    expect(signedText(at('2026-10-09T13:10:00Z'), now)).toBe('Fri 9 Oct 16:10');
  });

  it('clock, date and full date', () => {
    expect(clockText(at('2026-10-13T04:42:00Z'))).toBe('07:42');
    expect(dateClockText(at('2026-10-13T04:12:00Z'))).toBe('13 Oct 07:12');
    expect(weekdayDateText(at('2026-10-09T10:00:00Z'))).toBe('Fri 9 Oct');
    expect(fullDateClockText(at('2026-10-13T06:18:00Z'))).toBe('13 Oct 2026, 09:18');
  });
});

describe('quiet hours 22:00 to 05:00 Africa/Nairobi', () => {
  // [Nairobi clock, in quiet hours, push goes out at (Nairobi, as UTC ISO)]
  const table: [string, string, boolean, string][] = [
    ['21:59 is awake', '2026-10-13T18:59:00Z', false, '2026-10-13T18:59:00.000Z'],
    ['22:00 is quiet (starts at 22:00 sharp)', '2026-10-13T19:00:00Z', true, '2026-10-14T02:00:00.000Z'], // out at 05:00 next day
    ['23:30 is quiet', '2026-10-13T20:30:00Z', true, '2026-10-14T02:00:00.000Z'],
    ['00:00 is quiet', '2026-10-13T21:00:00Z', true, '2026-10-14T02:00:00.000Z'],
    ['03:15 is quiet and goes out the same morning', '2026-10-14T00:15:00Z', true, '2026-10-14T02:00:00.000Z'],
    ['04:59 is quiet', '2026-10-14T01:59:00Z', true, '2026-10-14T02:00:00.000Z'],
    ['05:00 is awake (the hold ends at 05:00 sharp)', '2026-10-14T02:00:00Z', false, '2026-10-14T02:00:00.000Z'],
    ['noon is awake', '2026-10-14T09:00:00Z', false, '2026-10-14T09:00:00.000Z'],
  ];
  for (const [name, iso, quiet, outAt] of table) {
    it(name, () => {
      expect(inQuietHours(at(iso))).toBe(quiet);
      expect(nextQuietHoursEnd(at(iso)).toISOString()).toBe(outAt);
    });
  }
});
