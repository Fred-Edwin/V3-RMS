import { scopeOf, type AccessSubject, type Capability } from '../_shared/workforce-access';
import type { NeedsYouContext } from './needs-you-types';

/**
 * The sites a person may act on for one action capability, among the sites whose new clock is on. `null` = the person does not hold
 * the capability at all (the source returns nothing). An empty list = they hold it but none of their sites is switched on.
 * Sources filter by the action capability and its scope, never by role name, so the access table stays the one authority.
 */
export function sitesFor(subject: AccessSubject, capability: Capability, ctx: NeedsYouContext): string[] | null {
  const scope = scopeOf(subject, capability);
  if (scope === null) return null;
  if (scope === 'all') return [...ctx.enabledSiteIds];
  if (scope === 'own' || subject.siteId === null) return [];
  return ctx.enabledSiteIds.includes(subject.siteId) ? [subject.siteId] : [];
}

/** True when the person holds the capability with company-wide reach (a head-office role). */
export const reachesCompany = (subject: AccessSubject, capability: Capability): boolean => scopeOf(subject, capability) === 'all';

export const DAY_MS = 86_400_000;
/** An item is overdue after 3 days waiting (6b N4, SD24). */
export const OVERDUE_DAYS = 3;
