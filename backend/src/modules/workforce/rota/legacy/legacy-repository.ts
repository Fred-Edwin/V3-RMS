import type { Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';

/**
 * The carry-over's database access. It only READS the legacy `shifts` and `shift_assignments`; it never writes them.
 * Everything it creates is in the new rota tables, tagged with the legacy id so a second run adds nothing.
 */
export type Db = Prisma.TransactionClient | typeof prisma;

export const legacyRepository = {
  companies: () => prisma.company.findMany({ where: { isActive: true }, select: { id: true } }),

  legacyShifts: (companyId: string) =>
    prisma.shift.findMany({ where: { site: { companyId } }, select: { id: true, siteId: true, name: true, startTime: true, endTime: true, isActive: true }, orderBy: [{ siteId: 'asc' }, { startTime: 'asc' }] }),

  carriedShiftIds: async (db: Db, ids: readonly string[]): Promise<Map<string, string>> =>
    new Map((await db.shiftTemplate.findMany({ where: { legacyShiftId: { in: [...ids] } }, select: { id: true, legacyShiftId: true } })).map((t) => [t.legacyShiftId as string, t.id] as const)),

  createTemplate: (db: Db, data: { companyId: string; siteId: string; name: string; colour: string; startTime: string; endTime: string; isActive: boolean; legacyShiftId: string }) =>
    db.shiftTemplate.create({ data: { ...data, retiredAt: data.isActive ? null : new Date() }, select: { id: true } }),

  /** Assignments from a day onward whose person has a clocking employee file at the same site. */
  upcomingAssignments: (companyId: string, from: Date) =>
    prisma.shiftAssignment.findMany({
      where: { date: { gte: from }, site: { companyId }, user: { employee: { is: { tracksTime: true } } } },
      select: { id: true, siteId: true, date: true, shiftId: true, user: { select: { employee: { select: { id: true, siteId: true, departmentId: true } } } } },
    }),

  carriedAssignmentIds: async (db: Db, ids: readonly string[]): Promise<Set<string>> =>
    new Set((await db.rotaEntry.findMany({ where: { legacyAssignmentId: { in: [...ids] } }, select: { legacyAssignmentId: true } })).map((e) => e.legacyAssignmentId as string)),

  /** A week container for the carry-over; a week already edited in the new rota is left alone. */
  weekFor: async (db: Db, siteId: string, departmentId: string | null, weekStart: Date): Promise<{ id: string; touched: boolean }> => {
    const found = await db.rotaWeek.findFirst({ where: { siteId, departmentId, weekStart }, select: { id: true, touchedAt: true } });
    if (found) return { id: found.id, touched: found.touchedAt !== null };
    const created = await db.rotaWeek.create({ data: { siteId, departmentId, weekStart, carriedFromLegacy: true }, select: { id: true } });
    return { id: created.id, touched: false };
  },

  addEntries: (db: Db, rows: readonly { weekId: string; siteId: string; employeeId: string; date: Date; templateId: string; legacyAssignmentId: string }[]) =>
    db.rotaEntry.createMany({ data: [...rows], skipDuplicates: true }),
};
