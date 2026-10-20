import type { DraftLine } from '../types/casual-types';

/**
 * The day's pay on the phone, so a head with no signal still sees what each worker is owed (PD22, PD28). The same line as the server:
 * `rate × minutes ÷ 480`, whole shillings, half up. The server's figure is the one that counts once the sheet is sent.
 */
export const DAY_MINUTES = 480;
export const MAX_SHIFT_MINUTES = 960;

const toMinute = (clock: string): number => {
  const [h = 0, m = 0] = clock.split(':').map(Number);
  return h * 60 + m;
};

/** Minutes between the two clock times; a shift that ends at or before its start ends the next day only if `endsNextDay`. */
export const shiftMinutes = (start: string, end: string, endsNextDay: boolean): number => toMinute(end) + (endsNextDay ? 1440 : 0) - toMinute(start);

/** Whole shillings, half up, in integer maths on cents. */
export function dayPay(rate: string, minutes: number): number {
  const rateCents = Math.round(Number(rate) * 100);
  const doubled = rateCents * minutes * 2;
  const unit = DAY_MINUTES * 100;
  return Math.floor((doubled + unit) / (2 * unit));
}

/** "8 h × KES 900 ÷ 8 = 900" */
export function payWorking(rate: string, minutes: number): string {
  const hours = minutes % 60 === 0 ? String(minutes / 60) : (minutes / 60).toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  return `${hours} h × KES ${rate.replace(/\.00$/, '')} ÷ 8 = ${dayPay(rate, minutes)}`;
}

/** "07:00 to 15:00 · 8 h" (a shift past midnight shows "+1"). */
export function timeRange(start: string, end: string, endsNextDay: boolean): string {
  const minutes = shiftMinutes(start, end, endsNextDay);
  const hours = minutes % 60 === 0 ? `${minutes / 60} h` : `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`;
  return `${start} to ${end}${endsNextDay ? ' +1' : ''} · ${hours}`;
}

export type LineProblem = 'END_BEFORE_START' | 'DAY_TOO_LONG' | null;

/** A line's check, in the order the screen says them. A shift that ends before it starts is read as past midnight only when the head says so. */
export function lineProblem(start: string, end: string, endsNextDay: boolean): LineProblem {
  const minutes = shiftMinutes(start, end, endsNextDay);
  if (minutes <= 0) return 'END_BEFORE_START';
  if (minutes > MAX_SHIFT_MINUTES) return 'DAY_TOO_LONG';
  return null;
}

export const PROBLEM_WORDS: Record<Exclude<LineProblem, null>, string> = {
  END_BEFORE_START: 'End must be after start.',
  DAY_TOO_LONG: 'A day cannot be over 16 hours.',
};

/** The first line whose shift has not ended yet at `nowMs`, or null when the sheet may be sent (PD23). Nairobi is UTC+3 all year. */
export function firstUnfinished(date: string, lines: readonly DraftLine[], nowMs: number): DraftLine | null {
  const midnight = Date.parse(`${date}T00:00:00+03:00`);
  return lines.find((l) => midnight + (toMinute(l.end) + (l.endsNextDay ? 1440 : 0)) * 60_000 > nowMs) ?? null;
}

/** The total for the lines held on the phone, in whole shillings. Correction lines belong to the server's total. */
export const draftTotal = (rate: string, lines: readonly DraftLine[]): number => lines.reduce((sum, l) => sum + dayPay(rate, Math.max(0, shiftMinutes(l.start, l.end, l.endsNextDay))), 0);
