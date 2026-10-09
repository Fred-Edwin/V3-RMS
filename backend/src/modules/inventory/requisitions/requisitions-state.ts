import type { NextStep, RequisitionStatus, SectionStatus, TrackerStep } from './_shared/requisitions-contract';

/**
 * The state rules of a requisition (docs/features/inventory/requisitions-contract.md §5) as pure functions, so the whole table is
 * tested without a database. The service asks these questions; it never decides a state by itself.
 */

/** What a section needs to answer "is everything in?". A retired department that has not sent does not hold the requisition up. */
export interface SectionFacts {
  status: SectionStatus;
  departmentActive: boolean;
}

/** A section's lines may be edited while it is Not started, a Draft or Sent (a Sent section reopens as a Draft). Skipped is final. */
export const SECTION_EDITABLE: readonly SectionStatus[] = ['NOT_STARTED', 'DRAFT', 'SUBMITTED'];

export type SavedSectionStatus = { allowed: true; status: SectionStatus } | { allowed: false };

/** R12: the section's status after the head saves `lineCount` lines. Sent reopens as Draft; no lines at all is Not started. */
export const sectionStatusAfterSave = (status: SectionStatus, lineCount: number): SavedSectionStatus => {
  if (!SECTION_EDITABLE.includes(status)) return { allowed: false };
  return { allowed: true, status: lineCount === 0 ? 'NOT_STARTED' : 'DRAFT' };
};

export type SendCheck = 'OK' | 'EMPTY' | 'NOT_SENDABLE';

/** R13: only a Draft with at least one line can be sent. */
export const checkSend = (status: SectionStatus, lineCount: number): SendCheck => {
  if (status !== 'DRAFT' && status !== 'NOT_STARTED') return 'NOT_SENDABLE';
  return lineCount === 0 ? 'EMPTY' : 'OK';
};

/** R14: only a Sent section can be recalled. */
export const canRecall = (status: SectionStatus): boolean => status === 'SUBMITTED';

/** R18: "Send without this section" is for a section that has not been sent. */
export const canSkip = (status: SectionStatus): boolean => status === 'NOT_STARTED' || status === 'DRAFT';

/** Every section that still counts is Sent or Skipped, and at least one was actually Sent (an all-skipped requisition has nothing to approve). */
export const allIn = (sections: readonly SectionFacts[]): boolean => {
  const counting = sections.filter((s) => s.departmentActive || s.status === 'SUBMITTED' || s.status === 'SKIPPED');
  return counting.length > 0 && counting.every((s) => s.status === 'SUBMITTED' || s.status === 'SKIPPED') && counting.some((s) => s.status === 'SUBMITTED');
};

/** Collecting (OPEN) becomes Ready to approve (PENDING_APPROVAL) when everything is in, and back when a section reopens. Other statuses never move here. */
export const statusAfterSectionChange = (current: RequisitionStatus, sections: readonly SectionFacts[]): RequisitionStatus => {
  if (current !== 'OPEN' && current !== 'PENDING_APPROVAL') return current;
  return allIn(sections) ? 'PENDING_APPROVAL' : 'OPEN';
};

export type WriteGuard = 'OK' | 'ALREADY_APPROVED' | 'CANCELLED';

/** Writes that only make sense before the signature (R12, R14, R15, R17, R18, R20) and the error each other status gives. */
export const guardBeforeApproval = (status: RequisitionStatus): WriteGuard => {
  if (status === 'OPEN' || status === 'PENDING_APPROVAL') return 'OK';
  return status === 'CANCELLED' ? 'CANCELLED' : 'ALREADY_APPROVED';
};

/** R19 needs Ready to approve; Collecting is "not ready", a signed or cancelled one has its own answer. */
export type ApproveGuard = 'OK' | 'NOT_READY' | 'ALREADY_APPROVED' | 'CANCELLED';
export const guardApprove = (status: RequisitionStatus): ApproveGuard => {
  if (status === 'PENDING_APPROVAL') return 'OK';
  if (status === 'OPEN') return 'NOT_READY';
  return status === 'CANCELLED' ? 'CANCELLED' : 'ALREADY_APPROVED';
};

/** R16 and R21 work on a signed requisition; before it is signed there is nothing to add to. */
export type AfterApprovalGuard = 'OK' | 'NOT_APPROVED' | 'CANCELLED' | 'CLOSED';
export const guardAfterApproval = (status: RequisitionStatus): AfterApprovalGuard => {
  if (status === 'APPROVED') return 'OK';
  if (status === 'CANCELLED') return 'CANCELLED';
  return status === 'CLOSED' ? 'CLOSED' : 'NOT_APPROVED';
};

export const URGENT_ESCALATION_MS = 60 * 60 * 1000;

/** Urgent and still unsigned after one hour (the Director's list). */
export const urgentOverHour = (r: { urgent: boolean; urgentAt: Date | null; status: RequisitionStatus }, now: Date): boolean =>
  r.urgent && r.urgentAt !== null && (r.status === 'OPEN' || r.status === 'PENDING_APPROVAL') && now.getTime() - r.urgentAt.getTime() >= URGENT_ESCALATION_MS;

// --- Money -----------------------------------------------------------------------

/** value = approvedQty × unit cost; the cost is the one frozen at approval once approved, the current item cost before. Before the manager sets a number the request stands. */
export const lineValueKes = (
  line: { requestedQty: number; approvedQty: number | null },
  cost: { unitCostAtApproval: number | null; currentCost: number },
): number => (line.approvedQty ?? line.requestedQty) * (cost.unitCostAtApproval ?? cost.currentCost);

// --- Next step and tracker ----------------------------------------------------------

export interface NextStepFacts {
  status: RequisitionStatus;
  sections: ReadonlyArray<{ departmentId: string; departmentName: string; status: SectionStatus; departmentActive: boolean }>;
  /** How many additions are waiting for the signature. */
  additionsWaiting: number;
  can: { nudge: boolean; approve: boolean; addToIt: boolean; print: boolean };
}

/**
 * The Next step card as facts (Amendment 2): the action key, the department it is about and the counts. The words (title, body,
 * button label) are the front ends', written from Paper step 22.
 */
export const nextStepOf = (f: NextStepFacts): NextStep => {
  const counting = f.sections.filter((s) => s.departmentActive || s.status === 'SUBMITTED' || s.status === 'SKIPPED');
  const facts = {
    sectionsIn: counting.filter((s) => s.status === 'SUBMITTED' || s.status === 'SKIPPED').length,
    sectionsTotal: counting.length,
    additionsWaiting: f.additionsWaiting,
  };
  const card = (action: NextStep['action'], departmentId: string | null = null): NextStep => ({ action, departmentId, facts });
  if (f.status === 'CANCELLED') return card('START_A_NEW_ONE');
  if (f.status === 'CLOSED') return card(f.can.print ? 'PRINT' : null);
  if (f.status === 'APPROVED') {
    if (f.additionsWaiting > 0) return card(f.can.approve ? 'APPROVE_ADDITION' : null);
    if (f.can.addToIt) return card('ADD_TO_THIS_REQUISITION');
    return card(f.can.print ? 'PRINT' : null);
  }
  if (f.status === 'PENDING_APPROVAL') return card(f.can.approve ? 'APPROVE_AND_SIGN' : null);
  const waiting = f.sections.find((s) => s.departmentActive && (s.status === 'NOT_STARTED' || s.status === 'DRAFT'));
  if (!waiting) return card(null);
  return card(f.can.nudge ? 'NUDGE' : null, waiting.departmentId);
};

export interface TrackerFacts {
  status: RequisitionStatus;
  openedAt: Date;
  openedBy: { id: string; name: string; role: string };
  allInAt: Date | null;
  approvedAt: Date | null;
  approvedBy: { id: string; name: string; role: string } | null;
  closedAt: Date | null;
  /** Sections Sent or Skipped, and the sections that count: the "All in" step's count. */
  sectionsIn: number;
  sectionsTotal: number;
  /** Block 2: the requisition's dispatches rolled up (`dispatch/dispatch-roll-up.ts`); absent or `total` 0 until a department has been opened for packing. */
  dispatch?: DispatchTrackerFacts;
}

/** "n of m sent" and "n counted": departments with a live dispatch, those signed, those counted, and when the last of each happened. */
export interface DispatchTrackerFacts {
  total: number;
  sent: number;
  counted: number;
  sentAt: Date | null;
  countedAt: Date | null;
}

type TrackerStepKey = TrackerStep['key'];

/** The six steps as facts (Amendment 2): state, date, who, and a count where the step has one. The labels are the front ends'. Packed ("n of m sent") and Delivered ("n counted") come from the dispatches (Block 2). */
export const trackerOf = (f: TrackerFacts, person: (u: { id: string; name: string; role: string }) => TrackerStep['by']): TrackerStep[] => {
  const d = f.dispatch;
  const reached: Record<TrackerStepKey, { at: Date | null; by: TrackerStep['by'] } | null> = {
    STARTED: { at: f.openedAt, by: person(f.openedBy) },
    ALL_IN: f.allInAt ? { at: f.allInAt, by: null } : null,
    APPROVED: f.approvedAt ? { at: f.approvedAt, by: f.approvedBy ? person(f.approvedBy) : null } : null,
    PACKED: d && d.total > 0 && d.sent === d.total ? { at: d.sentAt, by: null } : null,
    DELIVERED: d && d.total > 0 && d.counted === d.total ? { at: d.countedAt, by: null } : null,
    CLOSED: f.closedAt ? { at: f.closedAt, by: null } : null,
  };
  const order: TrackerStepKey[] = ['STARTED', 'ALL_IN', 'APPROVED', 'PACKED', 'DELIVERED', 'CLOSED'];
  const countOf = (key: TrackerStepKey): TrackerStep['count'] => {
    if (key === 'ALL_IN') return { done: f.sectionsIn, total: f.sectionsTotal };
    if (!d || d.total === 0) return null;
    if (key === 'PACKED') return { done: d.sent, total: d.total };
    if (key === 'DELIVERED') return { done: d.counted, total: d.total };
    return null;
  };
  let currentSet = false;
  return order.map((key) => {
    const hit = reached[key];
    if (hit) return { key, state: 'DONE' as const, at: hit.at ? hit.at.toISOString() : null, by: hit.by, count: countOf(key) };
    const state = !currentSet && f.status !== 'CANCELLED' ? ('CURRENT' as const) : ('TODO' as const);
    currentSet = currentSet || state === 'CURRENT';
    return { key, state, at: null, by: null, count: countOf(key) };
  });
};
