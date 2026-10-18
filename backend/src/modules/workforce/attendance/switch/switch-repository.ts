import type { Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';

/** The per-site switch. No row means off. */
export type Db = Prisma.TransactionClient | typeof prisma;

export interface SwitchRow {
  siteId: string;
  enabled: boolean;
  enabledAt: Date | null;
  changedAt: Date;
  changedById: string | null;
}

export const switchRepository = {
  get: (siteId: string, db: Db = prisma): Promise<SwitchRow | null> =>
    db.attendanceSiteSwitch.findUnique({ where: { siteId } }),

  isEnabled: async (siteId: string, db: Db = prisma): Promise<boolean> =>
    (await db.attendanceSiteSwitch.findUnique({ where: { siteId }, select: { enabled: true } }))?.enabled === true,

  /** Every active site (or just the ones named) with its switch row, for the lists that show the whole company at once. */
  sitesWithSwitch: async (siteIds: readonly string[] | null, db: Db = prisma) => {
    const sites = await db.site.findMany({
      where: { isActive: true, ...(siteIds ? { id: { in: [...siteIds] } } : {}) },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    const rows = await db.attendanceSiteSwitch.findMany({ where: { siteId: { in: sites.map((s) => s.id) } } });
    return sites.map((site) => ({ site, row: rows.find((r) => r.siteId === site.id) ?? null }));
  },

  /** Every site that is on, for the auto-close sweep. */
  enabledSiteIds: async (db: Db = prisma): Promise<string[]> =>
    (await db.attendanceSiteSwitch.findMany({ where: { enabled: true }, select: { siteId: true } })).map((row) => row.siteId),

  set: (tx: Prisma.TransactionClient, siteId: string, enabled: boolean, changedById: string, now: Date): Promise<SwitchRow> =>
    tx.attendanceSiteSwitch.upsert({
      where: { siteId },
      create: { siteId, enabled, enabledAt: enabled ? now : null, changedAt: now, changedById },
      update: { enabled, ...(enabled ? { enabledAt: now } : {}), changedAt: now, changedById },
    }),
};
