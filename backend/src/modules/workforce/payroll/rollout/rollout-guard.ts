import { rolloutRepository } from './rollout-repository';
import { coversPeriod } from './rollout-rules';

/**
 * The one door the old payslip code asks (E10): is this site's month, `YYYY-MM`, paid by the new Payroll? When it is, the old
 * code refuses to save, publish or revert (`PAID_IN_NEW_PAYROLL`). The check fails closed: if the answer cannot be read the
 * error goes up and the old action does not happen, because paying someone twice is worse than a retry.
 */
export async function isSitePeriodOnNewPayroll(siteId: string, payPeriod: string): Promise<boolean> {
  return coversPeriod(await rolloutRepository.coverage(siteId), payPeriod);
}
