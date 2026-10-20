/**
 * THE door of Needs you (6b). Leave (Segment 4) and Conduct (Segment 5) plug in without editing this module:
 *
 *   registerNeedsYouSource(source: NeedsYouSource)   call once at start-up; ids are unique, a repeat replaces the earlier one
 *
 * A source lists (and may count) rows from its OWN table, filtered by the viewer's ACTION capability and scope, for the sites in
 * `ctx.enabledSiteIds` only. Row ids are `<kind>:<record id>`; a row exists only while the item waits. See needs-you-types.ts.
 */
export { default as workforceNeedsYouRouter } from './needs-you-routes';
export { registerNeedsYou } from './register-needs-you';
export { registerNeedsYouSource, registeredSources } from './sources/registry';
export { BADGE_KEYS, type BadgeKey, type BadgeCounts, type NeedsYouContext, type NeedsYouRow, type NeedsYouSource } from './needs-you-types';
export { sitesFor, reachesCompany } from './needs-you-scope';
export { contextFor } from './needs-you-service'; // a source's own badge endpoint (Conduct's GET /badge) builds the same context the card uses
