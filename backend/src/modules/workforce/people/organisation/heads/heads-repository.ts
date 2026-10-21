import type { DepartmentTag, Prisma } from '@prisma/client';
import { prisma } from '../../../../../config/database';
import type { Db } from '../../employees/employees-repository';

/**
 * All Prisma access for department heads and the two head claims on `User`. Every query names the company (directly or
 * through the department's site). Head rows are ended, never edited; a row that started today and is ended today is
 * removed instead (its end date could not be earlier than its start, so it would still count for today).
 */
export const activeWhere = (today: Date): Prisma.DepartmentHeadWhereInput => ({
  startsOn: { lte: today },
  OR: [{ endsOn: null }, { endsOn: { gte: today } }],
});

const ROW_SELECT = {
  id: true,
  departmentId: true,
  employeeId: true,
  isActing: true,
  startsOn: true,
  endsOn: true,
  department: { select: { siteId: true, key: true, name: true } },
  employee: { select: { id: true, name: true, userId: true } },
} satisfies Prisma.DepartmentHeadSelect;
export type HeadRowRecord = Prisma.DepartmentHeadGetPayload<{ select: typeof ROW_SELECT }>;

export interface ClaimsRecord {
  isDepartmentHead: boolean;
  departmentTag: DepartmentTag | null;
  departmentId: string | null;
}

export const headsRepository = {
  /** The rows that are active today (or start later) for a person's login: the input to their claims. */
  rowsOfUser: (db: Db, companyId: string, userId: string, today: Date): Promise<HeadRowRecord[]> =>
    db.departmentHead.findMany({
      where: { employee: { userId, companyId }, OR: [{ endsOn: null }, { endsOn: { gte: today } }] },
      select: ROW_SELECT,
    }),

  activeRowsOfDepartment: (departmentId: string, today: Date, db: Db = prisma): Promise<HeadRowRecord[]> =>
    db.departmentHead.findMany({ where: { departmentId, ...activeWhere(today) }, select: ROW_SELECT, orderBy: [{ isActing: 'asc' }, { startsOn: 'asc' }] }),

  activeRowsOfEmployee: (employeeId: string, today: Date, db: Db = prisma): Promise<HeadRowRecord[]> =>
    db.departmentHead.findMany({ where: { employeeId, ...activeWhere(today) }, select: ROW_SELECT }),

  /** Active rows for many departments at once (the overview). */
  activeRowsOfDepartments: (departmentIds: readonly string[], today: Date, db: Db = prisma): Promise<HeadRowRecord[]> =>
    db.departmentHead.findMany({ where: { departmentId: { in: [...departmentIds] }, ...activeWhere(today) }, select: ROW_SELECT }),

  /** The person being named, with what the head rules need. */
  findPerson: (companyId: string, id: string, db: Db = prisma) =>
    db.employee.findFirst({
      where: { id, companyId },
      select: {
        id: true,
        name: true,
        userId: true,
        departmentId: true,
        status: true,
        payType: true,
        startDate: true,
        position: { select: { name: true } },
        user: { select: { isActive: true } },
      },
    }),

  /** Monthly, active staff of a department who have a working login, longest tenure first. */
  candidatesOf: (companyId: string, departmentId: string) =>
    prisma.employee.findMany({
      where: { companyId, departmentId, status: 'ACTIVE', payType: 'MONTHLY_SALARY', userId: { not: null }, user: { isActive: true } },
      select: { id: true, name: true, userId: true, startDate: true, position: { select: { name: true } } },
      orderBy: [{ startDate: 'asc' }, { name: 'asc' }],
    }),

  /** Monthly, active staff of a department with no login yet: who could lead once given one (finding 20). */
  withoutLoginOf: (companyId: string, departmentId: string) =>
    prisma.employee.findMany({
      where: { companyId, departmentId, status: 'ACTIVE', payType: 'MONTHLY_SALARY', userId: null },
      select: { id: true, name: true, position: { select: { name: true } } },
      orderBy: [{ startDate: 'asc' }, { name: 'asc' }],
    }),

  /** A department of the company, with what an event needs (site and inventory tag). */
  departmentOf: (db: Db, companyId: string, departmentId: string) =>
    db.department.findFirst({ where: { id: departmentId, site: { companyId } }, select: { id: true, siteId: true, key: true } }),

  createRow: (db: Db, data: { departmentId: string; employeeId: string; isActing: boolean; startsOn: Date; endsOn: Date | null; assignedById: string }) =>
    db.departmentHead.create({ data, select: { id: true } }),

  /** Ends a row on `endsOn` (guarded so a second run changes nothing). */
  endRow: (db: Db, id: string, endsOn: Date, endedById: string | null, endReason: string) =>
    db.departmentHead.updateMany({ where: { id, endsOn: null }, data: { endsOn, endedById, endReason } }),

  /** An acting row already has an end date; this only moves it earlier. */
  endActingRow: (db: Db, id: string, endsOn: Date, endedById: string | null, endReason: string) =>
    db.departmentHead.updateMany({ where: { id, isActing: true, endsOn: { gt: endsOn } }, data: { endsOn, endedById, endReason } }),

  removeRow: (db: Db, id: string, today: Date) => db.departmentHead.deleteMany({ where: { id, startsOn: { gte: today } } }),

  // ---- claims on User ---------------------------------------------------------------------------
  readClaims: async (db: Db, userId: string): Promise<ClaimsRecord | null> => {
    const user = await db.user.findUnique({ where: { id: userId }, select: { isDepartmentHead: true, departmentTag: true, departmentId: true } });
    return user;
  },

  writeClaims: (db: Db, userId: string, claims: { isDepartmentHead: boolean; departmentTag: DepartmentTag | null; departmentId?: string | null }) =>
    db.user.update({
      where: { id: userId },
      data: {
        isDepartmentHead: claims.isDepartmentHead,
        departmentTag: claims.departmentTag,
        ...(claims.departmentId !== undefined ? { departmentId: claims.departmentId } : {}),
      },
      select: { id: true },
    }),

  // ---- reconcile ---------------------------------------------------------------------------------
  companyIds: async (): Promise<string[]> => (await prisma.company.findMany({ select: { id: true } })).map((c) => c.id),

  /** Logins with a file that carry a head claim or have a head row that is open or ahead: the only ones that can drift. */
  usersToReconcile: (companyId: string, today: Date) =>
    prisma.user.findMany({
      where: {
        employee: { companyId },
        OR: [{ isDepartmentHead: true }, { employee: { heads: { some: { OR: [{ endsOn: null }, { endsOn: { gte: today } }] } } } }],
      },
      select: { id: true },
    }),
};
