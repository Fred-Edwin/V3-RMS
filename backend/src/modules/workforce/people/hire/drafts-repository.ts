import type { Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';
import type { Db } from '../employees/employees-repository';

/** Add-employee drafts. A draft belongs to the person who started it; nothing here is a person on file. */
export const draftsRepository = {
  listMine: (companyId: string, createdById: string) =>
    prisma.employeeDraft.findMany({ where: { companyId, createdById }, orderBy: { updatedAt: 'desc' } }),

  create: (data: { companyId: string; createdById: string; kind: string; step: number; payload: Prisma.InputJsonValue }) =>
    prisma.employeeDraft.create({ data }),

  async update(companyId: string, createdById: string, id: string, data: { kind: string; step: number; payload: Prisma.InputJsonValue }) {
    const result = await prisma.employeeDraft.updateMany({ where: { id, companyId, createdById }, data });
    if (result.count === 0) return null;
    return prisma.employeeDraft.findFirst({ where: { id, companyId, createdById } });
  },

  async remove(companyId: string, createdById: string, id: string): Promise<boolean> {
    const result = await prisma.employeeDraft.deleteMany({ where: { id, companyId, createdById } });
    return result.count > 0;
  },

  /** Used inside the hire transaction: the draft is spent. */
  removeInTx: (tx: Db, companyId: string, createdById: string, id: string) => tx.employeeDraft.deleteMany({ where: { id, companyId, createdById } }),

  /** Scheduler: drafts untouched since `before`. Returns how many were removed. */
  async removeOlderThan(before: Date): Promise<number> {
    const result = await prisma.employeeDraft.deleteMany({ where: { updatedAt: { lt: before } } });
    return result.count;
  },
};
