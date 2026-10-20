import { prisma } from '../../../../config/database';

/** Read-only queries that list what the timesheet, casual and payroll issuers have already signed. Every query carries the company. */
export const sourcesRepository = {
  timesheetMonths: (companyId: string) =>
    prisma.timesheetPeriod.findMany({
      where: { site: { companyId }, documentNumber: { not: null }, documentHash: { not: null }, approvedAt: { not: null } },
      select: { siteId: true, startDate: true, label: true, documentNumber: true, documentHash: true, approvedAt: true, approvedById: true },
      orderBy: { documentNumber: 'asc' },
    }),

  casualSheets: (companyId: string) =>
    prisma.casualSheet.findMany({
      where: { companyId, number: { not: null }, documentHash: { not: null }, approvedAt: { not: null } },
      select: { id: true, siteId: true, workDate: true, number: true, documentHash: true, approvedAt: true, approvedById: true, voidedAt: true, voidedById: true },
      orderBy: { number: 'asc' },
    }),

  /** Months that carry a PAY number, with every snapshot revision (each is one version of the document and has its own hash). */
  payrollMonths: (companyId: string) =>
    prisma.payrollMonth.findMany({
      where: { companyId, documentNumber: { not: null }, approvedAt: { not: null } },
      select: { monthKey: true, documentNumber: true, approvedAt: true, approvedById: true, sentById: true, sentAt: true, snapshots: { select: { revision: true, hash: true, createdAt: true }, orderBy: { revision: 'asc' } } },
      orderBy: { monthKey: 'asc' },
    }),

  people: async (ids: readonly string[]): Promise<Map<string, { name: string; role: string }>> => {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return new Map();
    const rows = await prisma.user.findMany({ where: { id: { in: unique } }, select: { id: true, name: true, role: true } });
    return new Map(rows.map((r) => [r.id, { name: r.name, role: r.role }]));
  },
};
