import type { Prisma } from '@prisma/client';
import { prisma } from '../../../config/database';
import { attentionReads } from '../needs-you/sources/attention-repository';
import type { ScopeFilter } from '../people/employees/employees-repository';
import { ACTIVE_STATUSES } from '../people/people.constants';

/** Counts for the Home numbers. Every query carries the company and the viewer's reach; nothing here decides who may ask. */

const scopeWhere = (scope: ScopeFilter): Prisma.EmployeeWhereInput => {
  switch (scope.kind) {
    case 'all':
      return {};
    case 'site':
      return {
        siteId: scope.siteId,
        ...(scope.excludeUserRoles ? { OR: [{ userId: null }, { user: { role: { notIn: [...scope.excludeUserRoles] } } }] } : {}),
      };
    case 'departments':
      return { departmentId: { in: [...scope.departmentIds] } };
  }
};

/** Leave carries its own site; a department head's reach is read through the employee. LeaveApplication has no relation, so ids are looked up first. */
async function leaveScope(companyId: string, scope: ScopeFilter): Promise<Prisma.LeaveApplicationWhereInput> {
  switch (scope.kind) {
    case 'all':
      return {};
    case 'site':
      return { siteId: scope.siteId };
    case 'departments': {
      const people = await prisma.employee.findMany({ where: { companyId, departmentId: { in: [...scope.departmentIds] } }, select: { id: true } });
      return { employeeId: { in: people.map((p) => p.id) } };
    }
  }
}

export interface PeopleCounts {
  active: number;
  joinedThisMonth: number;
  inProbation: number;
  probationDueSoon: number;
  probationOverdue: number;
  probationReportsDue: number;
  onLeaveToday: number;
}

export const homeRepository = {
  async peopleCounts(companyId: string, scope: ScopeFilter, today: Date, monthStart: Date, soon: Date): Promise<PeopleCounts> {
    const leaveWhere = await leaveScope(companyId, scope);
    const base: Prisma.EmployeeWhereInput = { companyId, AND: [scopeWhere(scope)] };
    const live: Prisma.EmployeeWhereInput = { AND: [base, { status: { not: 'EXITED' } }] };
    const open: Prisma.EmployeeWhereInput = { AND: [live, { probationConfirmedOn: null, probationDecidedOn: null, probationEndsOn: { not: null } }] };
    const [active, joinedThisMonth, inProbation, probationDueSoon, probationOverdue, probationReportsDue, onLeaveToday] = await Promise.all([
      prisma.employee.count({ where: { AND: [base, { status: { in: [...ACTIVE_STATUSES] } }] } }),
      prisma.employee.count({ where: { AND: [live, { startDate: { gte: monthStart } }] } }),
      prisma.employee.count({ where: { AND: [live, { probationConfirmedOn: null, probationEndsOn: { gte: today } }] } }),
      prisma.employee.count({ where: { AND: [open, { probationEndsOn: { gte: today, lte: soon } }] } }),
      prisma.employee.count({ where: { AND: [open, { probationEndsOn: { lt: today } }] } }),
      prisma.employee.count({ where: { AND: [open, { probationNotes: { none: { authorKind: 'HEAD' } } }] } }),
      prisma.leaveApplication.count({ where: { companyId, status: 'APPROVED', startDate: { lte: today }, endDate: { gte: today }, ...leaveWhere } }),
    ]);
    return { active, joinedThisMonth, inProbation, probationDueSoon, probationOverdue, probationReportsDue, onLeaveToday };
  },

  /** Departments with people and no head, the same list Needs your attention uses, narrowed to one site when the viewer has only one. */
  async departmentsWithoutHead(companyId: string, siteId: string | null, today: Date): Promise<number> {
    const list = await attentionReads.departmentsWithoutHead(companyId, today);
    return siteId ? list.filter((d) => d.siteId === siteId).length : list.length;
  },

  async payChangesWaiting(companyId: string): Promise<number> {
    // The same people the Employees list shows under "Pay change" (anyone who has left is not counted there).
    return prisma.payChange.count({ where: { status: 'PENDING', employee: { companyId, status: { not: 'EXITED' } } } });
  },

  async payChangesStartingBetween(companyId: string, from: Date, to: Date): Promise<number> {
    return prisma.payChange.count({ where: { status: { in: ['PENDING', 'APPROVED'] }, effectiveFrom: { gte: from, lte: to }, employee: { companyId, status: { not: 'EXITED' } } } });
  },

  async payrollState(companyId: string, monthKey: string): Promise<string | null> {
    const row = await prisma.payrollMonth.findUnique({ where: { companyId_monthKey: { companyId, monthKey } }, select: { state: true } });
    return row?.state ?? null;
  },

  async openSecurityAlerts(companyId: string): Promise<number> {
    return prisma.workforceSecurityAlert.count({ where: { companyId, status: 'OPEN' } });
  },

  async passwordResetsSince(companyId: string, since: Date): Promise<number> {
    return prisma.auditEntry.count({ where: { companyId, action: 'security.password_reset', occurredAt: { gte: since } } });
  },

  async unconfirmedPhones(companyId: string): Promise<number> {
    // A device row holds only the user id, so the company's people are found first.
    const users = await prisma.user.findMany({ where: { isActive: true, site: { companyId } }, select: { id: true } });
    return prisma.workforceDevice.count({ where: { confirmedAt: null, removedAt: null, userId: { in: users.map((u) => u.id) } } });
  },

  async activeUsers(companyId: string): Promise<number> {
    return prisma.user.count({ where: { isActive: true, site: { companyId } } });
  },

  async activeSites(companyId: string): Promise<number> {
    return prisma.site.count({ where: { companyId, isActive: true, isHub: false } });
  },

  /** The person's annual-leave days left this year (the ledger's sum), or null when they have no ledger. */
  async ownLeaveDaysLeft(employeeId: string, year: number): Promise<number | null> {
    const sum = await prisma.leaveBalanceEntry.aggregate({ where: { employeeId, typeCode: 'ANNUAL', leaveYear: year }, _sum: { days: true }, _count: true });
    return sum._count === 0 ? null : (sum._sum.days ?? 0);
  },

  ownLeaveWaiting: (employeeId: string): Promise<number> => prisma.leaveApplication.count({ where: { employeeId, status: 'WAITING' } }),

  employeeIdOfUser: async (userId: string): Promise<string | null> => (await prisma.employee.findUnique({ where: { userId }, select: { id: true } }))?.id ?? null,
};
