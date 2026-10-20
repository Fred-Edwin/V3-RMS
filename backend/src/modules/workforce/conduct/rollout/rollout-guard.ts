import { ConflictError } from '../../../../utils/errors';
import { switchRepository } from '../../attendance/switch/switch-repository';

/**
 * The one door the old HR disciplinary code asks (C1): does this site record conduct in the new Conduct? A site is on the new
 * Conduct the day its Attendance switch is on (the notice facts come from the new timesheets, which exist only there). Fails
 * closed: if the answer cannot be read the error goes up and the old action does not happen.
 */
export const isSiteOnNewConduct = (siteId: string): Promise<boolean> => switchRepository.isEnabled(siteId);

/** The old create and acknowledge calls run this first. The old list stays readable; nothing legacy is changed or copied. */
export async function refuseLegacyConductWhenSwitched(siteId: string): Promise<void> {
  if (await isSiteOnNewConduct(siteId)) throw new ConflictError('This site records conduct in the new Conduct.', 'CONDUCT_IN_NEW_SYSTEM');
}
