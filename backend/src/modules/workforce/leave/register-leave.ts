import { eachDay } from '../_shared/time/nairobi-time';
import { registerNeedsYouSource } from '../needs-you';
import { registerLeaveLookup } from '../rota/warnings/leave-lookup';
import { applicationsRepository } from './data/applications-repository';
import { leaveNeedsYouSource } from './reads/needs-you-source';

let registered = false;

/**
 * Called once at start-up (routes/index.ts). Plugs Leave into the three places that were waiting for it: the rota's approved-leave
 * lookup (its "needs an override reason" warning and the copy clash), the Needs you card and menu badge, and nothing else. Safe to
 * call twice.
 */
export function registerLeave(): void {
  if (registered) return;
  registered = true;
  registerLeaveLookup(async (employeeIds, from, to) => {
    const lookup = new Map<string, Set<string>>();
    for (const app of await applicationsRepository.approvedForPeople(employeeIds, from, to)) {
      const days = lookup.get(app.employeeId) ?? new Set<string>();
      for (const day of eachDay(app.start < from ? from : app.start, app.end > to ? to : app.end)) days.add(day);
      lookup.set(app.employeeId, days);
    }
    return lookup;
  });
  registerNeedsYouSource(leaveNeedsYouSource);
}
