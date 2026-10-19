import { nairobiDateOf, type NairobiDate } from '../../_shared/time/nairobi-time';

/** What the system knows about one site's move to the new Payroll. */
export interface SiteCoverage {
  switchEnabled: boolean;
  switchEnabledAt: Date | null;
  /** The earliest payroll month that includes the site (YYYY-MM), or null when it never appeared in one. */
  firstPayrollMonth: string | null;
}

export const isPayPeriod = (value: string): boolean => /^\d{4}-(0[1-9]|1[0-2])$/.test(value);

/**
 * E10, P1: is this site's month paid by the new Payroll (so the old payslip run must leave it alone)?
 *  - a site that has appeared in a payroll month stays on the new system for that month and every month after it, even if its
 *    attendance switch is turned off later (`siteEverOnNewPayroll`);
 *  - a site whose switch is on and was on from the first day of the month is paid by the new system even before that month is
 *    calculated, so that nobody starts an old payslip the new system will also pay;
 *  - every other month (before the switch, or a site that never switched) stays with the old run, untouched.
 */
export function coversPeriod(coverage: SiteCoverage, payPeriod: string): boolean {
  if (!isPayPeriod(payPeriod)) return false;
  if (coverage.firstPayrollMonth !== null && payPeriod >= coverage.firstPayrollMonth) return true;
  if (!coverage.switchEnabled || coverage.switchEnabledAt === null) return false;
  const switchedOn: NairobiDate = nairobiDateOf(coverage.switchEnabledAt);
  return switchedOn <= `${payPeriod}-01`;
}
