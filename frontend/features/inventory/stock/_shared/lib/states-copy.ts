import type { StockErrorCode } from '../types/stock-contract';
import type { StateCopy } from '../../../_shared/types/state-copy';

/**
 * Stock states kit wording (Paper steps 27 to 29 and 42). Source: docs/features/inventory/states-copy-stock-count-waste.md.
 * One reusable kit, this table is the per-screen wording. The Attendant never reaches these screens.
 */
export const STOCK_STATES_COPY = {
  /** Step 27, All items. */
  allItems: {
    loading: 'Getting items',
    empty: 'No items match. Clear the filters.',
    error: 'Could not load items. Try again.',
    permission: 'You can read all stock. The Attendant does not see stock.',
  },
  /** Step 28, Stock ledger. */
  stockLedger: {
    loading: 'Getting movements',
    empty: 'No movements in this period.',
    error: 'Could not load the ledger. Try again.',
    permission: 'You can read the ledger. The Attendant does not see it.',
  },
  /** Step 29, one item's stock card. */
  stockCard: {
    loading: 'Getting this item',
    empty: 'No movements for this item yet.',
    error: 'Could not load this item. Try again.',
    permission: 'You can read stock cards. The Attendant does not see them.',
  },
  /** Step 42, Overview. */
  overview: {
    loading: "Getting today's picture",
    empty: 'No counts today. Start one.',
    error: 'Could not load the overview. Try again.',
    permission: 'You can read the overview. Starting a count is for the Store Manager.',
  },
} as const satisfies Record<string, StateCopy>;

/** Lines for the 4xx codes the Stock endpoints send, in the same voice (the owner may edit them). */
export const STOCK_ERROR_COPY: Record<StockErrorCode, string> = {
  EXPORT_TOO_LARGE: 'That is more than 10,000 rows. Narrow the dates and try again.',
  ITEM_NOT_FOUND: 'We could not find that item. It may have been retired.',
  DATE_IN_FUTURE: 'Later dates cannot be picked.',
  RANGE_INVALID: 'The end date is before the start date.',
};
