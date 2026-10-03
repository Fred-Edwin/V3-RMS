import type { ItemChangeReview } from '../types';
import { trimDecimal } from './item-format';
import type { ItemEditPlan } from './item-form-model';

/** One "What happens" line: `safe` = nothing moves (green dot), `change` = something new from now on (amber dot). */
export interface ReviewBullet {
  tone: 'safe' | 'change';
  text: string;
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** Counts from the change-review endpoint, turned into the sentences under "What happens". */
function historyBullets(review: ItemChangeReview, usageUnit: string): ReviewBullet[] {
  if (!review.hasHistory) {
    return [
      { tone: 'safe', text: 'No stock has been counted for this item yet, so no figures change.' },
      { tone: 'safe', text: 'No receipts yet. Nothing in the item history is affected.' },
    ];
  }
  const onHand = Number.parseFloat(review.onHandQty);
  const stock =
    onHand !== 0
      ? `Stock stays in ${usageUnit}. The ${trimDecimal(review.onHandQty)} ${usageUnit} on hand does not change.`
      : `Stock stays in ${usageUnit}. Nothing on hand changes.`;
  const receipts =
    review.receipts > 0
      ? `Past receipts keep their numbers. ${plural(review.receipts, 'receipt', 'receipts')} with this item stay as recorded.`
      : 'No receipts yet. Nothing in the item history is affected.';
  return [
    { tone: 'safe', text: stock },
    { tone: 'safe', text: receipts },
  ];
}

const openOrdersText = (n: number, perUnit: string): string =>
  n === 0 ? 'No open order uses this item.' : `${plural(n, 'open order', 'open orders')} will show ${n === 1 ? 'its' : 'their'} ${perUnit}.`;

export function editReviewBullets(plan: ItemEditPlan, review: ItemChangeReview): ReviewBullet[] {
  const { buyUnit, usageUnit, holds } = plan.after;
  const bullets = historyBullets(review, usageUnit);
  const packChanged = plan.risky.some((row) => row.what === 'Pack' || row.what === 'Units');
  const typeChanged = plan.risky.find((row) => row.what === 'Type');
  if (packChanged) {
    const each = `${buyUnit}s at ${holds ? trimDecimal(holds) : '1'} ${usageUnit} each`;
    bullets.push({
      tone: 'change',
      text: `From now on a ${buyUnit} counts as ${holds ? trimDecimal(holds) : '1'} ${usageUnit} on new orders and receipts. ${openOrdersText(review.openOrders, each)}`,
    });
  }
  if (typeChanged) {
    bullets.push({ tone: 'change', text: `From now on it is counted as ${typeChanged.after.toLowerCase()}, not ${typeChanged.now.toLowerCase()}. Where it can be used follows the type.` });
  }
  return bullets;
}

export function retireReviewBullets(review: ItemChangeReview): ReviewBullet[] {
  return [
    {
      tone: 'safe',
      text: review.hasHistory
        ? `History stays: ${plural(review.stockEntries, 'stock entry', 'stock entries')} and ${plural(review.receipts, 'receipt', 'receipts')}.`
        : 'No stock or receipts yet, so there is no history to keep.',
    },
    { tone: 'safe', text: 'Restore it any time from Show retired.' },
    {
      tone: 'change',
      text:
        review.openOrders > 0
          ? `${plural(review.openOrders, 'open order', 'open orders')} keep ${review.openOrders === 1 ? 'its' : 'their'} lines. No new order can include it.`
          : 'No open order uses this item. New orders will not offer it.',
    },
  ];
}
