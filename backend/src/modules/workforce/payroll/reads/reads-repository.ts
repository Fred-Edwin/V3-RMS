import type { Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';

export interface PayslipFilter {
  q?: string;
  siteId?: string;
}

const where = (runId: string, filter: PayslipFilter): Prisma.PayrollPayslipWhereInput => ({
  runId,
  ...(filter.siteId ? { siteId: filter.siteId } : {}),
  ...(filter.q ? { employeeName: { contains: filter.q, mode: 'insensitive' as const } } : {}),
});

const money = (value: Prisma.Decimal | null): string => (value === null ? '0.00' : value.toFixed(2));

export const readsRepository = {
  /** Employee and employer totals per statutory table, and how many people each one took something from. */
  async byTable(runId: string) {
    const lineWhere = { payslip: { runId }, tableCode: { not: null } } as const;
    const [sums, taken] = await Promise.all([
      prisma.payrollPayslipLine.groupBy({ by: ['tableCode', 'share'], where: lineWhere, _sum: { amount: true } }),
      prisma.payrollPayslipLine.groupBy({ by: ['tableCode', 'share'], where: { ...lineWhere, amount: { gt: 0 } }, _count: { _all: true } }),
    ]);
    return sums.map((row) => ({ tableCode: row.tableCode ?? '', share: row.share ?? '', amount: money(row._sum.amount), people: taken.find((t) => t.tableCode === row.tableCode && t.share === row.share)?._count._all ?? 0 }));
  },

  /** A real person's stored line for the "Example" row: the first in the Barista department, else the first by name. */
  async example(runId: string, tableCode: string) {
    const base = { payslip: { runId }, tableCode, share: 'EMPLOYEE', amount: { gt: 0 } } as const;
    const pick = { select: { workingText: true, payslip: { select: { employeeId: true, employeeName: true } } }, orderBy: { payslip: { employeeName: 'asc' as const } } };
    return (await prisma.payrollPayslipLine.findFirst({ where: { ...base, payslip: { runId, department: 'Barista' } }, ...pick })) ?? (await prisma.payrollPayslipLine.findFirst({ where: base, ...pick }));
  },

  /** The pay lines of some codes (overtime, lateness, absence, holiday pay): a few per person, totalled in code because quantities are text. */
  async linesFor(runId: string, codes: readonly string[]) {
    const rows = await prisma.payrollPayslipLine.findMany({ where: { payslip: { runId }, code: { in: [...codes] } }, select: { code: true, amount: true, quantity: true, payslipId: true, payslip: { select: { employeeName: true } } } });
    return rows.map((r) => ({ code: r.code, amount: r.amount.toFixed(2), quantity: r.quantity, payslipId: r.payslipId, employeeName: r.payslip.employeeName }));
  },

  /** The weekly hours of the first payslip, to write the hourly rate text (every payslip's own hours are in its working). */
  async sampleWeekHours(runId: string): Promise<string | null> {
    const row = await prisma.payrollPayslip.findFirst({ where: { runId }, select: { input: true } });
    return (row?.input as { standardWeekHours?: string | null } | null)?.standardWeekHours ?? null;
  },

  async payslips(runId: string, filter: PayslipFilter, skip: number, take: number) {
    const [rows, total] = await Promise.all([
      prisma.payrollPayslip.findMany({ where: where(runId, filter), orderBy: [{ employeeName: 'asc' }, { id: 'asc' }], skip, take, select: { id: true, employeeId: true, employeeName: true, siteId: true, siteName: true, department: true, net: true, version: true, status: true, documentNumber: true } }),
      prisma.payrollPayslip.count({ where: where(runId, filter) }),
    ]);
    return { rows, total };
  },

  /** People HR left out of the run (shown in the payslips list as "Left out of run"). */
  leftOut: (monthId: string) => prisma.payrollLeftOut.findMany({ where: { monthId }, select: { employeeId: true, siteId: true } }),
  leftOutLines: (runId: string) => prisma.payrollReviewLine.findMany({ where: { runId, kind: 'LEFT_OUT' }, select: { employeeId: true, employeeName: true, siteId: true, siteName: true } }),

  payslip: (runId: string, id: string) => prisma.payrollPayslip.findFirst({ where: { id, runId }, include: { lines: { orderBy: { position: 'asc' } } } }),
};
