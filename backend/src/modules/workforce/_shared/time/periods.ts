import type { WeekAndBreaksRules } from '../../rules/rules-schemas';
import { addDays, daysBetween, parseNairobiDate, type NairobiDate } from './nairobi-time';

export type PeriodRule = WeekAndBreaksRules['timesheetPeriod'];

export interface Period {
  start: NairobiDate;
  end: NairobiDate; // inclusive
  label: string; // '21 Sep to 18 Oct 2026' or 'October 2026'
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const;

const partsOf = (date: NairobiDate): { year: number; month: number; day: number } => {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  return { year, month, day };
};

const shortDate = (date: NairobiDate, withYear: boolean): string => {
  const { year, month, day } = partsOf(date);
  return `${day} ${MONTHS[month - 1]}${withYear ? ` ${year}` : ''}`;
};

const rangeLabel = (start: NairobiDate, end: NairobiDate): string =>
  partsOf(start).year === partsOf(end).year ? `${shortDate(start, false)} to ${shortDate(end, true)}` : `${shortDate(start, true)} to ${shortDate(end, true)}`;

/**
 * Rule: FIXED_WEEKS cuts the calendar into blocks of `weeks` weeks counted from `anchorDate` (the anchor is itself a
 * week start; the rule schema enforces that it falls on weekStartsOn), forwards and backwards. CALENDAR_MONTH is the
 * first to the last day of the month. Example only: Mon 21 Sep 2026, 4 weeks gives 21 Sep to 18 Oct, then 19 Oct to 15 Nov.
 * Feeds on: week.timesheetPeriod.
 */
export function periodContaining(date: NairobiDate, rule: PeriodRule): Period {
  if (rule.kind === 'CALENDAR_MONTH') {
    const { year, month } = partsOf(date);
    const start = parseNairobiDate(`${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-01`);
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const end = parseNairobiDate(`${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`);
    return { start, end, label: `${MONTH_NAMES[month - 1]} ${year}` };
  }
  const length = rule.weeks * 7;
  const anchor = parseNairobiDate(rule.anchorDate);
  const index = Math.floor(daysBetween(anchor, date) / length);
  const start = addDays(anchor, index * length);
  const end = addDays(start, length - 1);
  return { start, end, label: rangeLabel(start, end) };
}

export function periodsBetween(from: NairobiDate, to: NairobiDate, rule: PeriodRule): Period[] {
  const periods: Period[] = [];
  let current = periodContaining(from, rule);
  while (current.start <= to) {
    periods.push(current);
    current = periodContaining(addDays(current.end, 1), rule);
  }
  return periods;
}

export function isInPeriod(date: NairobiDate, period: Period): boolean {
  return date >= period.start && date <= period.end;
}
