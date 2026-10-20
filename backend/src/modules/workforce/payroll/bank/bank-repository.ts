import type { BankFileState, Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';
import { currentPayslipIds } from '../reads/reads-repository';

type Db = Prisma.TransactionClient | typeof prisma;

export interface BankPayslip {
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  siteName: string;
  net: Prisma.Decimal;
  payoutMethod: string | null;
}

export const bankRepository = {
  /** The newest bank file of the month that is still good (downloaded, not voided). */
  activeFile: (monthId: string, db: Db = prisma) => db.payrollBankFile.findFirst({ where: { monthId, state: 'DOWNLOADED' }, orderBy: { version: 'desc' } }),

  /** Every download of the month, newest first (the pay-out card shows the latest and the audit shows the rest). */
  files: (monthId: string, db: Db = prisma) => db.payrollBankFile.findMany({ where: { monthId }, orderBy: [{ version: 'desc' }, { downloadedAt: 'desc' }] }),

  /** A download that already happened under this key (a double click or a lost response). */
  byKey: (monthId: string, userId: string, key: string, db: Db = prisma) => db.payrollBankFile.findUnique({ where: { monthId_downloadedById_idempotencyKey: { monthId, downloadedById: userId, idempotencyKey: key } } }),

  /** Voids every good file of the month (a net changed or payment details changed). Returns how many were voided. */
  async voidActive(tx: Prisma.TransactionClient, monthId: string, reason: string, now: Date): Promise<number> {
    const done = await tx.payrollBankFile.updateMany({ where: { monthId, state: 'DOWNLOADED' }, data: { state: 'VOIDED' satisfies BankFileState, voidedAt: now, voidReason: reason } });
    return done.count;
  },

  /** Downloads by this person since a time: the rate limit reads it. */
  countSince: (userId: string, since: Date): Promise<number> => prisma.payrollBankFile.count({ where: { downloadedById: userId, downloadedAt: { gte: since } } }),

  async nextVersion(tx: Db, monthId: string): Promise<number> {
    const last = await tx.payrollBankFile.aggregate({ where: { monthId }, _max: { version: true } });
    return (last._max.version ?? 0) + 1;
  },

  insertFile: (tx: Prisma.TransactionClient, data: Prisma.PayrollBankFileUncheckedCreateInput) => tx.payrollBankFile.create({ data }),

  /** The current version of every payslip in the run with what the bank file needs. The bank details are read live from the pay profile. */
  async payslips(runId: string): Promise<BankPayslip[]> {
    return prisma.payrollPayslip.findMany({
      where: { id: { in: await currentPayslipIds(runId) } },
      orderBy: [{ siteName: 'asc' }, { employeeName: 'asc' }, { employeeId: 'asc' }],
      select: { employeeId: true, employeeNumber: true, employeeName: true, siteName: true, net: true, payoutMethod: true },
    });
  },

  /** Bank details by employee, read when the file is built or checked (never copied onto a payslip). */
  async details(employeeIds: readonly string[]) {
    const rows = await prisma.payProfile.findMany({ where: { employeeId: { in: [...employeeIds] } }, select: { employeeId: true, bankName: true, bankBranch: true, accountName: true, accountNumber: true } });
    return new Map(rows.map((r) => [r.employeeId, r]));
  },
};
