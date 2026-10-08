import type { Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';
import type { WasteReason } from '../_shared/waste-contract';
import { wasteLogInclude, type WasteLogRow } from '../_shared/waste-row';

export type EntryPeriod = 'today' | '7d' | 'reversed';

/** What narrows every read: the Central Store's site, optionally one person's entries, optionally a search. */
export type EntryScope = { siteId: string; loggedById?: string; search?: string };

/** The instants a period is cut at (the Nairobi day started, and the day six days before it). */
export type EntryWindow = { todayStart: Date; last7Start: Date };

const scopeWhere = (scope: EntryScope): Prisma.WasteLogWhereInput => ({
  siteId: scope.siteId,
  ...(scope.loggedById ? { loggedById: scope.loggedById } : {}),
  ...(scope.search
    ? {
        OR: [
          { inventoryItem: { name: { contains: scope.search, mode: 'insensitive' } } },
          { loggedBy: { name: { contains: scope.search, mode: 'insensitive' } } },
        ],
      }
    : {}),
});

const periodWhere = (period: EntryPeriod, window: EntryWindow): Prisma.WasteLogWhereInput => {
  if (period === 'today') return { createdAt: { gte: window.todayStart } };
  if (period === '7d') return { createdAt: { gte: window.last7Start } };
  return { reversedAt: { gte: window.last7Start } };
};

/**
 * What narrows the list page only (not the chips or the KPIs): a date range on when the entry was logged (`loggedFrom` included,
 * `loggedBefore` excluded; either alone is fine and the pair replaces the period), a reason, and logged or reversed.
 */
export type EntryNarrow = { loggedFrom?: Date; loggedBefore?: Date; reason?: WasteReason; status?: 'logged' | 'reversed' };

const narrowWhere = (narrow: EntryNarrow): Prisma.WasteLogWhereInput => ({
  ...(narrow.loggedFrom || narrow.loggedBefore ? { createdAt: { ...(narrow.loggedFrom ? { gte: narrow.loggedFrom } : {}), ...(narrow.loggedBefore ? { lt: narrow.loggedBefore } : {}) } } : {}),
  ...(narrow.reason ? { reason: narrow.reason } : {}),
  ...(narrow.status === 'logged' ? { reversedAt: null } : narrow.status === 'reversed' ? { reversedAt: { not: null } } : {}),
});

export const entriesRepository = {
  /** One page of entries for a period (or for the date range in `narrow`), newest first (a reversed period is ordered by when it was reversed). */
  findPage: async (scope: EntryScope, period: EntryPeriod, window: EntryWindow, page: number, pageSize: number, narrow: EntryNarrow = {}): Promise<{ rows: WasteLogRow[]; total: number }> => {
    const ranged = narrow.loggedFrom !== undefined || narrow.loggedBefore !== undefined;
    const where: Prisma.WasteLogWhereInput = { AND: [scopeWhere(scope), ranged ? {} : periodWhere(period, window), narrowWhere(narrow)] };
    const [rows, total] = await Promise.all([
      prisma.wasteLog.findMany({
        where,
        include: wasteLogInclude,
        orderBy: period === 'reversed' && !ranged ? [{ reversedAt: 'desc' }, { id: 'desc' }] : [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.wasteLog.count({ where }),
    ]);
    return { rows, total };
  },

  /** Everyone who has logged waste at this site, for the "Logged by" filter. */
  loggers: async (siteId: string): Promise<{ id: string; name: string }[]> => {
    const rows = await prisma.wasteLog.findMany({ where: { siteId }, distinct: ['loggedById'], select: { loggedBy: { select: { id: true, name: true } } } });
    return rows.map((r) => r.loggedBy).sort((a, b) => a.name.localeCompare(b.name));
  },

  /** The three chip counts, over the same scope and search as the rows. */
  chipCounts: async (scope: EntryScope, window: EntryWindow): Promise<{ today: number; last7: number; reversed: number }> => {
    const [today, last7, reversed] = await Promise.all(
      (['today', '7d', 'reversed'] as const).map((period) => prisma.wasteLog.count({ where: { AND: [scopeWhere(scope), periodWhere(period, window)] } })),
    );
    return { today: today!, last7: last7!, reversed: reversed! };
  },

  /** Every entry logged in the last 7 days (any status), for the KPI strip. */
  findLast7: async (scope: EntryScope, window: EntryWindow): Promise<WasteLogRow[]> => {
    return prisma.wasteLog.findMany({
      where: { AND: [scopeWhere(scope), periodWhere('7d', window)] },
      include: wasteLogInclude,
      orderBy: { createdAt: 'desc' },
    });
  },

  /** Every entry reversed in the last 7 days, whenever it was logged. */
  findReversedLast7: async (scope: EntryScope, window: EntryWindow): Promise<WasteLogRow[]> => {
    return prisma.wasteLog.findMany({
      where: { AND: [scopeWhere(scope), periodWhere('reversed', window)] },
      include: wasteLogInclude,
      orderBy: { reversedAt: 'desc' },
    });
  },

  /** The caller's most recent entry of today and how many entries sit in its batch: "2 items logged at 14:20". */
  latestBatchToday: async (siteId: string, userId: string, todayStart: Date): Promise<{ at: Date; count: number } | null> => {
    const latest = await prisma.wasteLog.findFirst({
      where: { siteId, loggedById: userId, createdAt: { gte: todayStart } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { createdAt: true, batchId: true },
    });
    if (!latest) return null;
    const count = latest.batchId ? await prisma.wasteLog.count({ where: { siteId, batchId: latest.batchId } }) : 1;
    return { at: latest.createdAt, count };
  },
};
