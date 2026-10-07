/**
 * Africa/Nairobi days for Stock and Waste. Nairobi is UTC+3 all year with no daylight saving, so a fixed offset is exact.
 * Every function is pure: the clock is always passed in, never read here.
 */
const NAIROBI_OFFSET_MS = 3 * 60 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;

const pad = (n: number): string => String(n).padStart(2, '0');

/** A Date whose UTC fields read as the Nairobi wall clock. Only the `getUTC*` getters of the result mean anything. */
const wall = (date: Date): Date => new Date(date.getTime() + NAIROBI_OFFSET_MS);

/** "2026-10-13": the Nairobi calendar day of an instant. */
export const nairobiDay = (date: Date): string => wall(date).toISOString().slice(0, 10);

/** The instant a `YYYY-MM-DD` Nairobi day starts (00:00 Nairobi). */
export const dayStartInstant = (day: string): Date => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1) - NAIROBI_OFFSET_MS);
};

/** The instant the day after `day` starts: the exclusive end of that Nairobi day. */
export const dayEndInstant = (day: string): Date => new Date(dayStartInstant(day).getTime() + DAY_MS);

/** The Nairobi day `days` before or after `day` (negative goes back). */
export const addDays = (day: string, days: number): string => nairobiDay(new Date(dayStartInstant(day).getTime() + days * DAY_MS));

/** The instant the Nairobi day of `date` started. */
export const startOfNairobiDay = (date: Date): Date => dayStartInstant(nairobiDay(date));

/** "14:20" */
export const clockText = (date: Date): string => {
  const w = wall(date);
  return `${pad(w.getUTCHours())}:${pad(w.getUTCMinutes())}`;
};
