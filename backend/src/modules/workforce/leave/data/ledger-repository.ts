import type { LeaveEntryKind, Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';
import { fromDateColumn, toDateColumn, type NairobiDate } from '../../_shared/time/nairobi-time';

type Db = Prisma.TransactionClient | typeof prisma;

export interface LedgerRow {
  id: string;
  employeeId: string;
  typeCode: string;
  year: number;
  kind: LeaveEntryKind;
  days: number;
  asOf: NairobiDate;
  reasonCode: string | null;
  reasonNote: string | null;
  byUser: string | null;
  correctsId: string | null;
  createdAt: Date;
}

export interface NewEntry {
  companyId: string;
  employeeId: string;
  typeCode: string;
  year: number;
  kind: LeaveEntryKind;
  days: number;
  asOf: NairobiDate;
  reasonCode?: string | null;
  reasonNote?: string | null;
  byUser?: string | null;
  correctsId?: string | null;
  idempotencyKey?: string | null;
}

const toRow = (row: Prisma.LeaveBalanceEntryGetPayload<Record<string, never>>): LedgerRow => ({
  id: row.id,
  employeeId: row.employeeId,
  typeCode: row.typeCode,
  year: row.leaveYear,
  kind: row.kind,
  days: row.days,
  asOf: fromDateColumn(row.asOf),
  reasonCode: row.reasonCode,
  reasonNote: row.reasonNote,
  byUser: row.byUser,
  correctsId: row.correctsId,
  createdAt: row.createdAt,
});

const dataOf = (entry: NewEntry): Prisma.LeaveBalanceEntryUncheckedCreateInput => ({
  companyId: entry.companyId,
  employeeId: entry.employeeId,
  typeCode: entry.typeCode,
  leaveYear: entry.year,
  kind: entry.kind,
  days: entry.days,
  asOf: toDateColumn(entry.asOf),
  reasonCode: entry.reasonCode ?? null,
  reasonNote: entry.reasonNote ?? null,
  byUser: entry.byUser ?? null,
  correctsId: entry.correctsId ?? null,
  idempotencyKey: entry.idempotencyKey ?? null,
});

/** The balance ledger. Append only: the database refuses UPDATE and DELETE, so this file has neither. */
export const ledgerRepository = {
  forYear: async (db: Db, employeeIds: readonly string[], year: number): Promise<LedgerRow[]> =>
    (await db.leaveBalanceEntry.findMany({ where: { employeeId: { in: [...employeeIds] }, leaveYear: year }, orderBy: { createdAt: 'asc' } })).map(toRow),

  /** The adjustment history of one person for the drawer, newest first. */
  history: async (db: Db, employeeId: string, take: number): Promise<LedgerRow[]> =>
    (await db.leaveBalanceEntry.findMany({ where: { employeeId, kind: 'ADJUSTMENT' }, orderBy: { createdAt: 'desc' }, take })).map(toRow),

  add: async (tx: Prisma.TransactionClient, entry: NewEntry): Promise<LedgerRow> => toRow(await tx.leaveBalanceEntry.create({ data: dataOf(entry) })),

  /** OPENING and CARRY_OVER: one per person, type and year (partial unique index); a second call adds nothing. Returns how many were new. */
  addOnce: async (db: Db, entries: readonly NewEntry[]): Promise<number> => {
    if (entries.length === 0) return 0;
    return (await db.leaveBalanceEntry.createMany({ data: entries.map(dataOf), skipDuplicates: true })).count;
  },

  byKey: async (db: Db, employeeId: string, idempotencyKey: string): Promise<LedgerRow | null> => {
    const row = await db.leaveBalanceEntry.findFirst({ where: { employeeId, idempotencyKey } });
    return row ? toRow(row) : null;
  },

  /** Adjustments made in a month, for the "Adjusted" chip. */
  adjustedBetween: async (db: Db, companyId: string, from: Date, to: Date): Promise<Set<string>> =>
    new Set((await db.leaveBalanceEntry.findMany({ where: { companyId, kind: 'ADJUSTMENT', createdAt: { gte: from, lt: to } }, select: { employeeId: true }, distinct: ['employeeId'] })).map((row) => row.employeeId)),
};
