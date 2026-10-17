import type { Prisma, UserRole } from '@prisma/client';
import { prisma } from '../../../../../config/database';
import type { Db } from '../../employees/employees-repository';

/** All Prisma access for positions. A position belongs to the company, so every query names `companyId`. */
const NOT_EXITED: Prisma.EmployeeWhereInput = { status: { not: 'EXITED' } };

const POSITION_SELECT = {
  id: true,
  name: true,
  defaultTracksTime: true,
  loginRole: true,
  casualsAllowed: true,
  isActive: true,
  departments: { select: { department: { select: { id: true, name: true, siteId: true } } } },
  _count: { select: { employees: { where: NOT_EXITED } } },
} satisfies Prisma.PositionSelect;
export type PositionRecord = Prisma.PositionGetPayload<{ select: typeof POSITION_SELECT }>;

export type HolderScope = { kind: 'all' } | { kind: 'site'; siteId: string } | { kind: 'departments'; departmentIds: readonly string[] };
const holderWhere = (scope: HolderScope): Prisma.EmployeeWhereInput =>
  scope.kind === 'all' ? {} : scope.kind === 'site' ? { siteId: scope.siteId } : { departmentId: { in: [...scope.departmentIds] } };

export const positionsRepository = {
  list: (companyId: string, filter: { departmentId?: string; includeRetired: boolean; q?: string }): Promise<PositionRecord[]> =>
    prisma.position.findMany({
      where: {
        companyId,
        ...(filter.includeRetired ? {} : { isActive: true }),
        ...(filter.departmentId ? { departments: { some: { departmentId: filter.departmentId } } } : {}),
        ...(filter.q ? { name: { contains: filter.q, mode: 'insensitive' as const } } : {}),
      },
      select: POSITION_SELECT,
      orderBy: { name: 'asc' },
    }),

  find: (companyId: string, id: string, db: Db = prisma): Promise<PositionRecord | null> => db.position.findFirst({ where: { id, companyId }, select: POSITION_SELECT }),

  holders: (companyId: string, positionId: string, scope: HolderScope, take = 200) =>
    prisma.employee.findMany({
      where: { companyId, positionId, ...NOT_EXITED, ...holderWhere(scope) },
      select: { id: true, name: true, siteId: true, departmentId: true },
      orderBy: { name: 'asc' },
      take,
    }),

  holderCount: (db: Db, companyId: string, positionId: string) => db.employee.count({ where: { companyId, positionId, ...NOT_EXITED } }),

  holdersAnywhere: (db: Db, companyId: string, positionId: string) =>
    db.employee.findMany({ where: { companyId, positionId, ...NOT_EXITED }, select: { id: true, name: true }, orderBy: { name: 'asc' }, take: 50 }),

  /** People whose "clocks in" would change with the position's default: those without a personal override. */
  affectedByTracksTime: (companyId: string, positionId: string, value: boolean, db: Db = prisma) =>
    db.employee.findMany({
      where: { companyId, positionId, tracksTimeOverride: false, tracksTime: { not: value }, ...NOT_EXITED },
      select: { id: true, name: true, userId: true, siteId: true },
      orderBy: { name: 'asc' },
    }),

  applyTracksTime: (db: Db, companyId: string, ids: readonly string[], value: boolean) =>
    db.employee.updateMany({ where: { companyId, id: { in: [...ids] }, tracksTimeOverride: false }, data: { tracksTime: value } }),

  nameTaken: async (db: Db, companyId: string, name: string, exceptId: string | null): Promise<boolean> =>
    (await db.position.count({ where: { companyId, name: { equals: name, mode: 'insensitive' }, ...(exceptId ? { id: { not: exceptId } } : {}) } })) > 0,

  departmentsOfCompany: async (db: Db, companyId: string, ids: readonly string[]): Promise<string[]> =>
    (await db.department.findMany({ where: { id: { in: [...ids] }, status: 'ACTIVE', site: { companyId } }, select: { id: true } })).map((d) => d.id),

  create: (db: Db, data: { companyId: string; name: string; defaultTracksTime: boolean; loginRole: UserRole | null; casualsAllowed: boolean }) =>
    db.position.create({ data, select: { id: true } }),

  update: (db: Db, companyId: string, id: string, data: Prisma.PositionUncheckedUpdateManyInput) => db.position.updateMany({ where: { id, companyId }, data }),

  setActive: (db: Db, companyId: string, id: string, isActive: boolean) => db.position.updateMany({ where: { id, companyId }, data: { isActive } }),

  linkedDepartmentIds: async (db: Db, positionId: string): Promise<string[]> =>
    (await db.departmentPosition.findMany({ where: { positionId }, select: { departmentId: true } })).map((row) => row.departmentId),

  /** People holding the position inside these departments (blocks unlinking them). */
  holdersInDepartments: (db: Db, companyId: string, positionId: string, departmentIds: readonly string[]) =>
    db.employee.count({ where: { companyId, positionId, departmentId: { in: [...departmentIds] }, ...NOT_EXITED } }),

  setDepartments: async (db: Db, positionId: string, departmentIds: readonly string[]): Promise<void> => {
    await db.departmentPosition.deleteMany({ where: { positionId, departmentId: { notIn: [...departmentIds] } } });
    if (departmentIds.length > 0) await db.departmentPosition.createMany({ data: departmentIds.map((departmentId) => ({ departmentId, positionId })), skipDuplicates: true });
  },
};
