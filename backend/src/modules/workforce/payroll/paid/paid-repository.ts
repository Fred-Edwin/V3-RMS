import type { Prisma } from '@prisma/client';

export const paidRepository = {
  /** One update sets the state, who and when, and `lockedAt`, which the database's lock guard and the PAID check both read. */
  markPaid: (tx: Prisma.TransactionClient, monthId: string, paidById: string, now: Date) =>
    tx.payrollMonth.update({ where: { id: monthId }, data: { state: 'PAID', paidAt: now, paidById, lockedAt: now, stateVersion: { increment: 1 } }, select: { stateVersion: true } }),
};
