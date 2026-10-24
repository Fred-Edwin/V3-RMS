import type { ShiftTone } from '../../../_shared';
import { addDays, toneOfColour } from '../../../rota';
import { dayShort, dayMonth } from '../../_shared/lib/timesheet-words';
import type { MyRota } from '../../_shared/types/timesheet-types';

/** My rota (Paper Chapter 9, step 1, left phone): a card for each day from the first to the last, off days included. Pure. */

export interface RotaLine {
  date: string;
  day: string;
  today: boolean;
  dayOff: boolean;
  /** A day with no shift that nobody has planned yet (after the last planned shift): it reads "Not planned yet", not "Day off". */
  notPlanned: boolean;
  shift?: { tone: ShiftTone; label: string };
}

const minutesOf = (hm: string): number => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5));

export function rotaLines(rota: MyRota, today: string): RotaLine[] {
  const lines: RotaLine[] = [];
  const plannedThrough = rota.shifts.reduce((latest, s) => (s.date > latest ? s.date : latest), '');
  for (let date = rota.from; date <= rota.to && lines.length < 62; date = addDays(date, 1)) {
    const first = rota.shifts.find((s) => s.date === date);
    lines.push({
      date,
      day: dayShort(date),
      today: date === today,
      dayOff: !first,
      notPlanned: !first && date >= today && date > plannedThrough,
      shift: first ? { tone: toneOfColour(first.colour as Parameters<typeof toneOfColour>[0]), label: `${first.name} ${first.startTime} to ${first.endTime}` } : undefined,
    });
  }
  return lines;
}

/** Paid minutes of every shift in the range: the shift's length less its unpaid break. */
export const plannedMinutes = (rota: MyRota): number => rota.shifts.reduce((sum, s) => sum + Math.max(0, minutesOf(s.endTime) - minutesOf(s.startTime) - s.unpaidBreakMinutes), 0);

/** "5 shifts · 40 h planned". */
export function rotaSummary(rota: MyRota): string {
  const n = rota.shifts.length;
  const hours = plannedMinutes(rota) / 60;
  const shown = Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
  return `${n} ${n === 1 ? 'shift' : 'shifts'} · ${shown} h planned`;
}

/** "12 Oct to 25 Oct". */
export const rotaRange = (rota: MyRota): string => `${dayMonth(rota.from)} to ${dayMonth(rota.to)}`;
