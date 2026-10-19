import { ConflictError } from '../../../../utils/errors';

/**
 * The hook Payroll fills in (Segment 2A, E10): a site's new clock cannot be turned off while a payroll month that includes the
 * site is not yet paid, because that month's people are paid on the hours the clock produced. Returns the month keys that hold the
 * site, or an empty list. By default nothing holds a site, so the switch behaves exactly as before.
 */
export type SwitchOffCheck = (siteId: string) => Promise<string[]>;

const nothingHolds: SwitchOffCheck = async () => [];
let check: SwitchOffCheck = nothingHolds;

export const setSwitchOffCheck = (next: SwitchOffCheck | null): void => {
  check = next ?? nothingHolds;
};

export async function assertMaySwitchOff(siteId: string): Promise<void> {
  const months = await check(siteId);
  if (months.length > 0) throw new ConflictError('This branch is in a payroll month that is not paid yet, so its clock cannot be switched off.', 'SITE_IN_UNPAID_PAYROLL', { months });
}
