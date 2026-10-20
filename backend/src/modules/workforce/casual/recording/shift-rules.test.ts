import { describe, expect, it } from 'vitest';
import { parseNairobiDate } from '../../_shared/time/nairobi-time';
import { assertRecordable, clockOfMinute, firstUnfinished, neighbourDates, overlaps, shiftEndInstant, shiftOf } from './shift-rules';

const d = parseNairobiDate;

describe('shiftOf (PD23)', () => {
  it('reads a normal day', () => {
    expect(shiftOf({ start: '07:00', end: '15:00' })).toEqual({ startMinute: 420, endMinute: 900, minutes: 480 });
  });

  it('a shift past midnight carries the +1', () => {
    expect(shiftOf({ start: '20:00', end: '02:00', endsNextDay: true })).toEqual({ startMinute: 1200, endMinute: 1560, minutes: 360 });
  });

  it('end must be after start', () => {
    expect(() => shiftOf({ start: '15:00', end: '07:00' })).toThrow('End must be after start.');
    expect(() => shiftOf({ start: '07:00', end: '07:00' })).toThrow('End must be after start.');
  });

  it('a day is at most 16 hours: exactly 16 is fine, one minute more is refused', () => {
    expect(shiftOf({ start: '06:00', end: '22:00' }).minutes).toBe(960);
    expect(() => shiftOf({ start: '06:00', end: '22:01' })).toThrow('A day cannot be over 16 hours.');
  });

  it('refuses something that is not a clock time', () => {
    expect(() => shiftOf({ start: '7am', end: '15:00' })).toThrow();
    expect(() => shiftOf({ start: '07:00', end: '24:00' })).toThrow();
  });
});

describe('assertRecordable', () => {
  const today = d('2026-10-19');
  it('allows today and the three days before it', () => {
    for (const day of ['2026-10-19', '2026-10-18', '2026-10-17', '2026-10-16']) expect(() => assertRecordable(d(day), today)).not.toThrow();
  });
  it('refuses the fourth day back', () => {
    expect(() => assertRecordable(d('2026-10-15'), today)).toThrow('more than 3 days ago');
  });
  it('refuses tomorrow', () => {
    expect(() => assertRecordable(d('2026-10-20'), today)).toThrow('has not happened');
  });
});

describe('overlaps', () => {
  const shift = (workDate: string, startMinute: number, endMinute: number) => ({ workDate: d(workDate), startMinute, endMinute });
  it('detects an overlap on the same day', () => {
    expect(overlaps(shift('2026-10-19', 420, 900), shift('2026-10-19', 840, 1200))).toBe(true);
  });
  it('touching shifts do not overlap', () => {
    expect(overlaps(shift('2026-10-19', 420, 720), shift('2026-10-19', 720, 1000))).toBe(false);
  });
  it('a shift past midnight overlaps the next morning', () => {
    expect(overlaps(shift('2026-10-19', 1200, 1560), shift('2026-10-20', 60, 300))).toBe(true);
    expect(overlaps(shift('2026-10-19', 1200, 1560), shift('2026-10-20', 120, 300))).toBe(false);
  });
  it('different days far apart never overlap', () => {
    expect(overlaps(shift('2026-10-19', 0, 960), shift('2026-10-21', 0, 960))).toBe(false);
  });
  it('lists the days a shift can reach', () => {
    expect(neighbourDates(d('2026-10-31'))).toEqual(['2026-10-30', '2026-10-31', '2026-11-01']);
  });
});

describe('send readiness', () => {
  it('a shift ends at its Nairobi time (UTC+3)', () => {
    expect(shiftEndInstant(d('2026-10-19'), 900).toISOString()).toBe('2026-10-19T12:00:00.000Z'); // 15:00 Nairobi
  });
  it('finds the first line that has not ended', () => {
    const lines = [{ id: 'a', endMinute: 900 }, { id: 'b', endMinute: 1140 }];
    const at1550 = new Date('2026-10-19T12:50:00.000Z'); // 15:50 Nairobi
    expect(firstUnfinished(d('2026-10-19'), lines, at1550)?.id).toBe('b');
    expect(firstUnfinished(d('2026-10-19'), lines, new Date('2026-10-19T16:00:00.000Z'))).toBeNull(); // 19:00 exactly has ended
  });
  it('formats a clock from a minute', () => {
    expect(clockOfMinute(420)).toBe('07:00');
    expect(clockOfMinute(1530)).toBe('01:30');
  });
});
