import type { PayChangeStatus, PayoutMethod, Prisma } from '@prisma/client';
import { prisma } from '../../../config/database';
import type { Db } from './employees-repository';

/** Pay profile, pay changes and pay history. Every query names the company, directly or through the employee. */
const EMPLOYEE_BRIEF = { id: true, companyId: true, siteId: true, userId: true, name: true, departmentId: true, status: true, payType: true, department: { select: { key: true } } } as const;

export const payRepository = {
  findEmployee: (companyId: string, id: string) =>
    prisma.employee.findFirst({ where: { id, companyId }, select: { ...EMPLOYEE_BRIEF, payProfile: true } }),

  findEmployeeIn: (db: Db, companyId: string, id: string) =>
    db.employee.findFirst({ where: { id, companyId }, select: { ...EMPLOYEE_BRIEF, payProfile: true } }),

  historyOf: (employeeId: string) => prisma.payChange.findMany({ where: { employeeId }, orderBy: [{ effectiveFrom: 'desc' }, { requestedAt: 'desc' }] }),

  findChange: (companyId: string, changeId: string) =>
    prisma.payChange.findFirst({ where: { id: changeId, employee: { companyId } }, include: { employee: { select: EMPLOYEE_BRIEF } } }),

  findChangeIn: (db: Db, companyId: string, changeId: string) =>
    db.payChange.findFirst({ where: { id: changeId, employee: { companyId } }, include: { employee: { select: EMPLOYEE_BRIEF } } }),

  listChanges: (companyId: string, status: PayChangeStatus) =>
    prisma.payChange.findMany({
      where: { status, employee: { companyId } },
      include: { employee: { select: { id: true, name: true } } },
      orderBy: { requestedAt: 'asc' },
    }),

  updateProfile: (
    db: Db,
    employeeId: string,
    data: {
      payoutMethod?: PayoutMethod | null;
      bankName?: string | null;
      bankBranch?: string | null;
      accountName?: string | null;
      accountNumber?: string | null;
      mpesaPhone?: string | null;
      overtimeEligible?: boolean;
      standardWeekHours?: string | null;
      standardDayHours?: string | null;
      updatedById: string;
    },
  ) => db.payProfile.updateMany({ where: { employeeId }, data }),

  findPending: (db: Db, employeeId: string) => db.payChange.findFirst({ where: { employeeId, status: 'PENDING' }, select: { id: true } }),

  createChange: (db: Db, data: { employeeId: string; amount: string; effectiveFrom: Date; reason: string; requestedById: string }) =>
    db.payChange.create({ data: { ...data, status: 'PENDING' } }),

  /** Only a still-pending change can be decided; the count says whether this call won. */
  decide: (db: Db, id: string, data: { status: 'APPROVED' | 'DECLINED'; decidedById: string; decidedAt: Date; decisionNote: string | null; appliedAt: Date | null }) =>
    db.payChange.updateMany({ where: { id, status: 'PENDING' }, data }),

  setAmount: (db: Db, employeeId: string, amount: string, updatedById: string | null) =>
    db.payProfile.updateMany({ where: { employeeId }, data: { amount, updatedById } }),

  markApplied: (db: Db, id: string, now: Date) => db.payChange.updateMany({ where: { id, appliedAt: null }, data: { appliedAt: now } }),

  /** Scheduler: approved changes whose day has come and that are not yet in the profile. */
  dueChanges: (today: Date) =>
    prisma.payChange.findMany({
      where: { status: 'APPROVED', appliedAt: null, effectiveFrom: { lte: today } },
      include: { employee: { select: EMPLOYEE_BRIEF } },
      orderBy: [{ employeeId: 'asc' }, { effectiveFrom: 'asc' }, { requestedAt: 'asc' }],
    }),

  /** The amount in force on a date: the latest approved change that has started. */
  async amountOn(employeeId: string, date: Date): Promise<Prisma.Decimal | null> {
    const change = await prisma.payChange.findFirst({
      where: { employeeId, status: 'APPROVED', effectiveFrom: { lte: date } },
      orderBy: [{ effectiveFrom: 'desc' }, { requestedAt: 'desc' }],
      select: { amount: true },
    });
    return change?.amount ?? null;
  },

  async accountantUserIds(companyId: string): Promise<string[]> {
    const rows = await prisma.user.findMany({
      where: { role: 'ACCOUNTANT', isActive: true, deletedAt: null, OR: [{ site: { companyId } }, { siteId: null }] },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  },
  async directorUserIds(companyId: string): Promise<string[]> {
    const rows = await prisma.user.findMany({
      where: { role: 'DIRECTOR', isActive: true, deletedAt: null, OR: [{ site: { companyId } }, { siteId: null }] },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  },
};
