import type { Prisma, TimesheetPeriod, TimesheetPeriodState } from '@prisma/client';
import { prisma } from '../../../../config/database';
import { fromDateColumn, toDateColumn, type NairobiDate } from '../../_shared/time/nairobi-time';
import type { Db } from '../../attendance/days/days-repository';
import type { PeriodRow } from '../timesheets.types';
import type { PeriodWindow } from './period-window';

export const toPeriodRow = (row: TimesheetPeriod): PeriodRow => ({
  id: row.id,
  siteId: row.siteId,
  start: fromDateColumn(row.startDate),
  end: fromDateColumn(row.endDate),
  label: row.label,
  cutoffAt: row.cutoffAt,
  state: row.state,
  reportNumber: row.reportNumber,
  closeKind: row.closeKind,
  closedAt: row.closedAt,
  closedById: row.closedById,
  signedById: row.signedById,
  signedAt: row.signedAt,
  reopenedAt: row.reopenedAt,
  reopenedById: row.reopenedById,
  reopenReason: row.reopenReason,
});

/** Every query carries the site, so a read can never cross a branch. */
export const periodsRepository = {
  find: async (siteId: string, id: string, db: Db = prisma): Promise<PeriodRow | null> => {
    const row = await db.timesheetPeriod.findFirst({ where: { id, siteId } });
    return row ? toPeriodRow(row) : null;
  },

  /** By id wherever it is; the caller then decides whether the viewer may see that site (404 if not). */
  findAnywhere: async (id: string, db: Db = prisma): Promise<PeriodRow | null> => {
    const row = await db.timesheetPeriod.findUnique({ where: { id } });
    return row ? toPeriodRow(row) : null;
  },

  /** The period whose window starts on that day. */
  findByStart: async (siteId: string, start: NairobiDate, db: Db = prisma): Promise<PeriodRow | null> => {
    const row = await db.timesheetPeriod.findUnique({ where: { siteId_startDate: { siteId, startDate: toDateColumn(start) } } });
    return row ? toPeriodRow(row) : null;
  },

  /** The period whose window covers the day. */
  containing: async (siteId: string, date: NairobiDate, db: Db = prisma): Promise<PeriodRow | null> => {
    const day = toDateColumn(date);
    const row = await db.timesheetPeriod.findFirst({ where: { siteId, startDate: { lte: day }, endDate: { gte: day } }, orderBy: { startDate: 'desc' } });
    return row ? toPeriodRow(row) : null;
  },

  /** A closed period that covers the day (any person at the site): the answer the attendance fix door asks. */
  closedCovering: async (siteId: string, date: NairobiDate, db: Db = prisma): Promise<PeriodRow | null> => {
    const day = toDateColumn(date);
    const row = await db.timesheetPeriod.findFirst({ where: { siteId, state: { not: 'OPEN' }, startDate: { lte: day }, endDate: { gte: day } } });
    return row ? toPeriodRow(row) : null;
  },

  ensure: async (siteId: string, window: PeriodWindow, db: Db = prisma): Promise<PeriodRow> => {
    const row = await db.timesheetPeriod.upsert({
      where: { siteId_startDate: { siteId, startDate: toDateColumn(window.start) } },
      create: { siteId, startDate: toDateColumn(window.start), endDate: toDateColumn(window.end), label: window.label, cutoffAt: window.cutoffAt },
      update: {},
    });
    return toPeriodRow(row);
  },

  list: async (siteId: string, take: number, db: Db = prisma): Promise<PeriodRow[]> =>
    (await db.timesheetPeriod.findMany({ where: { siteId }, orderBy: { startDate: 'desc' }, take })).map(toPeriodRow),

  /** Open periods whose cut-off has passed, and periods whose close was claimed but not finished (all sites with the clock on). */
  dueToClose: async (now: Date, db: Db = prisma): Promise<PeriodRow[]> =>
    (
      await db.timesheetPeriod.findMany({
        where: { OR: [{ state: 'OPEN', cutoffAt: { lte: now } }, { state: 'CLOSING' }], site: { attendanceSwitch: { enabled: true } } },
        orderBy: { cutoffAt: 'asc' },
      })
    ).map(toPeriodRow),

  /** Claims a state change only if the period is still in the expected state (a second sweep gets 0 and does nothing). */
  transition: async (id: string, from: TimesheetPeriodState, data: Prisma.TimesheetPeriodUpdateManyMutationInput, db: Db = prisma): Promise<boolean> =>
    (await db.timesheetPeriod.updateMany({ where: { id, state: from }, data })).count === 1,

  setSigned: (id: string, by: string, at: Date, db: Db = prisma) => db.timesheetPeriod.update({ where: { id }, data: { signedById: by, signedAt: at } }),

  /** Names and roles of the people a report names (who decided, who signed). */
  people: async (ids: readonly string[], db: Db = prisma): Promise<Map<string, { name: string; role: string }>> => {
    const rows = ids.length ? await db.user.findMany({ where: { id: { in: [...ids] } }, select: { id: true, name: true, role: true } }) : [];
    return new Map(rows.map((row) => [row.id, { name: row.name, role: row.role }] as const));
  },

  /** The site's name, for the report header. */
  siteName: async (siteId: string, db: Db = prisma): Promise<string> => (await db.site.findUnique({ where: { id: siteId }, select: { name: true } }))?.name ?? '',
};
