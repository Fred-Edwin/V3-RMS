import { Prisma, type CasualSheetStatus } from '@prisma/client';
import { prisma } from '../../../../config/database';
import { fromDateColumn, toDateColumn, type NairobiDate } from '../../_shared/time/nairobi-time';

export type Tx = Prisma.TransactionClient;
type Db = Tx | typeof prisma;

/** A second writer got there first (the live-sheet index or a request key): the caller answers "changed underneath" or repeats the first result. */
export const isUniqueViolation = (error: unknown): boolean => error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

export interface NewLine {
  workerId: string;
  startMinute: number;
  endMinute: number;
  minutes: number;
  amount: string;
}

/** Everything that writes a draft sheet, a casual worker or a request key. Reads of sheets live in `sheet/`. */
export const recordingRepository = {
  // ---- the sheet row, locked for the length of a transaction ----------------------------------------------------------------
  async lockLive(tx: Tx, companyId: string, siteId: string, departmentId: string, workDate: NairobiDate): Promise<string | null> {
    const rows = await tx.$queryRaw<{ id: string }[]>(
      Prisma.sql`SELECT id FROM casual_sheets WHERE company_id = ${companyId} AND organization_id = ${siteId} AND department_id = ${departmentId} AND work_date = ${toDateColumn(workDate)} AND status <> 'VOID' FOR UPDATE`,
    );
    return rows[0]?.id ?? null;
  },
  async lockById(tx: Tx, companyId: string, id: string): Promise<{ id: string; status: CasualSheetStatus; version: number } | null> {
    const rows = await tx.$queryRaw<{ id: string; status: CasualSheetStatus; version: number }[]>(
      Prisma.sql`SELECT id, status, version FROM casual_sheets WHERE id = ${id} AND company_id = ${companyId} FOR UPDATE`,
    );
    return rows[0] ?? null;
  },
  /** One writer at a time per worker while a sheet is saved, so two heads on two sites cannot both record the same hours. Sorted, so two callers never wait on each other. */
  async lockWorkers(tx: Tx, workerIds: readonly string[]): Promise<void> {
    for (const id of [...workerIds].sort()) await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`casual-worker:${id}`}))`);
  },
  createSheet: (tx: Tx, data: Prisma.CasualSheetUncheckedCreateInput) => tx.casualSheet.create({ data, select: { id: true, version: true } }),
  async updateSheet(tx: Tx, id: string, data: Prisma.CasualSheetUncheckedUpdateInput): Promise<{ version: number }> {
    return tx.casualSheet.update({ where: { id }, data: { ...data, version: { increment: 1 } }, select: { version: true } });
  },
  async replaceLines(tx: Tx, sheetId: string, lines: readonly NewLine[]): Promise<void> {
    await tx.casualSheetLine.deleteMany({ where: { sheetId } });
    if (lines.length > 0) {
      await tx.casualSheetLine.createMany({ data: lines.map((l) => ({ sheetId, workerId: l.workerId, startMinute: l.startMinute, endMinute: l.endMinute, minutes: l.minutes, amount: l.amount })) });
    }
  },
  async reprice(tx: Tx, sheetId: string, amounts: ReadonlyMap<string, string>): Promise<void> {
    for (const [lineId, amount] of amounts) await tx.casualSheetLine.update({ where: { id: lineId }, data: { amount } });
  },

  // ---- corrections ------------------------------------------------------------------------------------------------------------
  addCorrection: (tx: Tx, data: Prisma.CasualCorrectionUncheckedCreateInput) => tx.casualCorrection.create({ data }),
  findCorrection: (sheetId: string, id: string, db: Db = prisma) => db.casualCorrection.findFirst({ where: { id, sheetId } }),
  deleteCorrection: (tx: Tx, id: string) => tx.casualCorrection.delete({ where: { id } }),

  /** A signed (received) line of the same department and site on an earlier date: what a correction line can point at. */
  signedLine: (companyId: string, siteId: string, departmentId: string, workerId: string, originalDate: NairobiDate) =>
    prisma.casualSheetLine.findFirst({
      where: { workerId, receivedAt: { not: null }, sheet: { companyId, siteId, departmentId, workDate: toDateColumn(originalDate), status: 'APPROVED' } },
      select: { id: true },
    }),

  // ---- workers ------------------------------------------------------------------------------------------------------------------
  workersByIds: (companyId: string, ids: readonly string[]) => prisma.casualWorker.findMany({ where: { companyId, id: { in: [...ids] } } }),
  workerByNationalId: (companyId: string, nationalId: string) => prisma.casualWorker.findUnique({ where: { companyId_nationalId: { companyId, nationalId } } }),
  createWorker: (tx: Tx, data: { companyId: string; nationalId: string; fullName: string; phone: string | null; createdById: string }) => tx.casualWorker.create({ data }),

  /** The department's casuals (anyone who has a non-void line on one of its sheets), with the last day worked, filtered by a name or ID fragment. */
  async departmentWorkers(companyId: string, siteId: string, departmentId: string, q: string | null) {
    const rows = await prisma.casualSheetLine.groupBy({
      by: ['workerId'],
      where: { sheet: { companyId, siteId, departmentId, status: { not: 'VOID' } } },
      _max: { createdAt: true },
    });
    const ids = rows.map((r) => r.workerId);
    const workers = await prisma.casualWorker.findMany({ where: { companyId, id: { in: ids }, ...(q ? { OR: [{ fullName: { contains: q, mode: 'insensitive' } }, { nationalId: { contains: q.toUpperCase() } }] } : {}) }, orderBy: { fullName: 'asc' }, take: 100 });
    const last = await prisma.casualSheetLine.findMany({
      where: { workerId: { in: workers.map((w) => w.id) }, sheet: { companyId, siteId, departmentId, status: { not: 'VOID' } } },
      select: { workerId: true, sheet: { select: { workDate: true } } },
      orderBy: { sheet: { workDate: 'desc' } },
    });
    const lastDay = new Map<string, NairobiDate>();
    for (const l of last) if (!lastDay.has(l.workerId)) lastDay.set(l.workerId, fromDateColumn(l.sheet.workDate));
    return workers.map((w) => ({ worker: w, lastWorked: lastDay.get(w.id) ?? null }));
  },

  /** Other live shifts of these workers on the days a shift can reach (for the overlap check), on any site. */
  otherShifts: (companyId: string, workerIds: readonly string[], dates: readonly NairobiDate[], exceptSheetId: string | null) =>
    prisma.casualSheetLine.findMany({
      where: { workerId: { in: [...workerIds] }, sheet: { companyId, status: { not: 'VOID' }, workDate: { in: dates.map(toDateColumn) }, ...(exceptSheetId ? { id: { not: exceptSheetId } } : {}) } },
      select: { workerId: true, startMinute: true, endMinute: true, sheet: { select: { workDate: true, siteId: true } } },
    }),

  // ---- request keys (an offline retry makes one record) -------------------------------------------------------------------------
  findKey: (companyId: string, key: string, db: Db = prisma) => db.casualRequestKey.findUnique({ where: { companyId_key: { companyId, key } } }),
  saveKey: (tx: Tx, data: { companyId: string; key: string; action: string; response: Prisma.InputJsonValue }) => tx.casualRequestKey.create({ data }),
};
