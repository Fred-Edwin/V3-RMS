import { describe, expect, it } from 'vitest';
import { parseNairobiDate } from '../../_shared/time/nairobi-time';
import { countedLateDays, holidayWorkedMinutes, splitOvertime, type ApprovedDay } from './day-facts';

const day = (date: string, over: Partial<ApprovedDay> = {}): ApprovedDay => ({ shiftDate: parseNairobiDate(date), workedMinutes: 480, scheduledMinutes: 480, minutesLate: 0, minutesAfterGrace: 0, lateExcused: false, ...over });
const ot = (date: string, authorisedMinutes: number) => ({ shiftDate: parseNairobiDate(date), authorisedMinutes });

describe('countedLateDays', () => {
  it('counts late days beyond the grace period in date order, and not an excused one', () => {
    const days = [
      day('2026-09-10', { minutesLate: 12, minutesAfterGrace: 7 }),
      day('2026-09-03', { minutesLate: 20, minutesAfterGrace: 15 }),
      day('2026-09-05', { minutesLate: 4, minutesAfterGrace: 0 }), // inside the grace period
      day('2026-09-07', { minutesLate: 30, minutesAfterGrace: 25, lateExcused: true }),
    ];
    expect(countedLateDays(days)).toEqual([20, 12]);
  });
});

describe('splitOvertime', () => {
  const holidays = new Set(['2026-09-14']);
  it('files overtime under the type of the day it was worked', () => {
    const days = [day('2026-09-08'), day('2026-09-13', { scheduledMinutes: 0 }), day('2026-09-14')];
    const split = splitOvertime([ot('2026-09-08', 30), ot('2026-09-13', 60), ot('2026-09-14', 45)], days, holidays, 135);
    expect(split).toEqual({ ordinaryDay: 30, restDay: 60, publicHoliday: 45 });
  });
  it('pays an unexplained remainder as ordinary and never more than the door counts', () => {
    expect(splitOvertime([], [], holidays, 50)).toEqual({ ordinaryDay: 50, restDay: 0, publicHoliday: 0 });
    expect(splitOvertime([ot('2026-09-08', 100)], [day('2026-09-08')], holidays, 40)).toEqual({ ordinaryDay: 40, restDay: 0, publicHoliday: 0 });
  });
});

describe('holidayWorkedMinutes', () => {
  it('counts holiday hours without the overtime already paid that day', () => {
    const holidays = new Set(['2026-09-14']);
    expect(holidayWorkedMinutes([day('2026-09-14', { workedMinutes: 540 }), day('2026-09-15')], [ot('2026-09-14', 60)], holidays)).toBe(480);
    expect(holidayWorkedMinutes([day('2026-09-15')], [], holidays)).toBe(0);
  });
});
