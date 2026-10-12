import type { StateCopy } from '../../../_shared/types/state-copy';
import type { CountErrorCode } from '../types/counting-contract';

/**
 * Counting states kit: one reusable loading, empty, error and permission treatment, and this table is the per-screen
 * wording. Source: docs/features/inventory/states-copy-stock-count-waste.md (the design pass, 8 Oct 2026). Never a state
 * design per screen. The step numbers are the Paper page "Inventory · Counting redesign (Oct 7)". The rules for each of
 * the four states are on `StateCopy`.
 */
const none = null;

export const COUNTING_STATES_COPY = {
  /** Step 1, Pick a section (phone). */
  pickSection: {
    loading: "Getting today's sections",
    empty: 'No sections are set up yet. Ask the Store Manager to set them up in Count setup.',
    error: 'Could not load the sections. Nothing was changed. Try again.',
    permission: 'Counting is for the Store Attendant and Store Manager.',
  },
  /** Step 2, Count the shelf (phone). `loading` takes the section name: "Opening Samrat". */
  countShelf: {
    loading: 'Opening {section}',
    empty: 'This section has no items. Ask the Store Manager to add some.',
    error: 'Could not save the last number. It is kept on this phone. Try again.',
    permission: 'You can count here only while a count is open for you.',
  },
  /** Step 3, Section done, check items again. */
  sectionCheck: {
    loading: 'Checking your numbers',
    empty: 'Nothing to check again. Carry on.',
    error: 'Could not check this section. Carry on or try again.',
    permission: none,
  },
  /** Step 5, Review before signing. */
  reviewBeforeSigning: {
    loading: 'Gathering your numbers',
    empty: 'You have not counted anything yet. Go back and count, or skip what you will not do today.',
    error: 'Could not load your numbers. They are saved. Try again.',
    permission: 'Only the person who counted can sign.',
  },
  /** Steps 6 and 14, Sign with PIN. */
  signWithPin: {
    loading: 'Signing',
    empty: none,
    error: 'Could not sign. Check your PIN and try again. Nothing was sent.',
    permission: 'You have no PIN yet. Ask the System Admin to set one.',
  },
  /** Step 7, Submitted. */
  submitted: {
    loading: '',
    empty: none,
    error: 'Could not confirm the count was sent. It is saved. Try again.',
    permission: none,
  },
  /** Step 40, Reorder sections for today. */
  reorderToday: {
    loading: "Getting today's order",
    empty: none,
    error: 'Could not change the order. It stays as it was. Try again.',
    permission: 'Reordering is for the Store Attendant and Store Manager.',
  },
  /** Step 52, Stock & counts home (phone). Lines added in Block 5 in the same voice; the design pass table had no row for it. */
  attendantHome: {
    loading: 'Getting your counts',
    empty: none,
    error: 'Could not load your home screen. Nothing was changed. Try again.',
    permission: 'Counting is for the Store Attendant and Store Manager.',
  },
  /** Step 53, My counts (phone). */
  myCounts: {
    loading: 'Getting your counts',
    empty: 'You have signed no counts in this period. Pick a section to start one.',
    error: 'Could not load your counts. Try again.',
    permission: 'You see your own counts.',
  },
  /** Step 41, Move an item. */
  moveItem: {
    loading: 'Moving it',
    empty: none,
    error: 'Could not move it. It stays in its section. Try again.',
    permission: 'Moving items is for the Store Attendant and Store Manager.',
  },
  /** Steps 8 and 48, Counts list. */
  countsList: {
    loading: 'Getting counts',
    empty: 'No counts yet. Start the first one.',
    error: 'Could not load counts. Try again.',
    permission: 'You can read counts. Starting one is for the Store Manager.',
  },
  /** Steps 9 and 47, Review a count. `loading` takes the reference: "Opening CNT-2026-1013". */
  reviewCount: {
    loading: 'Opening {reference}',
    empty: 'This count has no lines.',
    error: 'Could not load this count. Try again.',
    permission: 'You can read this count. Deciding lines is for the Store Manager.',
  },
  /** Step 10, Decide a line. */
  decideLine: {
    loading: 'Saving your decision',
    empty: none,
    error: 'Could not save. The line is still undecided. Try again.',
    permission: 'Deciding lines is for the Store Manager.',
  },
  /** Steps 11 and 14, Approve and sign. */
  approveAndSign: {
    loading: 'Signing and writing adjustments',
    empty: none,
    error: 'Could not approve. Nothing was written. Try again.',
    permission: 'Approving needs a PIN. Set yours in Settings.',
  },
  /** Steps 12 and 49, Start a count. */
  startCount: {
    loading: 'Getting sections',
    empty: 'Nothing is set up to count. Open Count setup.',
    error: 'Could not start the count. Try again.',
    permission: 'Starting a count is for the Store Manager and Store Attendant.',
  },
  /** Step 15, Count signed. */
  countSigned: {
    loading: '',
    empty: none,
    error: 'Could not confirm the signature. Check Counts before you start again.',
    permission: none,
  },
  /** Step 24, Count setup. */
  countSetup: {
    loading: 'Getting sections and items',
    empty: 'Nothing set up yet. Add your first section.',
    error: 'Could not load Count setup. Try again.',
    permission: 'You can read the setup. Changing it is for the Store Manager.',
  },
  /** Steps 24B, 24C and 51, Add items drawer. */
  addItems: {
    loading: 'Looking for items',
    empty: 'Every item is already in a section.',
    error: 'Could not search. Try again.',
    permission: 'Adding items is for the Store Manager.',
  },
  /** Step 50, Add items, no matches. `empty` takes the search: 'No item called "oatmilk". ...'. */
  addItemsNoMatches: {
    loading: 'Looking for items',
    empty: 'No item called “{query}”. Check the spelling, or try part of the name. Clear the search to see everything not in a section.',
    error: 'Could not search. Try again.',
    permission: 'Adding items is for the Store Manager.',
  },
  /** Step 25, Count settings. */
  countSettings: {
    loading: 'Getting settings',
    empty: none,
    error: 'Could not save. Your old settings still apply. Try again.',
    permission: "The range is the Store Manager's. The alert amount is the Director's.",
  },
  /** Steps 26 and 46, the Director's Counts view. */
  directorCounts: {
    loading: 'Getting flagged counts',
    empty: 'Nothing flagged. Counts over your alert amount appear here.',
    error: 'Could not load counts. Try again.',
    permission: 'Flagged counts are for the Director.',
  },
  /** Step 45, Count settings, Director. */
  directorSettings: {
    loading: 'Getting settings',
    empty: none,
    error: 'Could not save the alert amount. The old one still applies. Try again.',
    permission: 'Only the Director sets the alert amount.',
  },
  /** Steps 43 and 44, printed pages. */
  printedPages: {
    loading: 'Getting the page ready',
    empty: none,
    error: 'Could not make the page. Try again.',
    permission: 'Printing is for the Store Manager.',
  },
  /** Step 46, the Director alert. */
  directorAlert: {
    loading: '',
    empty: 'No alerts.',
    error: 'Could not load alerts. Try again.',
    permission: 'Alerts are for the Director.',
  },
} as const satisfies Record<string, StateCopy>;

/**
 * What to say for each 4xx `code` from the Counting endpoints. Never show the code. The design pass wrote the lines above;
 * these error-code lines are the orchestrator's draft in the same voice (short, what happened, what to do next, no blame)
 * and the owner may edit any of them.
 */
export const COUNT_ERROR_COPY: Record<CountErrorCode, string> = {
  YOU_HAVE_OPEN_COUNT: 'You already have a count open. Finish or sign it first.',
  SECTION_BUSY: 'Someone is already counting that section. Pick another one, or wait for them to sign.',
  NOTHING_TO_COUNT: 'Nothing is set up to count there. Open Count setup.',
  RECOUNT_NOT_ALLOWED: 'That line cannot be counted again.',
  COUNT_NOT_OPEN: 'This count is already signed.',
  COUNT_NOT_SUBMITTED: 'This count is not waiting for review.',
  NOT_YOUR_COUNT: 'Only the person who counted can do this.',
  NOTHING_COUNTED: 'You have not counted anything yet. Count something, or skip what you will not do today.',
  CAUSE_REQUIRED: 'Pick a cause for every line outside the range.',
  LINES_UNDECIDED: 'Decide every line outside the range first.',
  INVALID_PIN: 'Could not sign. Check your PIN and try again. Nothing was sent.',
  LAYOUT_CHANGED: 'Count setup changed while you were editing. Reload to see the latest, then save again.',
  SECTION_NAME_TAKEN: 'A section with that name already exists.',
  ITEM_NOT_IN_SETUP: 'That item is not in Count setup any more.',
  MOVE_ALREADY_UNDONE: 'That move was already undone.',
};
