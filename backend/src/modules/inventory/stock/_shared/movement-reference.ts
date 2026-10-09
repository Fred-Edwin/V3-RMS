import type { InventoryTransactionType } from '@prisma/client';

/** Every document number a ledger row can be traced to. Fields are null when the row has no such link. */
export type MovementSources = {
  type: InventoryTransactionType;
  /** `ADJ-nnnn`, the ledger row's own reference (adjustments only). */
  adjustmentReference: string | null;
  /** `CNT-yyyy-nnnn`, through the count line an adjustment came from. */
  countReference: string | null;
  /** `GRN-nnnn`, through the delivery line of a receipt. */
  deliveryReference: string | null;
  /** `PREP-nnnn`, through the prep run. */
  prepReference: string | null;
  /** `DSP-<branch code>-nnnn`, through the dispatch line (Block 2 numbers every signed dispatch; before it was a daily label). */
  dispatchLabel: string | null;
  /**
   * `DSC-<branch code>-nnnn`: how the DSC- reference reaches the ledger (Dispatch Amendment 1 row 17). A finding, its reversal and a
   * cancellation post through the door as rows linked to the dispatch line by `dispatchLineId` (an ADJUSTMENT keeps its own ADJ- number
   * in `reference`, which the door owns); the discrepancy is one per line, so the DSC- number is found through that link and shown
   * as the entry's source. No new column on the append-only ledger.
   */
  discrepancyReference?: string | null;
};

/**
 * The one function that turns a ledger row into its reference text (Stock ledger search, Stock card, CSV).
 *  - an adjustment reads `ADJ-nnnn`; when a count caused it, the count is its `source` ("CNT-2026-0007");
 *  - a receipt reads its `GRN-…`, a prep row its `PREP-…`, a dispatch row the dispatch's label;
 *  - waste is not numbered, so it has none.
 * `all` is every number the row can be found by, for search.
 */
export const movementReference = (row: MovementSources): { reference: string | null; source: string | null; all: string[] } => {
  const all = [row.adjustmentReference, row.countReference, row.deliveryReference, row.prepReference, row.dispatchLabel, row.discrepancyReference].filter((v): v is string => !!v);
  switch (row.type) {
    case 'ADJUSTMENT':
      // A dispatch finding's adjustment reads ADJ-nnnn with the DSC- number as its source; a count's reads ADJ-nnnn with the CNT- source.
      return {
        reference: row.adjustmentReference ?? row.countReference ?? row.discrepancyReference ?? row.dispatchLabel,
        source: row.adjustmentReference ? (row.countReference ?? row.discrepancyReference ?? null) : null,
        all,
      };
    case 'RECEIVE':
    case 'MARKET_RECEIVE':
      return { reference: row.deliveryReference, source: null, all };
    case 'PREP_CONSUME':
    case 'PREP_PRODUCE':
      return { reference: row.prepReference, source: null, all };
    case 'DISPATCH_OUT':
    case 'DISPATCH_IN':
      return { reference: row.dispatchLabel, source: null, all };
    default:
      return { reference: null, source: null, all };
  }
};
