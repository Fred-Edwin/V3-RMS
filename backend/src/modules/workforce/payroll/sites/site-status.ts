import { addDays, nairobiDateOf, type NairobiDate } from '../../_shared/time/nairobi-time';
import { LATE_APPROVAL_AFTER_DAYS, REMINDER_COOLDOWN_HOURS } from '../engine/payroll-constants';
import { daysSinceMonthEnd, monthHasEnded, type MonthWindow } from '../months/month-calendar';

export type SiteTimesheetState = 'OPEN' | 'TO_APPROVE' | 'APPROVED' | 'NOT_ON_NEW_SYSTEM';

export interface SiteFacts {
  siteId: string;
  name: string;
  switchedOnAt: Date | null; // the attendance switch is on, since
  everInPayroll: boolean; // the site has appeared in a payroll month: it never goes back to the old run
  period: { state: 'OPEN' | 'CLOSING' | 'CLOSED' | 'APPROVED'; approvedAt: Date | null; approvedById: string | null; documentNumber: number | null } | null;
  headcount: number;
}

export interface SiteRow {
  siteId: string;
  name: string;
  headcount: number;
  timesheetState: SiteTimesheetState;
  approvedAt: string | null;
  approvedById: string | null;
  documentNumber: string | null;
  waitingSince: string | null;
  waitingDays: number;
  lastReminderAt: string | null;
  canRemindNow: boolean;
  canApproveLate: boolean;
}

/**
 * E10: a site is in the month when its switch was on from the month's first day (or it has already been in a payroll month), and its
 * timesheet month is what the month waits for. Every other site is shown as paid by the old payslips and counts for nothing.
 */
export const isCandidate = (facts: Pick<SiteFacts, 'switchedOnAt' | 'everInPayroll'>, window: MonthWindow): boolean =>
  facts.everInPayroll || (facts.switchedOnAt !== null && nairobiDateOf(facts.switchedOnAt) <= window.first);

const docCode = (n: number | null): string | null => (n === null ? null : `TSH-${String(n).padStart(4, '0')}`);

export function classifySites(facts: readonly SiteFacts[], window: MonthWindow, today: NairobiDate, reminders: ReadonlyMap<string, Date>, now: Date): SiteRow[] {
  const ended = monthHasEnded(window, today);
  const waitingDays = daysSinceMonthEnd(window, today);
  return facts.map((site): SiteRow => {
    const base = { siteId: site.siteId, name: site.name, headcount: site.headcount, documentNumber: null, approvedAt: null, approvedById: null, waitingSince: null, waitingDays: 0, lastReminderAt: null, canRemindNow: false, canApproveLate: false };
    if (!isCandidate(site, window)) return { ...base, timesheetState: 'NOT_ON_NEW_SYSTEM' };
    if (site.period?.state === 'APPROVED') {
      return { ...base, timesheetState: 'APPROVED', approvedAt: site.period.approvedAt?.toISOString() ?? null, approvedById: site.period.approvedById, documentNumber: docCode(site.period.documentNumber) };
    }
    const last = reminders.get(site.siteId) ?? null;
    const cooled = last === null || now.getTime() - last.getTime() >= REMINDER_COOLDOWN_HOURS * 3_600_000;
    return {
      ...base,
      timesheetState: ended ? 'TO_APPROVE' : 'OPEN',
      waitingSince: ended ? addDays(window.last, 1) : null,
      waitingDays: ended ? waitingDays : 0,
      lastReminderAt: last?.toISOString() ?? null,
      canRemindNow: ended && cooled,
      canApproveLate: ended && waitingDays > LATE_APPROVAL_AFTER_DAYS,
    };
  });
}

/** The month's first-stage numbers: sites on the new system, and how many of them have approved. */
export const approvalCount = (rows: readonly SiteRow[]): { approved: number; total: number; people: number; peopleApproved: number } => {
  const on = rows.filter((row) => row.timesheetState !== 'NOT_ON_NEW_SYSTEM');
  const done = on.filter((row) => row.timesheetState === 'APPROVED');
  return { approved: done.length, total: on.length, people: on.reduce((t, r) => t + r.headcount, 0), peopleApproved: done.reduce((t, r) => t + r.headcount, 0) };
};
