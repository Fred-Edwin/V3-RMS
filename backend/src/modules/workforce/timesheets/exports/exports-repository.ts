import { prisma } from '../../../../config/database';
import { toDateColumn, type NairobiDate } from '../../_shared/time/nairobi-time';
import type { Db } from '../../attendance/days/days-repository';

/** Rows of `timesheet_exports`: the anchor of the audit entry, the idempotency key and the count the rate limit reads. */
export const exportsRepository = {
  find: (userId: string, idempotencyKey: string, db: Db = prisma) => db.timesheetExport.findUnique({ where: { userId_idempotencyKey: { userId, idempotencyKey } } }),

  countSince: (userId: string, since: Date, db: Db = prisma): Promise<number> => db.timesheetExport.count({ where: { userId, createdAt: { gte: since } } }),

  /** Claims the key. False when it was already used (a repeat of the same request): the caller writes no second audit entry. */
  claim: async (
    tx: Db,
    data: { periodId: string; siteId: string; userId: string; format: string; scope: string; from: NairobiDate | null; to: NairobiDate | null; idempotencyKey: string; documentNumber: number | null },
  ): Promise<boolean> => {
    const made = await tx.timesheetExport.createMany({
      data: [{ periodId: data.periodId, siteId: data.siteId, userId: data.userId, format: data.format, scope: data.scope, rangeFrom: data.from ? toDateColumn(data.from) : null, rangeTo: data.to ? toDateColumn(data.to) : null, idempotencyKey: data.idempotencyKey, documentNumber: data.documentNumber }],
      skipDuplicates: true,
    });
    return made.count === 1;
  },
};
