import { CORRECTION_REASON_TEXT, type CorrectionReason } from './_shared/branch-day-contract';

/**
 * The sentences of the Activity tab (Paper B12b) and the Audit log source `BRANCH_DAY` (B17), contract §9. One file so the two cannot
 * drift. Pure: no database. Names appear because a record states who did what; the Audit log's sentences carry no money and no PIN
 * (the owner's ruling for this build), the Activity tab's closed-day sentence carries the Used value for a holder of `catalog.see_costs`.
 */

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

export const describeOpeningAccepted = (departmentName: string): string => `Checked the opening: ${departmentName}, same as last night`;

/** One difference names the item and the move ("Milk 1L, 1 less than last night (8 → 7)"); several count them. */
export const describeOpeningRecounted = (departmentName: string, differences: { itemName: string; lastNightQty: string; countedQty: string }[]): string => {
  const [only] = differences;
  if (differences.length === 0) return `Recorded the opening: ${departmentName}, same as last night`;
  if (differences.length === 1 && only) {
    const move = Number(only.countedQty) - Number(only.lastNightQty);
    const size = Math.abs(Math.round(move * 10000) / 10000);
    return `Recorded the opening: ${only.itemName}, ${size} ${move < 0 ? 'less' : 'more'} than last night (${only.lastNightQty} → ${only.countedQty})`;
  }
  return `Recorded the opening: ${departmentName}, ${differences.length} differences`;
};

export const describeCountSigned = (departmentName: string, itemCount: number, onBehalf: boolean): string =>
  onBehalf ? `Counted and signed on behalf of ${departmentName}: ${plural(itemCount, 'item', 'items')}` : `Counted and signed: ${departmentName}, ${plural(itemCount, 'item', 'items')}`;

/** `usedValueText` is "KES 50,060" for a reader who may see money, else null. */
export const describeDayClosed = (usedValueText: string | null): string => (usedValueText ? `Closed the day · Used today ${usedValueText}` : 'Closed the day');

export const describeCountCorrected = (itemName: string, departmentName: string, from: string, to: string): string =>
  `Corrected a count: ${itemName} (${departmentName}), closing stock ${from} → ${to}`;

export const describeCorrectionDetail = (reason: CorrectionReason, note: string | null, signedWithPin: boolean): string =>
  [`Reason: ${CORRECTION_REASON_TEXT[reason].toLowerCase()}.`, note ? `Note: ${note}` : null, signedWithPin ? 'Signed with PIN.' : null].filter((s): s is string => s !== null).join(' ');

/** "KES 50,060" for the whole shillings, with cents only when there are any. */
export const kesText = (amount: string): string => {
  const [whole = '0', cents = '00'] = amount.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return cents === '00' ? `KES ${grouped}` : `KES ${grouped}.${cents}`;
};
