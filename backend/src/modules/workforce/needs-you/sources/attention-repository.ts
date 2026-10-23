import { prisma } from '../../../../config/database';
import { activeWhere } from '../../people/organisation/heads/heads-repository';

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

  /**
   * "No head", the one rule Home, Needs you and Organisation share: an active department at a branch (the Central Store has no heads)
   * with people in it and no head row covering `today`. An acting head covers the department, so it is not counted.
   */
  async departmentsWithoutHead(companyId: string, today: Date) {
    const departments = await prisma.department.findMany({
      where: { site: { companyId, isHub: false }, status: 'ACTIVE', retiredAt: null, employees: { some: { status: { not: 'EXITED' } } } },
      select: { id: true, name: true, siteId: true, createdAt: true, site: { select: { name: true } } },
      take: 400,
    });
    const headed = await prisma.departmentHead.findMany({ where: { departmentId: { in: departments.map((d) => d.id) }, ...activeWhere(today) }, select: { departmentId: true } });
    const withHead = new Set(headed.map((h) => h.departmentId));
    return departments.filter((d) => !withHead.has(d.id));
  },
};
