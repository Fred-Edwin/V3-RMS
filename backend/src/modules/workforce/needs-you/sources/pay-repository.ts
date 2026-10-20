import { prisma } from '../../../../config/database';

/** What the payroll, tables and P9 sources read. Counts of people only; no figure leaves these queries. */
export const payReads = {
  monthsInState: (companyId: string, states: readonly ('IN_REVIEW' | 'TO_APPROVE' | 'TO_PUBLISH' | 'PUBLISHED')[]) =>
    prisma.payrollMonth.findMany({
      where: { companyId, state: { in: [...states] } },
      select: { id: true, monthKey: true, state: true, calculatedAt: true, sentAt: true, sentById: true, approvedAt: true, publishedAt: true, createdAt: true, sites: { select: { headcount: true } }, _count: { select: { bankFiles: true } } },
      orderBy: { monthKey: 'asc' },
      take: 24,
    }),

  /** People left out of a month because they have no pay profile. */
  leftOutNoProfile: async (monthIds: readonly string[]): Promise<Map<string, number>> => {
    if (monthIds.length === 0) return new Map();
    const rows = await prisma.payrollLeftOut.findMany({ where: { monthId: { in: [...monthIds] }, reason: { contains: 'profile', mode: 'insensitive' } }, select: { monthId: true } });
    const counts = new Map<string, number>();
    for (const r of rows) counts.set(r.monthId, (counts.get(r.monthId) ?? 0) + 1);
    return counts;
  },

  userNames: async (ids: readonly (string | null)[]): Promise<Map<string, string>> => {
    const clean = ids.filter((id): id is string => id !== null);
    if (clean.length === 0) return new Map();
    const rows = await prisma.user.findMany({ where: { id: { in: clean } }, select: { id: true, name: true } });
    return new Map(rows.map((r) => [r.id, r.name]));
  },

  /** The newest Statutory table version, if nobody has confirmed it and it was not withdrawn. */
  async unconfirmedStatutory(companyId: string) {
    const latest = await prisma.ruleVersion.findFirst({
      where: { companyId, siteId: null, group: 'STATUTORY', withdrawal: null },
      orderBy: { version: 'desc' },
      select: { id: true, version: true, createdAt: true, confirmations: { where: { scope: 'statutory' }, select: { id: true } } },
    });
    return latest && latest.confirmations.length === 0 ? latest : null;
  },

  p9Confirmed: async (companyId: string, layoutVersion: number): Promise<boolean> => (await prisma.p9FormatConfirmation.findUnique({ where: { companyId_layoutVersion: { companyId, layoutVersion } }, select: { id: true } })) !== null,
  firstPublishedAt: async (companyId: string): Promise<Date | null> => (await prisma.payrollMonth.findFirst({ where: { companyId, publishedAt: { not: null } }, orderBy: { publishedAt: 'asc' }, select: { publishedAt: true } }))?.publishedAt ?? null,
};
