import type { Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';

/** All Prisma access for changing rota cells. Entries are real rows: a cleared cell deletes them, the audit entry keeps the history. */
export type Db = Prisma.TransactionClient | typeof prisma;

export interface CellPerson {
  id: string;
  name: string;
  userId: string | null;
  siteId: string;
  departmentId: string | null;
  tracksTime: boolean;
  department: { name: string } | null;
}

export interface ExistingEntry {
  id: string;
  employeeId: string;
  date: Date;
  templateId: string;
}

export const cellsRepository = {
  /** The people a change names, only if they belong to the company (through their site). */
  people: (companyId: string, ids: readonly string[]): Promise<CellPerson[]> =>
    prisma.employee.findMany({
      where: { id: { in: [...ids] }, site: { companyId } },
      select: { id: true, name: true, userId: true, siteId: true, departmentId: true, tracksTime: true, department: { select: { name: true } } },
    }),

  /** People of this site who are on loan elsewhere for part of a range ("Sent to Nyeri Highway that day"). */
  loansOut: (siteId: string, employeeIds: readonly string[], from: Date, to: Date) =>
    prisma.employeeMove.findMany({
      where: {
        kind: 'LOAN',
        status: { in: ['SCHEDULED', 'ACTIVE'] },
        fromSiteId: siteId,
        employeeId: { in: [...employeeIds] },
        startsOn: { lte: to },
        OR: [{ endsOn: null }, { endsOn: { gte: from } }],
      },
      select: { employeeId: true, startsOn: true, endsOn: true, toSiteId: true },
    }),

  siteNames: async (ids: readonly string[]): Promise<Map<string, string>> =>
    new Map((await prisma.site.findMany({ where: { id: { in: [...ids] } }, select: { id: true, name: true } })).map((s) => [s.id, s.name] as const)),

  /** Employment window of people, so a copy skips someone who has not started or has left by the target day. */
  employment: (ids: readonly string[]) => prisma.employee.findMany({ where: { id: { in: [...ids] } }, select: { id: true, startDate: true, exitedOn: true, status: true } }),

  entriesFor: (db: Db, employeeIds: readonly string[], from: Date, to: Date): Promise<ExistingEntry[]> =>
    db.rotaEntry.findMany({ where: { employeeId: { in: [...employeeIds] }, date: { gte: from, lte: to } }, select: { id: true, employeeId: true, date: true, templateId: true } }),

  /** The container row for a site, department and week; created on first use. */
  ensureWeek: async (db: Db, siteId: string, departmentId: string | null, weekStart: Date): Promise<string> => {
    const found = await db.rotaWeek.findFirst({ where: { siteId, departmentId, weekStart }, select: { id: true } });
    if (found) return found.id;
    try {
      return (await db.rotaWeek.create({ data: { siteId, departmentId, weekStart }, select: { id: true } })).id;
    } catch (error) {
      // Two edits created the week at once: the unique index refused the second, so read the first.
      const again = await db.rotaWeek.findFirst({ where: { siteId, departmentId, weekStart }, select: { id: true } });
      if (again) return again.id;
      throw error;
    }
  },

  touchWeeks: (db: Db, ids: readonly string[], at: Date): Promise<unknown> =>
    db.rotaWeek.updateMany({ where: { id: { in: [...ids] }, touchedAt: null }, data: { touchedAt: at } }),

  deleteEntries: (db: Db, ids: readonly string[]): Promise<unknown> => db.rotaEntry.deleteMany({ where: { id: { in: [...ids] } } }),

  addEntries: (db: Db, rows: readonly { weekId: string; siteId: string; employeeId: string; date: Date; templateId: string; overrideReason: string | null; setById: string }[]): Promise<unknown> =>
    db.rotaEntry.createMany({ data: [...rows], skipDuplicates: true }),
};
