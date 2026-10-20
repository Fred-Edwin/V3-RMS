import type { UserRole } from '@prisma/client';
import { prisma } from '../../../../config/database';

/** A person a notice can be about: one employee file, with the login (if any) and where they work now. */
export interface ConductPerson {
  employeeId: string;
  companyId: string;
  siteId: string;
  siteName: string;
  userId: string | null;
  userActive: boolean;
  name: string;
  employeeNumber: string;
  department: string | null;
  position: string | null;
  role: UserRole | null;
  status: string;
  reportsToUserId: string | null;
}

const SELECT = {
  id: true,
  companyId: true,
  siteId: true,
  userId: true,
  name: true,
  employeeNumber: true,
  status: true,
  site: { select: { name: true } },
  department: { select: { name: true } },
  position: { select: { name: true } },
  user: { select: { role: true, isActive: true, deletedAt: true } },
  reportsTo: { select: { userId: true } },
} as const;

type Row = NonNullable<Awaited<ReturnType<typeof prisma.employee.findFirst<{ select: typeof SELECT }>>>>;

const shape = (row: Row): ConductPerson => ({
  employeeId: row.id,
  companyId: row.companyId,
  siteId: row.siteId,
  siteName: row.site.name,
  userId: row.userId,
  userActive: row.user !== null && row.user.isActive && row.user.deletedAt === null,
  name: row.name,
  employeeNumber: row.employeeNumber,
  department: row.department?.name ?? null,
  position: row.position?.name ?? null,
  role: row.user?.role ?? null,
  status: row.status,
  reportsToUserId: row.reportsTo?.userId ?? null,
});

export interface NamedUser {
  id: string;
  name: string;
  role: UserRole;
  siteId: string | null;
}

export const conductPeopleRepository = {
  async personById(companyId: string, employeeId: string): Promise<ConductPerson | null> {
    const row = await prisma.employee.findFirst({ where: { id: employeeId, companyId }, select: SELECT });
    return row ? shape(row) : null;
  },

  async personByUserId(companyId: string, userId: string): Promise<ConductPerson | null> {
    const row = await prisma.employee.findFirst({ where: { userId, companyId }, select: SELECT });
    return row ? shape(row) : null;
  },

  async peopleByIds(companyId: string, employeeIds: readonly string[]): Promise<ConductPerson[]> {
    const rows = await prisma.employee.findMany({ where: { companyId, id: { in: [...employeeIds] } }, select: SELECT });
    return rows.map(shape);
  },

  /** Type-ahead for the Who field: people at the given sites (never exited, never the caller), 10 at most. */
  async searchPeople(args: { companyId: string; siteIds: readonly string[] | null; q: string; excludeUserId: string; take: number }): Promise<ConductPerson[]> {
    const rows = await prisma.employee.findMany({
      where: {
        companyId: args.companyId,
        ...(args.siteIds ? { siteId: { in: [...args.siteIds] } } : {}),
        status: { not: 'EXITED' },
        ...(args.q ? { OR: [{ name: { contains: args.q, mode: 'insensitive' as const } }, { employeeNumber: { contains: args.q, mode: 'insensitive' as const } }] } : {}),
      },
      select: SELECT,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: args.take + 1, // one spare for the caller's own row, which is dropped below
    });
    return rows.filter((row) => row.userId !== args.excludeUserId).slice(0, args.take).map(shape);
  },

  /** Employees whose name matches the typed text, for the list's type-ahead (the notices store ids, not names). */
  async employeeIdsByName(companyId: string, q: string): Promise<string[]> {
    const rows = await prisma.employee.findMany({ where: { companyId, name: { contains: q, mode: 'insensitive' } }, select: { id: true }, take: 500 });
    return rows.map((row) => row.id);
  },

  /** The ids of everyone filed at a site now (for "a transferred person's notices appear for the new site's manager", C26). */
  async employeeIdsAtSite(companyId: string, siteId: string): Promise<string[]> {
    const rows = await prisma.employee.findMany({ where: { companyId, siteId }, select: { id: true } });
    return rows.map((row) => row.id);
  },

  async usersByIds(ids: readonly string[]): Promise<NamedUser[]> {
    if (ids.length === 0) return [];
    return prisma.user.findMany({ where: { id: { in: [...ids] } }, select: { id: true, name: true, role: true, siteId: true } });
  },

  /** Active logins with a role in the company (HR and the Director are told by role; the Director and HR have no site). */
  async userIdsByRoles(companyId: string, roles: readonly UserRole[]): Promise<string[]> {
    const rows = await prisma.user.findMany({
      where: { role: { in: [...roles] }, isActive: true, deletedAt: null, OR: [{ site: { companyId } }, { siteId: null }] },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  },

  /** Colleagues who can stand as a witness: same site, active login, not the issuer and not the subject. */
  async witnessCandidates(args: { companyId: string; siteId: string; excludeUserIds: readonly string[]; q: string; take: number }) {
    return prisma.employee.findMany({
      where: {
        companyId: args.companyId,
        siteId: args.siteId,
        status: { not: 'EXITED' },
        userId: { not: null, notIn: [...args.excludeUserIds] },
        user: { isActive: true, deletedAt: null },
        ...(args.q ? { name: { contains: args.q, mode: 'insensitive' as const } } : {}),
      },
      select: { userId: true, name: true, position: { select: { name: true } }, user: { select: { role: true } } },
      orderBy: { name: 'asc' },
      take: args.take,
    });
  },
};
