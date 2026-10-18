import { registerHomeCard } from '../lib/card-registry';
import { branchKpisCard, todayBoardCard, waitingDesktopCard } from './branch-cards';
import { comingUpCard, hrAttentionCard, hrKpisCard, peopleByBranchCard } from './hr-cards';
import { clockCard, jobCardsCard, teamTodayCard, waitingPhoneCard, weekCard } from './phone-cards-defs';
import { companyHeadcountCard, overdueApprovalsCard, payRunKpisCard, payRunStepsCard } from './payrun-cards';
import { attendanceSwitchCard } from './switch-card';

/**
 * Every Home card that exists. A slice adds its card by writing its definition in `cards/` and listing it here; the page needs no
 * other change. The Orders redo's job cards will be registered here too (and remove the dashed slot).
 */
export const HOME_CARDS = [
  // Desktop, in Paper's order
  hrKpisCard,
  hrAttentionCard,
  peopleByBranchCard,
  branchKpisCard,
  todayBoardCard,
  waitingDesktopCard,
  payRunKpisCard,
  payRunStepsCard,
  overdueApprovalsCard,
  companyHeadcountCard,
  comingUpCard,
  attendanceSwitchCard,
  // Phone, in Paper's order
  clockCard,
  waitingPhoneCard,
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
