import { Prisma } from '@prisma/client';
import { WAITING_FOR_BRANCH_AFTER_HOURS, type DispatchAction, type DispatchDoneResult, type DispatchStage, type DispatchStatus, type TrackerStep } from './_shared/dispatch-contract';

/**
 * The Dispatch state rules as pure functions (docs/features/inventory/dispatch-contract.md §5, Amendment 1), table-tested in
 * `dispatch-state.test.ts`. Nothing here reads the database or the clock: the service passes the facts and `now`.
 *
 *   TO_PACK     lines exist, nothing ticked           PACKING   any line ticked
 *   ON_THE_WAY  final sign (P5)                       CONFIRMED the department signed its count
 *   CLOSED      every discrepancy settled, or none    CANCELLED P8, only before the department counted
 */

const WAITING_MS = WAITING_FOR_BRANCH_AFTER_HOURS * 60 * 60 * 1000;

/** What the Attendant packs: the approved quantity, else the requested one (a line the manager added has no request). */
export const effectiveQty = (line: { approvedQty: Prisma.Decimal | null; requestedQty: Prisma.Decimal | null }): Prisma.Decimal =>
  line.approvedQty ?? line.requestedQty ?? new Prisma.Decimal(0);

/** A short line is normal: less is sent than was asked for. */
export const isShort = (sentQty: Prisma.Decimal, requestedQty: Prisma.Decimal): boolean => sentQty.lessThan(requestedQty);

export type PackState = 'TO_PACK' | 'PACKING' | 'PACKED';

/** A department with no line is never PACKED (there is nothing to send). */
export const packStateOf = (lines: ReadonlyArray<{ packedTick: boolean }>): PackState => {
  const ticked = lines.filter((l) => l.packedTick).length;
  if (ticked === 0) return 'TO_PACK';
  return ticked === lines.length ? 'PACKED' : 'PACKING';
};

/** The status a saved set of ticks gives an unsigned dispatch (P3). A signed dispatch never moves back. */
export const statusAfterSave = (lines: ReadonlyArray<{ packedTick: boolean }>): Extract<DispatchStatus, 'TO_PACK' | 'PACKING'> =>
  lines.some((l) => l.packedTick) ? 'PACKING' : 'TO_PACK';

export const isUnsigned = (status: DispatchStatus): boolean => status === 'TO_PACK' || status === 'PACKING';

/** ON_THE_WAY longer than 2 hours after the final sign, with nobody having signed the count. */
export const isWaiting = (d: { status: DispatchStatus; signedAt: Date | null }, now: Date): boolean =>
  d.status === 'ON_THE_WAY' && d.signedAt !== null && now.getTime() - d.signedAt.getTime() > WAITING_MS;

export interface StageFacts {
  status: DispatchStatus;
  signedAt: Date | null;
  /** Every line is ticked (only meaningful while unsigned). */
  allTicked: boolean;
  /** A discrepancy of this dispatch is OPEN, or was reversed and is held again. */
  gapHeld: boolean;
}

/** The nine states of Paper D21, derived from the status plus facts. */
export const stageOf = (f: StageFacts, now: Date): DispatchStage => {
  switch (f.status) {
    case 'TO_PACK':
      return 'TO_PACK';
    case 'PACKING':
      return f.allTicked ? 'READY_TO_SEND' : 'PACKING';
    case 'ON_THE_WAY':
      return isWaiting(f, now) ? 'WAITING_FOR_BRANCH' : 'ON_THE_WAY';
    case 'CONFIRMED':
      return f.gapHeld ? 'GAP_HELD' : 'CONFIRMED';
    case 'CLOSED':
      return 'CLOSED';
    case 'CANCELLED':
      return 'CANCELLED';
  }
};

/** The result chip on the Attendant's Done tab (G3). Null while the dispatch is still on the way (or never left). */
export const doneResultOf = (status: DispatchStatus, discrepancies: ReadonlyArray<{ status: 'OPEN' | 'RECORDED' | 'REVERSED' }>): DispatchDoneResult | null => {
  if (status === 'CANCELLED') return 'CANCELLED';
  if (status !== 'CONFIRMED' && status !== 'CLOSED') return null;
  if (discrepancies.length === 0) return 'CONFIRMED';
  return discrepancies.some((d) => d.status !== 'RECORDED') ? 'GAP_FOUND' : 'GAP_SETTLED';
};

/** The Attendant's tabs: On the way = signed and not counted; Done = counted or cancelled. */
export const mineTabOf = (status: DispatchStatus): 'on-the-way' | 'done' | null => {
  if (status === 'ON_THE_WAY') return 'on-the-way';
  if (status === 'CONFIRMED' || status === 'CLOSED' || status === 'CANCELLED') return 'done';
  return null;
};

export interface ActionFacts {
  stage: DispatchStage;
  canPack: boolean;
  canRecordFinding: boolean;
  canConfirmForDepartment: boolean;
}

/** The one main button of a state (Paper D21 "Main button"); null when the caller has none. */
export const nextActionOf = (f: ActionFacts): DispatchAction | null => {
  switch (f.stage) {
    case 'TO_PACK':
    case 'PACKING':
      return f.canPack ? 'PACK' : null;
    case 'READY_TO_SEND':
      return f.canPack ? 'SIGN_AND_SEND' : null;
    case 'ON_THE_WAY':
      return 'PRINT';
    case 'WAITING_FOR_BRANCH':
      return f.canConfirmForDepartment ? 'CONFIRM_FOR_DEPARTMENT' : 'PRINT';
    case 'GAP_HELD':
      return f.canRecordFinding ? 'RECORD_A_FINDING' : 'PRINT';
    case 'CONFIRMED':
    case 'CLOSED':
      return 'PRINT';
    case 'CANCELLED':
      return f.canPack ? 'PACK_AGAIN' : null;
  }
};

/** Cancel is allowed only while the dispatch is On the way and the department has not signed its count (including Waiting). */
export const canCancelDispatch = (d: { status: DispatchStatus; countedAt: Date | null }): boolean => d.status === 'ON_THE_WAY' && d.countedAt === null;

/** The branch side never sees the sent figure before its own department has signed its count (the blind rule). */
export const sentVisibleTo = (viewer: { branchSide: boolean }, d: { countedAt: Date | null }): boolean => !viewer.branchSide || d.countedAt !== null;

export interface TrackerFacts {
  status: DispatchStatus;
  approvedAt: Date | null;
  approvedBy: TrackerStep['by'];
  packedAt: Date | null;
  packedBy: TrackerStep['by'];
  signedAt: Date | null;
  signedBy: TrackerStep['by'];
  carrier: TrackerStep['carrier'];
  countedAt: Date | null;
  countedBy: TrackerStep['by'];
  closedAt: Date | null;
}

/** The five steps of the dispatch file (D13) as facts: state, when, who. Words are the front end's. */
export const dispatchTrackerOf = (f: TrackerFacts): TrackerStep[] => {
  const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);
  const cancelled = f.status === 'CANCELLED';
  const reached: Record<TrackerStep['key'], { at: Date | null; by: TrackerStep['by'] } | null> = {
    APPROVED: f.approvedAt ? { at: f.approvedAt, by: f.approvedBy } : null,
    PACKED: f.signedAt && f.packedAt ? { at: f.packedAt, by: f.packedBy } : null,
    ON_THE_WAY: f.signedAt ? { at: f.signedAt, by: f.signedBy } : null,
    COUNTED: f.countedAt ? { at: f.countedAt, by: f.countedBy } : null,
    CLOSED: f.closedAt ? { at: f.closedAt, by: null } : null,
  };
  const order: TrackerStep['key'][] = ['APPROVED', 'PACKED', 'ON_THE_WAY', 'COUNTED', 'CLOSED'];
  let currentSet = false;
  return order.map((key) => {
    const hit = reached[key];
    const carrier = key === 'ON_THE_WAY' ? f.carrier : null;
    if (hit) return { key, state: 'DONE' as const, at: iso(hit.at), by: hit.by, carrier };
    const state = !currentSet && !cancelled ? ('CURRENT' as const) : ('TODO' as const);
    currentSet = currentSet || state === 'CURRENT';
    return { key, state, at: null, by: null, carrier };
  });
};
