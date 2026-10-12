import type { DispatchStage } from '../types/dispatch-contract';

/**
 * Dispatch, deliveries and discrepancies wording SKELETON: only what Paper step D21 ("Every state, findings and wording") gives. The
 * front-end sessions write the rest (per-screen States kit copy, error wording by audience, notification text) from their own gap reports.
 * Titles, not names: write "the Store Manager", never a person's name; names appear only where a record states who did something.
 * The finding names, stock effects and "recorded against" lines are in `discrepancies-contract.ts` (`FINDING_TEXT`, `FINDING_PROFILE`).
 */

/** "One file, eight states": the tracker line, who does what, and the main button (D21, first table). */
export interface DispatchStateRow {
  stage: DispatchStage;
  state: string;
  tracker: string;
  whoDoesWhat: string;
  mainButton: string;
}

export const DISPATCH_STATE_ROWS: readonly DispatchStateRow[] = [
  { stage: 'TO_PACK', state: 'To pack', tracker: 'Approved', whoDoesWhat: 'The Store Attendant or Store Manager packs, department by department', mainButton: 'Start here' },
  {
    stage: 'PACKING',
    state: 'Packing',
    tracker: 'Approved, some departments packed',
    whoDoesWhat: 'Nothing is signed and no stock has left yet; the packer can go back to any department',
    mainButton: 'Done with a department',
  },
  {
    stage: 'READY_TO_SEND',
    state: 'Ready to send',
    tracker: 'Every department packed',
    whoDoesWhat: 'One final review: carried by, PIN, send once for the whole requisition',
    mainButton: 'Sign and send',
  },
  {
    stage: 'ON_THE_WAY',
    state: 'On the way',
    tracker: 'Packed and signed, with the carrier',
    whoDoesWhat: 'The department counts its own delivery, blind; the store can still cancel until then',
    mainButton: 'Count the delivery (department)',
  },
  {
    stage: 'WAITING_FOR_BRANCH',
    state: 'Waiting for the branch',
    tracker: 'On the way, 2 hours after arrival',
    whoDoesWhat: "The Branch Manager is nudged; the department's day cannot close",
    mainButton: 'Confirm for the department (Branch Manager)',
  },
  {
    stage: 'GAP_HELD',
    state: 'Gap held',
    tracker: 'Counted, a difference is unaccounted',
    whoDoesWhat: "The Store Manager records one finding; the branch's part is over",
    mainButton: 'Record a finding',
  },
  {
    stage: 'CLOSED',
    state: 'Closed',
    tracker: 'Counted and settled',
    whoDoesWhat: 'Everyone can open it; a finding can be reversed with a reason and PIN',
    mainButton: 'Print',
  },
  {
    stage: 'CANCELLED',
    state: 'Cancelled',
    tracker: 'Stops where it was cancelled, with the reason',
    whoDoesWhat: 'Only after signing and before the branch counts; stock returns by a linked entry',
    mainButton: 'Pack again',
  },
];

/** "What the screens say" (D21, last table): the moments and the words Paper gives. */
export interface DispatchWordingRow {
  moment: string;
  whoSeesIt: string;
  words: readonly string[];
}

export const DISPATCH_WORDING_ROWS: readonly DispatchWordingRow[] = [
  { moment: 'A line is short at the store', whoSeesIt: 'Store Attendant', words: ['Not enough in store', 'Asked 2 · only 1 in store', 'A short line is normal. It is not carried over.'] },
  {
    moment: 'The final review',
    whoSeesIt: 'Store Attendant',
    words: ['Nothing leaves the store until you sign the final review.', 'Five delivery notes, one per department', 'Sign and send to Nyeri Town'],
  },
  {
    moment: 'The blind count',
    whoSeesIt: 'Department member',
    words: ['Count what is in the boxes. Nothing is shown to copy.', "This doesn't match what was sent. Count again.", 'Why is it different?'],
  },
  {
    moment: 'After the branch signs',
    whoSeesIt: 'Member, Store Manager',
    words: ['Milk 1L is short by 2.', 'The Store Manager has been told. You do not need to do anything more.', 'Milk 1L is short by 2: record what happened'],
  },
  {
    moment: 'Nobody counts it',
    whoSeesIt: 'Branch Manager',
    words: ['Nobody in Pastry has counted it yet', "Confirm Pastry's delivery for them", 'Signed by the Branch Manager, on behalf of Pastry.'],
  },
  {
    moment: 'Cancel',
    whoSeesIt: 'Store Manager',
    words: ['Cancel this dispatch?', 'The Kitchen has not counted this delivery yet.', 'The delivery note is voided. Kept on file, marked Cancelled.'],
  },
  {
    moment: 'Reverse a finding',
    whoSeesIt: 'Store Manager',
    words: ['Reverse this finding?', 'Both entries stay on the file and in the audit log.', 'Keep the finding'],
  },
  // Approved as written in Dispatch Amendment 1 (9 Oct 2026); the rest is written by the front-end sessions.
  {
    moment: 'An extra line on the summary (row 15)',
    whoSeesIt: 'Department member',
    words: ['You counted 26, 24 were sent. The Store Manager will say what happened to the 2 extra.'],
  },
  {
    moment: 'Confirm for a department that has not counted (D19, row 1)',
    whoSeesIt: 'Branch Manager',
    words: ['It left at 3:05 pm. Nobody in Pastry has counted it yet.'],
  },
  {
    moment: 'Some departments left out at the final review (D6, row 2)',
    whoSeesIt: 'Store Attendant',
    words: ['4 of 5 departments sent. Pastry is still to pack.', 'Not ready · stays in To pack'],
  },
  {
    moment: 'No carrier is set up (row 3)',
    whoSeesIt: 'Store Attendant',
    words: ['No carrier is set up. Ask the Store Manager to add one in Settings.'],
  },
];
