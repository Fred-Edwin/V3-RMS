import type { Prisma, RuleConfirmation, RuleGroup, RuleVersion, RuleVersionWithdrawal, UserRole } from '@prisma/client';
import { prisma } from '../../../../config/database';

/**
 * Read access for the rules store (writes are in versions/versions-repository.ts). Every query carries companyId (or the
 * site id, for the lookup of a site itself). Rule versions and confirmations are immutable: there is no update, delete or
 * upsert anywhere, and a static test keeps it that way. A mistake is fixed by a new version; a cancelled one by a withdrawal.
 */

export type Db = Prisma.TransactionClient | typeof prisma;

export type RuleVersionRow = RuleVersion & { confirmations: RuleConfirmation[]; withdrawal: RuleVersionWithdrawal | null };

/** The plain (non-transaction) client, for the plan's read-only pre-flight; services pass it on and never query it themselves. */
export const readDb: Db = prisma;

export const withDetails = { confirmations: { orderBy: { confirmedAt: 'asc' as const } }, withdrawal: true };

/** A withdrawn version is skipped by every question about what is in force or what comes next. */
const live = { withdrawal: null };

export const rulesRepository = {
  /** The one lookup by a bare site id: a site names its own company. */
  findSite: (siteId: string) => prisma.site.findUnique({ where: { id: siteId }, select: { id: true, companyId: true, name: true, type: true } }),

  /** Active sites of a company, for site selectors and the "who can change this" answers. */
  findSites: (companyId: string) => prisma.site.findMany({ where: { companyId, isActive: true }, select: { id: true, name: true, type: true }, orderBy: { name: 'asc' } }),

  findUser: (userId: string) => prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, role: true, site: { select: { companyId: true } } } }),

  /** The company when exactly one is active (a System Admin has no site of their own). Otherwise null. */
  findOnlyCompanyId: async (): Promise<string | null> => {
    const companies = await prisma.company.findMany({ where: { isActive: true }, select: { id: true }, take: 2 });
    return companies.length === 1 ? (companies[0]?.id ?? null) : null;
  },

  findUserNames: async (companyId: string, userIds: string[]): Promise<Map<string, string>> => {
    if (userIds.length === 0) return new Map();
    const users = await prisma.user.findMany({
      where: { id: { in: userIds }, OR: [{ site: { companyId } }, { siteId: null }] },
      select: { id: true, name: true },
    });
    return new Map(users.map((user) => [user.id, user.name]));
  },

  /** Active people of the given roles in the company (people with no site, like a Director on the hub, count as company-wide). */
  findActiveUsers: (companyId: string, roles: UserRole[], siteId: string | null) =>
    prisma.user.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        role: { in: roles },
        ...(siteId ? { siteId } : { OR: [{ site: { companyId } }, { siteId: null }] }),
      },
      select: { id: true },
    }),

  /** People who head a department right now (substantive or acting), for one site or the whole company. */
  findHeadUserIds: async (companyId: string, siteId: string | null): Promise<string[]> => {
    const heads = await prisma.departmentHead.findMany({
      where: { endsOn: null, employee: { companyId, userId: { not: null }, ...(siteId ? { siteId } : {}) } },
      select: { employee: { select: { userId: true } } },
    });
    return [...new Set(heads.flatMap((head) => (head.employee.userId ? [head.employee.userId] : [])))];
  },

  /** The version in force on a date for one scope: greatest effectiveFrom not after the date; a tie goes to the higher version. */
  findEffective: (companyId: string, siteId: string | null, group: RuleGroup, date: Date, db: Db = prisma): Promise<RuleVersionRow | null> =>
    db.ruleVersion.findFirst({
      where: { companyId, siteId, group, effectiveFrom: { lte: date }, ...live },
      orderBy: [{ effectiveFrom: 'desc' }, { version: 'desc' }],
      include: withDetails,
    }),

  /** Company versions in force on or before a date, newest first (a pay field falls back along this list until one is confirmed, D2). */
  findChainUpTo: (companyId: string, group: RuleGroup, date: Date, take = 25): Promise<RuleVersionRow[]> =>
    prisma.ruleVersion.findMany({
      where: { companyId, siteId: null, group, effectiveFrom: { lte: date }, ...live },
      orderBy: [{ effectiveFrom: 'desc' }, { version: 'desc' }],
      take,
      include: withDetails,
    }),

  /** The next version that has not started yet (not withdrawn), for the "scheduled" line. */
  findScheduled: (companyId: string, siteId: string | null, group: RuleGroup, today: Date): Promise<RuleVersionRow | null> =>
    prisma.ruleVersion.findFirst({
      where: { companyId, siteId, group, effectiveFrom: { gt: today }, ...live },
      orderBy: [{ effectiveFrom: 'asc' }, { version: 'asc' }],
      include: withDetails,
    }),

  /** Every site's newest started override of a group, for "sites that do their own". */
  findSiteOverrides: (companyId: string, group: RuleGroup, today: Date): Promise<RuleVersionRow[]> =>
    prisma.ruleVersion.findMany({
      where: { companyId, siteId: { not: null }, group, effectiveFrom: { lte: today }, ...live },
      orderBy: [{ effectiveFrom: 'desc' }, { version: 'desc' }],
      include: withDetails,
    }),

  /** The highest number ever used in a scope (numbers are never reused, even by a withdrawn version) and the latest live start day. */
  latestOfScope: async (
    companyId: string,
    siteId: string | null,
    group: RuleGroup,
    db: Db = prisma,
  ): Promise<{ number: number; live: { version: number; effectiveFrom: Date } | null } | null> => {
    const [byNumber, byDate] = await Promise.all([
      db.ruleVersion.findFirst({ where: { companyId, siteId, group }, orderBy: { version: 'desc' }, select: { version: true } }),
      db.ruleVersion.findFirst({ where: { companyId, siteId, group, ...live }, orderBy: [{ effectiveFrom: 'desc' }, { version: 'desc' }], select: { version: true, effectiveFrom: true } }),
    ]);
    if (!byNumber) return null;
    return { number: byNumber.version, live: byDate ? { version: byDate.version, effectiveFrom: byDate.effectiveFrom } : null };
  },

  /** One page of a scope's versions, newest first, plus one extra row so the last row can be compared with its predecessor. */
  listVersionsPage: async (companyId: string, group: RuleGroup, siteId: string | null, skip: number, take: number): Promise<{ rows: RuleVersionRow[]; total: number }> => {
    const [rows, total] = await Promise.all([
      prisma.ruleVersion.findMany({ where: { companyId, group, siteId }, orderBy: { version: 'desc' }, skip, take: take + 1, include: withDetails }),
      prisma.ruleVersion.count({ where: { companyId, group, siteId } }),
    ]);
    return { rows, total };
  },

  findByNumber: (companyId: string, siteId: string | null, group: RuleGroup, version: number, db: Db = prisma): Promise<RuleVersionRow | null> =>
    db.ruleVersion.findFirst({ where: { companyId, siteId, group, version }, include: withDetails }),

  findVersion: (companyId: string, versionId: string, db: Db = prisma): Promise<RuleVersionRow | null> =>
    db.ruleVersion.findFirst({ where: { companyId, id: versionId }, include: withDetails }),

  /** A retry of the same save: the version this key already made. */
  findByKey: (companyId: string, key: string, db: Db = prisma): Promise<RuleVersionRow | null> =>
    db.ruleVersion.findFirst({ where: { companyId, idempotencyKey: key }, include: withDetails }),
};
