import type { Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';
import type { StatutoryIds } from './month-snapshot';
import type { PreparerFacts } from './preparers';

export interface RunTotals {
  headcount: number;
  gross: string;
  taxStatutory: string;
  other: string;
  net: string;
}

export const approvalRepository = {
  /** Everyone who touched the month, for the "approver is never a preparer" rule. */
  async preparerFacts(monthId: string, currentRunId: string | null, sentById: string | null): Promise<PreparerFacts> {
    const [runs, checked, adjustments, leftOut] = await Promise.all([
      prisma.payrollRun.findMany({ where: { monthId }, select: { byId: true } }),
      currentRunId ? prisma.payrollReviewLine.findMany({ where: { runId: currentRunId, checkedById: { not: null } }, select: { checkedById: true } }) : Promise.resolve([]),
      prisma.payrollAdjustment.findMany({ where: { monthId }, select: { createdById: true, removedById: true } }),
      prisma.payrollLeftOut.findMany({ where: { monthId }, select: { byId: true } }),
    ]);
    return {
      sentById,
      runByIds: runs.map((r) => r.byId),
      checkedByIds: checked.map((c) => c.checkedById),
      adjustmentByIds: adjustments.flatMap((a) => [a.createdById, a.removedById]),
      leftOutByIds: leftOut.map((l) => l.byId),
    };
  },

  /** The month's figures from the stored payslips of the current run (sums of the 2-decimal stored values). */
  async runTotals(runId: string): Promise<RunTotals> {
    const sum = await prisma.payrollPayslip.aggregate({ where: { runId }, _count: true, _sum: { gross: true, statutoryEmployee: true, otherDeductions: true, net: true } });
    const fixed = (d: Prisma.Decimal | null): string => (d === null ? '0.00' : d.toFixed(2));
    return { headcount: sum._count, gross: fixed(sum._sum.gross), taxStatutory: fixed(sum._sum.statutoryEmployee), other: fixed(sum._sum.otherDeductions), net: fixed(sum._sum.net) };
  },

  /** Every payslip of the run with its lines, for the frozen snapshot. */
  payslipsWithLines: (runId: string) => prisma.payrollPayslip.findMany({ where: { runId }, include: { lines: { orderBy: { position: 'asc' } } }, orderBy: [{ siteName: 'asc' }, { employeeName: 'asc' }] }),

  /** The newest snapshot of the month: revision 1 is the approval, a later one is a correction after it. */
  latestSnapshot: (monthId: string) => prisma.payrollSnapshot.findFirst({ where: { monthId }, orderBy: { revision: 'desc' } }),

  /** The filing numbers of these people, frozen into the snapshot at approval. */
  async statutoryIds(employeeIds: readonly string[]): Promise<Map<string, StatutoryIds>> {
    const rows = await prisma.employee.findMany({ where: { id: { in: [...employeeIds] } }, select: { id: true, kraPin: true, nssfNumber: true, shaNumber: true } });
    return new Map(rows.map((r) => [r.id, { kraPin: r.kraPin, nssfNumber: r.nssfNumber, shaNumber: r.shaNumber }]));
  },

  addSnapshot: (tx: Prisma.TransactionClient, data: { monthId: string; hash: string; data: Prisma.InputJsonValue }) => tx.payrollSnapshot.create({ data: { ...data, revision: 1 } }),

  updateMonth: (tx: Prisma.TransactionClient, monthId: string, data: Prisma.PayrollMonthUncheckedUpdateInput) => tx.payrollMonth.update({ where: { id: monthId }, data: { ...data, stateVersion: { increment: 1 } }, select: { stateVersion: true } }),
};
