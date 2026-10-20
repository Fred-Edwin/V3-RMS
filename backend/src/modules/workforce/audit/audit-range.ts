import { ValidationError } from '../../../utils/errors';
import { AUDIT_RETENTION_YEARS } from '../_shared/audit/audit.types';
import { addDays, daysBetween, instantAt, nairobiToday, parseClockTime, parseNairobiDate, type NairobiDate } from '../_shared/time/nairobi-time';

const MIDNIGHT = parseClockTime('00:00');
export const DEFAULT_RANGE_DAYS = 30;
/** Beyond this many pages, a wide range is refused: an offset scan across years is the one slow thing a log can do. */
export const DEEP_PAGE = 200;
export const DEEP_PAGE_MAX_DAYS = 90;

export interface LogRange {
  from: NairobiDate;
  to: NairobiDate;
  /** Inclusive start instant and exclusive end instant, Nairobi midnight to Nairobi midnight. */
  start: Date;
  end: Date;
  /** The range reaches past the retention window (A1 cut-off line). */
  reachesArchive: boolean;
}

/**
 * Inclusive Nairobi days. Missing = the last 30 days. A later date than today is cut to today. From after To swaps silently (A2).
 * An invalid date is a 400 RANGE_INVALID.
 */
export function rangeOf(from: string | undefined, to: string | undefined, now: Date = new Date()): LogRange {
  const today = nairobiToday(now);
  let a: NairobiDate;
  let b: NairobiDate;
  try {
    b = to ? parseNairobiDate(to) : today;
    a = from ? parseNairobiDate(from) : addDays(b, -(DEFAULT_RANGE_DAYS - 1));
  } catch {
    throw new ValidationError('Choose a real date.', 'RANGE_INVALID');
  }
  if (b > today) b = today;
  if (a > today) a = today;
  if (a > b) [a, b] = [b, a];
  const archiveEdge = addDays(today, -Math.round(AUDIT_RETENTION_YEARS * 365.25));
  return { from: a, to: b, start: instantAt(a, MIDNIGHT), end: instantAt(addDays(b, 1), MIDNIGHT), reachesArchive: a < archiveEdge };
}

/** Throws 400 RANGE_REQUIRED when a deep page is asked across a wide range. */
export function assertPageReachable(page: number, range: LogRange): void {
  if (page > DEEP_PAGE && daysBetween(range.from, range.to) > DEEP_PAGE_MAX_DAYS) {
    throw new ValidationError('Choose dates to go further.', 'RANGE_REQUIRED');
  }
}
