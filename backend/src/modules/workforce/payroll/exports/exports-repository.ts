import type { Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';

type Db = Prisma.TransactionClient | typeof prisma;

/** Rows of `payroll_exports`: the anchor of the audit entry, the idempotency key and the count the rate limit reads. */
export const exportsRepository = {
  find: (userId: string, idempotencyKey: string, db: Db = prisma) => db.payrollExport.findUnique({ where: { userId_idempotencyKey: { userId, idempotencyKey } } }),

  countSince: (userId: string, since: Date, db: Db = prisma): Promise<number> => db.payrollExport.count({ where: { userId, createdAt: { gte: since } } }),

  /** Claims the key. False when it was already used (a repeat of the same request): the caller writes no second audit entry. */
  async claim(tx: Db, data: { monthId: string; userId: string; kind: string; format: string; documentNumber: string | null; revision: number; idempotencyKey: string }): Promise<boolean> {
    const made = await tx.payrollExport.createMany({ data: [data], skipDuplicates: true });
    return made.count === 1;
  },
};
