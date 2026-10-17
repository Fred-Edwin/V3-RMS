/**
 * Pure time formatters for the kit (timers, hours, durations). They take plain
 * numbers, never a Date, so no server-local time can leak in. Date and clock
 * maths for the Nairobi day lives in the back end's `_shared/time/`.
 */

const pad2 = (n: number): string => String(n).padStart(2, '0');
const whole = (n: number): number => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);

/** Seconds to "07:38:21" (the running clock on the phone). Negative or NaN reads as zero. */
export function formatHms(totalSeconds: number): string {
  const s = whole(totalSeconds);
  return `${pad2(Math.floor(s / 3600))}:${pad2(Math.floor((s % 3600) / 60))}:${pad2(s % 60)}`;
}

/** Seconds to "1:52" (the Undo countdown). Minutes are not padded. */
export function formatMmSs(totalSeconds: number): string {
  const s = whole(totalSeconds);
  return `${Math.floor(s / 60)}:${pad2(s % 60)}`;
}

/** Minutes to "41 h 05" (a week's hours on a timesheet row). */
export function formatHoursMinutes(totalMinutes: number): string {
  const m = whole(totalMinutes);
  return `${Math.floor(m / 60)} h ${pad2(m % 60)}`;
}

/** Minutes to "8 h 02 m" (a day's hours, with the minutes unit). */
export function formatHoursMinutesUnit(totalMinutes: number): string {
  return `${formatHoursMinutes(totalMinutes)} m`;
}

/** Minutes to a spoken length: "1 h 30", "2 h", "45 min". */
export function formatDuration(totalMinutes: number): string {
  const m = whole(totalMinutes);
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h === 0) return `${rest} min`;
  return rest === 0 ? `${h} h` : `${h} h ${pad2(rest)}`;
}

/** Whole minutes between two "HH:MM" clock times on the same day; an end before the start counts as the next day. */
export function minutesBetween(start: string, end: string): number {
  const toMin = (t: string): number => {
    const [h, m] = t.split(':').map(Number);
    return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
  };
  const diff = toMin(end) - toMin(start);
  return diff >= 0 ? diff : diff + 24 * 60;
}
