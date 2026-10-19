import { ConflictError } from '../../../../utils/errors';
import type { NairobiDate } from '../../_shared/time/nairobi-time';
import type { AccessSubject } from '../../_shared/workforce-access';

/**
 * The hook Timesheets fill in. Once the site's manager has approved a month, no one fixes a day in it: the answer is "ask HR to
 * correct the payslip" (Segment 1A; HR's reopen is gone). Before approval the Branch Manager fixes alone. Sites with the old
 * clock have no timesheets, so by default no day is ever approved. Timesheets registers the real answer with `setPeriodClosedCheck`.
 */
export type PeriodClosedCheck = (args: { siteId: string; employeeId: string; date: NairobiDate }) => Promise<boolean>;

const neverClosed: PeriodClosedCheck = async () => false;
let check: PeriodClosedCheck = neverClosed;

export const setPeriodClosedCheck = (next: PeriodClosedCheck | null): void => {
  check = next ?? neverClosed;
};

/** Segment 1A: nobody fixes a day in an approved month, HR included; the correction is made on the payslip. */
export async function assertPeriodOpen(_subject: AccessSubject, args: { siteId: string; employeeId: string; date: NairobiDate }): Promise<void> {
  if (await check(args)) {
    throw new ConflictError('This month is approved. Ask HR to correct the payslip.', 'PERIOD_APPROVED', { date: args.date });
  }
}
