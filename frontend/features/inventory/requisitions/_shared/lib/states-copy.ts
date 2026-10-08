import type { RequisitionStatus } from '../types/requisitions-contract';

/**
 * Requisitions wording: the states kit (Paper step 21) and the table of every state with its words (Paper step 22,
 * "What the screens say"). Titles, not names: write "the Branch Manager", never a person's name (owner, 7 Oct 2026).
 * Names appear only where a record states who did something (Activity, the Audit log).
 *
 * The kit is drawn once for the whole pass. A title says what is missing in a person's words, the line under it says what to
 * do, a button appears only when there is something to press, and a failed action shows an inline message on the screen,
 * never an empty card. Only the wording below is Requisitions' own; the shapes come from `shell-states.tsx`.
 */

export interface KitCopy {
  title: string;
  /** The line under the title. */
  line: string;
  /** The one button, when there is something to press. */
  action?: string;
}

/** The three states drawn in Paper step 21 (empty, empty with an action, error with Retry). */
export const REQUISITIONS_KIT_COPY = {
  /** Empty: a list that holds nothing for this person. */
  nothingWaiting: { title: 'Nothing waiting for you', line: 'When a requisition needs you it shows up here.' },
  /** Empty with an action: the head's home before the cycle is started. */
  nothingAskedFor: { title: 'Nothing asked for yet', line: "Start this cycle's requisition for your department.", action: 'Start a requisition' },
  /** Error with Retry. */
  couldNotLoad: { title: "Couldn't load requisitions", line: 'Check your connection and try again.', action: 'Retry' },
} as const satisfies Record<string, KitCopy>;

/** Which kit state each screen shows. Loading is always the real shell with a skeleton data region (no words). */
export const REQUISITIONS_SCREEN_STATES = {
  /** Steps 7 and 7b, the list, every role. */
  list: { empty: REQUISITIONS_KIT_COPY.nothingWaiting, error: REQUISITIONS_KIT_COPY.couldNotLoad },
  /** Steps 1 and 14, the head's home. */
  headHome: { empty: REQUISITIONS_KIT_COPY.nothingAskedFor, error: REQUISITIONS_KIT_COPY.couldNotLoad },
  /** Step G1, My requisitions. */
  myRequisitions: { empty: REQUISITIONS_KIT_COPY.nothingWaiting, error: REQUISITIONS_KIT_COPY.couldNotLoad },
  /** Steps 8, 11, 12 and 13, the file page. */
  file: { empty: null, error: REQUISITIONS_KIT_COPY.couldNotLoad },
} as const;

/** "One file, eight states": the tracker line, who does what, and the main button (Paper step 22, first table). */
export interface StateRow {
  state: string;
  tracker: string;
  whoDoesWhat: string;
  mainButton: string;
}

export const REQUISITION_EVERY_STATE: readonly StateRow[] = [
  { state: 'Collecting', tracker: 'Started, sections coming in', whoDoesWhat: 'Heads fill and send with a PIN; the manager can nudge', mainButton: 'Send for approval (head) · Nudge (manager)' },
  { state: 'Ready to approve', tracker: 'All sections in, or sent without one', whoDoesWhat: 'Manager reviews, edits any quantity, signs once with a PIN', mainButton: 'Approve and sign' },
  { state: 'Approved, with the store', tracker: 'Approved, with the time and who', whoDoesWhat: 'The store packs per department; a head can add lines until their dispatch is signed', mainButton: 'Add to this requisition (head) · Print' },
  { state: 'Addition waiting', tracker: 'Added lines flagged, approved lines untouched', whoDoesWhat: 'The manager approves the addition with a PIN before it goes to the store', mainButton: 'Approve addition' },
  { state: 'Packing, on the way, to confirm', tracker: 'One dispatch per department, each with its own status', whoDoesWhat: 'The packer signs each dispatch; the branch counts what arrives (Dispatch group)', mainButton: 'Per the Dispatch group' },
  { state: 'Closed', tracker: 'Every department confirmed', whoDoesWhat: 'Everyone can open it; nothing changes', mainButton: 'Print' },
  { state: 'Cancelled', tracker: 'Stops where it was cancelled, with the reason', whoDoesWhat: 'Only before approval; kept on record, nothing deleted', mainButton: 'Start a new one' },
];

/** The word for a requisition's status chip. The server also sends `statusText`; this is the fallback and the test anchor. */
export const REQUISITION_STATUS_WORDS: Record<RequisitionStatus, string> = {
  OPEN: 'Collecting',
  PENDING_APPROVAL: 'Ready to approve',
  APPROVED: 'Approved',
  CANCELLED: 'Cancelled',
  CLOSED: 'Closed',
};

/** "What the screens say": eight moments, who sees them, and the exact words (Paper step 22, second table). */
export interface WordingRow {
  key: 'headSends' | 'sectionMissing' | 'managerChangesQuantity' | 'readySigning' | 'afterApproval' | 'urgent' | 'cancel' | 'shortAtStore';
  moment: string;
  whoSeesIt: string;
  words: readonly string[];
}

export const REQUISITIONS_WORDING: readonly WordingRow[] = [
  { key: 'headSends', moment: 'Head sends a section', whoSeesIt: 'Department Head', words: ["Send Kitchen's list for approval?", 'Waiting for the Branch Manager', 'Recall my list'] },
  {
    key: 'sectionMissing',
    moment: 'A section is missing',
    whoSeesIt: 'Branch Manager',
    words: ["Housekeeping hasn't sent yet", 'Nudge Housekeeping', 'Fill it myself', 'Send without this section'],
  },
  {
    key: 'managerChangesQuantity',
    moment: 'Manager changes a quantity',
    whoSeesIt: 'Manager, then the head',
    words: ['You changed 30 to 24. The Kitchen head will be told.', 'The Branch Manager changed 1 line'],
  },
  {
    key: 'readySigning',
    moment: 'Ready, signing',
    whoSeesIt: 'Branch Manager',
    words: ['Everything is in. Ready for your signature.', 'One signature covers the whole requisition.', 'Approved and sent to the Central Store'],
  },
  {
    key: 'afterApproval',
    moment: 'After approval',
    whoSeesIt: 'Head, manager',
    words: ['Added after approval', 'Ask for 2 more lines?', 'The approved lines are not touched', 'Approve the addition'],
  },
  { key: 'urgent', moment: 'Urgent', whoSeesIt: 'Head, manager, Director', words: ['Mark as urgent', 'The Director is told if it is not approved within 1 hour and can approve it.'] },
  { key: 'cancel', moment: 'Cancel', whoSeesIt: 'Branch Manager', words: ['Cancel this requisition?', 'Nothing has gone to the Central Store yet.', 'It stays on record as Cancelled.'] },
  { key: 'shortAtStore', moment: 'Short at the store', whoSeesIt: 'Everyone', words: ['Short: only 1 in store. The next requisition will suggest it again.'] },
];

/** Looks a wording row up by key, so a screen never repeats the words. */
export const wordsFor = (key: WordingRow['key']): readonly string[] => REQUISITIONS_WORDING.find((row) => row.key === key)?.words ?? [];
