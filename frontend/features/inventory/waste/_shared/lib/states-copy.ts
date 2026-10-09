import type { WasteErrorCode } from '../types/waste-contract';
import type { StateCopy } from '../../../_shared/types/state-copy';

/**
 * Waste states kit wording (Paper steps 16 to 23). Source: docs/features/inventory/states-copy-stock-count-waste.md.
 * One reusable kit, this table is the per-screen wording.
 *
 * The design pass's row for step 23 said "Reversing needs a PIN". The owner decided on 8 Oct 2026 that waste is never
 * signed with a PIN (the drawn dialog has none), so the permission line below drops it.
 */
export const WASTE_STATES_COPY = {
  /** Step 16, Pick what was wasted (phone). */
  pickWasted: {
    loading: 'Getting usual items',
    empty: 'No usual items yet. Search for the item.',
    error: 'Could not load items. Try again.',
    permission: 'Logging waste is for the Store Attendant and Store Manager.',
  },
  /** Step 17, How much, and why. */
  howMuchAndWhy: {
    loading: '',
    empty: null,
    error: 'Could not read that number. Check it and try again.',
    permission: null,
  },
  /** Step 18, Check, then confirm. */
  checkThenConfirm: {
    loading: 'Logging waste',
    empty: null,
    error: 'Could not log it. Nothing was recorded. Try again.',
    permission: null,
  },
  /** Step 19, My waste today (phone). */
  myWasteToday: {
    loading: "Getting today's waste",
    empty: 'You have logged no waste today.',
    error: 'Could not load your waste. Try again.',
    permission: 'You see your own entries.',
  },
  /** Step 54, My waste, today and earlier (phone). Replaces step 19's lines; added in Block 5. */
  myWasteEarlier: {
    loading: 'Getting your waste',
    empty: 'You have logged no waste in this period.',
    error: 'Could not load your waste. Try again.',
    permission: 'You see your own entries.',
  },
  /** Step 20, Reverse a wrong entry (phone). */
  reversePhone: {
    loading: 'Reversing',
    empty: null,
    error: 'Could not reverse it. The entry stays. Try again.',
    permission: 'You can reverse your own entry on the day you logged it.',
  },
  /** Step 21, Waste (desktop). */
  wasteDesktop: {
    loading: 'Getting waste',
    empty: 'No waste logged in this period.',
    error: 'Could not load waste. Try again.',
    permission: 'You can read all waste. Logging and reversing are for the Store Manager.',
  },
  /** Step 22, Log waste drawer. */
  logDrawer: {
    loading: 'Logging waste',
    empty: null,
    error: 'Could not log it. Nothing was recorded. Try again.',
    permission: 'Logging waste is for the Store Manager and Store Attendant.',
  },
  /** Step 23, Reverse any entry (dialog). */
  reverseAny: {
    loading: 'Reversing and returning the stock',
    empty: null,
    error: 'Could not reverse it. Nothing changed. Try again.',
    permission: 'Reversing any entry is for the Store Manager.',
  },
} as const satisfies Record<string, StateCopy>;

/** Lines for the 4xx codes the Waste endpoints send, in the same voice (the owner may edit them). */
export const WASTE_ERROR_COPY: Record<WasteErrorCode, string> = {
  ITEM_RETIRED: 'That item has been retired, so waste cannot be logged for it.',
  NOT_YOUR_ENTRY: 'You can only reverse your own entries.',
  REVERSAL_WINDOW_PASSED: 'You can reverse an entry only on the day you logged it. Ask the Store Manager.',
  ALREADY_REVERSED: 'That entry was already reversed.',
};
