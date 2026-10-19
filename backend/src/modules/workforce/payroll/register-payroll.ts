import { setSwitchOffCheck } from '../attendance/switch/switch-off-check';
import { rolloutRepository } from './rollout/rollout-repository';

/**
 * Payroll's answer to the hook the attendance switch left (E10): a branch's new clock cannot be switched off while a payroll month
 * that includes it is not paid. Called once at start-up, next to `registerTimesheets`.
 */
export function registerPayroll(): void {
  setSwitchOffCheck((siteId) => rolloutRepository.unpaidMonthKeys(siteId));
}
