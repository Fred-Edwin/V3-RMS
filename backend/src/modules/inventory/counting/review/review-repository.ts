import type { CountCause, CountMovementKind, Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';
import { countRecordRepository } from '../_shared/count-record-repository';

type Client = typeof prisma | Prisma.TransactionClient;

export type DecisionData =
  | { decision: 'WRITE_OFF'; cause: CountCause; causeNote: string | null; decidedById: string; decidedAt: Date }
  | { decision: 'MOVEMENT_LOGGED'; movementKind: CountMovementKind; decidedById: string; decidedAt: Date }
  | { decision: 'RECOUNT_ASKED' | 'ACCEPTED'; decidedById: string; decidedAt: Date }
  | { decision: 'PENDING' };

/** Reviewing a submitted count: deciding lines, approving, "Mark seen". A `prisma.$transaction` is opened by the service. */
export const reviewRepository = {
  ...countRecordRepository,

  /**
   * One decision on many lines of ONE count. A decision replaces whatever was there, so every other column of a decision is set
   * (and a "Clear" puts them all back to nothing).
   */
  decideLines: async (tx: Prisma.TransactionClient, siteId: string, countId: string, lineIds: string[], data: DecisionData): Promise<void> => {
    const decided = data.decision === 'PENDING' ? { decidedById: null, decidedAt: null } : { decidedById: data.decidedById, decidedAt: data.decidedAt };
    await tx.countLine.updateMany({
      where: { siteId, countId, id: { in: lineIds } },
      data: {
        decision: data.decision,
        cause: data.decision === 'WRITE_OFF' ? data.cause : null,
        causeNote: data.decision === 'WRITE_OFF' ? data.causeNote : null,
        movementKind: data.decision === 'MOVEMENT_LOGGED' ? data.movementKind : null,
        ...decided,
      },
    });
  },

  /** Lines worth at least the Director alert amount: flagged to the Director, with the alert raised. */
  flagForDirector: async (tx: Prisma.TransactionClient, siteId: string, countId: string, lineIds: string[]): Promise<void> => {
    if (lineIds.length === 0) return;
    await tx.countLine.updateMany({ where: { siteId, countId, id: { in: lineIds } }, data: { directorAlert: true, directorFlagged: true } });
  },

  /** The approval: who and when, and the key it was approved with. `updatedAt` stays at the last time a number was saved. */
  markApproved: async (tx: Prisma.TransactionClient, countId: string, data: { approverId: string; approvedAt: Date; idempotencyKey: string; lastSavedAt: Date }): Promise<void> => {
    await tx.count.update({
      where: { id: countId },
      data: { status: 'APPROVED', approverId: data.approverId, approvedAt: data.approvedAt, idempotencyKey: data.idempotencyKey, updatedAt: data.lastSavedAt },
    });
  },

  /** "Mark seen": only a flagged line, only once. Returns how many lines were marked now. */
  markSeen: async (siteId: string, lineIds: string[], userId: string, at: Date, client: Client = prisma): Promise<number> =>
    (
      await client.countLine.updateMany({
        where: { siteId, id: { in: lineIds }, directorFlagged: true, directorSeenAt: null },
        data: { directorSeenAt: at, directorSeenById: userId },
      })
    ).count,
};
