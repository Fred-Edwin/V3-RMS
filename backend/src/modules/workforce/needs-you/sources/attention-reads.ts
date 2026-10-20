import { prisma } from '../../../../config/database';

/** HR housekeeping reads: people not finished, probation about to end, departments with no head. Scoped by company. */
export const attentionReads = {
  onboarding: (companyId: string) =>
    prisma.employee.findMany({ where: { companyId, status: 'ONBOARDING' }, select: { id: true, name: true, siteId: true, createdAt: true, site: { select: { name: true } } }, orderBy: { createdAt: 'asc' }, take: 200 }),

  probationEnding: (companyId: string, endsBy: Date) =>
    prisma.employee.findMany({
      where: { companyId, status: { in: ['ACTIVE', 'ON_LEAVE'] }, probationDecidedOn: null, probationEndsOn: { not: null, lte: endsBy } },
      select: { id: true, name: true, siteId: true, probationEndsOn: true, site: { select: { name: true } } },
      orderBy: { probationEndsOn: 'asc' },
      take: 200,
    }),

  async departmentsWithoutHead(companyId: string) {
    const departments = await prisma.department.findMany({
      where: { site: { companyId }, status: 'ACTIVE', retiredAt: null, employees: { some: { status: { not: 'EXITED' } } } },
      select: { id: true, name: true, siteId: true, createdAt: true, site: { select: { name: true } } },
      take: 400,
    });
    const headed = await prisma.departmentHead.findMany({ where: { departmentId: { in: departments.map((d) => d.id) }, endsOn: null }, select: { departmentId: true } });
    const withHead = new Set(headed.map((h) => h.departmentId));
    return departments.filter((d) => !withHead.has(d.id));
  },
};
