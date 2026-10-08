import { Prisma } from '@prisma/client';
import { prisma } from '../../../config/database';
import type { BranchPickRecord, DepartmentHeadRecord, DepartmentRecord } from './departments.types';

type Db = Prisma.TransactionClient | typeof prisma;

const departmentSelect = { id: true, siteId: true, name: true, key: true, status: true, position: true, retiredAt: true } as const;

/**
 * Departments: database access only. A department belongs to a branch Site (`siteId`); every read and write here names that
 * branch, so one branch can never reach another's rows. The branch list is the one deliberate cross-site read (the picker).
 */
export const departmentsRepository = {
  /** Active branch sites (never the Central Store), for the hub roles' branch picker. */
  listBranches: (): Promise<BranchPickRecord[]> =>
    prisma.site.findMany({ where: { type: 'BRANCH', isActive: true }, select: { id: true, name: true, code: true }, orderBy: { name: 'asc' } }),

  findBranch: (siteId: string): Promise<BranchPickRecord | null> =>
    prisma.site.findFirst({ where: { id: siteId, type: 'BRANCH' }, select: { id: true, name: true, code: true } }),

  listByBranch: (siteId: string): Promise<DepartmentRecord[]> =>
    prisma.department.findMany({ where: { siteId }, select: departmentSelect, orderBy: [{ position: 'asc' }, { name: 'asc' }] }),

  findById: (id: string): Promise<DepartmentRecord | null> => prisma.department.findFirst({ where: { id }, select: departmentSelect }),

  /** Heads of the given departments (the user with isDepartmentHead whose departmentId matches), scoped to the branch. */
  listHeads: (siteId: string, departmentIds: string[]): Promise<DepartmentHeadRecord[]> =>
    departmentIds.length === 0
      ? Promise.resolve([])
      : prisma.user
          .findMany({
            where: { siteId, isDepartmentHead: true, isActive: true, deletedAt: null, departmentId: { in: departmentIds } },
            select: { id: true, name: true, role: true, departmentId: true },
            orderBy: { name: 'asc' },
          })
          .then((rows) => rows.flatMap((r) => (r.departmentId ? [{ id: r.id, name: r.name, role: r.role, departmentId: r.departmentId }] : []))),

  /** Items (not retired) tagged to each department, in one grouped read. */
  countItemsByDepartment: async (departmentIds: string[]): Promise<Map<string, number>> => {
    if (departmentIds.length === 0) return new Map();
    const rows = await prisma.itemDepartment.groupBy({
      by: ['departmentId'],
      where: { departmentId: { in: departmentIds }, item: { deletedAt: null } },
      _count: { _all: true },
    });
    return new Map(rows.map((r) => [r.departmentId, r._count._all]));
  },

  /** A branch's department with this name (case-insensitive), optionally ignoring one id (a rename to its own name). */
  findByName: (siteId: string, name: string, exceptId?: string): Promise<{ id: string } | null> =>
    prisma.department.findFirst({
      where: { siteId, name: { equals: name, mode: 'insensitive' }, ...(exceptId ? { id: { not: exceptId } } : {}) },
      select: { id: true },
    }),

  create: async (siteId: string, name: string, db: Db = prisma): Promise<DepartmentRecord> => {
    const last = await db.department.aggregate({ where: { siteId }, _max: { position: true } });
    return db.department.create({ data: { siteId, name, position: (last._max.position ?? 0) + 1 }, select: departmentSelect });
  },

  rename: (id: string, siteId: string, name: string): Promise<DepartmentRecord> =>
    prisma.department.update({ where: { id, siteId }, data: { name }, select: departmentSelect }),

  setStatus: (id: string, siteId: string, status: 'ACTIVE' | 'RETIRED'): Promise<DepartmentRecord> =>
    prisma.department.update({
      where: { id, siteId },
      data: { status, retiredAt: status === 'RETIRED' ? new Date() : null },
      select: departmentSelect,
    }),
};
