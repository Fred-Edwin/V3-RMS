import type { DispatchStatus } from '@prisma/client';
import type { DispatchRef } from '../requisitions/_shared/requisitions-contract';
import type { DispatchTrackerFacts } from '../requisitions/requisitions-state';
import { dispatchRepository } from './dispatch-repository';
import { stageOf } from './dispatch-state';
import { gapHeldOf } from './dispatch-view';

/**
 * What the requisition file shows of its dispatches (R3, Dispatch Amendment 1 row 10): one row per department with a live dispatch
 * (a cancelled one is replaced), the tracker's "n of m sent" and "n counted", and the DSP- numbers the printed requisition carries.
 * `rollUpOf` is pure so the numbers are table-tested; `dispatchRollUp` only reads.
 */
export interface RollUpRow {
  id: string;
  reference: string | null;
  status: DispatchStatus;
  signedAt: Date | null;
  countedAt: Date | null;
  departmentId: string;
  department: { name: string; position: number };
  carrier: { name: string } | null;
  lines: ReadonlyArray<{ packedTick: boolean }>;
  discrepancies: ReadonlyArray<{ status: 'OPEN' | 'RECORDED' | 'REVERSED' }>;
}

export interface RollUp {
  dispatches: DispatchRef[];
  tracker: DispatchTrackerFacts;
}

const latest = (dates: Array<Date | null>): Date | null => {
  const real = dates.filter((d): d is Date => d !== null);
  return real.length === 0 ? null : new Date(Math.max(...real.map((d) => d.getTime())));
};

export const rollUpOf = (rows: readonly RollUpRow[], now: Date): RollUp => {
  const ordered = [...rows].sort((a, b) => a.department.position - b.department.position);
  const sent = ordered.filter((r) => r.signedAt !== null);
  const counted = ordered.filter((r) => r.countedAt !== null);
  return {
    dispatches: ordered.map((r) => ({
      id: r.id,
      reference: r.reference,
      departmentId: r.departmentId,
      departmentName: r.department.name,
      status: r.status,
      derivedState: stageOf({ status: r.status, signedAt: r.signedAt, allTicked: r.lines.length > 0 && r.lines.every((l) => l.packedTick), gapHeld: gapHeldOf(r.discrepancies) }, now),
      lineCount: r.lines.length,
      signedAt: r.signedAt ? r.signedAt.toISOString() : null,
      carrierName: r.carrier ? r.carrier.name : null,
    })),
    tracker: {
      total: ordered.length,
      sent: sent.length,
      counted: counted.length,
      sentAt: sent.length === ordered.length ? latest(sent.map((r) => r.signedAt)) : null,
      countedAt: counted.length === ordered.length ? latest(counted.map((r) => r.countedAt)) : null,
    },
  };
};

export const dispatchRollUp = {
  forRequisition: async (requisitionId: string, now: Date = new Date()): Promise<RollUp> => rollUpOf(await dispatchRepository.listForRequisition(requisitionId), now),

  /** Department id -> DSP- number, for the printed requisition's cover (only signed departments have one). */
  referencesOf: async (requisitionId: string): Promise<Map<string, string>> => {
    const rows = await dispatchRepository.listForRequisition(requisitionId);
    return new Map(rows.flatMap((r) => (r.reference ? [[r.departmentId, r.reference] as const] : [])));
  },
};
