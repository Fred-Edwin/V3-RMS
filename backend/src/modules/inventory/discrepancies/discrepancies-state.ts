import { Prisma } from '@prisma/client';
import { FINDINGS_FOR, FINDING_PROFILE, type Finding, type GapDirection, type LossKind } from './_shared/discrepancies-contract';

/**
 * What a finding does, as pure functions (docs/features/inventory/discrepancies.md, "What happens after the branch signs"),
 * table-tested in `discrepancies-state.test.ts`. Nothing here reads the database or the clock.
 *
 * The gap is `counted − sent`, signed: negative short, positive extra. While it is held as unaccounted it is in neither the store's
 * stock (the DISPATCH_OUT took what was SENT) nor the department's (the DISPATCH_IN brought what was COUNTED). A finding then says
 * where it went:
 *
 *   short, packed short at the store    store +gap          (an error, not a loss)
 *   short, lost or damaged              no stock moves      written off at the cost frozen at dispatch (the units already left)
 *   short, branch counted wrong         department +gap     (all of it arrived)
 *   short, can't tell                   no stock moves      written off, unexplained
 *   extra, packed more than recorded    store −gap          (an error)
 *   extra, branch counted wrong         department −gap
 *   extra, can't tell                   no stock moves      taken in, unexplained
 *
 * A reversal is the exact opposite entry for each row, so the gap is held again.
 */

export const directionOfGap = (gap: Prisma.Decimal): GapDirection => (gap.isNegative() ? 'SHORT' : 'EXTRA');

export const isFindingAllowed = (direction: GapDirection, finding: Finding): boolean => FINDINGS_FOR[direction].includes(finding);

export type Place = 'CENTRAL_STORE' | 'DEPARTMENT';

/** The ledger entries a finding posts: one `ADJUSTMENT` per place, signed. Empty when the finding only classifies the gap. */
export const postingsOf = (finding: Finding, gap: Prisma.Decimal): Array<{ place: Place; quantity: Prisma.Decimal }> => {
  const size = gap.abs();
  const short = gap.isNegative();
  switch (finding) {
    case 'PACKED_SHORT':
      return short ? [{ place: 'CENTRAL_STORE', quantity: size }] : [];
    case 'PACKED_MORE':
      return short ? [] : [{ place: 'CENTRAL_STORE', quantity: size.negated() }];
    case 'BRANCH_COUNTED_WRONG':
      // Short: all of it arrived, so the department is corrected up. Extra: it never held that much, so it is corrected down.
      return [{ place: 'DEPARTMENT', quantity: short ? size : size.negated() }];
    case 'LOST_OR_DAMAGED':
    case 'CANT_TELL':
      return [];
  }
};

export const lossKindOf = (finding: Finding): LossKind => FINDING_PROFILE[finding].lossKind;

/** The value of a LOSS finding at the cost frozen at dispatch, KES with 2 decimals; null for an error or a correction. */
export const lossValueOf = (finding: Finding, gap: Prisma.Decimal, unitCost: Prisma.Decimal): Prisma.Decimal | null =>
  lossKindOf(finding) === 'LOSS' ? gap.abs().mul(unitCost).toDecimalPlaces(2) : null;

/** What the gap is worth while it is held, at the cost frozen at dispatch. */
export const heldValueOf = (gap: Prisma.Decimal, unitCost: Prisma.Decimal): Prisma.Decimal => gap.abs().mul(unitCost).toDecimalPlaces(2);

/** The rows of the preview (Paper D15), in the order stock moves: the places that change, then the write-off. */
export const effectRowsOf = (finding: Finding, gap: Prisma.Decimal): Array<{ place: Place | 'WRITTEN_OFF'; quantity: Prisma.Decimal }> => {
  const rows: Array<{ place: Place | 'WRITTEN_OFF'; quantity: Prisma.Decimal }> = postingsOf(finding, gap);
  if (lossKindOf(finding) === 'LOSS') rows.push({ place: 'WRITTEN_OFF', quantity: gap.isNegative() ? gap : gap.abs() });
  return rows;
};

/** A status counts as Open on the list while the gap is held: OPEN, and REVERSED (the instant before it goes back to OPEN). */
export const isHeld = (status: 'OPEN' | 'RECORDED' | 'REVERSED'): boolean => status !== 'RECORDED';

/** 24 hours without a finding, then once a day: due when no reminder went yet and it is 24 hours old, or the last one is 24 hours old. */
export const reminderDue = (f: { since: Date; reminderSentAt: Date | null }, now: Date, afterHours: number): boolean => {
  const limit = afterHours * 60 * 60 * 1000;
  const last = f.reminderSentAt ?? f.since;
  return now.getTime() - last.getTime() >= limit;
};
