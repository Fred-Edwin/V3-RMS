import type { Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';
import { toDateColumn, type NairobiDate } from '../../_shared/time/nairobi-time';

export interface OvertimeSoFar {
  authorised: number;
  undecided: number;
}

export const estimateRepository = {
  read: (companyId: string, monthKey: string) => prisma.payrollEstimate.findUnique({ where: { companyId_monthKey: { companyId, monthKey } } }),

  save: (companyId: string, monthKey: string, asOf: NairobiDate, computedAt: Date, data: Prisma.InputJsonValue) =>
    prisma.payrollEstimate.upsert({
      where: { companyId_monthKey: { companyId, monthKey } },
      create: { companyId, monthKey, asOf: toDateColumn(asOf), computedAt, data },
      update: { asOf: toDateColumn(asOf), computedAt, data },
    }),

  /** Authorised overtime minutes so far, and minutes still waiting for a decision, by person. */
  async overtimeSoFar(periodIds: readonly string[]): Promise<Map<string, OvertimeSoFar>> {
    const rows = await prisma.overtimeItem.groupBy({ by: ['employeeId', 'status'], where: { periodId: { in: [...periodIds] } }, _sum: { authorisedMinutes: true, needsMinutes: true } });
    const out = new Map<string, OvertimeSoFar>();
    for (const row of rows) {
      const entry = out.get(row.employeeId) ?? { authorised: 0, undecided: 0 };
      entry.authorised += row._sum.authorisedMinutes ?? 0;
      if (row.status === 'PENDING') entry.undecided += row._sum.needsMinutes ?? 0;
      out.set(row.employeeId, entry);
    }
    return out;
  },

  /** Days marked absent so far, by person. */
  async absentDays(periodIds: readonly string[]): Promise<Map<string, number>> {
    const rows = await prisma.timesheetDay.groupBy({ by: ['employeeId'], where: { periodId: { in: [...periodIds] }, reasons: { has: 'ABSENT' } }, _count: { _all: true } });
    return new Map(rows.map((row) => [row.employeeId, row._count._all]));
  },

  /** Last month's calculated gross by site, from that month's current run. */
  async grossBySite(companyId: string, monthKey: string): Promise<Map<string, string>> {
    const month = await prisma.payrollMonth.findUnique({ where: { companyId_monthKey: { companyId, monthKey } }, select: { currentRunId: true } });
    if (!month?.currentRunId) return new Map();
    const rows = await prisma.payrollPayslip.groupBy({ by: ['siteId'], where: { runId: month.currentRunId }, _sum: { gross: true } });
    return new Map(rows.map((row) => [row.siteId, (row._sum.gross ?? 0).toString()]));
  },
};
