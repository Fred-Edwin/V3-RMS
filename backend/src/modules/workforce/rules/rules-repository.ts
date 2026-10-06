import type { Prisma, RuleConfirmation, RuleGroup, RuleVersion, UserRole } from '@prisma/client';
import { prisma } from '../../../config/database';

/**
 * All Prisma access for the rules store. Every query carries companyId (or the site id, for the lookup of a site
 * itself). Rule versions and confirmations are immutable: there is no update, delete or upsert here, and a static test
 * keeps it that way. A mistake is fixed by a new version.
 */

type Db = Prisma.TransactionClient | typeof prisma;

export type RuleVersionRow = RuleVersion & { confirmations: RuleConfirmation[] };

export interface NewRuleVersion {
  companyId: string;
  siteId: string | null;
  group: RuleGroup;
  version: number;
  effectiveFrom: Date; // a @db.Date value
  values: Prisma.InputJsonValue;
  reason: string;
  createdById: string;
  createdByRole: string;
}

export interface NewRuleConfirmation {
  ruleVersionId: string;
  scope: string;
  confirmedById: string;
  confirmerRole: string;
  note: string | null;
}

const withConfirmations = { confirmations: { orderBy: { confirmedAt: 'asc' as const } } };

export const rulesRepository = {
  /** The one lookup by a bare site id: a site names its own company. */
  findSite: (siteId: string) => prisma.site.findUnique({ where: { id: siteId }, select: { id: true, companyId: true } }),

  findUser: (userId: string) =>
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, role: true, site: { select: { companyId: true } } } }),

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

  /** The version in force on a date for one scope: greatest effectiveFrom not after the date; a tie goes to the higher version. */
  findEffective: (companyId: string, siteId: string | null, group: RuleGroup, date: Date, db: Db = prisma): Promise<RuleVersionRow | null> =>
    db.ruleVersion.findFirst({
      where: { companyId, siteId, group, effectiveFrom: { lte: date } },
      orderBy: [{ effectiveFrom: 'desc' }, { version: 'desc' }],
      include: withConfirmations,
    }),

  findByNumber: (companyId: string, siteId: string | null, group: RuleGroup, version: number, db: Db = prisma): Promise<RuleVersionRow | null> =>
    db.ruleVersion.findFirst({ where: { companyId, siteId, group, version }, include: withConfirmations }),

  /** The newest version of a scope by number, and the latest effective date stored, for numbering and the date rule. */
  latestOfScope: async (companyId: string, siteId: string | null, group: RuleGroup, db: Db = prisma): Promise<{ version: number; effectiveFrom: Date } | null> => {
    const [byNumber, byDate] = await Promise.all([
      db.ruleVersion.findFirst({ where: { companyId, siteId, group }, orderBy: { version: 'desc' }, select: { version: true } }),
      db.ruleVersion.findFirst({ where: { companyId, siteId, group }, orderBy: [{ effectiveFrom: 'desc' }, { version: 'desc' }], select: { effectiveFrom: true } }),
    ]);
    return byNumber && byDate ? { version: byNumber.version, effectiveFrom: byDate.effectiveFrom } : null;
  },

  listVersions: (companyId: string, group: RuleGroup, siteId: string | null): Promise<RuleVersionRow[]> =>
    prisma.ruleVersion.findMany({ where: { companyId, group, siteId }, orderBy: { version: 'desc' }, include: withConfirmations }),

  findVersion: (companyId: string, versionId: string, db: Db = prisma): Promise<RuleVersionRow | null> =>
    db.ruleVersion.findFirst({ where: { id: versionId, companyId }, include: withConfirmations }),

  createVersion: (db: Prisma.TransactionClient, data: NewRuleVersion): Promise<RuleVersionRow> =>
    db.ruleVersion.create({ data: { ...data }, include: withConfirmations }),

  createConfirmation: (db: Prisma.TransactionClient, data: NewRuleConfirmation): Promise<RuleConfirmation> => db.ruleConfirmation.create({ data }),
};
