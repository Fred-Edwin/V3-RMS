import type { ConductDecision, Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';

export type { ConductDecision };

/** Decisions on notices: insert-only. A second decision on the same notice is a new version, never an edit. */
export const decisionsRepository = {
  create: (
    tx: Prisma.TransactionClient,
    data: { noticeId: string; version: number; outcome: string; viaAppeal: boolean; reason: string; decidedById: string; decidedByName: string; decidedByRole: string; decidedAt: Date; newNoticeId: string | null; idempotencyKey: string },
  ): Promise<ConductDecision> => tx.conductDecision.create({ data }),

  forNotice: (noticeId: string): Promise<ConductDecision[]> => prisma.conductDecision.findMany({ where: { noticeId }, orderBy: { version: 'asc' } }),

  byKey: (decidedById: string, idempotencyKey: string): Promise<ConductDecision | null> =>
    prisma.conductDecision.findUnique({ where: { decidedById_idempotencyKey: { decidedById, idempotencyKey } } }),

  /** The newest decision for each of several notices (the lists show the outcome). */
  async latestFor(noticeIds: readonly string[]): Promise<Map<string, ConductDecision>> {
    if (noticeIds.length === 0) return new Map();
    const rows = await prisma.conductDecision.findMany({ where: { noticeId: { in: [...noticeIds] } }, orderBy: { version: 'asc' } });
    return new Map(rows.map((row) => [row.noticeId, row]));
  },
};
