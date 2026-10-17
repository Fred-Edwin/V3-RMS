import type { Prisma } from '@prisma/client';
import { prisma } from '../../../../../config/database';
import type { Db } from '../../employees/employees-repository';

/**
 * All Prisma access for departments and the positions they offer. `Department` is Inventory's table; a department
 * belongs to a company through its site, so every query names the company that way. Nothing is deleted except the
 * "offered by" links of a department.
 */
const DEPARTMENT_SELECT = {
  id: true,
  siteId: true,
  name: true,
  key: true,
  description: true,
  status: true,
  site: { select: { id: true, name: true, type: true, isHub: true } },
  positions: { select: { position: { select: { id: true, name: true, isActive: true } } } },
} satisfies Prisma.DepartmentSelect;
export type DepartmentRecord = Prisma.DepartmentGetPayload<{ select: typeof DEPARTMENT_SELECT }>;

const NOT_EXITED: Prisma.EmployeeWhereInput = { status: { not: 'EXITED' } };

export const departmentsRepository = {
  sitesOfCompany: (companyId: string, onlySiteId: string | null) =>
    prisma.site.findMany({
      where: { companyId, isActive: true, ...(onlySiteId ? { id: onlySiteId } : {}) },
      select: { id: true, name: true, type: true, isHub: true },
      orderBy: [{ isHub: 'asc' }, { name: 'asc' }],
    }),

  findSite: (companyId: string, id: string, db: Db = prisma) => db.site.findFirst({ where: { id, companyId, isActive: true }, select: { id: true, name: true, type: true, isHub: true } }),

  departmentsOfSites: (companyId: string, siteIds: readonly string[], includeRetired: boolean, onlyIds: readonly string[] | null) =>
    prisma.department.findMany({
      where: {
        siteId: { in: [...siteIds] },
        site: { companyId },
        ...(includeRetired ? {} : { status: 'ACTIVE' as const }),
        ...(onlyIds ? { id: { in: [...onlyIds] } } : {}),
      },
      select: DEPARTMENT_SELECT,
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
    }),

  findDepartment: (companyId: string, id: string, db: Db = prisma): Promise<DepartmentRecord | null> =>
    db.department.findFirst({ where: { id, site: { companyId } }, select: DEPARTMENT_SELECT }),

  peopleCounts: async (companyId: string, departmentIds: readonly string[]): Promise<Map<string, number>> => {
    const rows = await prisma.employee.groupBy({ by: ['departmentId'], where: { companyId, departmentId: { in: [...departmentIds] }, ...NOT_EXITED }, _count: { _all: true } });
    return new Map(rows.flatMap((row) => (row.departmentId ? [[row.departmentId, row._count._all] as const] : [])));
  },

  peopleCount: (companyId: string, departmentId: string, db: Db = prisma) => db.employee.count({ where: { companyId, departmentId, ...NOT_EXITED } }),

  /** Monthly staff of a department, a page at a time. */
  peoplePage: (companyId: string, departmentId: string, skip: number, take: number) =>
    Promise.all([
      prisma.employee.findMany({
        where: { companyId, departmentId, ...NOT_EXITED, payType: 'MONTHLY_SALARY' },
        select: { id: true, userId: true, name: true, status: true, payType: true, position: { select: { name: true } } },
        orderBy: { name: 'asc' },
        skip,
        take,
      }),
      prisma.employee.count({ where: { companyId, departmentId, ...NOT_EXITED, payType: 'MONTHLY_SALARY' } }),
    ]),

  casualPool: (companyId: string, departmentId: string, withRate: boolean) =>
    prisma.employee.findMany({
      where: { companyId, departmentId, ...NOT_EXITED, payType: 'DAILY_RATE' },
      select: {
        id: true,
        userId: true,
        name: true,
        status: true,
        payType: true,
        position: { select: { name: true } },
        ...(withRate ? { payProfile: { select: { amount: true } } } : {}),
      },
      orderBy: { name: 'asc' },
      take: 200,
    }),

  nameTaken: async (db: Db, siteId: string, name: string, exceptId: string | null): Promise<boolean> =>
    (await db.department.count({ where: { siteId, name: { equals: name, mode: 'insensitive' }, ...(exceptId ? { id: { not: exceptId } } : {}) } })) > 0,

  nextOrder: async (db: Db, siteId: string): Promise<number> => (await db.department.aggregate({ where: { siteId }, _max: { position: true } }))._max.position ?? 0,

  /** Active positions of the company among the given ids (the ones a department may offer). */
  activePositionIds: async (companyId: string, ids: readonly string[], db: Db = prisma): Promise<string[]> =>
    (await db.position.findMany({ where: { companyId, isActive: true, id: { in: [...ids] } }, select: { id: true } })).map((p) => p.id),

  /** People in the department whose position is among these (blocks taking the position off the department's list). */
  holdersOfPositions: (db: Db, companyId: string, departmentId: string, positionIds: readonly string[]) =>
    db.employee.count({ where: { companyId, departmentId, positionId: { in: [...positionIds] }, ...NOT_EXITED } }),

  create: (db: Db, data: { siteId: string; name: string; description: string | null; position: number }) =>
    db.department.create({ data: { ...data, status: 'ACTIVE' }, select: { id: true } }),

  update: (db: Db, siteId: string, id: string, data: { name?: string; description?: string | null }) => db.department.updateMany({ where: { id, siteId }, data }),

  setStatus: (db: Db, siteId: string, id: string, status: 'ACTIVE' | 'RETIRED') =>
    db.department.updateMany({ where: { id, siteId }, data: { status, retiredAt: status === 'RETIRED' ? new Date() : null } }),

  /** Makes the offered positions exactly this list (adds the missing links, removes the others). */
  setOfferedPositions: async (db: Db, departmentId: string, positionIds: readonly string[]): Promise<void> => {
    await db.departmentPosition.deleteMany({ where: { departmentId, positionId: { notIn: [...positionIds] } } });
    if (positionIds.length > 0) await db.departmentPosition.createMany({ data: positionIds.map((positionId) => ({ departmentId, positionId })), skipDuplicates: true });
  },

  offeredPositionIds: async (db: Db, departmentId: string): Promise<string[]> =>
    (await db.departmentPosition.findMany({ where: { departmentId }, select: { positionId: true } })).map((row) => row.positionId),
};
