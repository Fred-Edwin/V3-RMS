/**
 * Needs you (Segment 6a): the card on each Home, the menu badges and the Director's Overdue list. Other features import from here only.
 * Leave and Conduct register their rows on the server; nothing here changes when they do. See README.md.
 */
export { NeedsYouCard } from './components/needs-you-card';
export { OverdueCard } from './components/overdue-card';
export { useNeedsYou, type NeedsYouState } from './hooks/use-needs-you';
export { useNeedsYouBadges, useNeedsYouMenuCounts, type NeedsYouMenuCounts } from './hooks/use-needs-you-badges';
export { useOverdue, type OverdueState } from './hooks/use-overdue';
export { badgeText, badgeSpoken } from './lib/needs-you-words';
export type { NeedsYouBadgeKey, NeedsYouBadges, NeedsYouList, NeedsYouRow, OverdueList, OverdueRow } from './types/needs-you-types';
