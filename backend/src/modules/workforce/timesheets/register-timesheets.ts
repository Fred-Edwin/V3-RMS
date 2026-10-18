import { setPeriodClosedCheck } from '../attendance/fixes/period-lock';
import { periodsRepository } from './periods/periods-repository';

/**
 * Slice 4a's answer to the hook slice 3 left: a day in a closed timesheet period cannot be fixed (PERIOD_CLOSED). HR
 * changes it by reopening the period with a reason. Only sites with the new clock have periods, so every other site
 * answers "not closed" and nothing changes for it. Called once at start-up, next to `registerPeople`.
 */
export function registerTimesheets(): void {
  setPeriodClosedCheck(async ({ siteId, date }) => (await periodsRepository.closedCovering(siteId, date)) !== null);
}
