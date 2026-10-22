/**
 * Needs you (Segment 6a): the menu badges. The Home table and the paged "See all" list live in `home/role-home`; the cards that used
 * to sit here (Needs you, Overdue) were replaced by them in batch 2A. Other features import from here only. See README.md.
 */
export { useNeedsYouBadges, useNeedsYouMenuCounts, type NeedsYouMenuCounts } from './hooks/use-needs-you-badges';
export { badgeText, badgeSpoken } from './lib/needs-you-words';
export type { NeedsYouBadgeKey, NeedsYouBadges, NeedsYouList, NeedsYouRow, OverdueList, OverdueRow } from './types/needs-you-types';
