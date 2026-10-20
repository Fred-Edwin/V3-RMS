import { prisma } from '../../../config/database';

export const verifyRepository = {
  record: (row: { kind: string; number: string; outcome: string; addressHash: string; deviceLabel: string | null; userId: string | null }) =>
    prisma.workforceDocumentCheck.create({ data: row, select: { id: true } }),

  /** Checks in the last minute, for the global breaker's own record (the limiter counts; this is the durable trail). */
  countSince: (since: Date) => prisma.workforceDocumentCheck.count({ where: { at: { gte: since } } }),
};
