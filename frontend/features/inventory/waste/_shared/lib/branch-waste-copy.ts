import type { BranchWasteErrorCode } from '../types/waste-contract';
import type { StateCopy } from '../../../_shared/types/state-copy';

/**
 * Branch waste wording (Paper step W9, "The wording of Branch waste", plus step 55). Source: docs/features/inventory/branch-waste-contract.md §10.
 * Waste is never signed with a PIN, so no line here mentions one. Titles, not names: write "the Branch Manager", never a person.
 * The reason and reversal texts (Expired, Spoiled, Damaged in store, Prep error; Logged the wrong item, Wrong quantity, Other) come from
 * `WASTE_REASON_TEXT` and `WASTE_REVERSAL_TEXT` in the contract mirror, not from here.
 */

/** "The words" (W9, left column). */
export const BRANCH_WASTE_WORDS: readonly { word: string; meaning: string }[] = [
  { word: 'Waste', meaning: 'Something thrown away, spoiled, expired or broken. Every entry takes stock down once it is confirmed' },
  { word: 'Expired · Spoiled · Damaged in store · Prep error', meaning: 'The four reasons for waste. One per item' },
  { word: 'Reverse', meaning: 'Puts the stock back with a new linked entry. The wrong entry stays on record, struck through' },
  { word: 'Logged the wrong item · Wrong quantity · Other, add a note', meaning: 'The three reasons for a reversal. One is required' },
  { word: 'Reversed 09:12 · wrong item', meaning: 'The status of a reversed entry: the time and the reason' },
  { word: 'Value (KES)', meaning: 'What the waste cost. Heads and members never see it; a reversed entry shows 0' },
  { word: 'Most wasted · Reversed', meaning: 'Two of the four figures on the waste page, both for the last 7 days' },
];

/** The phone buttons, in order (W9, right column). No PIN. */
export const BRANCH_WASTE_BUTTONS = {
  review: (count: number): string => `Review ${count} ${count === 1 ? 'item' : 'items'}`,
  confirm: 'Confirm and log waste',
  back: 'Back to edit',
  more: 'Log more waste',
  /** The reversal sheet on the phone and the dialog on desktop. */
  reverse: 'Reverse entry',
  keep: 'Keep it',
  cancel: 'Cancel',
  /** The link on a desktop row and a phone row. */
  reverseLink: 'Reverse',
} as const;

/** The two messages W9 quotes. */
export const BRANCH_WASTE_MESSAGES = {
  beforeConfirm: 'Stock goes down only when you confirm. Nothing is deleted later; a wrong entry can be reversed.',
  /** The server sends this as `bannerText` with the batch time ("2 items logged at 14:20. You can reverse your own entries today."). */
  afterLogging: (count: number, clock: string): string => `${count} ${count === 1 ? 'item' : 'items'} logged at ${clock}. You can reverse your own entries today.`,
  /** Step 55's note under the department list. */
  departmentNote: 'Everyone in the department sees these entries. You can reverse only your own, on the day you logged them.',
  /** Step 55's note for the Store Attendant's twin is step 54, in `WASTE_STATES_COPY.myWasteEarlier`. */
} as const;

/** "Who does what" (W9). */
export const BRANCH_WASTE_WHO: readonly { who: string; does: string }[] = [
  { who: 'Department head or member', does: 'Logs waste for their own department and reverses their own entry on the same day' },
  { who: 'Branch Manager', does: "Reads the branch's waste with values and reverses any entry with a reason. The Reverse link is hidden, not greyed, for everyone else" },
  { who: 'Director, Accountant, Store Manager, System Admin', does: "Read every branch's waste, with a Branch column and filter" },
];

/**
 * The States kit lines per screen, same voice as the Central Store table (`WASTE_STATES_COPY`). W9 says "no per-screen states (the States
 * kit is in Group R)"; these are the per-screen words the kit asks for, which the owner may edit.
 */
export const BRANCH_WASTE_STATES_COPY = {
  /** W1, Pick what was wasted. */
  pick: {
    loading: 'Getting your department’s items',
    empty: 'No usual items yet. Search for the item.',
    error: 'Could not load items. Try again.',
    permission: 'Logging waste is for the people of a department.',
  },
  /** W2, How much, and why. */
  amount: {
    loading: '',
    empty: null,
    error: 'Could not read that number. Check it and try again.',
    permission: null,
  },
  /** W3, Check, then log. */
  check: {
    loading: 'Logging waste',
    empty: null,
    error: 'Could not log it. Nothing was recorded. Try again.',
    permission: null,
  },
  /** Step 55, the department's waste, today and earlier (replaces W4). */
  department: {
    loading: 'Getting your department’s waste',
    empty: 'No waste logged in this period.',
    error: 'Could not load waste. Try again.',
    permission: 'Everyone in the department sees these entries. You can reverse only your own, on the day you logged them.',
  },
  /** W5, Reverse a wrong entry (phone). */
  reversePhone: {
    loading: 'Reversing',
    empty: null,
    error: 'Could not reverse it. The entry stays. Try again.',
    permission: 'You can reverse your own entry on the day you logged it.',
  },
  /** W6, Branch waste (Branch Manager, desktop). */
  branchList: {
    loading: 'Getting the branch’s waste',
    empty: 'No waste logged in this period.',
    error: 'Could not load waste. Try again.',
    permission: 'You can read all of the branch’s waste and reverse any entry.',
  },
  /** W7, Reverse any entry (dialog). */
  reverseAny: {
    loading: 'Reversing and returning the stock',
    empty: null,
    error: 'Could not reverse it. Nothing changed. Try again.',
    permission: 'Reversing any entry is for the Branch Manager.',
  },
  /** W8, Waste for any branch, read only. */
  allBranches: {
    loading: 'Getting waste for every branch',
    empty: 'No waste logged in this period.',
    error: 'Could not load waste. Try again.',
    permission: 'You can read every branch’s waste. A wrong entry is reversed by its Branch Manager.',
  },
} as const satisfies Record<string, StateCopy>;

/** Lines for the 4xx codes the Branch waste endpoints send, in the same voice (the owner may edit them). */
export const BRANCH_WASTE_ERROR_COPY: Record<BranchWasteErrorCode, string> = {
  ITEM_RETIRED: 'That item has been retired, so waste cannot be logged for it.',
  ITEM_NOT_IN_DEPARTMENT: 'That item is not one of your department’s items.',
  NOT_YOUR_DEPARTMENT: 'You are not a member of a department of this branch.',
  NOT_YOUR_ENTRY: 'You can only reverse your own entries.',
  REVERSAL_WINDOW_PASSED: 'You can reverse an entry only on the day you logged it. Ask the Branch Manager.',
  ALREADY_REVERSED: 'That entry was already reversed.',
};
