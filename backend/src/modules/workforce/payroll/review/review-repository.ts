import type { Prisma, ReviewState } from '@prisma/client';
import { prisma } from '../../../../config/database';

export interface ReviewFilter {
  kind?: string;
  state?: ReviewState;
  severity?: 'BLOCK' | 'TICK';
  q?: string;
  siteId?: string;
}

const where = (runId: string, filter: ReviewFilter): Prisma.PayrollReviewLineWhereInput => ({
  runId,
  ...(filter.kind ? { kind: filter.kind } : {}),
  ...(filter.state ? { state: filter.state } : {}),
  ...(filter.severity ? { severity: filter.severity } : {}),
  ...(filter.siteId ? { siteId: filter.siteId } : {}),
  ...(filter.q ? { employeeName: { contains: filter.q, mode: 'insensitive' as const } } : {}),
});

export const reviewRepository = {
  async list(runId: string, filter: ReviewFilter, skip: number, take: number) {
    const [rows, total] = await Promise.all([
      prisma.payrollReviewLine.findMany({ where: where(runId, filter), orderBy: [{ severity: 'asc' }, { state: 'asc' }, { employeeName: 'asc' }, { kind: 'asc' }], skip, take }),
      prisma.payrollReviewLine.count({ where: where(runId, filter) }),
    ]);
    return { rows, total };
  },

  /** total, ticked and blocking-and-open for the whole run, whatever the filter. */
  async counts(runId: string): Promise<{ total: number; checked: number; blocking: number }> {
    const [total, checked, blocking] = await Promise.all([
      prisma.payrollReviewLine.count({ where: { runId } }),
      prisma.payrollReviewLine.count({ where: { runId, state: 'CHECKED' } }),
      prisma.payrollReviewLine.count({ where: { runId, severity: 'BLOCK', state: 'OPEN' } }),
    ]);
    return { total, checked, blocking };
  },

  find: (runId: string, id: string) => prisma.payrollReviewLine.findFirst({ where: { id, runId } }),

  /** Ticks or un-ticks one line. A blocking line is never ticked: it is resolved by an action, then the month is calculated again. */
  async setState(tx: Prisma.TransactionClient, runId: string, id: string, checked: boolean, by: string, at: Date): Promise<number> {
    const result = await tx.payrollReviewLine.updateMany({
      where: { id, runId, severity: 'TICK', state: checked ? 'OPEN' : 'CHECKED' },
      data: checked ? { state: 'CHECKED', checkedById: by, checkedAt: at } : { state: 'OPEN', checkedById: null, checkedAt: null },
    });
    return result.count;
  },

  /** "Tick all of this kind": the open lines of one kind that are not blocking. */
  async tickKind(tx: Prisma.TransactionClient, runId: string, kind: string, by: string, at: Date): Promise<number> {
    const result = await tx.payrollReviewLine.updateMany({ where: { runId, kind, severity: 'TICK', state: 'OPEN' }, data: { state: 'CHECKED', checkedById: by, checkedAt: at } });
    return result.count;
  },

  async unresolved(runId: string): Promise<{ open: number; blocking: number }> {
    const [open, blocking] = await Promise.all([prisma.payrollReviewLine.count({ where: { runId, state: 'OPEN' } }), prisma.payrollReviewLine.count({ where: { runId, severity: 'BLOCK' } })]);
    return { open, blocking };
  },

  /** Is this person part of the run, as a payslip or as someone left out? */
  async personInRun(runId: string, employeeId: string): Promise<{ siteId: string; name: string } | null> {
    const slip = await prisma.payrollPayslip.findFirst({ where: { runId, employeeId }, select: { siteId: true, employeeName: true } });
    if (slip) return { siteId: slip.siteId, name: slip.employeeName };
    const line = await prisma.payrollReviewLine.findFirst({ where: { runId, employeeId }, select: { siteId: true, employeeName: true } });
    return line ? { siteId: line.siteId, name: line.employeeName } : null;
  },

  findAdjustmentByKey: (monthId: string, key: string) => prisma.payrollAdjustment.findUnique({ where: { monthId_idempotencyKey: { monthId, idempotencyKey: key } } }),
  findAdjustment: (monthId: string, id: string) => prisma.payrollAdjustment.findFirst({ where: { id, monthId } }),

  addAdjustment: (tx: Prisma.TransactionClient, data: Prisma.PayrollAdjustmentUncheckedCreateInput) => tx.payrollAdjustment.create({ data }),

  async removeAdjustment(tx: Prisma.TransactionClient, monthId: string, id: string, by: string, at: Date): Promise<number> {
    const result = await tx.payrollAdjustment.updateMany({ where: { id, monthId, removedAt: null }, data: { removedAt: at, removedById: by } });
    return result.count;
  },

  async addLeftOut(tx: Prisma.TransactionClient, data: Prisma.PayrollLeftOutUncheckedCreateInput): Promise<boolean> {
    const existing = await tx.payrollLeftOut.findUnique({ where: { monthId_employeeId: { monthId: data.monthId, employeeId: data.employeeId } } });
    if (existing) return false;
    await tx.payrollLeftOut.create({ data });
    return true;
  },

  async bumpVersion(tx: Prisma.TransactionClient, monthId: string): Promise<number> {
    const month = await tx.payrollMonth.update({ where: { id: monthId }, data: { stateVersion: { increment: 1 } }, select: { stateVersion: true } });
    return month.stateVersion;
  },
};
