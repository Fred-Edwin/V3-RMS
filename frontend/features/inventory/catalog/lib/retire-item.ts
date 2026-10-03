import type { ItemChangeReview } from '../../types';
import { trimDecimal } from '../../_shared/lib/item-format';
import type { ReviewBullet } from './item-review';

/** Why an item is retired (Paper step 31). "Other" needs a few words of its own. */
export const RETIRE_REASONS = ['Added twice', 'No longer sold', 'Other'] as const;
export type RetireReason = (typeof RETIRE_REASONS)[number];

export const REASON_MAX = 200;

/**
 * The sentence kept on the history row: "Added twice. Replaced by Brown sugar."
 * The reason is a label, or the typed words for "Other". Returns null when the reason is not ready yet.
 */
export function composeRetireReason(reason: RetireReason | null, otherNote: string, replacedBy: string | null): string | null {
  if (reason === null) return null;
  const base = reason === 'Other' ? otherNote.trim() : reason;
  if (base === '') return null;
  const withStop = /[.!?]$/.test(base) ? base : `${base}.`;
  const sentence = replacedBy ? `${withStop} Replaced by ${replacedBy}.` : withStop;
  return sentence.length > REASON_MAX ? null : sentence;
}

/** The "What this touches" lines: green when nothing moves, amber when something does. */
export function retireTouches(review: ItemChangeReview, usageUnit: string, hasCentralLevel: boolean): ReviewBullet[] {
  const onHand = Number.parseFloat(review.onHandQty);
  const lines: ReviewBullet[] = [
    onHand === 0
      ? { tone: 'safe', text: `No stock on hand: 0 ${usageUnit}.` }
      : { tone: 'change', text: `${trimDecimal(review.onHandQty)} ${usageUnit} is still on hand. The stock stays on record.` },
    review.openOrders === 0
      ? { tone: 'safe', text: 'No open order uses it.' }
      : {
          tone: 'change',
          text: `${review.openOrders === 1 ? 'One open order has' : `${review.openOrders} open orders have`} a line for it. The line stays; no new orders can use the item.`,
        },
  ];
  if (hasCentralLevel) lines.push({ tone: 'change', text: 'It has a Central Store restock level. It will drop off the restock list.' });
  return lines;
}
