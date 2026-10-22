import { prisma } from '../../../../config/database';

/** Pay changes waiting for a decision, scoped by company. Reads only; the amounts are never selected. */
export const payChangeReads = {
  pending: (companyId: string) =>
    prisma.payChange.findMany({
      where: { status: 'PENDING', employee: { companyId } },
      select: { id: true, employeeId: true, effectiveFrom: true, requestedAt: true, employee: { select: { name: true, siteId: true, site: { select: { name: true } }, user: { select: { id: true } } } } },
      orderBy: { requestedAt: 'asc' },
      take: 200,
    }),
};
