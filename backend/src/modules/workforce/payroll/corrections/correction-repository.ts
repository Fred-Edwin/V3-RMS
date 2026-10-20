import type { Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';
import type { Payslip } from '../engine/engine.types';
import { lineRow } from '../calculate/calculate-repository';

export interface NewVersion {
  monthId: string;
  runId: string;
  previous: { employeeId: string; siteId: string; employeeName: string; employeeNumber: string; department: string | null; siteName: string; payoutMethod: string | null; version: number };
  slip: Payslip;
  input: Prisma.InputJsonValue;
  diff: Prisma.InputJsonValue;
  reason: string;
  correctedById: string;
  now: Date;
}

export const correctionRepository = {
  /** One payslip row of the month with its lines (any version). */
  payslip: (monthId: string, id: string) => prisma.payrollPayslip.findFirst({ where: { id, monthId }, include: { lines: { orderBy: { position: 'asc' } } } }),

  /** The highest version of the person's payslip in the run. Pass the transaction when adding the next one, so the read is part of it. */
  async latestVersion(runId: string, employeeId: string, db: Prisma.TransactionClient | typeof prisma = prisma): Promise<number> {
    const top = await db.payrollPayslip.aggregate({ where: { runId, employeeId }, _max: { version: true } });
    return top._max.version ?? 0;
  },

  /** The login behind an employee, to refuse a correction of one's own payslip and to tell the person. */
  employeeUser: (employeeId: string) => prisma.employee.findUnique({ where: { id: employeeId }, select: { userId: true } }),

  /** Adds version n+1 with its lines. Rows are never updated; version n stays as it was. */
  async insertVersion(tx: Prisma.TransactionClient, v: NewVersion): Promise<string> {
    const { slip, previous } = v;
    const created = await tx.payrollPayslip.create({
      data: {
        monthId: v.monthId,
        runId: v.runId,
        employeeId: previous.employeeId,
        siteId: previous.siteId,
        version: previous.version + 1,
        employeeName: previous.employeeName,
        employeeNumber: previous.employeeNumber,
        department: previous.department,
        siteName: previous.siteName,
        payoutMethod: previous.payoutMethod,
        basic: slip.basic,
        gross: slip.gross,
        statutoryEmployee: slip.statutoryEmployee,
        incomeTax: slip.incomeTax,
        otherDeductions: slip.otherDeductions,
        net: slip.net,
        employerShare: slip.employerShare,
        taxablePay: slip.taxablePay,
        overtimePay: slip.overtimePay,
        latenessDeduction: slip.latenessDeduction,
        unpaidAbsence: slip.unpaidAbsence,
        input: v.input,
        replacesVersion: previous.version,
        diff: v.diff,
        reason: v.reason,
        correctedById: v.correctedById,
        correctedAt: v.now,
      },
      select: { id: true },
    });
    await tx.payrollPayslipLine.createMany({ data: slip.lines.map((line, position) => lineRow(created.id, line, position)) });
    return created.id;
  },

  /** The newest snapshot, read inside the transaction that adds the next revision. */
  latestSnapshot: (tx: Prisma.TransactionClient, monthId: string) => tx.payrollSnapshot.findFirst({ where: { monthId }, orderBy: { revision: 'desc' } }),

  insertRevision: (tx: Prisma.TransactionClient, data: { monthId: string; revision: number; hash: string; data: Prisma.InputJsonValue }) => tx.payrollSnapshot.create({ data }),

  bumpMonth: (tx: Prisma.TransactionClient, monthId: string) => tx.payrollMonth.update({ where: { id: monthId }, data: { stateVersion: { increment: 1 } }, select: { stateVersion: true } }),
};
