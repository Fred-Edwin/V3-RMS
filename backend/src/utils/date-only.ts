/**
 * The single source of truth for the business timezone. All user-facing
 * timestamps (receipts, reports, notifications) must be formatted in this
 * zone, never the server's local zone — production runs in UTC, so any
 * `toLocale*` call without an explicit `timeZone` prints 3 hours early.
 */
export const NAIROBI_TZ = 'Africa/Nairobi';

const buildUtcDateOnly = (year: number, month: number, day: number): Date => {
  return new Date(Date.UTC(year, month - 1, day));
};

/** Formats an instant as `HH:MM` (24h) in Kenya time. */
export const formatNairobiTime = (value: Date, hour12 = false): string =>
  value.toLocaleTimeString('en-KE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12,
    timeZone: NAIROBI_TZ,
  });

/** Formats an instant as `DD/MM/YYYY` in Kenya time. */
export const formatNairobiDate = (value: Date): string =>
  value.toLocaleDateString('en-KE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: NAIROBI_TZ,
  });

export const parseDateOnly = (value: string): Date => {
  const [yearToken, monthToken, dayToken] = value.split('-');
  const year = Number(yearToken ?? '0');
  const month = Number(monthToken ?? '1');
  const day = Number(dayToken ?? '1');
  return buildUtcDateOnly(year, month, day);
};

export const formatDateOnly = (value: Date): string => {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  const day = String(value.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const toIsoDateOnly = (value: Date): string => formatDateOnly(value);

const nairobiDateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Africa/Nairobi',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export const getTodayDateOnly = (): Date => {
  const parts = nairobiDateFormatter.formatToParts(new Date());
  const year = Number(parts.find((p) => p.type === 'year')!.value);
  const month = Number(parts.find((p) => p.type === 'month')!.value);
  const day = Number(parts.find((p) => p.type === 'day')!.value);
  return buildUtcDateOnly(year, month, day);
};

export const isSameDateOnly = (left: Date, right: Date): boolean => {
  return formatDateOnly(left) === formatDateOnly(right);
};

/**
 * The `[start, end)` UTC instant range covering "today" in Kenya time — for
 * filtering timestamp columns (e.g. `openedAt gte/lt`) to the current
 * Nairobi calendar day. Kenya has no DST, so a fixed +3h offset from the
 * Nairobi-local midnight (itself derived via `getTodayDateOnly`, which is
 * already DST-safe through `Intl.DateTimeFormat`) is correct year-round.
 */
export const getTodayNairobiRangeUtc = (): { start: Date; end: Date } => {
  const todayDateOnly = getTodayDateOnly();
  const start = new Date(todayDateOnly.getTime() - 3 * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
};
