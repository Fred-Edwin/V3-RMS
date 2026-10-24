import type { Prisma, UserRole } from '@prisma/client';
import { payChangeWhere } from './employees-pay-filter';

/**
 * The shapes and where-builders `employees-repository.ts` queries with: who a list may show, which columns a list row and a file
 * carry, and the filters of the People list. No query runs here (and no Prisma client is imported: only the repository does that).
 */

/** Who the list or lookup may show: the repository turns this into a where clause so services never build one. */
export type ScopeFilter =
  | { kind: 'all' }
  | { kind: 'site'; siteId: string; excludeUserRoles?: readonly UserRole[] }
  | { kind: 'departments'; departmentIds: readonly string[] };

export const scopeWhere = (scope: ScopeFilter): Prisma.EmployeeWhereInput => {
  switch (scope.kind) {
    case 'all':
      return {};
    case 'site':
      // People without a login stay in; a login at or above the viewer's level goes out.
      return {
        siteId: scope.siteId,
        ...(scope.excludeUserRoles ? { OR: [{ userId: null }, { user: { role: { notIn: [...scope.excludeUserRoles] } } }] } : {}),
      };
    case 'departments':
      return { departmentId: { in: [...scope.departmentIds] } };
  }
};

export const activeHeadWhere = (today: Date): Prisma.DepartmentHeadWhereInput => ({
  startsOn: { lte: today },
  OR: [{ endsOn: null }, { endsOn: { gte: today } }],
});

export const LIST_SELECT = (today: Date) =>
  ({
    id: true,
    employeeNumber: true,
    name: true,
    photoUrl: true,
    siteId: true,
    departmentId: true,
    positionId: true,
    userId: true,
    status: true,
    payType: true,
    contractStatus: true,
    probationEndsOn: true,
    nationalId: true,
    personalPhone: true,
    physicalAddress: true,
    nssfNumber: true,
    shaNumber: true,
    emergencyName: true,
    emergencyPhone: true,
    site: { select: { name: true } },
    department: { select: { name: true } },
    position: { select: { name: true } },
    reportsTo: { select: { name: true } },
    user: { select: { role: true } },
    payProfile: { select: { amount: true, payoutMethod: true, bankName: true, accountNumber: true, mpesaPhone: true } },
    heads: { where: activeHeadWhere(today), select: { id: true } },
  }) satisfies Prisma.EmployeeSelect;
export type ListRow = Prisma.EmployeeGetPayload<{ select: ReturnType<typeof LIST_SELECT> }>;

export const FILE_INCLUDE = (today: Date) =>
  ({
    site: { select: { id: true, name: true, companyId: true, type: true } },
    department: { select: { id: true, name: true, key: true, siteId: true } },
    position: { select: { id: true, name: true, defaultTracksTime: true } },
    reportsTo: { select: { id: true, name: true, position: { select: { name: true } }, site: { select: { name: true } }, heads: { where: activeHeadWhere(today), select: { id: true } } } },
    user: { select: { id: true, role: true, isActive: true, email: true } },
    payProfile: true,
    contracts: { orderBy: { startsOn: 'desc' as const }, include: { contractType: { select: { name: true } } } },
    spells: { orderBy: { startsOn: 'desc' as const } },
    moves: { orderBy: { startsOn: 'desc' as const } },
    heads: { where: activeHeadWhere(today), select: { id: true, isActing: true, departmentId: true } },
    probationNotes: { orderBy: { createdAt: 'desc' as const } },
    fileRequests: { where: { resolvedAt: null }, orderBy: { askedAt: 'desc' as const } },
    payChanges: { orderBy: { effectiveFrom: 'desc' as const } },
    documents: { select: { id: true, createdAt: true, documentType: true }, orderBy: { createdAt: 'desc' as const } },
  }) satisfies Prisma.EmployeeInclude;
export type FileRow = Prisma.EmployeeGetPayload<{ include: ReturnType<typeof FILE_INCLUDE> }>;

export interface SubjectFacts {
  employeeId: string | null;
  /** Null when the person has no file yet: the role default (decision D2) applies. */
  tracksTime: boolean | null;
  /** Active DepartmentHead rows today, substantive or acting. */
  headOfDepartmentIds: string[];
}

export interface ListQuery {
  companyId: string;
  scope: ScopeFilter;
  siteId?: string;
  departmentId?: string;
  filter: 'all' | 'needs_finishing' | 'blocks_payroll' | 'no_contract' | 'casual_pool' | 'on_probation' | 'pay_change' | 'pay_change_month' | 'exited';
  q?: string;
  today: Date;
}

export const filterWhere = (query: ListQuery): Prisma.EmployeeWhereInput => {
  const and: Prisma.EmployeeWhereInput[] = [scopeWhere(query.scope)];
  if (query.siteId) and.push({ siteId: query.siteId });
  if (query.departmentId) and.push({ departmentId: query.departmentId });
  if (query.q) {
    and.push({
      OR: [
        { name: { contains: query.q, mode: 'insensitive' } },
        { employeeNumber: { contains: query.q, mode: 'insensitive' } },
        { position: { name: { contains: query.q, mode: 'insensitive' } } },
      ],
    });
  }
  switch (query.filter) {
    case 'exited':
      and.push({ status: 'EXITED' });
      break;
    case 'no_contract':
      and.push({ status: { not: 'EXITED' }, payType: 'MONTHLY_SALARY', contractStatus: { not: 'ACTIVE' } });
      break;
    case 'casual_pool':
      and.push({ status: { not: 'EXITED' }, payType: 'DAILY_RATE' });
      break;
    case 'on_probation':
      and.push({ status: { not: 'EXITED' }, probationEndsOn: { gte: query.today }, probationConfirmedOn: null });
      break;
    case 'pay_change':
    case 'pay_change_month':
      and.push({ status: { not: 'EXITED' } }, payChangeWhere(query.filter === 'pay_change' ? 'waiting' : 'month', query.today));
      break;
    case 'needs_finishing':
    case 'blocks_payroll':
      and.push({ status: { not: 'EXITED' } });
      break;
    case 'all':
      and.push({ status: { not: 'EXITED' } });
      break;
  }
  return { companyId: query.companyId, AND: and };
};
