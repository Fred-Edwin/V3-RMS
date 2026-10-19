import type { Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';
import { toDateColumn } from '../../_shared/time/nairobi-time';
import type { MonthWindow } from '../months/month-calendar';

export const sitesRepository = {
  activeSites: (companyId: string): Promise<{ id: string; name: string }[]> =>
    prisma.site.findMany({ where: { companyId, isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),

  /** People with a spell inside the month, by site (the site they belong to now). */
  async headcounts(companyId: string, window: MonthWindow): Promise<Map<string, number>> {
    const rows = await prisma.employee.groupBy({
      by: ['siteId'],
      where: { companyId, status: { not: 'ONBOARDING' }, spells: { some: { startsOn: { lte: toDateColumn(window.last) }, OR: [{ endedOn: null }, { endedOn: { gte: toDateColumn(window.first) } }] } } },
      _count: { _all: true },
    });
    return new Map(rows.map((row) => [row.siteId, row._count._all]));
  },

  addReminder: (tx: Prisma.TransactionClient, data: { companyId: string; monthKey: string; siteId: string; remindedById: string; remindedAt: Date }) => tx.payrollReminder.create({ data }),

  /** The newest reminder for a site and month, read inside the transaction so two clicks cannot both pass. */
  lastReminder: (tx: Prisma.TransactionClient, companyId: string, monthKey: string, siteId: string) =>
    tx.payrollReminder.findFirst({ where: { companyId, monthKey, siteId }, orderBy: { remindedAt: 'desc' }, select: { remindedAt: true } }),

  /** The managers to tell: the site's own Branch or Store Manager. */
  siteManagers: async (siteId: string): Promise<string[]> => {
    const rows = await prisma.user.findMany({ where: { siteId, isActive: true, deletedAt: null, role: { in: ['MANAGER', 'STORE_MANAGER'] } }, select: { id: true } });
    return rows.map((row) => row.id);
  },

  /** Who to tell about the month: every active user of these roles. */
  usersWithRoles: async (roles: readonly ('HR_MANAGER' | 'ACCOUNTANT' | 'DIRECTOR')[]): Promise<string[]> => {
    const rows = await prisma.user.findMany({ where: { role: { in: [...roles] }, isActive: true, deletedAt: null }, select: { id: true } });
    return rows.map((row) => row.id);
  },
};
