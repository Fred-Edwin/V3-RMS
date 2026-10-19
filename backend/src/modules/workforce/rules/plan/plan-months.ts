import { monthKey, nairobiToday, parseNairobiDate, type NairobiDate } from '../../_shared/time/nairobi-time';

/**
 * "A change never alters an approved or paid month" (D11). Which months are approved is a Timesheets/Payroll fact that the
 * rules store must not read directly, so the answer comes through this small interface.
 *
 * The month-approval status of the Timesheets rework is not merged yet. Until it is, the DEFAULT guard is deliberately safe:
 * it treats every month before the current Nairobi calendar month as approved and the current month as open. So a Statutory
 * rate can never start earlier than the first day of this month, and nothing else can start in the past at all. When the
 * real status ships, it calls `setApprovedMonthGuard` once at start-up and nothing else here changes.
 */
export interface ApprovedMonthGuard {
  /** First day of the earliest month that is not yet approved for this company. */
  firstOpenMonthStart(companyId: string, now: Date): Promise<NairobiDate>;
  /** Is the month holding this day approved (or paid)? */
  isMonthApproved(companyId: string, day: NairobiDate): Promise<boolean>;
}

const defaultGuard: ApprovedMonthGuard = {
  firstOpenMonthStart: async (_companyId, now) => parseNairobiDate(`${monthKey(nairobiToday(now))}-01`),
  isMonthApproved: async (_companyId, _day) => false,
};

let guard: ApprovedMonthGuard = defaultGuard;

export const setApprovedMonthGuard = (next: ApprovedMonthGuard): void => {
  guard = next;
};

export const approvedMonths = (): ApprovedMonthGuard => guard;
