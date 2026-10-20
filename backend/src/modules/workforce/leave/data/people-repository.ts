import type { Prisma, UserRole } from '@prisma/client';
import { prisma } from '../../../../config/database';
import { fromDateColumn, toDateColumn, type NairobiDate } from '../../_shared/time/nairobi-time';
import type { SiteKind } from '../engine/leave-routing';

export type Db = Prisma.TransactionClient | typeof prisma;

/** The transaction the caller is in, else the shared client. Services pass this on so they never import the client themselves. */
export const dbOf = (tx?: Prisma.TransactionClient): Db => tx ?? prisma;

const SELECT = {
  id: true,
  companyId: true,
  siteId: true,
  name: true,
  userId: true,
  departmentId: true,
  status: true,
  payType: true,
  contractStatus: true,
  startDate: true,
  exitedOn: true,
  department: { select: { name: true } },
  position: { select: { name: true } },
  site: { select: { name: true, type: true } },
  user: { select: { role: true, isActive: true } },
} satisfies Prisma.EmployeeSelect;

type Row = Prisma.EmployeeGetPayload<{ select: typeof SELECT }>;

/** A person as Leave needs them. */
export interface LeavePerson {
  id: string;
  companyId: string;
  siteId: string;
  siteName: string;
  siteKind: SiteKind;
  name: string;
  userId: string | null;
  /** The login's role; null when the person has no login. */
  role: UserRole | null;
  departmentId: string | null;
  departmentName: string | null;
  positionName: string | null;
  status: string;
  /** Casual workers (probation, no contract, paid daily) have no leave until a contract starts (owner decision, 20 Oct 2026). */
  isCasual: boolean;
  startDate: NairobiDate;
  exitedOn: NairobiDate | null;
}

export const toLeavePerson = (row: Row): LeavePerson => ({
  id: row.id,
  companyId: row.companyId,
  siteId: row.siteId,
  siteName: row.site.name,
  siteKind: row.site.type === 'CENTRAL_STORE' ? 'CENTRAL_STORE' : 'BRANCH',
  name: row.name,
  userId: row.userId,
  role: row.user?.role ?? null,
  departmentId: row.departmentId,
  departmentName: row.department?.name ?? null,
  positionName: row.position?.name ?? null,
  status: row.status,
  isCasual: row.payType === 'DAILY_RATE' && row.contractStatus !== 'ACTIVE',
  startDate: fromDateColumn(row.startDate),
  exitedOn: row.exitedOn ? fromDateColumn(row.exitedOn) : null,
});

export const peopleRepository = {
  byId: async (companyId: string, employeeId: string, db: Db = prisma): Promise<LeavePerson | null> => {
    const row = await db.employee.findFirst({ where: { id: employeeId, companyId }, select: SELECT });
    return row ? toLeavePerson(row) : null;
  },

  byUserId: async (userId: string, db: Db = prisma): Promise<LeavePerson | null> => {
    const row = await db.employee.findFirst({ where: { userId }, select: SELECT });
    return row ? toLeavePerson(row) : null;
  },

  byIds: async (companyId: string, ids: readonly string[], db: Db = prisma): Promise<LeavePerson[]> =>
    (await db.employee.findMany({ where: { companyId, id: { in: [...ids] } }, select: SELECT })).map(toLeavePerson),

  /** Active people of a department on a site, for the "usual team" when the rota is not planned. */
  activeInDepartment: async (siteId: string, departmentId: string, db: Db = prisma): Promise<string[]> =>
    (await db.employee.findMany({ where: { siteId, departmentId, status: { in: ['ACTIVE', 'ON_LEAVE'] } }, select: { id: true } })).map((row) => row.id),

  /** The people holding a deciding role who can still sign in: a site's own manager, or the company's HR Manager / Director. */
  holders: async (roles: readonly UserRole[], scope: { companyId: string; siteId: string | null }, db: Db = prisma): Promise<{ userId: string; name: string }[]> =>
    (
      await db.user.findMany({
        where: { role: { in: [...roles] }, isActive: true, deletedAt: null, ...(scope.siteId ? { siteId: scope.siteId } : { site: { companyId: scope.companyId } }) },
        select: { id: true, name: true },
        orderBy: { createdAt: 'asc' },
        take: 20,
      })
    ).map((row) => ({ userId: row.id, name: row.name })),

  /** HR Managers and Directors sit at Head office or have no site, so the company-wide search also takes site-less accounts. */
  companyHolders: async (roles: readonly UserRole[], companyId: string, db: Db = prisma): Promise<{ userId: string; name: string }[]> =>
    (
      await db.user.findMany({
        where: { role: { in: [...roles] }, isActive: true, deletedAt: null, OR: [{ site: { companyId } }, { siteId: null }] },
        select: { id: true, name: true },
        orderBy: { createdAt: 'asc' },
        take: 20,
      })
    ).map((row) => ({ userId: row.id, name: row.name })),

  /** The head of a department today (substantive first, else acting), with their role for "head of Barista". */
  headOf: async (departmentId: string, date: NairobiDate, db: Db = prisma): Promise<{ employeeId: string; userId: string | null; name: string } | null> => {
    const day = toDateColumn(date);
    const row = await db.departmentHead.findFirst({
      where: { departmentId, startsOn: { lte: day }, OR: [{ endsOn: null }, { endsOn: { gte: day } }] },
      orderBy: [{ isActing: 'asc' }, { startsOn: 'desc' }],
      select: { employee: { select: { id: true, userId: true, name: true } } },
    });
    return row ? { employeeId: row.employee.id, userId: row.employee.userId, name: row.employee.name } : null;
  },

  /** People for a list: scoped by site and department, name type-ahead, leavers hidden unless asked for. A hard `take` bounds every call. */
  search: async (args: { companyId: string; siteId?: string; departmentIds?: readonly string[]; q?: string; includeLeavers?: boolean; take: number }, db: Db = prisma): Promise<LeavePerson[]> =>
    (
      await db.employee.findMany({
        where: {
          companyId: args.companyId,
          ...(args.siteId ? { siteId: args.siteId } : {}),
          ...(args.departmentIds ? { departmentId: { in: [...args.departmentIds] } } : {}),
          ...(args.q ? { name: { contains: args.q, mode: 'insensitive' as const } } : {}),
          ...(args.includeLeavers ? {} : { status: { not: 'EXITED' as const } }),
        },
        select: SELECT,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        take: args.take,
      })
    ).map(toLeavePerson),

  userNames: async (ids: readonly string[], db: Db = prisma): Promise<Map<string, { name: string; role: UserRole }>> =>
    new Map((await db.user.findMany({ where: { id: { in: [...ids] } }, select: { id: true, name: true, role: true } })).map((u) => [u.id, { name: u.name, role: u.role }] as const)),

  siteKindOf: async (siteId: string, db: Db = prisma): Promise<{ name: string; kind: SiteKind; companyId: string } | null> => {
    const site = await db.site.findFirst({ where: { id: siteId }, select: { name: true, type: true, companyId: true } });
    return site ? { name: site.name, kind: site.type === 'CENTRAL_STORE' ? 'CENTRAL_STORE' : 'BRANCH', companyId: site.companyId } : null;
  },

  /** Sites of the company with their branch/store type, for the balances page's site list. */
  sitesOf: async (companyId: string, db: Db = prisma): Promise<{ id: string; name: string }[]> =>
    db.site.findMany({ where: { companyId, isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
};
