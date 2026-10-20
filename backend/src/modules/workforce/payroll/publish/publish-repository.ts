import type { Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';
import { currentPayslipIds } from '../reads/reads-repository';

export const publishRepository = {
  /** The payslips that go out: the current version of everyone in the run, in a fixed order so the numbers follow it. */
  async toPublish(runId: string) {
    return prisma.payrollPayslip.findMany({ where: { id: { in: await currentPayslipIds(runId) } }, orderBy: [{ siteName: 'asc' }, { employeeName: 'asc' }, { employeeId: 'asc' }], select: { employeeId: true, net: true } });
  },

  /** Issues PS-nnnn: each row takes the next value of the database sequence (gaps allowed). The unique (month, person) makes a repeat impossible. */
  async issueNumbers(tx: Prisma.TransactionClient, monthId: string, employeeIds: readonly string[], publishedAt: Date): Promise<number> {
    const made = await tx.payrollPublication.createMany({ data: employeeIds.map((employeeId) => ({ monthId, employeeId, publishedAt })) });
    return made.count;
  },

  /** The login behind each employee, to tell them. People without a login (casual, some staff) are simply not told by phone. */
  async userIdsOf(employeeIds: readonly string[]): Promise<string[]> {
    const rows = await prisma.employee.findMany({ where: { id: { in: [...employeeIds] }, userId: { not: null } }, select: { userId: true } });
    return rows.flatMap((row) => (row.userId ? [row.userId] : []));
  },

  updateMonth: (tx: Prisma.TransactionClient, monthId: string, data: Prisma.PayrollMonthUncheckedUpdateInput) => tx.payrollMonth.update({ where: { id: monthId }, data: { ...data, stateVersion: { increment: 1 } }, select: { stateVersion: true } }),
};
