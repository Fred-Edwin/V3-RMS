import { registerHomeCard } from '../lib/card-registry';
import { branchKpisCard, todayBoardCard } from './branch-cards';
import { comingUpCard, hrAttentionCard, hrKpisCard, peopleByBranchCard } from './hr-cards';
import { needsYouCard, needsYouPhoneCard, overdueCard } from './needs-you-cards';
import { clockCard, jobCardsCard, teamTodayCard, weekCard } from './phone-cards-defs';
import { companyHeadcountCard, payRunKpisCard } from './payrun-cards';

/**
 * Every Home card that exists. A slice adds its card by writing its definition in `cards/` and listing it here; the page needs no
 * other change. The Orders redo's job cards will be registered here too (and remove the dashed slot).
 */
export const HOME_CARDS = [
  // Desktop, in Paper's order
  hrKpisCard,
  needsYouCard,
  overdueCard,
  hrAttentionCard,
  peopleByBranchCard,
  branchKpisCard,
  todayBoardCard,
  payRunKpisCard,
  companyHeadcountCard,
  comingUpCard,
  // Phone, in Paper's order
  clockCard,
  needsYouPhoneCard,
  jobCardsCard,
  teamTodayCard,
  weekCard,
] as const;

let registered = false;

/** Registers the cards once. Safe to call from every render path; a second call does nothing. */
export function registerHomeCards(): void {
  if (registered) return;
  registered = true;
  for (const card of HOME_CARDS) registerHomeCard(card);
}
