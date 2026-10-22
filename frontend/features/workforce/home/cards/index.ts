import { registerHomeCard } from '../lib/card-registry';
import { clockCard, jobCardsCard, teamTodayCard, weekCard } from './phone-cards-defs';

/**
 * The action cards Role Home puts under the number cards on a phone (clock, job cards slot, team today, this week). The old desktop
 * cards (HR numbers, Needs you, Overdue, attention, people by branch, branch numbers, today board, pay run numbers, headcount, payslip
 * opens, coming up) were replaced by Role Home's number cards, "Needs you" table and "Latest" list in batch 2A and are deleted.
 * The Orders redo's job cards will be registered here too (and remove the dashed slot).
 */
export const HOME_CARDS = [clockCard, jobCardsCard, teamTodayCard, weekCard] as const;

let registered = false;

/** Registers the cards once. Safe to call from every render path; a second call does nothing. */
export function registerHomeCards(): void {
  if (registered) return;
  registered = true;
  for (const card of HOME_CARDS) registerHomeCard(card);
}
