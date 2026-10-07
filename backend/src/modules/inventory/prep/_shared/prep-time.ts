/** Nairobi has no daylight saving, so a Nairobi midnight is always 21:00 UTC the day before. */
const NAIROBI_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The instant a `YYYY-MM-DD` Nairobi day starts. */
export const nairobiDayStart = (date: string): Date => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1) - NAIROBI_OFFSET_MS);
};

/** `[start, end)` for the Nairobi day that contains `at`. */
export const nairobiDayRange = (at: Date): { start: Date; end: Date } => {
  const shifted = new Date(at.getTime() + NAIROBI_OFFSET_MS);
  const start = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - NAIROBI_OFFSET_MS);
  return { start, end: new Date(start.getTime() + DAY_MS) };
};

/** `[from, to)` instants for an inclusive pair of Nairobi dates; either side may be missing. */
export const nairobiDateWindow = (from?: string, to?: string): { from?: Date; to?: Date } => ({
  ...(from ? { from: nairobiDayStart(from) } : {}),
  ...(to ? { to: new Date(nairobiDayStart(to).getTime() + DAY_MS) } : {}),
});
