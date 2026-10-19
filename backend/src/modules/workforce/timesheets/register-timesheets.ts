import { setPeriodClosedCheck } from '../attendance/fixes/period-lock';
import { periodsRepository } from './periods/periods-repository';

/**
 * Timesheets' answer to the hook slice 3 left: a day in an approved month cannot be fixed (PERIOD_APPROVED, "ask HR to correct
 * the payslip"). Before approval the Branch Manager fixes alone. Only sites with the new clock have months, so every other
 * site answers "not approved" and nothing changes for it. Called once at start-up, next to `registerPeople`.
 */
export function registerTimesheets(): void {
  setPeriodClosedCheck(async ({ siteId, date }) => (await periodsRepository.approvedCovering(siteId, date)) !== null);
}
