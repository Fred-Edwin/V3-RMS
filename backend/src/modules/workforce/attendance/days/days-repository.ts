import type { Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';
import { fromDateColumn, toDateColumn, type NairobiDate } from '../../_shared/time/nairobi-time';
import type { AnswerRow, DayData, EntryRow, EventRow, PersonRow } from '../attendance.types';

/** Reads that every attendance screen shares. Every query carries the site, so a read can never cross a branch. */
export type Db = Prisma.TransactionClient | typeof prisma;

const PERSON_SELECT = {
  id: true,
  name: true,
  userId: true,
  siteId: true,
  departmentId: true,
  tracksTime: true,
  department: { select: { name: true } },
  position: { select: { name: true } },
} satisfies Prisma.EmployeeSelect;

const toPerson = (row: Prisma.EmployeeGetPayload<{ select: typeof PERSON_SELECT }>): PersonRow => ({
  id: row.id,
  name: row.name,
  userId: row.userId,
  siteId: row.siteId,
  departmentId: row.departmentId,
  departmentName: row.department?.name ?? null,
  positionName: row.position?.name ?? null,
  tracksTime: row.tracksTime,
});

const EVENT_ROW_SELECT = {
  id: true,
  employeeId: true,
  rotaEntryId: true,
  shiftDate: true,
  type: true,
  source: true,
  occurredAt: true,
  serverAt: true,
  createdAt: true,
  clientEventId: true,
  correctsEventId: true,
  voidsCorrected: true,
  skewFlagged: true,
  reasonCode: true,
  reason: true,
  recordedById: true,
} satisfies Prisma.ClockEventSelect;

export const toEventRow = (row: Prisma.ClockEventGetPayload<{ select: typeof EVENT_ROW_SELECT }>): EventRow => ({ ...row, shiftDate: fromDateColumn(row.shiftDate) });

export const daysRepository = {
  /** The employee file behind a login (a person who has left is not found). */
  personByUserId: async (userId: string, db: Db = prisma): Promise<PersonRow | null> => {
    const row = await db.employee.findFirst({ where: { userId, status: { not: 'EXITED' } }, select: PERSON_SELECT });
    return row ? toPerson(row) : null;
  },

  personById: async (siteId: string, employeeId: string, db: Db = prisma): Promise<PersonRow | null> => {
    const row = await db.employee.findFirst({ where: { id: employeeId, siteId }, select: PERSON_SELECT });
    return row ? toPerson(row) : null;
  },

  userNames: async (ids: readonly string[], db: Db = prisma): Promise<Map<string, string>> => {
    const rows = ids.length ? await db.user.findMany({ where: { id: { in: [...ids] } }, select: { id: true, name: true } }) : [];
    return new Map(rows.map((row) => [row.id, row.name] as const));
  },

  peopleByIds: async (siteId: string, ids: readonly string[], db: Db = prisma): Promise<PersonRow[]> =>
    (await db.employee.findMany({ where: { siteId, id: { in: [...ids] } }, select: PERSON_SELECT, orderBy: { name: 'asc' } })).map(toPerson),

  /** The employee by id wherever they work (the caller then decides whether the caller may see that site: 404 if not). */
  personAnywhere: async (employeeId: string, db: Db = prisma): Promise<PersonRow | null> => {
    const row = await db.employee.findFirst({ where: { id: employeeId }, select: PERSON_SELECT });
    return row ? toPerson(row) : null;
  },

  /** People who clock in at the site and are employed on the day, optionally only some departments. */
  peopleOnSite: async (siteId: string, date: NairobiDate, departmentIds: readonly string[] | null, db: Db = prisma): Promise<PersonRow[]> => {
    const day = toDateColumn(date);
    const rows = await db.employee.findMany({
      where: {
        siteId,
        tracksTime: true,
        status: { not: 'EXITED' },
        startDate: { lte: day },
        OR: [{ exitedOn: null }, { exitedOn: { gte: day } }],
        ...(departmentIds ? { departmentId: { in: [...departmentIds] } } : {}),
      },
      select: PERSON_SELECT,
      orderBy: { name: 'asc' },
    });
    return rows.map(toPerson);
  },

  /** Shifts, clock events and shift-end answers for a site between two Nairobi days (optionally for some people). */
  loadDayData: async (siteId: string, from: NairobiDate, to: NairobiDate, employeeIds: readonly string[] | null, db: Db = prisma): Promise<DayData> => {
    const range = { gte: toDateColumn(from), lte: toDateColumn(to) };
    const people = employeeIds ? { employeeId: { in: [...employeeIds] } } : {};
    const [entryRows, eventRows] = await Promise.all([
      db.rotaEntry.findMany({
        where: { siteId, date: range, ...people },
        select: { id: true, employeeId: true, date: true, template: { select: { name: true, colour: true, startTime: true, endTime: true, unpaidBreakMinutes: true } } },
        orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      }),
      db.clockEvent.findMany({ where: { siteId, shiftDate: range, ...people }, select: EVENT_ROW_SELECT, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }),
    ]);
    const answerRows = entryRows.length
      ? await db.shiftEndAnswer.findMany({ where: { siteId, rotaEntryId: { in: entryRows.map((e) => e.id) } } })
      : [];
    const entries: EntryRow[] = entryRows.map((e) => ({
      id: e.id,
      employeeId: e.employeeId,
      date: fromDateColumn(e.date),
      templateName: e.template.name,
      colour: e.template.colour,
      startTime: e.template.startTime,
      endTime: e.template.endTime,
      unpaidBreakMinutes: e.template.unpaidBreakMinutes,
    }));
    const answers: AnswerRow[] = answerRows.map((a) => ({
      rotaEntryId: a.rotaEntryId,
      answer: a.answer,
      reasonCode: a.reasonCode,
      estimateMinutes: a.estimateMinutes,
      answeredAt: a.answeredAt,
    }));
    return { entries, events: eventRows.map(toEventRow), answers };
  },

  /** A site's name, company and position, for the geofence and the audit entry. */
  siteFacts: (siteId: string, db: Db = prisma) =>
    db.site.findUnique({ where: { id: siteId }, select: { id: true, name: true, companyId: true, latitude: true, longitude: true } }),
};
