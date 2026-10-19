import type { Prisma, TimesheetPeriod, TimesheetPeriodState } from '@prisma/client';
import { prisma } from '../../../../config/database';
import { addDays, fromDateColumn, toDateColumn, type NairobiDate } from '../../_shared/time/nairobi-time';
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
  approvedAt: row.approvedAt,
  approvedById: row.approvedById,
  approverOwnHours: row.approverOwnHours,
  approveKey: row.approveKey,
  documentNumber: row.documentNumber,
  documentHash: row.documentHash,
  approvalNote: row.approvalNote,
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

  /** An approved month that covers the day (any person at the site): the answer the attendance fix door asks. */
  approvedCovering: async (siteId: string, date: NairobiDate, db: Db = prisma): Promise<PeriodRow | null> => {
    const day = toDateColumn(date);
    const row = await db.timesheetPeriod.findFirst({ where: { siteId, state: 'APPROVED', startDate: { lte: day }, endDate: { gte: day } } });
    return row ? toPeriodRow(row) : null;
  },

  /** The period whose last day falls in the month ("2026-09"); the month key is its last day's month. */
  byMonth: async (siteId: string, first: NairobiDate, last: NairobiDate, db: Db = prisma): Promise<PeriodRow | null> => {
    const row = await db.timesheetPeriod.findFirst({ where: { siteId, endDate: { gte: toDateColumn(first), lte: toDateColumn(last) } }, orderBy: { endDate: 'desc' } });
    return row ? toPeriodRow(row) : null;
  },

  /** The months of a site, newest first, with the total for the pager. */
  page: async (siteId: string, skip: number, take: number, db: Db = prisma): Promise<{ rows: PeriodRow[]; total: number }> => {
    const [rows, total] = await Promise.all([db.timesheetPeriod.findMany({ where: { siteId }, orderBy: { endDate: 'desc' }, skip, take }), db.timesheetPeriod.count({ where: { siteId } })]);
    return { rows: rows.map(toPeriodRow), total };
  },

  /** Locks the row for the rest of the transaction (decisions and the approval take turns) and returns its state. */
  lockState: async (tx: Db, id: string): Promise<TimesheetPeriodState | null> => {
    const rows = await tx.$queryRaw<{ state: TimesheetPeriodState }[]>`SELECT "state" FROM "timesheet_periods" WHERE "id" = ${id} FOR UPDATE`;
    return rows[0]?.state ?? null;
  },

  /** The next TSH-n document number (gaps are allowed). */
  nextDocumentNumber: async (tx: Db): Promise<number> => {
    const rows = await tx.$queryRaw<{ n: number }[]>`SELECT nextval('timesheet_document_seq')::int AS n`;
    return rows[0]!.n;
  },

  /** Claims the approval only while the month is still open; a second approver gets false. */
  approve: async (
    tx: Db,
    id: string,
    data: { approvedAt: Date; approvedById: string; approverOwnHours: boolean; approveKey: string; documentNumber: number; documentHash: string; snapshot: Prisma.InputJsonValue },
  ): Promise<boolean> =>
    (
      await tx.timesheetPeriod.updateMany({
        where: { id, state: 'OPEN' },
        data: { state: 'APPROVED', approvedAt: data.approvedAt, approvedById: data.approvedById, approverOwnHours: data.approverOwnHours, approveKey: data.approveKey, documentNumber: data.documentNumber, documentHash: data.documentHash, approvedSnapshot: data.snapshot },
      })
    ).count === 1,

  snapshotOf: async (id: string, db: Db = prisma): Promise<Prisma.JsonValue | null> => (await db.timesheetPeriod.findUnique({ where: { id }, select: { approvedSnapshot: true } }))?.approvedSnapshot ?? null,

  /** Months that are not approved yet, for the sweep's refresh (all sites with the new clock on). */
  openPeriods: async (db: Db = prisma): Promise<PeriodRow[]> =>
    (await db.timesheetPeriod.findMany({ where: { state: 'OPEN', site: { attendanceSwitch: { enabled: true } } }, orderBy: { startDate: 'asc' } })).map(toPeriodRow),

  /** Company sites that have a month, and whether it is approved (the Approve dialog's "payroll waits for ..." sentence). */
  otherSites: async (companyId: string, excludeSiteId: string, end: NairobiDate, db: Db = prisma): Promise<{ name: string; approved: boolean }[]> => {
    const sites = await db.site.findMany({ where: { companyId, id: { not: excludeSiteId }, attendanceSwitch: { enabled: true } }, select: { id: true, name: true }, orderBy: { name: 'asc' } });
    const day = toDateColumn(end);
    const periods = await db.timesheetPeriod.findMany({ where: { siteId: { in: sites.map((s) => s.id) }, startDate: { lte: day }, endDate: { gte: day } }, select: { siteId: true, state: true } });
    return sites.map((s) => ({ name: s.name, approved: periods.some((p) => p.siteId === s.id && p.state === 'APPROVED') }));
  },

  /**
   * The period for a window, created on first use. A window never overlaps an earlier period: when a closed period (for
   * example an old four-week one) already covers its first days, the new period starts the day after that one.
   */
  ensure: async (siteId: string, window: PeriodWindow, db: Db = prisma): Promise<PeriodRow> => {
    const earlier = await db.timesheetPeriod.findFirst({
      where: { siteId, startDate: { lt: toDateColumn(window.start) }, endDate: { gte: toDateColumn(window.start) } },
      orderBy: { endDate: 'desc' },
    });
    const earlierEnd = earlier ? fromDateColumn(earlier.endDate) : null;
    const start: NairobiDate = earlierEnd !== null && earlierEnd < window.end ? addDays(earlierEnd, 1) : window.start;
    const row = await db.timesheetPeriod.upsert({
      where: { siteId_startDate: { siteId, startDate: toDateColumn(start) } },
      create: { siteId, startDate: toDateColumn(start), endDate: toDateColumn(window.end), label: window.label, cutoffAt: window.cutoffAt },
      update: {},
    });
    return toPeriodRow(row);
  },

  list: async (siteId: string, take: number, db: Db = prisma): Promise<PeriodRow[]> =>
    (await db.timesheetPeriod.findMany({ where: { siteId }, orderBy: { startDate: 'desc' }, take })).map(toPeriodRow),

  /** Names and roles of the people a report names (who decided, who signed). */
  people: async (ids: readonly string[], db: Db = prisma): Promise<Map<string, { name: string; role: string }>> => {
    const rows = ids.length ? await db.user.findMany({ where: { id: { in: [...ids] } }, select: { id: true, name: true, role: true } }) : [];
    return new Map(rows.map((row) => [row.id, { name: row.name, role: row.role }] as const));
  },

  /** The site's name, for the report header. */
  siteName: async (siteId: string, db: Db = prisma): Promise<string> => (await db.site.findUnique({ where: { id: siteId }, select: { name: true } }))?.name ?? '',
};
