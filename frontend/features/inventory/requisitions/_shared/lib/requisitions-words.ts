import type { NextStepAction, RequisitionFile, RequisitionStatus, SectionStatus, TrackerStep } from '../types/requisitions-contract';

/**
 * The words of the Requisitions desktop screens. The back end sends action keys and facts only (Amendment 2); every title, body,
 * label and error sentence is written here from Paper step 22 and the owner-approved gap-report proposals. Titles, not names.
 */

// ── Time and money (Africa/Nairobi) ──────────────────────────────────────────────────────────────────────────────────────────

const TZ = 'Africa/Nairobi';

/** "1:41 pm" */
export const clock = (iso: string): string =>
  new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(iso)).replace(' AM', ' am').replace(' PM', ' pm');

/** "Wed 7 Oct" */
export const dayLabel = (iso: string): string => new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(iso)).replace(',', '');

/** "Wed 7 Oct · 9:12 am" */
export const dayAndClock = (iso: string): string => `${dayLabel(iso)} · ${clock(iso)}`;

/** "58,020" (no decimals when whole). */
export const kes = (value: string): string => {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString('en-US', { maximumFractionDigits: 2 }) : value;
};

/** "17 min", "1 h 01 min", "1 d 2 h". */
export const elapsed = (fromIso: string, now: number = Date.now()): string => {
  const minutes = Math.max(0, Math.floor((now - new Date(fromIso).getTime()) / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ${String(minutes % 60).padStart(2, '0')} min`;
  return `${Math.floor(hours / 24)} d ${hours % 24} h`;
};

// ── Status chips (Paper steps 8, 11, 12, 16) ─────────────────────────────────────────────────────────────────────────────────

export type ChipTone = 'warning' | 'success' | 'info' | 'neutral' | 'error';
export interface Chip {
  text: string;
  tone: ChipTone;
}

/** The chip beside the file's title. An addition waiting and a store that is packing change the Approved chip. */
export function fileChip(file: Pick<RequisitionFile, 'status' | 'additions' | 'dispatches'>): Chip {
  const status: RequisitionStatus = file.status;
  if (status === 'OPEN') return { text: 'Collecting', tone: 'warning' };
  if (status === 'PENDING_APPROVAL') return { text: 'Ready to approve', tone: 'warning' };
  if (status === 'CANCELLED') return { text: 'Cancelled', tone: 'neutral' };
  if (status === 'CLOSED') return { text: 'Closed', tone: 'success' };
  if (file.additions.some((a) => a.status === 'PENDING')) return { text: 'Addition waiting', tone: 'warning' };
  if (file.dispatches.length > 0) return { text: 'Packing and sending', tone: 'info' };
  return { text: 'Approved · with the store', tone: 'success' };
}

// ── The tracker (Paper steps 8, 12, 13) ──────────────────────────────────────────────────────────────────────────────────────

export interface TrackerWords {
  key: TrackerStep['key'];
  state: TrackerStep['state'];
  label: string;
  second: string;
}

export function trackerWords(steps: readonly TrackerStep[], canApprove: boolean): TrackerWords[] {
  return steps.map((step) => {
    const when = step.at ? clock(step.at) : '';
    const who = step.by ? step.by.roleLabel : '';
    switch (step.key) {
      case 'STARTED':
        return { key: step.key, state: step.state, label: 'Started', second: [when, who].filter(Boolean).join(' · ') };
      case 'ALL_IN':
        return step.state === 'DONE'
          ? { key: step.key, state: step.state, label: 'All sections in', second: when }
          : { key: step.key, state: step.state, label: 'Sections coming in', second: step.count ? `${step.count.done} of ${step.count.total} in` : '' };
      case 'APPROVED':
        if (step.state === 'DONE') return { key: step.key, state: step.state, label: 'Approved', second: [when, who].filter(Boolean).join(' · ') };
        return { key: step.key, state: step.state, label: 'Approved', second: step.state === 'CURRENT' ? (canApprove ? 'Waiting for you' : 'Waiting for the Branch Manager') : 'Branch Manager' };
      case 'PACKED':
        return { key: step.key, state: step.state, label: 'Packed and sent', second: step.state === 'DONE' ? when : step.state === 'CURRENT' ? 'Central Store · waiting' : 'Central Store' };
      case 'DELIVERED':
        return { key: step.key, state: step.state, label: 'Counted at the branch', second: step.state === 'DONE' ? when : 'Each department' };
      case 'CLOSED':
        return { key: step.key, state: step.state, label: 'Closed', second: step.state === 'DONE' ? when : '' };
    }
  });
}

// ── The Next step card (Paper steps 8, 11, 12, 13, 16, 22) ───────────────────────────────────────────────────────────────────

export interface NextStepWords {
  title: string;
  body: string;
  action: NextStepAction | null;
  actionLabel: string | null;
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

export function nextStepWords(file: RequisitionFile): NextStepWords {
  const { action, departmentId, facts } = file.nextStep;
  const department = file.sections.find((s) => s.departmentId === departmentId)?.departmentName ?? 'This department';
  const label = (a: NextStepAction | null): string | null => {
    switch (a) {
      case 'NUDGE': return `Nudge ${department}`;
      case 'APPROVE_AND_SIGN': return 'Approve and sign';
      case 'APPROVE_ADDITION': return 'Approve addition';
      case 'ADD_TO_THIS_REQUISITION': return 'Add to this requisition';
      case 'PRINT': return 'Print';
      case 'START_A_NEW_ONE': return 'Start a new one';
      case 'SEND_SECTION': return 'Send for approval';
      default: return null;
    }
  };
  const actionLabel = label(action);

  if (file.status === 'CANCELLED') {
    return { title: 'Cancelled', body: 'Stopped before approval. Nothing went to the Central Store, and nothing was deleted.', action, actionLabel };
  }
  if (file.status === 'CLOSED') {
    return { title: 'Closed', body: 'Every department has counted what it received. Nothing here changes any more.', action, actionLabel };
  }
  if (file.status === 'APPROVED') {
    const pending = file.additions.find((a) => a.status === 'PENDING');
    if (pending) {
      return {
        title: `The ${pending.departmentName} head added ${plural(pending.lines.length, 'line', 'lines')} after approval`,
        body: `The approved lines are not touched. Your signature sends the added ones to the ${pending.departmentName}'s dispatch, which has not been signed yet.`,
        action,
        actionLabel,
      };
    }
    if (file.dispatches.length > 0) {
      return { title: 'Deliveries are on the way', body: 'Each department counts its own delivery when it arrives. Nothing for you to do unless one is not counted within 2 hours.', action, actionLabel };
    }
    return { title: 'With the Central Store now', body: 'The Store Manager packs each department. You will see each delivery here, and under To pack on the list.', action, actionLabel };
  }
  if (file.status === 'PENDING_APPROVAL') {
    return {
      title: 'Everything is in. Ready for your signature.',
      body: `All ${facts.sectionsTotal} sections are in. One signature covers the whole requisition, and the heads are told when you sign.`,
      action,
      actionLabel,
    };
  }
  // Collecting.
  if (departmentId) {
    return {
      title: `${department} hasn't sent yet`,
      body: `${facts.sectionsIn} of ${facts.sectionsTotal} sections are in, so the others don't have to wait. You can approve once ${department} is in, or send without it.`,
      action,
      actionLabel,
    };
  }
  return { title: 'Sections are coming in', body: `${facts.sectionsIn} of ${facts.sectionsTotal} sections are in. Each head sends their own list; you will be asked to sign when all are in.`, action, actionLabel };
}

// ── The department rail (Paper steps 8 and 12) ───────────────────────────────────────────────────────────────────────────────

export interface RailWords {
  line: string;
  changed: string | null;
}

export function railWords(section: { departmentName: string; status: SectionStatus; lineCount: number; changedCount: number }, requisition: RequisitionStatus): RailWords {
  const changed = section.changedCount > 0 ? `${section.changedCount} changed` : null;
  const lines = plural(section.lineCount, 'line', 'lines');
  switch (section.status) {
    case 'NOT_STARTED': return { line: `${section.departmentName} hasn't started`, changed: null };
    case 'DRAFT': return { line: 'Drafting', changed: null };
    case 'SKIPPED': return { line: 'Skipped', changed: null };
    case 'SUBMITTED': return { line: requisition === 'APPROVED' ? `To pack · ${lines}` : `In · ${lines}`, changed };
  }
}

// ── Error wording, by audience ───────────────────────────────────────────────────────────────────────────────────────────────

export type Audience = 'manager' | 'head';

const ERROR_WORDS: Record<string, Record<Audience, string>> = {
  INVALID_PIN: { manager: 'That PIN did not work. Check it and try again.', head: 'That PIN did not work. Check it and try again.' },
  REQUISITION_ALREADY_OPEN: { manager: 'This cycle already has a requisition open. Open it instead of starting another.', head: 'This cycle already has a requisition open. Open it instead of starting another.' },
  SECTION_NOT_SENT: { manager: "That section hasn't been sent yet.", head: "Your list hasn't been sent yet." },
  SECTION_ALREADY_SENT: { manager: 'That section has already been sent.', head: 'Your list has already been sent.' },
  NOT_APPROVED: { manager: "This requisition isn't approved yet.", head: "This requisition isn't approved yet." },
  SECTION_NOT_OPEN: { manager: "That section can't be changed now.", head: "Your list can't be changed now." },
  ADDITION_NOT_PENDING: { manager: 'That addition has already been dealt with.', head: 'That addition has already been dealt with.' },
  BRANCH_CODE_MISSING: { manager: 'This branch has no code yet. The owner needs to set one before a requisition can be started.', head: 'This branch has no code yet. The owner needs to set one before a requisition can be started.' },
  DEPARTMENT_PACKED: { manager: 'The store has already packed that department, so its quantities are locked.', head: 'The store has already packed your department, so your list is locked.' },
  DEPARTMENT_HAS_OPEN_SECTIONS: { manager: 'This department still has an open section. Send or skip it first, then retire it.', head: 'This department still has an open section.' },
  DEPARTMENT_NAME_TAKEN: { manager: 'This branch already has a department with that name.', head: 'This branch already has a department with that name.' },
  REASON_REQUIRED: { manager: 'Add a reason for this change.', head: 'Add a reason for this change.' },
  NOT_READY_TO_APPROVE: { manager: 'Not every section is in yet.', head: 'Not every section is in yet.' },
  ALREADY_APPROVED: { manager: 'This requisition has already been approved.', head: 'This requisition has already been approved.' },
  CANCELLED: { manager: 'This requisition was cancelled.', head: 'This requisition was cancelled.' },
};

/** The sentence to show under a failed action. Falls back to the server's message, then to `fallback`. */
export const errorWords = (code: string | null, audience: Audience, serverMessage: string | null, fallback: string): string =>
  (code ? ERROR_WORDS[code]?.[audience] : undefined) ?? serverMessage ?? fallback;

// ── Dialog and menu words ────────────────────────────────────────────────────────────────────────────────────────────────────

export const CHANGE_REASON_CHIPS = ['Agreed by phone', 'Enough in stock', 'Too much for the week', 'Other'] as const;
export type ChangeReasonChip = (typeof CHANGE_REASON_CHIPS)[number];

/** "You changed 2 lines: Beef patty 120g (30 to 24) and Flour 25kg (6 to 4)." */
export function changesSentence(changes: readonly { itemName: string; from: string; to: string }[]): string {
  if (changes.length === 0) return '';
  const parts = changes.map((c) => `${c.itemName} (${c.from} to ${c.to})`);
  const list = parts.length <= 1 ? parts.join('') : parts.length === 2 ? parts.join(' and ') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
  return `You changed ${plural(changes.length, 'line', 'lines')}: ${list}.`;
}
