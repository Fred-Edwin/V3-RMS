import type { StateCopy } from '../../../_shared/types/state-copy';
import type { Blocker, BranchDayErrorCode, DayStatus, OpeningDifference, OpeningState } from '../types/branch-day-contract';

/**
 * Branch day wording (Paper step B18, "The wording of Branch day", plus the copy drawn on B0 to B17 and chapter 5). Source:
 * docs/features/inventory/branch-day-contract.md §14. The back end sends facts and codes only (states, ids, times, figures);
 * every title and line below is written here. Titles, not names: a name shows only where a record states who did something.
 * Never say "counted" for the closing figure, "consumption" or "gap" for Used today, "reopen", or "unusual": none of those exist.
 */

/** "The figures" (B18, left column), in the order Paper lists them. */
export const BRANCH_DAY_FIGURES: readonly { word: string; meaning: string }[] = [
  { word: 'Opening stock', meaning: "Last night's closing figure, checked by the head at the start of the day" },
  { word: 'Received', meaning: 'Deliveries the department confirmed today' },
  { word: 'Waste', meaning: 'Waste logged today' },
  { word: 'Closing stock', meaning: 'The evening count, done blind by the department head. Never "counted"' },
  { word: 'Used today', meaning: 'Opening stock plus Received, less Waste, less Closing stock. Never "consumption"' },
  { word: 'Yesterday', meaning: "The same item's Used today the day before. Nothing is flagged; the Branch Manager compares" },
  { word: 'Used value (KES)', meaning: "What was used, at today's prices. Heads do not see it" },
  { word: 'Closing stock value (KES)', meaning: "What is left on the shelves, at today's prices. Heads do not see it" },
];

/** "States and chips" (B18, right column, top). */
export const BRANCH_DAY_STATES: readonly { word: string; meaning: string }[] = [
  { word: 'Open · Closed · Corrected', meaning: 'The three states of a day in History' },
  { word: 'Counted · Not counted', meaning: 'A department card on Today' },
  { word: 'Opening not checked', meaning: "The department ran on last night's figure. Does not block the close" },
  { word: 'Opening 1 less · Milk 1L', meaning: 'The overnight difference, with the item. Recorded, never blocks' },
];

/** "What blocks the close" (B18). */
export const BRANCH_DAY_BLOCKS_THE_CLOSE =
  'A department has not counted. A delivery has left the store and is not confirmed. Nothing else blocks: an open discrepancy never does';

/** "Buttons and reasons" (B18) and the other buttons the screens draw. */
export const BRANCH_DAY_BUTTONS = {
  /** Branch Manager only. Hidden, not greyed, for every other role. */
  closeDay: 'Close the day',
  correctCount: 'Correct a count',
  postCorrection: 'Post the correction',
  /** "Confirm for Kitchen": the Branch Manager confirms a delivery for a department. */
  confirmFor: (department: string): string => `Confirm for ${department}`,
  printSheet: 'Print the day sheet',
  print: 'Print',
  openDayFile: 'Open the day file',
  openFigures: 'Open figures',
  seeEveryLine: 'See every line',
  seeEveryFigure: 'See every figure',
  cancel: 'Cancel',
  // The head's phone (B0 to B4)
  checkOpening: 'Check the opening',
  countDepartment: 'Count your department',
  sameAsLastNight: 'Yes, same as last night',
  recount: "No, I'll recount",
  recordOpening: 'Record the opening',
  checkAndSign: 'Check and sign',
  sendToManager: 'Send to the Branch Manager',
  backToDay: 'Back to Day',
  backToCheckAndSign: 'Back to check and sign',
  // The Branch Manager counting for a department (B15)
  seeAllInDayFile: (total: number): string => `See all ${total} in the day file`,
} as const;

/** The three reasons for a correction (B12, B18); the values are `CORRECTION_REASON_TEXT` in the contract mirror. */
export const BRANCH_DAY_CORRECTION_NOTE = 'One item, one reason, PIN. Posts one linked entry; a day is never reopened';

/** Plain lines the screens quote. */
export const BRANCH_DAY_MESSAGES = {
  usedTodayRule: 'Used today = opening stock + received − waste − closing stock. Used value is what was used at today’s prices; closing stock value is what is left on the shelves.',
  /** The rule line on a closed day file (B11) and after the close (B9). */
  correctionRule: (untilWhat = 'tomorrow’s opening is accepted'): string => `One item can be corrected until ${untilWhat}.`,
  afterClose:
    'Nothing is reopened. If a figure was wrong, the Branch Manager corrects that one item on the day file, with a reason and a PIN, until tomorrow’s opening is accepted.',
  /** B8, under the department rows. */
  closeDoes: (entryCount: number, reference: string): string =>
    `Writes ${entryCount} usage ${entryCount === 1 ? 'entry' : 'entries'} to the stock ledger, one per item, each marked ${reference}. Nothing is reopened afterwards: you can correct one item, with a reason and your PIN.`,
  /** B9, the green line. */
  closedBanner: (clock: string, usedValue: string, entryCount: number, reference: string): string =>
    `Day closed at ${clock}, signed by the Branch Manager. Used today KES ${usedValue}. ${entryCount} usage ${entryCount === 1 ? 'entry was' : 'entries were'} written to the stock ledger, each marked ${reference}.`,
  /** B12, the blue note. */
  correctionPosts: 'One linked entry is posted to the stock ledger. The original close stays on file and in the audit log; nothing is reopened.',
  /** B12b, the green line on the Activity tab. */
  correctionPosted: (clock: string, itemName: string, from: string, to: string, usedValue: string): string =>
    `Correction posted at ${clock}: ${itemName}, closing stock ${from} → ${to}. The day’s Used value is now KES ${usedValue}.`,
  /** B15, the blue note on the drawer. */
  onBehalf: (department: string): string =>
    `Neither the ${department} Department Head nor a member is available. The count is recorded "on behalf of ${department}", signed by the Branch Manager.`,
  /** B1 */
  openingIntro: (department: string, closedOn: string): string =>
    `These are the figures signed when the ${department} day closed on ${closedOn}. Check the shelves, then accept or recount.`,
  /** B2 */
  openingStartsFromCount: 'The day starts from what you counted. The Branch Manager sees the difference on Today.',
  /** B2b */
  openingManagerSees: 'The Branch Manager can see the difference, with your name against it. Nothing else is needed from you.',
  /** B3b */
  signedByManagerNote: 'The Branch Manager reviews your department and closes the day. You will not be shown what was expected.',
  /** B4 */
  countSentNote: 'If you got a figure wrong, tell the Branch Manager. They can correct one item after the day is closed.',
  /** B0, the note under the cards. */
  homeNote: 'In the morning the first card reads Check the opening and opens step 1. The day closes once every department has counted.',
  /** B20 (chapter 5), the note under a past day for a head. */
  pastDayNote: 'Opening stock, Received, Waste, Closing stock and Used today for your department. Values are for the Branch Manager.',
} as const;

/** The department card chip on Today (B5, B14, B16): "Opening 1 less · Milk 1L", "Opening not checked", or nothing. */
export const openingChip = (state: OpeningState, differences: readonly OpeningDifference[]): string | null => {
  if (state === 'NOT_CHECKED') return 'Opening not checked';
  if (differences.length === 0) return null;
  const [only] = differences;
  if (differences.length === 1 && only) {
    const n = Math.abs(Number(only.difference));
    return `Opening ${n} ${Number(only.difference) < 0 ? 'less' : 'more'} · ${only.itemName}`;
  }
  // Several differences are not drawn: the count with the word "differences" until the owner draws it (contract gap 6).
  return `Opening: ${differences.length} differences`;
};

/** The head's own opening difference line on B2b ("8 last night, 7 this morning"). */
export const openingDifferenceLine = (difference: OpeningDifference): string => `${difference.lastNightQty} last night, ${difference.countedQty} this morning`;

/** The state chip words in History and on a day file. */
export const dayStatusChip = (status: DayStatus): string => (status === 'OPEN' ? 'Open' : status === 'CLOSED' ? 'Closed' : 'Corrected');

const pluralThing = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** The heading and its line above the blockers (B5, B7). "Before the day can close · 1 thing to do. 1 more to know about." */
export const blockersHeading = (canClose: boolean, todo: number, toKnow: number): { title: string; line: string } => {
  const first = todo === 0 ? 'Nothing is left to do.' : `${pluralThing(todo, 'thing', 'things')} to do.`;
  const second = toKnow === 0 ? '' : todo === 0 ? ` ${pluralThing(toKnow, 'thing', 'things')} to know about.` : ` ${toKnow} more to know about.`;
  return { title: canClose ? 'Ready to close' : 'Before the day can close', line: `${first}${second}` };
};

const NUMBER_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
const numberWord = (n: number): string => NUMBER_WORDS[n] ?? String(n);

/**
 * The title and line of one blocker, from its facts (B5, B7, B14). `clock` formats an ISO time in Nairobi ("3:05 pm"); `departmentCount` is the
 * number of departments on the day ("Five departments counted what arrived").
 */
export const blockerCopy = (blocker: Blocker, clock: (iso: string) => string, departmentCount: number): { title: string; line: string } => {
  const department = blocker.department?.name ?? '';
  switch (blocker.kind) {
    case 'DELIVERIES_CONFIRMED': {
      const open = blocker.discrepancies.length;
      const base = `${numberWord(departmentCount)} departments counted what arrived.`;
      return {
        title: 'Every delivery is confirmed',
        line: open === 0 ? base : `${base} ${numberWord(open)} ${open === 1 ? 'discrepancy is' : 'discrepancies are'} open, which does not block the close:`,
      };
    }
    case 'DELIVERY_NOT_CONFIRMED': {
      const reference = blocker.dispatch?.reference ?? 'The delivery';
      const left = blocker.dispatch ? ` left the store at ${clock(blocker.dispatch.signedAt)} and is not counted yet.` : ' is not counted yet.';
      return { title: `${department} has not confirmed its delivery`, line: `${reference}${left} This blocks the close; an open discrepancy never does:` };
    }
    case 'DEPARTMENT_NOT_COUNTED':
      return {
        title: `${department} has not counted`,
        line: `This blocks the close. The ${department} Department Head, or any active member of the department, can count it now.`,
      };
    case 'ALL_COUNTED': {
      const last = blocker.lastDepartment?.name ?? '';
      return {
        title: `All ${numberWord(departmentCount).toLowerCase()} departments have counted`,
        line: blocker.at && last ? `${last} signed its count at ${clock(blocker.at)}.` : 'Every department has signed its count.',
      };
    }
    case 'OPENING_NOT_CHECKED':
      return { title: `Opening not checked: ${department}`, line: `The ${department} day ran on last night's closing figure. This does not block the close.` };
  }
};

/**
 * The States kit lines per screen, same voice as the other Inventory tables. B18 says "no per-screen states drawn; the States kit is in
 * Group R"; these are the per-screen words the kit asks for, which the owner may edit.
 */
export const BRANCH_DAY_STATES_COPY = {
  /** B0, the head's Day. */
  home: {
    loading: 'Getting your day',
    empty: null,
    error: 'Could not load your day. Try again.',
    permission: 'Day is for the people of a department.',
  },
  /** B1 to B2b, the opening. */
  opening: {
    loading: 'Getting last night’s figures',
    empty: 'Nothing was signed last night. The day runs on the figures in stock; count what is on the shelves.',
    error: 'Could not load the opening. Try again.',
    permission: 'Checking the opening is for the people of the department.',
  },
  /** B3 to B3c, the blind count. */
  count: {
    loading: 'Getting your department’s items',
    empty: 'Your department has no items to count. The day counts it as done.',
    error: 'Could not save your count. Your figures are kept on this screen. Try again.',
    permission: 'Counting is for the people of a department, or the Branch Manager.',
  },
  /** B5, B7, B14 Today (Branch Manager, every desktop role). */
  today: {
    loading: 'Getting today’s day',
    empty: 'Nobody has opened today for this branch yet.',
    error: 'Could not load today. Try again.',
    permission: 'Closing the day is for the Branch Manager. Everyone else reads it.',
  },
  /** B16, Today for any branch (read only). */
  todayAnyBranch: {
    loading: 'Getting the branch’s day',
    empty: 'Nobody has opened today for this branch yet.',
    error: 'Could not load the branch’s day. Try again.',
    permission: 'You can read every branch’s day. Closing it is for that branch’s Branch Manager.',
  },
  /** B6, a department's figures. */
  figures: {
    loading: 'Getting the department’s figures',
    empty: 'This department has no items today.',
    error: 'Could not load the figures. Try again.',
    permission: null,
  },
  /** B8, Close the day. */
  close: {
    loading: 'Closing the day and writing the usage entries',
    empty: null,
    error: 'Could not close the day. Nothing was written. Try again.',
    permission: 'Closing the day is for the Branch Manager.',
  },
  /** B10, B10b History. */
  history: {
    loading: 'Getting the days',
    empty: 'No days in this period.',
    error: 'Could not load the days. Try again.',
    permission: null,
  },
  /** B11, the day file. */
  dayFile: {
    loading: 'Getting the day file',
    empty: null,
    error: 'Could not load the day file. Try again.',
    permission: 'Correcting a count is for the Branch Manager.',
  },
  /** B12, Correct a count. */
  correct: {
    loading: 'Posting the correction',
    empty: null,
    error: 'Could not post the correction. Nothing changed. Try again.',
    permission: 'Correcting a count is for the Branch Manager.',
  },
  /** B13, the Documents tab. */
  documents: {
    loading: 'Getting the day sheets',
    empty: 'No day sheet yet. One is made when the day closes.',
    error: 'Could not load the day sheets. Try again.',
    permission: null,
  },
  /** Chapter 5, step 19: the head's past days. */
  myHistory: {
    loading: 'Getting your department’s past days',
    empty: 'No closed days in this period.',
    error: 'Could not load your past days. Try again.',
    permission: 'Past days are for the people of a department.',
  },
} as const satisfies Record<string, StateCopy>;

/** Lines for the 4xx codes the Branch day endpoints send, in the same voice (the owner may edit them). */
export const BRANCH_DAY_ERROR_COPY: Record<BranchDayErrorCode, string> = {
  INVALID_PIN: 'That PIN is not right. Try again.',
  NOT_YOUR_DEPARTMENT: 'That department is not yours to count.',
  NOT_YOUR_BRANCH: 'That is another branch’s day.',
  DAY_ALREADY_CLOSED: 'This day is already closed.',
  DAY_NOT_READY: 'The day is not ready to close. Check the list above the button.',
  DAY_NOT_CLOSED: 'This day has not been closed yet.',
  ALREADY_COUNTED: 'This department has already signed its count.',
  COUNT_INCOMPLETE: 'Count every item before you sign.',
  OPENING_ALREADY_CHECKED: 'This opening has already been checked.',
  ITEM_NOT_IN_DAY: 'That item is not on this department’s day.',
  DEPARTMENT_NOT_COUNTED: 'This department did not count, so there is no figure to correct.',
  CORRECTION_WINDOW_PASSED: 'The next opening was accepted, so this figure can no longer be corrected here. The opening recount catches it.',
  CORRECTION_NO_CHANGE: 'That is the figure already on the day.',
  NO_DEPARTMENTS: 'This branch has no department to count yet.',
};
