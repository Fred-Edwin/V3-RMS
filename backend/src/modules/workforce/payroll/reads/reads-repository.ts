import type { Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';

export interface PayslipFilter {
  q?: string;
  siteId?: string;
  corrected?: boolean;
}

const money = (value: Prisma.Decimal | null): string => (value === null ? '0.00' : value.toFixed(2));

/** The latest version of each person's payslip in the run. A correction adds a row (version n+1), so every total and list reads these. */
export async function currentPayslipIds(runId: string): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`SELECT DISTINCT ON ("employee_id") "id" FROM "payroll_payslips" WHERE "run_id" = ${runId} ORDER BY "employee_id", "version" DESC`;
  return rows.map((row) => row.id);
}

const where = (ids: readonly string[], filter: PayslipFilter): Prisma.PayrollPayslipWhereInput => ({
  id: { in: [...ids] },
  ...(filter.siteId ? { siteId: filter.siteId } : {}),
  ...(filter.q ? { employeeName: { contains: filter.q, mode: 'insensitive' as const } } : {}),
  ...(filter.corrected ? { version: { gt: 1 } } : {}),
});

export const readsRepository = {
  /** Employee and employer totals per statutory table, and how many people each one took something from. */
  async byTable(runId: string) {
    const ids = await currentPayslipIds(runId);
    const lineWhere = { payslipId: { in: ids }, tableCode: { not: null } } as const;
    const [sums, taken] = await Promise.all([
      prisma.payrollPayslipLine.groupBy({ by: ['tableCode', 'share'], where: lineWhere, _sum: { amount: true } }),
      prisma.payrollPayslipLine.groupBy({ by: ['tableCode', 'share'], where: { ...lineWhere, amount: { gt: 0 } }, _count: { _all: true } }),
    ]);
    return sums.map((row) => ({ tableCode: row.tableCode ?? '', share: row.share ?? '', amount: money(row._sum.amount), people: taken.find((t) => t.tableCode === row.tableCode && t.share === row.share)?._count._all ?? 0 }));
  },

  /** A real person's stored line for the "Example" row: the first in the Barista department, else the first by name. */
  async example(runId: string, tableCode: string) {
    const ids = await currentPayslipIds(runId);
    const base = { payslip: { id: { in: ids } }, tableCode, share: 'EMPLOYEE', amount: { gt: 0 } } as const;
    const pick = { select: { workingText: true, payslip: { select: { employeeId: true, employeeName: true } } }, orderBy: { payslip: { employeeName: 'asc' as const } } };
    return (await prisma.payrollPayslipLine.findFirst({ where: { ...base, payslip: { id: { in: ids }, department: 'Barista' } }, ...pick })) ?? (await prisma.payrollPayslipLine.findFirst({ where: base, ...pick }));
  },

  /** The pay lines of some codes (overtime, lateness, absence, holiday pay): a few per person, totalled in code because quantities are text. */
  async linesFor(runId: string, codes: readonly string[]) {
    const rows = await prisma.payrollPayslipLine.findMany({ where: { payslipId: { in: await currentPayslipIds(runId) }, code: { in: [...codes] } }, select: { code: true, amount: true, quantity: true, payslipId: true, payslip: { select: { employeeName: true } } } });
    return rows.map((r) => ({ code: r.code, amount: r.amount.toFixed(2), quantity: r.quantity, payslipId: r.payslipId, employeeName: r.payslip.employeeName }));
  },

  /** The weekly hours of the first payslip, to write the hourly rate text (every payslip's own hours are in its working). */
  async sampleWeekHours(runId: string): Promise<string | null> {
    const row = await prisma.payrollPayslip.findFirst({ where: { runId }, select: { input: true } });
    return (row?.input as { standardWeekHours?: string | null } | null)?.standardWeekHours ?? null;
  },

  /** The current version of each payslip, filtered and paged, with the chip counts (all, corrected). */
  async payslips(runId: string, filter: PayslipFilter, skip: number, take: number) {
    const ids = await currentPayslipIds(runId);
    const [rows, total, correctedCount, everyone] = await Promise.all([
      prisma.payrollPayslip.findMany({ where: where(ids, filter), orderBy: [{ employeeName: 'asc' }, { id: 'asc' }], skip, take, select: { id: true, employeeId: true, employeeName: true, siteId: true, siteName: true, department: true, net: true, version: true, status: true } }),
      prisma.payrollPayslip.count({ where: where(ids, filter) }),
      prisma.payrollPayslip.count({ where: { id: { in: ids }, version: { gt: 1 } } }),
      ids.length,
    ]);
    return { rows, total, counts: { all: everyone, corrected: correctedCount } };
  },

  /** Sums per site over the current versions: the month's totals after corrections (the run's stored totals never change). */
  async siteSums(runId: string) {
    const rows = await prisma.payrollPayslip.groupBy({
      by: ['siteId'],
      where: { id: { in: await currentPayslipIds(runId) } },
      _count: true,
      _sum: { basic: true, gross: true, statutoryEmployee: true, otherDeductions: true, net: true, employerShare: true },
    });
    return rows.map((r) => ({ siteId: r.siteId, people: r._count, basic: money(r._sum.basic), gross: money(r._sum.gross), taxStatutory: money(r._sum.statutoryEmployee), other: money(r._sum.otherDeductions), net: money(r._sum.net), employerShare: money(r._sum.employerShare) }));
  },

  /** The payslip numbers issued at publish, by person. */
  async numbers(monthId: string, employeeIds: readonly string[]): Promise<Map<string, number>> {
    const rows = await prisma.payrollPublication.findMany({ where: { monthId, employeeId: { in: [...employeeIds] } }, select: { employeeId: true, number: true } });
    return new Map(rows.map((row) => [row.employeeId, row.number]));
  },

  /** People HR left out of the run (shown in the payslips list as "Left out of run"). */
  leftOut: (monthId: string) => prisma.payrollLeftOut.findMany({ where: { monthId }, select: { employeeId: true, siteId: true } }),
  leftOutLines: (runId: string) => prisma.payrollReviewLine.findMany({ where: { runId, kind: 'LEFT_OUT' }, select: { employeeId: true, employeeName: true, siteId: true, siteName: true } }),

  /** Every version of one person's payslip in the run, oldest first (version 1 stays readable, marked replaced). */
  versionsOf: (runId: string, employeeId: string) => prisma.payrollPayslip.findMany({ where: { runId, employeeId }, orderBy: { version: 'asc' }, select: { id: true, version: true, createdAt: true, reason: true, correctedAt: true } }),

  payslip: (runId: string, id: string) => prisma.payrollPayslip.findFirst({ where: { id, runId }, include: { lines: { orderBy: { position: 'asc' } } } }),
};
