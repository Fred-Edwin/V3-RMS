import type { ClockEventSource, ClockEventType, Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';
import { toDateColumn, type NairobiDate } from '../../_shared/time/nairobi-time';
import type { AnswerRow, EventRow } from '../attendance.types';
import { toEventRow } from '../days/days-repository';

/** Every write to `clock_events` and `shift_end_answers`. Events are only ever inserted: a fix or an undo is a new row. */
export type Db = Prisma.TransactionClient | typeof prisma;

export interface NewEvent {
  siteId: string;
  employeeId: string;
  rotaEntryId: string | null;
  shiftDate: NairobiDate;
  type: ClockEventType;
  source: ClockEventSource;
  occurredAt: Date;
  /** The server's moment for this write (the database default when omitted). The undo window is measured from here. */
  serverAt?: Date;
  deviceAt?: Date | null;
  skewMinutes?: number | null;
  skewFlagged?: boolean;
  clientEventId?: string | null;
  correctsEventId?: string | null;
  voidsCorrected?: boolean;
  latitude?: number | null;
  longitude?: number | null;
  distanceMetres?: number | null;
  reasonCode?: string | null;
  reason?: string | null;
  recordedById?: string | null;
}

const SELECT = {
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

export const clockRepository = {
  /** Serialises everything one person's taps do, so two phones or a double tap cannot both pass the same check. Held to the end of the transaction. */
  lockEmployee: async (tx: Prisma.TransactionClient, employeeId: string): Promise<void> => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`clock:${employeeId}`}))`;
  },

  insert: async (tx: Prisma.TransactionClient, data: NewEvent): Promise<EventRow> =>
    toEventRow(
      await tx.clockEvent.create({
        data: {
          ...data,
          shiftDate: toDateColumn(data.shiftDate),
          deviceAt: data.deviceAt ?? null,
          clientEventId: data.clientEventId ?? null,
        },
        select: SELECT,
      }),
    ),

  /** Events carried from the legacy clock; the unique (legacy record, type) key makes a second run add nothing. Returns how many were new. */
  insertCarried: async (tx: Prisma.TransactionClient, rows: readonly (NewEvent & { legacyClockRecordId: string })[]): Promise<number> => {
    const result = await tx.clockEvent.createMany({
      data: rows.map((row) => ({ ...row, shiftDate: toDateColumn(row.shiftDate) })),
      skipDuplicates: true,
    });
    return result.count;
  },

  /** A retry of the same tap finds the event it already made. */
  findByClientId: async (employeeId: string, clientEventId: string, db: Db = prisma): Promise<EventRow | null> => {
    const row = await db.clockEvent.findUnique({ where: { employeeId_clientEventId: { employeeId, clientEventId } }, select: SELECT });
    return row ? toEventRow(row) : null;
  },

  findById: async (siteId: string, id: string, db: Db = prisma): Promise<EventRow | null> => {
    const row = await db.clockEvent.findFirst({ where: { id, siteId }, select: SELECT });
    return row ? toEventRow(row) : null;
  },

  /** The entry a person may clock against, when they name one: it must be theirs and at their site. */
  entryOwnedBy: (siteId: string, employeeId: string, entryId: string, db: Db = prisma) =>
    db.rotaEntry.findFirst({ where: { id: entryId, siteId, employeeId }, select: { id: true, date: true } }),

  insertAnswer: async (
    tx: Prisma.TransactionClient,
    data: { siteId: string; employeeId: string; rotaEntryId: string; answer: 'STAY_ON' | 'FINISH_NOW'; reasonCode: string | null; estimateMinutes: number | null },
  ): Promise<AnswerRow> => {
    const row = await tx.shiftEndAnswer.create({ data });
    return { rotaEntryId: row.rotaEntryId, answer: row.answer, reasonCode: row.reasonCode, estimateMinutes: row.estimateMinutes, answeredAt: row.answeredAt };
  },

  findAnswer: async (siteId: string, rotaEntryId: string, db: Db = prisma): Promise<AnswerRow | null> => {
    const row = await db.shiftEndAnswer.findFirst({ where: { siteId, rotaEntryId } });
    return row ? { rotaEntryId: row.rotaEntryId, answer: row.answer, reasonCode: row.reasonCode, estimateMinutes: row.estimateMinutes, answeredAt: row.answeredAt } : null;
  },
};
