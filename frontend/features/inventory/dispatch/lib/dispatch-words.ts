import type { Chip } from '../../requisitions/_shared/lib/requisitions-words';
import { clock, dayLabel } from '../../requisitions/_shared/lib/requisitions-words';
import type { DiscrepancyFile, Finding, GapDirection } from '../../discrepancies/_shared/types/discrepancies-contract';
import { FINDING_TEXT } from '../../discrepancies/_shared/types/discrepancies-contract';
import type { CarrierKind, DispatchFile, DispatchStage, Stamp, TrackerStep } from '../_shared/types/dispatch-contract';
import { itemWord } from '../../_shared/lib/block2-words';
import type { Person } from '../../_shared/types/wire';

/**
 * The words of the Dispatch, Discrepancies and Carriers desktop screens. The back end sends keys and facts only; every chip, title,
 * body and error sentence is written here from Paper D13 to D22 (chapter 12's states and wording sheet is the source) and the
 * owner's picks of 9 Oct 2026. Names appear as "Name · Title" where a record states who did something.
 */

export { clock, dayLabel };

export const nameAndTitle = (person: Pick<Person, 'name' | 'roleLabel'>): string => `${person.name} · ${person.roleLabel}`;
/** "Peter K., Store Attendant" (tracker second lines). */
export const nameComma = (person: Pick<Person, 'name' | 'roleLabel'>): string => `${person.name}, ${person.roleLabel}`;

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;
const lineWord = (n: number): string => plural(n, 'line', 'lines');

/** "Nyeri Town" -> used with the department: "Barista · Nyeri Town". */
export const fileTitle = (file: Pick<DispatchFile, 'department' | 'branch'>): string => `${file.department.name} · ${file.branch.name}`;

// ── Chips (D22 "The word on every state") ─────────────────────────────────────────────────────────────────────────────────

export function stageChip(stage: DispatchStage): Chip {
  switch (stage) {
    case 'TO_PACK':
      return { text: 'To pack', tone: 'neutral' };
    case 'PACKING':
      return { text: 'Packing', tone: 'warning' };
    case 'READY_TO_SEND':
      return { text: 'Ready to send', tone: 'info' };
    case 'ON_THE_WAY':
      return { text: 'On the way', tone: 'info' };
    case 'WAITING_FOR_BRANCH':
      return { text: 'Waiting for the branch', tone: 'warning' };
    case 'GAP_HELD':
      return { text: 'Gap held · needs a finding', tone: 'warning' };
    case 'CONFIRMED':
      return { text: 'Counted', tone: 'success' };
    case 'CLOSED':
      return { text: 'Closed', tone: 'success' };
    case 'CANCELLED':
      return { text: 'Cancelled', tone: 'neutral' };
  }
}

/** The discrepancy chip: Open · waiting for a finding, Settled · {finding}, Open · gap held again (after a reversal). */
export function discrepancyChip(file: Pick<DiscrepancyFile, 'status' | 'finding' | 'reversal'>): Chip {
  if (file.status === 'RECORDED' && file.finding) return { text: `Settled · ${FINDING_TEXT[file.finding.finding].toLowerCase()}`, tone: 'success' };
  if (file.reversal) return { text: 'Open · gap held again', tone: 'warning' };
  return { text: 'Open · waiting for a finding', tone: 'warning' };
}

// ── Tracker (D22 "One tracker, for every role and every width") ────────────────────────────────────────────────────────────

export interface ProgressStep {
  key: string;
  state: 'DONE' | 'CURRENT' | 'TODO' | 'CANCELLED';
  /** Green ring when the work is going normally, amber when someone has to act. */
  tone: 'ok' | 'act';
  label: string;
  /** "3:03 pm · Peter K., Store Attendant" */
  second: string;
  /** A second small line ("Arrived · 3:28 pm"). */
  third?: string;
}

export function dispatchProgress(file: Pick<DispatchFile, 'tracker' | 'stage' | 'cancelled' | 'arrivedAt' | 'closedAt'>): ProgressStep[] {
  const out: ProgressStep[] = [];
  const act = file.stage === 'GAP_HELD' || file.stage === 'WAITING_FOR_BRANCH';
  const find = (key: TrackerStep['key']): TrackerStep | undefined => file.tracker.find((s) => s.key === key);
  const at = (step: TrackerStep | undefined): string => (step?.at ? clock(step.at) : '');
  const stamp = (step: TrackerStep | undefined): string => [at(step), step?.by ? nameComma(step.by) : ''].filter(Boolean).join(' · ');

  const approved = find('APPROVED');
  const packed = find('PACKED');
  const way = find('ON_THE_WAY');
  const counted = find('COUNTED');
  const closed = find('CLOSED');
  const cancelledBeyond = file.cancelled !== null;

  out.push({ key: 'APPROVED', state: approved?.state ?? 'DONE', tone: 'ok', label: 'Approved', second: stamp(approved) || (approved?.state === 'TODO' ? 'Branch Manager' : '') });
  out.push({ key: 'PACKED', state: packed?.state ?? 'TODO', tone: 'ok', label: 'Packed and signed', second: packed?.state === 'TODO' ? 'Store Attendant' : stamp(packed) });
  const wayStep: ProgressStep = {
    key: 'ON_THE_WAY',
    state: way?.state ?? 'TODO',
    tone: 'ok',
    label: 'On the way',
    second: way?.state === 'TODO' ? 'Carrier' : [at(way), way?.carrier?.name ?? ''].filter(Boolean).join(' · '),
  };
  if (way?.state !== 'TODO' && file.arrivedAt) wayStep.third = `Arrived · ${clock(file.arrivedAt)}`;
  out.push(wayStep);

  if (cancelledBeyond && file.cancelled) {
    out.push({ key: 'CANCELLED', state: 'CANCELLED', tone: 'ok', label: 'Cancelled', second: [clock(file.cancelled.at), nameComma(file.cancelled.by)].join(' · ') });
    return out;
  }
  out.push({
    key: 'COUNTED',
    state: counted?.state ?? 'TODO',
    tone: file.stage === 'WAITING_FOR_BRANCH' && counted?.state === 'CURRENT' ? 'act' : 'ok',
    label: 'Counted at the branch',
    second: counted?.state === 'DONE' ? stamp(counted) : file.stage === 'WAITING_FOR_BRANCH' ? 'Waiting for the branch' : 'Waiting',
  });
  out.push({
    key: 'CLOSED',
    state: closed?.state ?? 'TODO',
    tone: act && closed?.state === 'CURRENT' ? 'act' : 'ok',
    label: 'Closed',
    second: closed?.state === 'DONE' ? `${closed.at ? clock(closed.at) : ''}${closed.at && file.stage === 'CLOSED' && counted?.at && Math.abs(new Date(counted.at).getTime() - new Date(closed.at).getTime()) <= 60_000 ? ' · at once' : ''}` : file.stage === 'GAP_HELD' ? 'After a finding' : '',
  });
  return out;
}

// ── The Next step card (D13, D21, D22) ──────────────────────────────────────────────────────────────────────────────────────

export interface DispatchNextWords {
  title: string;
  body: string;
  /** The label of the one main button; the screen shows it only when the caller can do it. */
  actionLabel: string | null;
  tone: 'amber' | 'green' | 'neutral';
}

const roleOf = (file: Pick<DispatchFile, 'department'>): string => file.department.name;

/** A short word for the gap of one line: "Milk 1L is short by 2" / "over by 2". */
export function gapSentence(itemName: string, gap: string): string {
  const n = Math.abs(Number(gap));
  return `${itemName} is ${Number(gap) < 0 ? 'short' : 'over'} by ${Number.isFinite(n) ? n : gap}`;
}

export function dispatchNextWords(file: DispatchFile): DispatchNextWords {
  const dept = roleOf(file);
  switch (file.stage) {
    case 'TO_PACK':
    case 'PACKING':
      return { title: `${dept}'s lines are waiting to be packed`, body: 'The Store Attendant packs department by department and signs once for the whole requisition. Nothing leaves the store until then.', actionLabel: file.stage === 'TO_PACK' ? 'Pack' : 'Continue packing', tone: 'neutral' };
    case 'READY_TO_SEND':
      return { title: 'Every department is packed', body: 'One final review: who carries it, then a PIN. Nothing leaves the store until it is signed.', actionLabel: 'Sign and send', tone: 'neutral' };
    case 'ON_THE_WAY':
      return {
        title: `The ${dept} delivery is on the way`,
        body: file.can.cancel
          ? `Left the store at ${clock(file.signed.at)}. The ${dept} counts it when it arrives. You can cancel until then.`
          : `Left the store at ${clock(file.signed.at)}. The ${dept} counts it when it arrives. Nothing for you to do.`,
        actionLabel: null,
        tone: 'neutral',
      };
    case 'WAITING_FOR_BRANCH':
      return {
        title: `Nobody in ${dept} has counted it yet`,
        body: `It left at ${clock(file.signed.at)} and the 2 hours are over. ${dept}'s day cannot close until it is counted. The Branch Manager can confirm for the department.`,
        actionLabel: 'Confirm for the department',
        tone: 'amber',
      };
    case 'GAP_HELD': {
      const gaps = file.items.filter((i) => i.discrepancy && i.discrepancy.status === 'OPEN');
      const only = gaps.length === 1 ? gaps[0] : undefined;
      if (only && only.gapQty !== undefined && only.gapQty !== null) {
        const over = Number(only.gapQty) > 0;
        const n = Math.abs(Number(only.gapQty));
        return {
          title: `${gapSentence(only.itemName, only.gapQty)}: record what happened`,
          body: over
            ? `The ${dept} counted ${only.countedQty ?? ''} and ${only.sentQty ?? ''} were sent. Talk to the packer, then record one finding. The ${n} extra are held as unaccounted until you do.`
            : `The ${dept} counted ${only.countedQty ?? ''} and ${only.sentQty ?? ''} were sent. Talk to the packer and the carrier if you need to, then record one finding. The ${n} ${shortName(only.itemName)} are held until you do.`,
          actionLabel: 'Record a finding',
          tone: 'amber',
        };
      }
      return { title: `${gaps.length || file.nextStep.facts.gapLineCount} lines differ: record what happened to each`, body: 'Talk to the packer and the carrier if you need to, then record one finding for each line. The gaps are held as unaccounted until you do.', actionLabel: 'Record a finding', tone: 'amber' };
    }
    case 'CONFIRMED':
    case 'CLOSED': {
      if (file.items.some((i) => i.discrepancy)) return { title: 'Every gap has a finding', body: `The ${dept} counted ${lineWord(file.lineCount)} and the differences are settled. Both the findings and the counts stay on file.`, actionLabel: null, tone: 'green' };
      return { title: 'Nothing to do: everything matched', body: `The ${dept} head counted all ${file.lineCount} lines and every count matched what was sent. Their stock is updated, no discrepancy was opened, and this dispatch closed by itself.`, actionLabel: null, tone: 'green' };
    }
    case 'CANCELLED':
      return { title: 'This dispatch was cancelled', body: `${file.cancelled ? `${nameAndTitle(file.cancelled.by)} cancelled it at ${clock(file.cancelled.at)}: ${file.cancelled.reason}. ` : ''}The stock is back in the Central Store and the lines are in To pack. The delivery note is kept, marked void.`, actionLabel: 'Pack again', tone: 'neutral' };
  }
}

/** "milk" from "Milk 1L": the first word, lower-cased, for "the 2 milk are held". */
const shortName = (itemName: string): string => itemWord(itemName);

// ── The discrepancy file's cards ─────────────────────────────────────────────────────────────────────────────────────────────

export function discrepancyTitle(file: Pick<DiscrepancyFile, 'item' | 'gapQty' | 'direction'>): string {
  const n = Math.abs(Number(file.gapQty));
  return `${file.item.name} is ${file.direction === 'EXTRA' ? 'over' : 'short'} by ${n}`;
}

export function discrepancyNextWords(file: DiscrepancyFile): { title: string; body: string } {
  const n = Math.abs(Number(file.gapQty));
  const what = shortName(file.item.name);
  const again = file.reversal !== null;
  const title = file.direction === 'EXTRA' ? `Record what happened to the ${n} extra ${what}${again ? ', again' : ''}` : `Record what happened to the ${n} ${what}${again ? ', again' : ''}`;
  const reminder = `A reminder goes to you after ${file.nextStep.facts.reminderAfterHours} hours, then daily.`;
  if (again && file.reversal) return { title, body: `The earlier finding was reversed at ${clock(file.reversal.reversed.at)} and the ${n} ${what} are held as unaccounted again. Both entries stay on file. ${reminder}` };
  return { title, body: `Opened ${sinceOpened(file.openedAt)} ago. ${reminder} The Director and the Branch Manager have been told.` };
}

function sinceOpened(iso: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 60) return plural(minutes, 'minute', 'minutes');
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return plural(hours, 'hour', 'hours');
  return plural(Math.floor(hours / 24), 'day', 'days');
}

/** The long description of a finding on the Record drawer (D15), by direction, written in D15's voice (D22's Extra-line table). */
export function findingDescription(finding: Finding, direction: GapDirection, ctx: { sent: string; counted: string; gap: number; item: string }): { title: string; body: string; against: string; loss: string } {
  const n = ctx.gap;
  if (direction === 'EXTRA') {
    switch (finding) {
      case 'PACKED_MORE':
        return { title: FINDING_TEXT.PACKED_MORE, body: `The store sent ${ctx.counted} but recorded ${ctx.sent}. Store stock goes down by ${n}. Recorded against the store, who packed and who signed. A loss: no, a packing error on its own report line.`, against: 'Recorded against the store, who packed and who signed', loss: 'A loss: no, a packing error on its own report line.' };
      case 'BRANCH_COUNTED_WRONG':
        return { title: FINDING_TEXT.BRANCH_COUNTED_WRONG, body: `Only ${ctx.sent} arrived. The department's stock is corrected down by ${n}. Recorded against the receiver. A loss: no.`, against: 'Recorded against the receiver', loss: 'A loss: no.' };
      default:
        return { title: FINDING_TEXT.CANT_TELL, body: `Nobody can say. The department keeps the ${n} extra and they are recorded as unexplained. Recorded against: unexplained, its own bucket. A loss: no, an unexplained surplus.`, against: 'Recorded against: unexplained, its own bucket', loss: 'A loss: no, an unexplained surplus.' };
    }
  }
  switch (finding) {
    case 'PACKED_SHORT':
      return { title: FINDING_TEXT.PACKED_SHORT, body: `The store recorded ${ctx.sent} but sent ${ctx.counted}. The ${n} return to store stock. Recorded against the packer; an error, not a loss.`, against: 'Recorded against the packer', loss: 'A loss: no, a packing error.' };
    case 'LOST_OR_DAMAGED':
      return { title: FINDING_TEXT.LOST_OR_DAMAGED, body: 'Left the store, never arrived. Written off at cost. Recorded against the carrier. A loss.', against: 'Recorded against the carrier', loss: 'A loss: yes.' };
    case 'BRANCH_COUNTED_WRONG':
      return { title: FINDING_TEXT.BRANCH_COUNTED_WRONG, body: `All ${ctx.sent} arrived. The department's stock is corrected up by ${n}. Not a loss.`, against: 'Recorded against the receiver', loss: 'A loss: no.' };
    default:
      return { title: FINDING_TEXT.CANT_TELL, body: 'Nobody can say. Written off at cost as unexplained. A loss.', against: 'Recorded against: unexplained', loss: 'A loss: yes.' };
  }
}

/** The drawer title: "What happened to the 2 milk?" / "What happened to the 2 extra milk?" */
export function drawerTitle(item: string, gap: number, direction: GapDirection): string {
  return `What happened to the ${gap}${direction === 'EXTRA' ? ' extra' : ''} ${shortName(item)}?`;
}

/** The sentence under a recorded finding (E1), by finding. */
export function recordedBody(finding: Finding, ctx: { sent: string; counted: string; gap: number; item: string }): string {
  const n = ctx.gap;
  const what = shortName(ctx.item);
  switch (finding) {
    case 'PACKED_SHORT':
      return `The store recorded ${ctx.sent} but packed ${ctx.counted}. The ${n} ${what} went back into Central Store stock. This is shown as a packing error on its own report line, not as a loss.`;
    case 'PACKED_MORE':
      return `The store packed ${ctx.counted} but recorded ${ctx.sent}. Store stock went down by ${n}. This is shown as a packing error on its own report line, not as a loss.`;
    case 'LOST_OR_DAMAGED':
      return `The ${n} ${what} left the store and never arrived. They are written off at the cost frozen at dispatch and recorded against the carrier.`;
    case 'BRANCH_COUNTED_WRONG':
      return `All ${ctx.sent} arrived. The department's stock was corrected by ${n}. Recorded against the receiver; not a loss.`;
    case 'CANT_TELL':
      return `Nobody could say. The ${n} ${what} are recorded as unexplained, in their own bucket.`;
  }
}

// ── Print, cancel, reverse ────────────────────────────────────────────────────────────────────────────────────────────────

export const CANCEL_WARNING = (department: string): string => `The ${department} has not counted this delivery yet. Once it has, a dispatch cannot be cancelled; any gap becomes a discrepancy.`;
export const REVERSE_PRESETS = ['The item turned up', 'Recorded in error', 'Other'] as const;
export type ReversePreset = (typeof REVERSE_PRESETS)[number];

// ── Errors (D22 "Print, and cancel when it is allowed"; picks of 9 Oct) ────────────────────────────────────────────────────

const ERROR_WORDS: Record<string, string> = {
  INVALID_PIN: 'That PIN is not right. Try again.',
  DISPATCH_ALREADY_COUNTED: 'The branch has already counted this delivery, so it cannot be cancelled. Any gap is now a discrepancy.',
  DISPATCH_CANCELLED: 'The store cancelled this delivery.',
  ALREADY_SIGNED: 'This was already signed and sent.',
  CARRIER_NAME_TAKEN: 'A carrier with this name already exists. Use another name.',
  CARRIER_INACTIVE: 'That carrier is no longer on the list. Choose another.',
  FINDING_ALREADY_RECORDED: 'A finding is already recorded for this gap.',
  FINDING_NOT_REVERSIBLE: 'This finding cannot be reversed. It may already have been.',
  FINDING_NOT_ALLOWED: 'That finding does not fit this gap. Choose another.',
  ALREADY_CONFIRMED: 'Someone from the department already confirmed this delivery.',
  NOT_COUNTED: 'Count every line before you sign.',
  RECOUNT_USED: 'Your second count is final.',
  REASON_REQUIRED: 'Pick a reason for each line that still differs.',
  NOT_YOUR_DEPARTMENT: 'That delivery belongs to another department.',
  PHOTO_TOO_LARGE: 'That photo is over 5 MB.',
  TOO_MANY_PHOTOS: 'You can add up to 3 photos.',
};

export const errorText = (code: string | null, serverMessage: string | null, fallback = 'Something went wrong. Try again.'): string => (code ? ERROR_WORDS[code] : undefined) ?? serverMessage ?? fallback;

// ── Empty copy per list (D22) ─────────────────────────────────────────────────────────────────────────────────────────────────

export const EMPTY: Record<'to-pack' | 'on-the-way' | 'to-confirm' | 'open' | 'settled' | 'carriers' | 'carriers-readonly' | 'dispatches', { title: string; line: string }> = {
  'to-pack': { title: 'Nothing to pack', line: 'Approved requisitions appear here.' },
  'on-the-way': { title: 'Nothing is on the way', line: 'Deliveries you have signed and sent show here until the branch counts them.' },
  'to-confirm': { title: 'No delivery is waiting for the branch', line: 'A delivery shows here when a department has not counted it 2 hours after it was sent.' },
  open: { title: 'Nothing is waiting for a finding', line: 'Every gap has been explained.' },
  settled: { title: 'No settled discrepancies yet', line: 'A recorded finding moves its discrepancy here.' },
  carriers: { title: 'No carriers yet', line: 'Add the first one.' },
  'carriers-readonly': { title: 'No carriers yet', line: 'No carriers have been set up.' },
  dispatches: { title: 'No dispatches yet', line: 'One dispatch per department appears when the requisition is approved.' },
};

export const CARRIER_KIND_TEXT: Record<CarrierKind, string> = { PERSON: 'Person', VEHICLE: 'Vehicle', COMPANY: 'Courier company' };

export const dayOnly = (iso: string): string => dayLabel(iso);

export type { Stamp };
