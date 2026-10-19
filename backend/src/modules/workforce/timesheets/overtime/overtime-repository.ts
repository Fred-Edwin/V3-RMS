import { Prisma, type OvertimeItem, type OvertimeStatus } from '@prisma/client';
import { prisma } from '../../../../config/database';
import { fromDateColumn, toDateColumn, type NairobiDate } from '../../_shared/time/nairobi-time';
import type { Db } from '../../attendance/days/days-repository';
import type { OvertimeLimits, OvertimeRow } from '../timesheets.types';

export const toOvertimeRow = (row: OvertimeItem): OvertimeRow => ({
  id: row.id,
  periodId: row.periodId,
  employeeId: row.employeeId,
  shiftDate: fromDateColumn(row.shiftDate),
  rawMinutes: row.rawMinutes,
  serviceTailMinutes: row.serviceTailMinutes,
  autoMinutes: row.autoMinutes,
  needsMinutes: row.needsMinutes,
  authorisedMinutes: row.authorisedMinutes,
  status: row.status,
  evidence: row.evidence as OvertimeRow['evidence'],
  limits: row.limits as unknown as OvertimeLimits,
  decidedById: row.decidedById,
  decidedAt: row.decidedAt,
  decisionReason: row.decisionReason,
  version: row.version,
  headNote: (row.headNote as OvertimeRow['headNote']) ?? null,
});

export interface OvertimeWrite {
  periodId: string;
  siteId: string;
  employeeId: string;
  shiftDate: NairobiDate;
  rawMinutes: number;
  serviceTailMinutes: number;
  autoMinutes: number;
  needsMinutes: number;
  authorisedMinutes: number;
  status: OvertimeStatus;
  evidence: OvertimeRow['evidence'];
  limits: OvertimeLimits;
  clearDecision: boolean;
}

/** Rows of `overtime_items`. Every query carries the site. */
export const overtimeRepository = {
  inRange: async (siteId: string, from: NairobiDate, to: NairobiDate, db: Db = prisma): Promise<OvertimeRow[]> =>
    (await db.overtimeItem.findMany({ where: { siteId, shiftDate: { gte: toDateColumn(from), lte: toDateColumn(to) } } })).map(toOvertimeRow),

  /** By id wherever it is, with its site; the caller checks the viewer's scope (404 if not). */
  byIdAnywhere: async (id: string, db: Db = prisma): Promise<(OvertimeRow & { siteId: string }) | null> => {
    const row = await db.overtimeItem.findUnique({ where: { id } });
    return row ? { ...toOvertimeRow(row), siteId: row.siteId } : null;
  },

  byPersonDate: async (siteId: string, employeeId: string, date: NairobiDate, db: Db = prisma): Promise<OvertimeRow | null> => {
    const row = await db.overtimeItem.findFirst({ where: { siteId, employeeId, shiftDate: toDateColumn(date) } });
    return row ? toOvertimeRow(row) : null;
  },

  allInPeriod: async (periodId: string, siteId: string, db: Db = prisma): Promise<OvertimeRow[]> =>
    (await db.overtimeItem.findMany({ where: { periodId, siteId }, orderBy: { shiftDate: 'asc' } })).map(toOvertimeRow),

  ofPerson: async (siteId: string, employeeId: string, from: NairobiDate, to: NairobiDate, db: Db = prisma): Promise<OvertimeRow[]> =>
    (await db.overtimeItem.findMany({ where: { siteId, employeeId, shiftDate: { gte: toDateColumn(from), lte: toDateColumn(to) } }, orderBy: { shiftDate: 'asc' } })).map(toOvertimeRow),

  page: async (siteId: string, periodId: string | null, statuses: readonly OvertimeStatus[], skip: number, take: number, db: Db = prisma) => {
    const where: Prisma.OvertimeItemWhereInput = { siteId, status: { in: [...statuses] }, ...(periodId ? { periodId } : {}) };
    const [rows, total] = await Promise.all([
      db.overtimeItem.findMany({
        where,
        include: { employee: { select: { id: true, name: true, userId: true, siteId: true, departmentId: true, department: { select: { name: true } } } } },
        orderBy: [{ shiftDate: 'asc' }],
        skip,
        take,
      }),
      db.overtimeItem.count({ where }),
    ]);
    return { rows: rows.map((row) => ({ item: toOvertimeRow(row), person: row.employee })), total };
  },

  upsert: async (tx: Db, write: OvertimeWrite): Promise<void> => {
    const { clearDecision, shiftDate, limits, evidence, ...rest } = write;
    const data = { ...rest, shiftDate: toDateColumn(shiftDate), limits: limits as unknown as Prisma.InputJsonValue, evidence: evidence as unknown as Prisma.InputJsonValue };
    const decision = clearDecision ? { decidedById: null, decidedAt: null, decisionReason: null } : {};
    await tx.overtimeItem.upsert({ where: { employeeId_shiftDate: { employeeId: write.employeeId, shiftDate: data.shiftDate } }, create: data, update: { ...data, ...decision, version: { increment: 1 } } });
  },

  /** Takes an item away when the day no longer holds overtime (a fix shortened it) and nobody had decided it. */
  removeUndecided: (tx: Db, siteId: string, employeeId: string, date: NairobiDate) =>
    tx.overtimeItem.deleteMany({ where: { siteId, employeeId, shiftDate: toDateColumn(date), status: { in: ['PENDING', 'AUTO_AUTHORISED'] } } }),

  /** Writes the answer only if the item is still at the version the screen showed (a second manager, a double tap or a refresh moved it otherwise). */
  decide: async (tx: Db, id: string, version: number, data: { status: OvertimeStatus; authorisedMinutes: number; decidedById: string; decidedAt: Date; decisionReason: string | null }): Promise<boolean> =>
    (await tx.overtimeItem.updateMany({ where: { id, version }, data: { ...data, version: { increment: 1 } } })).count === 1,

  /** A department head's note: once, only while the item is pending. */
  setNote: async (tx: Db, id: string, note: { byId: string; text: string; at: string }): Promise<boolean> =>
    (await tx.overtimeItem.updateMany({ where: { id, status: 'PENDING', headNote: { equals: Prisma.DbNull } }, data: { headNote: note as unknown as Prisma.InputJsonValue, version: { increment: 1 } } })).count === 1,

  /** Minutes already authorised or waiting in a period, for the branch budget. */
  usedInPeriod: async (periodId: string, siteId: string, db: Db = prisma): Promise<number> => {
    const rows = await db.overtimeItem.aggregate({ where: { periodId, siteId, status: { not: 'DECLINED' } }, _sum: { autoMinutes: true, needsMinutes: true } });
    return (rows._sum.autoMinutes ?? 0) + (rows._sum.needsMinutes ?? 0);
  },

  summaryByPeriod: async (periodId: string, siteId: string, db: Db = prisma) => {
    const rows = await db.overtimeItem.groupBy({ by: ['status'], where: { periodId, siteId }, _sum: { authorisedMinutes: true, needsMinutes: true }, _count: true });
    return rows.map((row) => ({ status: row.status, count: row._count, authorisedMinutes: row._sum.authorisedMinutes ?? 0, needsMinutes: row._sum.needsMinutes ?? 0 }));
  },
};
