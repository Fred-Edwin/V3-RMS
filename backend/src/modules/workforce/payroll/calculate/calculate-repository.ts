import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import type { PayLine, Payslip } from '../engine/engine.types';

export interface PayslipWrite {
  slip: Payslip;
  siteId: string;
  employeeName: string;
  employeeNumber: string;
  department: string | null;
  siteName: string;
  payoutMethod: string | null;
  input: Prisma.InputJsonValue;
}

export interface ReviewWrite {
  employeeId: string;
  siteId: string;
  employeeName: string;
  siteName: string;
  kind: string;
  severity: 'BLOCK' | 'TICK';
  text: string;
  checkedById: string | null; // set for a line that is born ticked (a person left out, or a tick carried over from the run before)
  checkedAt?: Date | null;
}

export interface RunWrite {
  monthId: string;
  runNumber: number;
  trigger: 'SYSTEM' | 'HR';
  byId: string | null;
  inputsHash: string;
  headcount: number;
  blocking: number;
  totals: Prisma.InputJsonValue;
  payslips: PayslipWrite[];
  reviews: ReviewWrite[];
  now: Date;
}

const CHUNK = 500;
const chunks = <T>(rows: readonly T[]): T[][] => Array.from({ length: Math.ceil(rows.length / CHUNK) }, (_, i) => rows.slice(i * CHUNK, (i + 1) * CHUNK));

export const lineRow = (payslipId: string, line: PayLine, position: number): Prisma.PayrollPayslipLineCreateManyInput => ({
  payslipId,
  position,
  code: line.code,
  label: line.label,
  kind: line.kind,
  amount: line.amount,
  taxable: line.taxable,
  base: line.base,
  baseAmount: line.baseAmount,
  rate: line.rate,
  bandsUsed: line.bandsUsed ?? undefined,
  quantity: line.quantity,
  unit: line.unit,
  source: line.source as Prisma.InputJsonValue,
  workingText: line.workingText,
  tableCode: line.tableCode,
  share: line.share,
});

export const calculateRepository = {
  /** Inserts a successful run with everything it made. Rows are insert-only; the caller holds the month lock. */
  async insertRun(tx: Prisma.TransactionClient, write: RunWrite): Promise<string> {
    const run = await tx.payrollRun.create({
      data: { monthId: write.monthId, runNumber: write.runNumber, trigger: write.trigger, status: 'SUCCEEDED', byId: write.byId, inputsHash: write.inputsHash, headcount: write.headcount, blocking: write.blocking, totals: write.totals },
      select: { id: true },
    });
    const slipRows = write.payslips.map((p) => ({ id: randomUUID(), p }));
    for (const batch of chunks(slipRows)) {
      await tx.payrollPayslip.createMany({
        data: batch.map(({ id, p }) => ({
          id,
          monthId: write.monthId,
          runId: run.id,
          employeeId: p.slip.employeeId,
          siteId: p.siteId,
          employeeName: p.employeeName,
          employeeNumber: p.employeeNumber,
          department: p.department,
          siteName: p.siteName,
          basic: p.slip.basic,
          gross: p.slip.gross,
          statutoryEmployee: p.slip.statutoryEmployee,
          incomeTax: p.slip.incomeTax,
          otherDeductions: p.slip.otherDeductions,
          net: p.slip.net,
          employerShare: p.slip.employerShare,
          taxablePay: p.slip.taxablePay,
          overtimePay: p.slip.overtimePay,
          latenessDeduction: p.slip.latenessDeduction,
          unpaidAbsence: p.slip.unpaidAbsence,
          input: p.input,
          payoutMethod: p.payoutMethod,
        })),
      });
    }
    for (const batch of chunks(slipRows.flatMap(({ id, p }) => p.slip.lines.map((line, position) => lineRow(id, line, position))))) await tx.payrollPayslipLine.createMany({ data: batch });
    for (const batch of chunks(write.reviews)) {
      await tx.payrollReviewLine.createMany({
        data: batch.map((r) => ({
          monthId: write.monthId,
          runId: run.id,
          employeeId: r.employeeId,
          siteId: r.siteId,
          employeeName: r.employeeName,
          siteName: r.siteName,
          kind: r.kind,
          severity: r.severity,
          text: r.text,
          ...(r.checkedById ? { state: 'CHECKED' as const, checkedById: r.checkedById, checkedAt: r.checkedAt ?? write.now } : {}),
        })),
      });
    }
    return run.id;
  },

  /** A run whose whole-month checks disagreed: kept (insert-only) so the developer can see it, never current. */
  async insertFailedRun(tx: Prisma.TransactionClient, data: { monthId: string; runNumber: number; trigger: 'SYSTEM' | 'HR'; byId: string | null; inputsHash: string; headcount: number; reason: string }): Promise<void> {
    const { reason, ...run } = data;
    await tx.payrollRun.create({ data: { ...run, failureReason: reason, status: 'FAILED', totals: {} } });
  },

  async nextRunNumber(tx: Prisma.TransactionClient, monthId: string): Promise<number> {
    const last = await tx.payrollRun.aggregate({ where: { monthId }, _max: { runNumber: true } });
    return (last._max.runNumber ?? 0) + 1;
  },

  addMonthSites: (tx: Prisma.TransactionClient, rows: Prisma.PayrollMonthSiteCreateManyInput[]) => tx.payrollMonthSite.createMany({ data: rows }),

  updateMonth: (tx: Prisma.TransactionClient, monthId: string, data: Prisma.PayrollMonthUncheckedUpdateInput) => tx.payrollMonth.update({ where: { id: monthId }, data: { ...data, stateVersion: { increment: 1 } } }),
};
