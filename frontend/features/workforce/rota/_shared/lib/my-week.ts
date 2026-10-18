import type { WeekBar } from '../../../_shared';
import type { MyShift } from '../types/rota-types';
import { addDays, dayOfMonth, monthName, weekDates, weekdayName } from './rota-dates';
import { hoursNumber } from './shift-look';

export interface WeekPlanDay extends WeekBar {
  date: string;
}

/** A 10-hour day fills the 40 px bar; the shift in Paper's example (8 h) reads as most of it. */
const FULL_BAR_MINUTES = 600;

/**
 * The phone "This week" card from the person's own upcoming shifts: one bar per day with the planned paid hours, today ringed, a day with
 * no shift drawn as the 2 px line. Only planned hours exist until Attendance adds what was worked.
 */
export function weekPlan(shifts: readonly MyShift[], weekStart: string, today: string): { range: string; bars: WeekPlanDay[]; hours: string; hoursOf: string } {
  const minutesOn = (date: string): number => shifts.filter((s) => s.date === date).reduce((sum, s) => sum + s.paidMinutes, 0);
  const bars = weekDates(weekStart).map((date): WeekPlanDay => {
    const minutes = minutesOn(date);
    const day = weekdayName(date);
    return {
      date,
      letter: day.charAt(0),
      fraction: Math.min(1, minutes / FULL_BAR_MINUTES),
      state: minutes > 0 ? 'planned' : 'off',
      today: date === today,
      label: minutes > 0 ? `${day}, ${hoursNumber(minutes)} hours planned` : `${day}, no shift`,
    };
  });
  const total = shifts.reduce((sum, s) => (bars.some((b) => b.date === s.date) ? sum + s.paidMinutes : sum), 0);
  const end = addDays(weekStart, 6);
  const range = `${dayOfMonth(weekStart)} TO ${dayOfMonth(end)} ${monthName(end).slice(0, 3).toUpperCase()}`;
  return { range, bars, hours: `${hoursNumber(total)} h`, hoursOf: total === 0 ? 'no shifts planned this week' : 'planned this week' };
}
