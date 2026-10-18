import { ConflictError } from '../../../../utils/errors';
import type { NairobiDate } from '../../_shared/time/nairobi-time';
import type { AccessSubject } from '../../_shared/workforce-access';

/**
 * The hook for slice 4. Timesheets close a pay period; once a day is in a closed period only HR may change its time
 * (Chapter 7, step 6: "After the period closes only HR can change this, with a reason"). Slice 3 builds no
 * timesheets, so by default no day is ever closed. Slice 4 registers the real answer with `setPeriodClosedCheck`.
 */
export type PeriodClosedCheck = (args: { siteId: string; employeeId: string; date: NairobiDate }) => Promise<boolean>;

const neverClosed: PeriodClosedCheck = async () => false;
let check: PeriodClosedCheck = neverClosed;

export const setPeriodClosedCheck = (next: PeriodClosedCheck | null): void => {
  check = next ?? neverClosed;
};

export async function assertPeriodOpen(subject: AccessSubject, args: { siteId: string; employeeId: string; date: NairobiDate }): Promise<void> {
  if (subject.role === 'HR_MANAGER') return;
  if (await check(args)) {
    throw new ConflictError('That pay period is closed. Only HR can change it, with a reason.', 'PERIOD_CLOSED', { date: args.date });
  }
}
