import type { Prisma, PayrollMonth, PayrollMonthState } from '@prisma/client';
import { prisma } from '../../../../config/database';

export type Db = Prisma.TransactionClient | typeof prisma;
export type MonthRow = PayrollMonth;

/** Every query names the company, so a read can never cross it. */
export const monthsRepository = {
  find: (companyId: string, monthKey: string, db: Db = prisma): Promise<MonthRow | null> => db.payrollMonth.findUnique({ where: { companyId_monthKey: { companyId, monthKey } } }),

  /** The month row, created WAITING when it does not exist (a concurrent create answers with the same row). */
  ensure: (companyId: string, monthKey: string, db: Db = prisma): Promise<MonthRow> =>
    db.payrollMonth.upsert({ where: { companyId_monthKey: { companyId, monthKey } }, create: { companyId, monthKey }, update: {} }),

  list: async (companyId: string, skip: number, take: number): Promise<{ rows: MonthRow[]; total: number }> => {
    const [rows, total] = await Promise.all([prisma.payrollMonth.findMany({ where: { companyId }, orderBy: { monthKey: 'desc' }, skip, take }), prisma.payrollMonth.count({ where: { companyId } })]);
    return { rows, total };
  },

  allKeys: async (companyId: string): Promise<{ monthKey: string; state: PayrollMonthState }[]> => prisma.payrollMonth.findMany({ where: { companyId }, select: { monthKey: true, state: true }, orderBy: { monthKey: 'desc' } }),

  /** Locks the month row for the rest of the transaction and returns what it held at that moment. */
  async lock(tx: Prisma.TransactionClient, monthId: string): Promise<{ state: PayrollMonthState; stateVersion: number } | null> {
    const rows = await tx.$queryRaw<{ state: PayrollMonthState; state_version: number }[]>`SELECT "state", "state_version" FROM "payroll_months" WHERE "id" = ${monthId} FOR UPDATE`;
    const row = rows[0];
    return row ? { state: row.state, stateVersion: row.state_version } : null;
  },

  sites: (monthId: string) => prisma.payrollMonthSite.findMany({ where: { monthId }, orderBy: { siteId: 'asc' } }),

  run: (runId: string) => prisma.payrollRun.findUnique({ where: { id: runId } }),

  lastReminders: async (companyId: string, monthKey: string): Promise<Map<string, Date>> => {
    const rows = await prisma.payrollReminder.groupBy({ by: ['siteId'], where: { companyId, monthKey }, _max: { remindedAt: true } });
    return new Map(rows.flatMap((row) => (row._max.remindedAt ? [[row.siteId, row._max.remindedAt] as const] : [])));
  },

  /** A write that already happened under this key (the same key answers the first result). */
  findKey: (companyId: string, key: string, db: Db = prisma) => db.payrollRequestKey.findUnique({ where: { companyId_key: { companyId, key } } }),

  saveKey: (tx: Prisma.TransactionClient, data: { companyId: string; key: string; action: string; monthKey: string; response: Prisma.InputJsonValue }) => tx.payrollRequestKey.create({ data }),

  userNames: async (ids: readonly string[]): Promise<Map<string, { name: string; role: string }>> => {
    const rows = await prisma.user.findMany({ where: { id: { in: [...ids] } }, select: { id: true, name: true, role: true } });
    return new Map(rows.map((row) => [row.id, { name: row.name, role: row.role }]));
  },
};
