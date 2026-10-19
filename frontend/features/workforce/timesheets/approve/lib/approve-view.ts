import { monthName } from '../../_shared/lib/month-words';
import type { MonthView } from '../../_shared/types/month-types';

/** Why the Approve button cannot be used yet, or null when the month can be signed (spec S7, D1 and D5). */
export function approveBlock(month: Pick<MonthView, 'monthKey' | 'needsYou' | 'kpis' | 'state'>): string | null {
  if (month.state === 'APPROVED') return 'This month is already approved.';
  if (month.state === 'OPEN') return `${monthName(month.monthKey)} has not ended yet.`;
  if (month.kpis.headcount === 0) return `Nobody worked in ${monthName(month.monthKey)}, so there is nothing to approve.`;
  if (month.needsYou.total > 0) return `Decide the ${month.needsYou.total} ${month.needsYou.total === 1 ? 'thing' : 'things'} first.`;
  return null;
}

/** The server's refusal codes of the approve call, in the spec's words. Anything else shows the server's own sentence. */
export function approveWords(code: string, fallback: string): string {
  switch (code) {
    case 'INVALID_PIN':
      return 'That PIN is not right.';
    case 'CHANGED_UNDERNEATH':
      return 'Something changed while you were looking. The numbers above are updated. Check them and try again.';
    case 'NEEDS_YOU_REMAINS':
      return 'Something still needs you. The numbers above are updated.';
    case 'PIN_NOT_SET':
      return 'Set your PIN first. Open your profile and choose Set PIN.';
    case 'NOTHING_TO_APPROVE':
      return 'Nobody worked in this month, so there is nothing to approve.';
    case 'MONTH_NOT_ENDED':
      return 'This month has not ended yet.';
    default:
      return fallback || 'That did not go through. Nothing was changed.';
  }
}

/** The reason under the page's Approve button while the month is still open (spec S1, D5): "October ends on 31 Oct. You can approve from 1 Nov." */
export function notYetReason(month: string, lastDay: string, firstApprovalDay: string): string {
  const short = (d: string): string => `${Number(d.slice(8, 10))} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(d.slice(5, 7)) - 1]}`;
  return `${month} ends on ${short(lastDay)}. You can approve from ${short(firstApprovalDay)}.`;
}
