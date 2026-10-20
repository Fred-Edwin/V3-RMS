import { UserRole, type Prisma } from '@prisma/client';
import { prisma } from '../../../config/database';

/**
 * Reads that every source shares and the card's own state. Each source keeps its own reads next to it (sources/*-reads.ts);
 * what is here is not about any one feature. Every query is scoped by site or company.
 */
export const needsYouQueries = {
  /** Sites whose new clock is on. A site with no switch row is a legacy site (SD1). */
  async enabledSiteIds(companyId: string): Promise<string[]> {
    const rows = await prisma.attendanceSiteSwitch.findMany({ where: { enabled: true, site: { companyId } }, select: { siteId: true } });
    return rows.map((r) => r.siteId);
  },

  async siteNames(siteIds: readonly string[]): Promise<Map<string, string>> {
    if (siteIds.length === 0) return new Map();
    const rows = await prisma.site.findMany({ where: { id: { in: [...siteIds] } }, select: { id: true, name: true } });
    return new Map(rows.map((r) => [r.id, r.name]));
  },

  /** People at a site holding one of these roles, for a reminder. */
  async usersAt(siteId: string, roles: readonly UserRole[]): Promise<string[]> {
    const rows = await prisma.user.findMany({ where: { siteId, role: { in: [...roles] }, isActive: true, deletedAt: null }, select: { id: true } });
    return rows.map((r) => r.id);
  },

  allRoles: (): UserRole[] => Object.values(UserRole),

  /** Active people with one of these roles: everywhere (`siteId` null) or at one site. */
  async usersByRoles(roles: readonly UserRole[], siteId: string | null): Promise<string[]> {
    if (roles.length === 0) return [];
    const rows = await prisma.user.findMany({ where: { role: { in: [...roles] }, isActive: true, deletedAt: null, ...(siteId ? { siteId } : {}) }, select: { id: true } });
    return rows.map((r) => r.id);
  },

  /** The company a person belongs to, for the counts call (cheap, indexed by id). */
  companyOfUser: async (userId: string): Promise<string | null> => (await prisma.user.findUnique({ where: { id: userId }, select: { site: { select: { companyId: true } } } }))?.site?.companyId ?? null,
  onlyCompanyId: async (): Promise<string | null> => {
    const companies = await prisma.company.findMany({ where: { isActive: true }, select: { id: true }, take: 2 });
    return companies.length === 1 ? (companies[0]?.id ?? null) : null;
  },

  lastSeenHome: async (userId: string): Promise<Date | null> => (await prisma.workforceNeedsYouState.findUnique({ where: { userId } }))?.lastSeenHomeAt ?? null,
  markSeen: (userId: string, at: Date) => prisma.workforceNeedsYouState.upsert({ where: { userId }, create: { userId, lastSeenHomeAt: at }, update: { lastSeenHomeAt: at } }),

  reminderOn: async (itemIds: readonly string[], day: string): Promise<Set<string>> => {
    if (itemIds.length === 0) return new Set();
    const rows = await prisma.workforceNeedsYouReminder.findMany({ where: { itemId: { in: [...itemIds] }, day }, select: { itemId: true } });
    return new Set(rows.map((r) => r.itemId));
  },
  /** False when a reminder for this item and day already exists (the unique key decides when two Directors press at once). */
  async insertReminder(tx: Prisma.TransactionClient, data: { itemId: string; day: string; sentById: string; sentToUserId: string | null }): Promise<boolean> {
    const done = await tx.workforceNeedsYouReminder.createMany({ data: [data], skipDuplicates: true });
    return done.count === 1;
  },
};
