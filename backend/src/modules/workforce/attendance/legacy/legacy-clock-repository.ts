import type { Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';

/**
 * The only place attendance touches the legacy clock tables (`clock_records`, `shift_assignments`). It reads them, and on
 * switch-off it INSERTS a record for a shift the new clock handled (never updates or deletes a legacy row, and never
 * changes the table's shape). Every query carries the site.
 */
export type Db = Prisma.TransactionClient | typeof prisma;

/** Written on the records a switch-off mirrors, so a later switch-on can tell them from real legacy taps and never carry them back. */
export const MIRROR_NOTE = 'Carried from the new attendance when the branch switched back';

export interface LegacyRecord {
  id: string;
  userId: string;
  shiftAssignmentId: string;
  assignmentDate: Date;
  clockInAt: Date | null;
  clockOutAt: Date | null;
  /** Written by a switch-off mirror, not by a person tapping the legacy clock. */
  mirrored: boolean;
}

const SELECT = {
  id: true,
  userId: true,
  shiftAssignmentId: true,
  clockInAt: true,
  clockOutAt: true,
  overrideNote: true,
  shiftAssignment: { select: { date: true } },
} satisfies Prisma.ClockRecordSelect;

const toRecord = (row: Prisma.ClockRecordGetPayload<{ select: typeof SELECT }>): LegacyRecord => ({
  id: row.id,
  userId: row.userId,
  shiftAssignmentId: row.shiftAssignmentId,
  assignmentDate: row.shiftAssignment.date,
  clockInAt: row.clockInAt,
  clockOutAt: row.clockOutAt,
  mirrored: row.overrideNote === MIRROR_NOTE,
});

export const legacyClockRepository = {
  /** Legacy records for assignments on one day. */
  recordsOnDate: async (siteId: string, date: Date, db: Db = prisma): Promise<LegacyRecord[]> =>
    (await db.clockRecord.findMany({ where: { siteId, shiftAssignment: { date } }, select: SELECT })).map(toRecord),

  /** People clocked in on the legacy clock on one day and not yet out, with what the displays need to know about them. */
  openOn: (siteId: string, date: Date, db: Db = prisma) =>
    db.clockRecord.findMany({
      where: { siteId, clockInAt: { not: null }, clockOutAt: null, shiftAssignment: { date } },
      select: { userId: true, clockInAt: true, user: { select: { name: true, role: true, departmentTag: true } } },
      orderBy: { clockInAt: 'asc' },
    }),

  /** Which legacy record, if any, already exists for these assignments (so a mirror never doubles one). */
  assignmentsWithRecord: async (siteId: string, assignmentIds: readonly string[], db: Db = prisma): Promise<Set<string>> => {
    const rows = await db.clockRecord.findMany({ where: { siteId, shiftAssignmentId: { in: [...assignmentIds] } }, select: { shiftAssignmentId: true } });
    return new Set(rows.map((r) => r.shiftAssignmentId));
  },

  /** New rota entries that were carried from a legacy assignment, keyed by that assignment. */
  entriesByAssignment: async (siteId: string, assignmentIds: readonly string[], db: Db = prisma) =>
    db.rotaEntry.findMany({
      where: { siteId, legacyAssignmentId: { in: [...assignmentIds] } },
      select: { id: true, employeeId: true, legacyAssignmentId: true, employee: { select: { userId: true } } },
    }),

  /** The other direction: the legacy assignment behind a new rota entry, with the user it belongs to. */
  assignmentsForEntries: async (siteId: string, entryIds: readonly string[], db: Db = prisma) =>
    db.rotaEntry.findMany({
      where: { siteId, id: { in: [...entryIds] }, legacyAssignmentId: { not: null } },
      select: { id: true, legacyAssignmentId: true, employee: { select: { userId: true } } },
    }),

  /** Employees by login, for events carried in from a record whose assignment has no new rota entry. */
  employeesByUser: async (siteId: string, userIds: readonly string[], db: Db = prisma) =>
    db.employee.findMany({ where: { siteId, userId: { in: [...userIds] } }, select: { id: true, userId: true } }),

  /** Switch-off mirror: a record shaped exactly as the legacy clock would have written it. Insert only. */
  insertRecord: (
    tx: Prisma.TransactionClient,
    data: { siteId: string; shiftAssignmentId: string; userId: string; clockInAt: Date; clockOutAt: Date | null },
  ) =>
    tx.clockRecord.create({
      data: {
        siteId: data.siteId,
        shiftAssignmentId: data.shiftAssignmentId,
        userId: data.userId,
        clockInAt: data.clockInAt,
        clockOutAt: data.clockOutAt,
        clockInMethod: 'OVERRIDE',
        clockOutMethod: data.clockOutAt ? 'OVERRIDE' : null,
        overrideNote: MIRROR_NOTE,
      },
      select: { id: true },
    }),
};
