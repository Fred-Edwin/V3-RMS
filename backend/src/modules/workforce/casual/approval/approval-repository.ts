import { Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';
import type { Tx } from '../recording/recording-repository';

/** Writes of the decision steps: the CPS number, the receipts, the void check. */
export const approvalRepository = {
  /** The next CPS number for the company, taken inside the approving transaction (the counter row is locked by the upsert). Gaps are allowed (PD15). */
  async nextNumber(tx: Tx, companyId: string): Promise<number> {
    const rows = await tx.$queryRaw<{ last_number: number }[]>(
      Prisma.sql`INSERT INTO casual_counters (company_id, last_number) VALUES (${companyId}, 1) ON CONFLICT (company_id) DO UPDATE SET last_number = casual_counters.last_number + 1 RETURNING last_number`,
    );
    const next = rows[0]?.last_number;
    if (next === undefined) throw new Error('CPS counter returned nothing');
    return next;
  },

  /** True when the line was unsigned and is now signed; false when someone signed it first. */
  async markReceived(tx: Tx, lineId: string, data: { receivedAt: Date; receivedName: string; receivedById: string }): Promise<boolean> {
    const result = await tx.casualSheetLine.updateMany({ where: { id: lineId, receivedAt: null }, data });
    return result.count === 1;
  },

  receivedCount: (tx: Tx, sheetId: string): Promise<number> => tx.casualSheetLine.count({ where: { sheetId, receivedAt: { not: null } } }),

  /** Whether a user exists and is active (for a named cash holder). */
  activeUser: async (userId: string): Promise<boolean> => (await prisma.user.count({ where: { id: userId, isActive: true, deletedAt: null } })) === 1,
};
