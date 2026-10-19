import type { ReasonOption } from '../../../_shared';
import { hmWords } from '../../_shared/lib/timesheet-words';
import type { Overtime } from '../../_shared/types/timesheet-types';

/** The overtime decision (Paper Chapter 8, step 3). You authorise the time; payroll decides pay, so nothing here is money. */

export const DECLINE_REASONS: ReasonOption[] = [
  { key: 'not-agreed', label: 'Not agreed beforehand' },
  { key: 'no-work', label: 'No work was waiting' },
  { key: 'hand-over', label: 'Could have been handed over' },
  { key: 'weekly-limit', label: 'Over the weekly limit' },
  { key: 'early', label: 'Clocked in early, no need' },
  { key: 'twice', label: 'Entered twice' },
  { key: 'time-off', label: 'Taken as time off instead' },
];

/** Needed when the time is above the weekly or branch limit and you authorise it anyway. */
export const OVER_LIMIT_REASONS: ReasonOption[] = [
  { key: 'busy', label: 'Busy service, customers waiting' },
  { key: 'cover', label: 'Covering someone who was away' },
  { key: 'event', label: 'An event or a late delivery' },
];

export const reasonLabels = (options: readonly ReasonOption[]): Record<string, string> => Object.fromEntries(options.map((o) => [o.key, o.label]));

/** "WHY, FROM THE RECORD": what the system saw, counts only. */
export function evidenceLines(item: Overtime): string[] {
  const { evidence } = item;
  const lines: string[] = [];
  if (evidence.openWorkAtEnd) lines.push(`Work was open at the shift end: ${evidence.openOrdersAtEnd} ${evidence.openOrdersAtEnd === 1 ? 'order' : 'orders'}`);
  else lines.push('Nothing was open at the shift end');
  lines.push(`Orders taken in the extra time: ${evidence.ordersTaken}`);
  lines.push(`Tickets cleared in the extra time: ${evidence.ticketsCleared}`);
  if (item.serviceTailMinutes > 0) lines.push(`Service tail the rules allow: ${hmWords(item.serviceTailMinutes)}${item.autoMinutes > 0 ? `, ${hmWords(item.autoMinutes)} of it recognised already` : ''}`);
  return lines;
}

/** "THE LIMITS": the weekly cap and the branch budget, as the rules stand. */
export function limitLines(item: Overtime): string[] {
  const { limits } = item;
  const lines: string[] = [];
  if (limits.weeklyCapMinutes !== null) lines.push(`Their week: ${hmWords(limits.weekMinutes)} of the ${hmWords(limits.weeklyCapMinutes)} limit`);
  else lines.push(`Their week: ${hmWords(limits.weekMinutes)} of overtime so far`);
  if (limits.overCapMinutes > 0) lines.push(`${hmWords(limits.overCapMinutes)} is over the weekly limit`);
  lines.push(
    limits.branchBudgetMinutes !== null
      ? `Branch overtime this month: ${hmWords(limits.branchUsedMinutes)} of ${hmWords(limits.branchBudgetMinutes)}`
      : `Branch overtime this month: ${hmWords(limits.branchUsedMinutes)} so far`
  );
  return lines;
}

/** The "approve part" amount: about half, to the nearest five minutes, only when there is enough to split. */
export function partMinutes(needsMinutes: number): number | null {
  if (needsMinutes < 10) return null;
  const half = Math.floor(needsMinutes / 2 / 5) * 5;
  return half >= 5 && half < needsMinutes ? half : null;
}

export type OvertimeChoice = 'ALL' | 'PART' | 'DECLINE';

/** Whether a reason must be given with this answer, and which list it comes from. */
export function reasonNeeded(choice: OvertimeChoice, insideAllowance: boolean): 'decline' | 'over-limit' | null {
  if (choice === 'DECLINE') return 'decline';
  return insideAllowance ? null : 'over-limit';
}
