import { Prisma, type InventoryTransactionType } from '@prisma/client';

// ---------------------------------------------------------------------------
// The ledger's rules per movement type: which way the quantity points and
// which source link the row must carry. One table, so the door, its tests and
// the README cannot drift apart. Checked against the 11 writers that existed
// on 4 Oct 2026 (receiving, prep, count, dispatch, discrepancy, waste, branch day).
// ---------------------------------------------------------------------------

/** The columns of `inventory_transactions` that say which document a row came from. */
export const LEDGER_LINKS = [
  'purchaseDeliveryLineId', // Purchasing: one received delivery line
  'prepRecordId',
  'wasteLogId',
  'stockCountLineId',
  'countLineId', // the Counting rebuild: one line of a signed count
  'branchDayLineId',
  'openingLineId',
  'dispatchLineId',
  'marketPurchaseLineId',
] as const;

export type LedgerLink = (typeof LEDGER_LINKS)[number];

/** `IN` rows add stock, `OUT` rows remove it, `SIGNED` rows (adjustments) go either way. */
export type LedgerDirection = 'IN' | 'OUT' | 'SIGNED';

export type LedgerRule = {
  direction: LedgerDirection;
  /** Exactly one of these must be set on the row. */
  links: readonly LedgerLink[];
  /** Only ADJUSTMENT rows are numbered ADJ-#### (ReferenceCounter). */
  numbered: boolean;
  /**
   * How a row of this type is reversed, if it can be. `ADJUSTMENT`: the caller sends the exact opposite signed quantity.
   * `PREP`: a reversal keeps the original's type with the opposite sign, so the caller sends the same positive magnitude and
   * the door flips the direction (PREP_CONSUME reverses to a positive row, PREP_PRODUCE to a negative one).
   * `WASTE`: the same rule as PREP (a reversal keeps the original's type with the opposite sign): a reversed waste row is positive.
   */
  reversal?: 'ADJUSTMENT' | 'PREP' | 'WASTE';
};

/**
 * Types with no entry (MARKET_RECEIVE, SALE) exist in the enum but no flow posts them yet.
 * The door refuses them until the flow that owns them is rebuilt and adds a rule here.
 */
export const LEDGER_RULES: Partial<Record<InventoryTransactionType, LedgerRule>> = {
  RECEIVE: { direction: 'IN', links: ['purchaseDeliveryLineId'], numbered: false },
  PREP_CONSUME: { direction: 'OUT', links: ['prepRecordId'], numbered: false, reversal: 'PREP' },
  PREP_PRODUCE: { direction: 'IN', links: ['prepRecordId'], numbered: false, reversal: 'PREP' },
  WASTE: { direction: 'OUT', links: ['wasteLogId'], numbered: false, reversal: 'WASTE' },
  DISPATCH_OUT: { direction: 'OUT', links: ['dispatchLineId'], numbered: false },
  DISPATCH_IN: { direction: 'IN', links: ['dispatchLineId'], numbered: false },
  // A count, a branch-day close, a next-morning opening, or a dispatch discrepancy
  // (transit loss / receiving miscount) each write adjustments.
  ADJUSTMENT: {
    direction: 'SIGNED',
    links: ['stockCountLineId', 'countLineId', 'branchDayLineId', 'openingLineId', 'dispatchLineId'],
    numbered: true,
    reversal: 'ADJUSTMENT',
  },
};

/** The stored quantity for a movement: positive in, negative out, adjustments as given. */
export const signedQuantity = (direction: LedgerDirection, quantity: Prisma.Decimal): Prisma.Decimal => {
  if (direction === 'IN') return quantity;
  if (direction === 'OUT') return quantity.negated();
  return quantity;
};

/** The stored quantity for a REVERSAL of a prep or waste row: the same magnitude with the opposite sign to a normal row of that type. */
export const reversedPrepQuantity = (direction: LedgerDirection, quantity: Prisma.Decimal): Prisma.Decimal =>
  direction === 'IN' ? quantity.negated() : quantity;
