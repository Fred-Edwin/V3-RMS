import { ApiError } from '@/types/api';
import type { NextStepAction, RequisitionCycle, RequisitionStatus, SectionStatus, TrackerStep } from '../types/requisitions-contract';

/**
 * The Department Head's phone wording (Paper steps 1 to 6, 10, 14, 15, 18, G1 and the step 21 and 22 tables). Titles, not names:
 * "the Branch Manager", never a person's name; a name shows only where a record states who did something. Words not drawn in
 * Paper are the owner-approved proposals of `docs/sessions/block-1-fe-phone-gaps.md` (Amendment 2). The back end sends facts and
 * action keys only; every title, body and label is written here.
 */

// --- Errors, by audience (heads on the phone: "Your list ...") ------------------------------------------------------------

export const HEAD_ERROR_COPY: Record<string, string> = {
  REQUISITION_ALREADY_OPEN: "This cycle's requisition is already started. Open it from Requisitions.",
  INVALID_PIN: 'That PIN is not right. Try again.',
  NOT_YOUR_DEPARTMENT: 'That belongs to another department.',
  SECTION_EMPTY: 'Add at least one line before you send.',
  ITEM_NOT_IN_DEPARTMENT: "That item is not on your department's list.",
  ALREADY_APPROVED: 'This requisition is already approved.',
  NOT_READY_TO_APPROVE: 'Not every section is in yet.',
  ADDITION_LOCKED: 'Your delivery is already signed. Start an Extra instead.',
  REASON_REQUIRED: 'Give a reason for the change.',
  DEPARTMENT_PACKED: "The store has already packed this. It can't change now.",
  CANCELLED: 'This requisition was cancelled.',
  SECTION_NOT_SENT: 'Your list has not been sent.',
  SECTION_ALREADY_SENT: 'Your list is already sent. Recall it to change it.',
  NOT_APPROVED: 'This requisition is not approved yet.',
  SECTION_NOT_OPEN: "This list can't be changed now.",
  ADDITION_NOT_PENDING: 'That addition is no longer waiting.',
  BRANCH_CODE_MISSING: 'This branch has no code yet. Ask the owner to set it.',
};

export const OFFLINE_MESSAGE = 'No connection. Your list is kept; try again when you are back online.';
export const GENERIC_ERROR_MESSAGE = 'Something went wrong. Try again.';

/** The words for whatever a call threw: a known code gets its line, a lost connection the offline line, anything else the generic one. */
export function headErrorMessage(err: unknown, fallback: string = GENERIC_ERROR_MESSAGE): string {
  if (err instanceof ApiError) {
    const known = HEAD_ERROR_COPY[err.code];
    if (known) return known;
    if (err.statusCode === 401) return 'Your session ended. Sign in again, then try again.';
    if (err.statusCode === 403) return 'You do not have access to do this.';
    return fallback;
  }
  if (err instanceof TypeError) return OFFLINE_MESSAGE;
  return fallback;
}

export const errorCodeOf = (err: unknown): string | null => (err instanceof ApiError ? err.code : null);

// --- Home (step 1, 18) ------------------------------------------------------------------------------------------------------

/** "Nothing asked for yet this afternoon". Extra with no Afternoon asks "Need something extra?"; no evening headline. */
export function homeHeadline(cycle: RequisitionCycle, afternoonExists: boolean): string {
  if (cycle === 'MORNING') return 'Nothing asked for yet this morning';
  if (cycle === 'AFTERNOON') return 'Nothing asked for yet this afternoon';
  return afternoonExists ? 'Something came up after the Afternoon one?' : 'Need something extra?';
}

export const homeLine = (departmentName: string, count: number): string =>
  count > 0
    ? `We fill it in for you: ${count} ${departmentName} ${count === 1 ? 'item is' : 'items are'} below their restock level. You check the list before anything is sent.`
    : `Nothing in ${departmentName} is below its restock level. You can still start the requisition and add what you need.`;

export const startLabel = (cycle: RequisitionCycle, urgent: boolean): string => {
  if (cycle === 'EXTRA') return urgent ? 'Start an urgent Extra requisition' : 'Start an Extra requisition';
  const word = cycle === 'MORNING' ? 'morning' : 'afternoon';
  return urgent ? `Start an urgent ${word} requisition` : `Start the ${word} requisition`;
};

export const URGENT_SWITCH = {
  title: 'Mark as urgent',
  body: 'The Branch Manager is told at once. If it is not approved within 1 hour, the Director is told too and can approve it with their own PIN.',
  notePlaceholder: 'Why is it urgent? (optional)',
  noteLabel: 'Why it is urgent',
  noteMax: 200,
};

export const HOME_COPY = {
  subtitle: (department: string): string => `${department} · asking the Central Store`,
  whichRequisition: 'Which requisition',
  earlierToday: 'Earlier today',
  openCycle: (cycleLabel: string): string => `Open ${cycleLabel}`,
  cycleOpenHint: 'Already started',
  loading: 'Getting your requisitions',
} as const;

// --- Section screens (steps 2, 3, 4, 5, 6) ------------------------------------------------------------------------------------

export const SECTION_COPY = {
  filledIn: (n: number): string => `${n} ${n === 1 ? 'line' : 'lines'}, filled in from your restock levels.`,
  filledInNone: 'Nothing was filled in. Add what you need.',
  changeLines: 'Change lines',
  changeIntro: 'Change what you need. The Branch Manager sees what you changed.',
  addAnItem: '+ Add an item',
  footerNothingChanged: (n: number): string => `${n} ${n === 1 ? 'line' : 'lines'} · nothing changed`,
  toTheManager: 'To the Branch Manager',
  sendAsSuggested: 'Send as suggested',
  reviewAndSend: 'Review and send',
  removed: (name: string): string => `${name} removed`,
  undo: 'Undo',
  changedFrom: (was: string, unit: string | null): string => (unit ? `Changed from ${was} ${unit}` : `Changed from ${was}`),
  addedLine: 'Added to your list',
  onHandLevel: (onHand: string, level: string, long: boolean): string => `On hand ${onHand} · ${long ? 'Restock level' : 'Level'} ${level}`,
  lines: (n: number): string => `${n} ${n === 1 ? 'line' : 'lines'}`,
  urgentTag: 'Urgent',
  saving: 'Saving',
  saved: 'Saved',
  saveFailed: 'Could not save your last change. It is kept on this phone. Try again.',
  loading: 'Opening your list',
  noLines: 'Your list is empty. Add an item to send it.',
} as const;

export function changeSummary(lineCount: number, changed: number, removed: number): string {
  const parts = [`${lineCount} ${lineCount === 1 ? 'line' : 'lines'}`];
  if (changed > 0) parts.push(`${changed} changed`);
  if (removed > 0) parts.push(`${removed} removed`);
  return parts.join(' · ');
}

export const ADD_ITEM_COPY = {
  subtitle: (department: string): string => `${department} items only`,
  placeholder: 'Search items',
  found: (n: number): string => `${n} found`,
  add: '+ Add',
  alreadyOnList: (qty: string, unit: string): string => `Already on your list · ${qty} ${unit}`,
  addedToList: (unit: string): string => `Added to your list · ${unit}`,
  onHandLevel: (onHand: string | undefined, level: string | undefined, unit: string): string =>
    onHand !== undefined && level !== undefined ? `On hand ${onHand} ${unit} · Level ${level}` : unit,
  summary: (lines: number, added: number): string => `${lines} lines · ${added} added`,
  back: 'Back to my list',
  none: 'No item matches. Clear the search to see every item for your department.',
  clear: 'Clear the search',
} as const;

export const SEND_SHEET_COPY = {
  title: (department: string): string => `Send ${department}'s list for approval?`,
  subtitle: (reference: string, cycleLabel: string, branch: string): string => `${reference} · ${cycleLabel} · ${branch}`,
  yourList: 'Your list',
  items: (n: number): string => `${n} ${n === 1 ? 'item' : 'items'}`,
  changes: (n: number): string => `${n} ${n === 1 ? 'change' : 'changes'}`,
  goesTo: 'Goes to the Branch Manager',
  seeEveryLine: 'See every line',
  hideEveryLine: 'Hide the lines',
  noteLabel: 'Note for the Branch Manager (optional)',
  noteMax: 200,
  pinLabel: 'Your PIN',
  confirm: 'Send for approval',
} as const;

// --- Sent, told, approved (steps 6, 10, 14) ---------------------------------------------------------------------------------

export interface Banner {
  tone: 'warning' | 'info' | 'success' | 'error';
  title: string;
  body: string;
}

export const SENT_COPY = {
  recall: 'Recall my list',
  recallHint: 'Recall it to change something. You can recall until the Branch Manager approves.',
  recallHintShort: 'You can recall until the Branch Manager approves.',
  seeLines: 'See lines',
  whereItIs: 'Where it is',
  changedFromSuggestion: (n: number): string => `${n} changed from the suggestion`,
  changedByManager: (n: number): string => `${n} changed by the Branch Manager`,
  recalling: 'Recalling',
  recalled: 'Your list is back with you. Change it, then send it again.',
} as const;

export function waitingBanner(sentAt: string, lineCount: number): Banner {
  return {
    tone: 'warning',
    title: 'Waiting for the Branch Manager',
    body: `You sent ${lineCount} ${lineCount === 1 ? 'line' : 'lines'} at ${sentAt}. You'll be told as soon as they are approved.`,
  };
}

/** Step 10: one line changed, or several. Nothing for the head to do. */
export function managerChangedBanner(lines: ReadonlyArray<{ itemName: string; asked: string; approved: string; unit: string; reason: string | null }>): Banner {
  const n = lines.length;
  const first = lines[0];
  const body =
    n === 1 && first
      ? `${first.itemName}: you asked for ${first.asked} ${first.unit}, ${first.approved} were approved.${first.reason ? ` Reason: ${first.reason}.` : ''} Nothing for you to do.`
      : `${n} lines were changed. Each is marked below. Nothing for you to do.`;
  return { tone: 'warning', title: n === 1 ? 'The Branch Manager changed 1 line' : `The Branch Manager changed ${n} lines`, body };
}

/** Approved, not yet packed (Amendment 2): the Approved row only; the Block 2 rows stay greyed with no dates. */
export const APPROVED_BANNER: Banner = { tone: 'info', title: 'Approved, with the store', body: 'The Central Store will pack it.' };

export const CLOSED_BANNER: Banner = { tone: 'success', title: 'Closed', body: 'Every department confirmed. Nothing changes now.' };
export const CANCELLED_BANNER = (reason: string | null): Banner => ({
  tone: 'error',
  title: 'Cancelled',
  body: reason ? `It stays on record as Cancelled. Reason: ${reason}.` : 'It stays on record as Cancelled.',
});
export const SKIPPED_BANNER: Banner = { tone: 'warning', title: 'Sent without your section', body: 'The Branch Manager sent the requisition without your list. Start an Extra if you still need something.' };
export const COLLECTING_BANNER: Banner = { tone: 'warning', title: 'Not sent yet', body: 'Your list is waiting for you. Review it, then send it.' };

export function statusBanner(args: {
  requisitionStatus: RequisitionStatus;
  sectionStatus: SectionStatus;
  sentAt: string | null;
  lineCount: number;
  cancelReason: string | null;
  changedByManagerLines: ReadonlyArray<{ itemName: string; asked: string; approved: string; unit: string; reason: string | null }>;
}): Banner {
  const { requisitionStatus, sectionStatus } = args;
  if (requisitionStatus === 'CANCELLED') return CANCELLED_BANNER(args.cancelReason);
  if (requisitionStatus === 'CLOSED') return CLOSED_BANNER;
  if (sectionStatus === 'SKIPPED') return SKIPPED_BANNER;
  if (sectionStatus === 'NOT_STARTED' || sectionStatus === 'DRAFT') return COLLECTING_BANNER;
  if (requisitionStatus === 'APPROVED') return APPROVED_BANNER;
  if (args.changedByManagerLines.length > 0) return managerChangedBanner(args.changedByManagerLines);
  return waitingBanner(args.sentAt ?? '', args.lineCount);
}

// --- The head's tracker (steps 6, 10, 14) -----------------------------------------------------------------------------------

export interface RailStep {
  key: string;
  title: string;
  /** The second line: who and when, or what it waits for. Null draws no second line. */
  line: string | null;
  state: 'DONE' | 'CURRENT' | 'TODO';
}

/** Paper's head tracker, built on the phone from the requisition status, the head's own section and the approval facts. */
export function headTracker(args: {
  departmentName: string;
  requisitionStatus: RequisitionStatus;
  sectionStatus: SectionStatus;
  sentAtText: string | null;
  tracker: readonly TrackerStep[];
  approvedAtText: string | null;
  approvedByLabel: string | null;
  sectionsIn: number;
  sectionsTotal: number;
}): RailStep[] {
  const { departmentName, requisitionStatus: status, sectionStatus } = args;
  const sent = sectionStatus === 'SUBMITTED';
  const approved = status === 'APPROVED' || status === 'CLOSED';
  const asked: RailStep = {
    key: 'asked',
    title: `${departmentName} asked`,
    line: sent ? `You, ${args.sentAtText ?? ''}`.trim() : sectionStatus === 'DRAFT' ? 'Drafting' : sectionStatus === 'SKIPPED' ? 'Skipped' : `${departmentName} hasn't started`,
    state: sent ? 'DONE' : 'CURRENT',
  };
  if (approved) {
    // Paper step 14: once approved the rail starts at Approved. The Block 2 rows stay greyed with no dates until Dispatch is built.
    return [
      { key: 'approves', title: 'Approved', line: [args.approvedByLabel, args.approvedAtText].filter(Boolean).join(', ') || null, state: 'DONE' },
      { key: 'packs', title: 'Packed and signed', line: null, state: 'TODO' },
      { key: 'way', title: 'On the way', line: null, state: 'TODO' },
      { key: 'confirms', title: 'You count it and sign', line: null, state: 'TODO' },
    ];
  }
  const waitingOthers = sent && args.sectionsIn < args.sectionsTotal;
  const approves: RailStep = {
    key: 'approves',
    title: 'Branch Manager approves',
    line: sent ? (waitingOthers ? 'Waiting for the other sections' : 'Waiting') : null,
    state: sent ? 'CURRENT' : 'TODO',
  };
  // Block 2 rows: greyed, no dates, until the Dispatch group is built.
  const packs: RailStep = { key: 'packs', title: 'Store packs and sends', line: null, state: 'TODO' };
  const confirms: RailStep = { key: 'confirms', title: `${departmentName} counts and confirms`, line: null, state: 'TODO' };
  return [asked, approves, packs, confirms];
}

// --- After approval, additions (step 15) ------------------------------------------------------------------------------------

export const ADDITION_COPY = {
  button: 'Add to this requisition',
  hint: 'Allowed until your delivery is signed. After that, start an Extra.',
  headerTitle: (department: string): string => `Add to ${department}'s list`,
  approvedBlock: (n: number): string => `Approved · ${n} ${n === 1 ? 'line' : 'lines'}`,
  staysApproved: 'These stay as approved',
  addedBlock: 'Added after approval',
  newItem: (onHand: string | undefined, unit: string): string => (onHand !== undefined ? `New item · On hand ${onHand} ${unit}` : 'New item'),
  moreOf: (already: string): string => `More of an approved item · ${already} already`,
  sheetTitle: (n: number): string => (n === 1 ? 'Ask for 1 more line?' : `Ask for ${n} more lines?`),
  sheetBody: 'The Branch Manager approves these before they go to the store. Your approved lines are not touched.',
  linesAdded: (n: number): string => `${n} ${n === 1 ? 'line' : 'lines'} added`,
  waitingForApproval: 'Waiting for approval',
  pendingTitle: 'Added after approval',
  pendingBody: 'Waiting for the Branch Manager to approve your added lines.',
  approvedAddition: 'The Branch Manager approved your added lines.',
  confirm: 'Send for approval',
  pinLabel: 'Your PIN',
} as const;

// --- History (G1) -----------------------------------------------------------------------------------------------------------

export const HISTORY_COPY = {
  title: 'History',
  subtitle: (dateText: string, department: string): string => `${dateText} · ${department}`,
  empty: 'No requisitions in this range. Widen the dates or clear the status.',
  error: 'Could not load your past requisitions. Nothing was changed. Try again.',
  loading: 'Getting your past requisitions',
  statusAll: 'Status: All',
  statusLabel: (s: string): string => `Status: ${s}`,
  showing: (from: number, to: number, total: number): string => `Showing ${from} to ${to} of ${total}`,
  sentOn: (when: string): string => `Sent ${when}`,
  cancelledOn: (when: string, reason: string | null): string => (reason ? `Cancelled ${when} · ${reason}` : `Cancelled ${when}`),
  notSent: 'Not sent',
} as const;

/** The reason shown on a row: "preset — note" reads "preset · note". */
export const cancelReasonText = (reason: string | null): string | null => (reason ? reason.replace(' — ', ' · ') : null);

// --- Next step card actions (the head's phone only uses a few) --------------------------------------------------------------

export const NEXT_STEP_BUTTON: Partial<Record<NextStepAction, string>> = {
  SEND_SECTION: 'Send for approval',
  ADD_TO_THIS_REQUISITION: 'Add to this requisition',
  START_A_NEW_ONE: 'Start a new one',
  PRINT: 'Print',
};

export const SIGN_COPY = {
  settingUp: 'Checking your signing PIN',
  signing: 'Signing',
} as const;
