import type { Prisma } from '@prisma/client';
import { PAY_CHANGE_MONTH_DAYS } from '../people.constants';

/** The two "Pay change" lists on Employees, each the same people the Home card counts (home-kpis). */

const DAY_MS = 86_400_000;

/** The first of `today`'s month and the last day that still counts as "this month" for a pay change. */
export const payChangeMonthRange = (today: Date): { from: Date; to: Date } => {
  const from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  return { from, to: new Date(from.getTime() + PAY_CHANGE_MONTH_DAYS * DAY_MS) };
};

/** Waiting for a decision (the HR and Director card), or starting this month, waiting or approved (the Accountant card). */
export const payChangeWhere = (kind: 'waiting' | 'month', today: Date): Prisma.EmployeeWhereInput => {
  if (kind === 'waiting') return { payChanges: { some: { status: 'PENDING' } } };
  const { from, to } = payChangeMonthRange(today);
  return { payChanges: { some: { status: { in: ['PENDING', 'APPROVED'] }, effectiveFrom: { gte: from, lte: to } } } };
};
