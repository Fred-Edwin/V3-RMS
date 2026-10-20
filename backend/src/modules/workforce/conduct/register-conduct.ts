import { registerNeedsYouSource } from '../needs-you';
import { conductNeedsYouSource } from './needs-you/conduct-source';

/**
 * Conduct's start-up hook, called once next to `registerNeedsYou`: its rows (notices to sign, notices to record, appeals waiting)
 * join the Home card and the menu badge without any file in Needs you changing.
 */
export function registerConduct(): void {
  registerNeedsYouSource(conductNeedsYouSource);
}
