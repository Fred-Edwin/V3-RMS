import { Prisma, type CorporateAccount, type CorporateAccountSettlement } from '@prisma/client';
import { prisma } from '../config/database';

const createdBySelect = { id: true, name: true } as const;

const toNextDate = (date: Date): Date => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + 1);
  return next;
};

const buildDateRangeWhere = (dateRange?: {
  startDate?: Date;
  endDate?: Date;
}): Prisma.DateTimeFilter | undefined => {
  if (!dateRange?.startDate && !dateRange?.endDate) return undefined;
  const filter: Prisma.DateTimeFilter = {};
  if (dateRange.startDate) filter.gte = dateRange.startDate;
  if (dateRange.endDate) filter.lt = toNextDate(dateRange.endDate);
  return filter;
};

export type CorporateAccountWithCreator = CorporateAccount & {
  createdBy: { id: string; name: string };
};

export type CorporateAccountDropdownItem = {
  id: string;
  companyName: string;
  currentBalance: Prisma.Decimal;
  creditLimit: Prisma.Decimal | null;
};

export const corporateAccountRepository = {
  findAll: async (): Promise<CorporateAccountWithCreator[]> => {
    return prisma.corporateAccount.findMany({
      include: { createdBy: { select: createdBySelect } },
      orderBy: { createdAt: 'desc' },
    });
  },

  findById: async (id: string): Promise<CorporateAccountWithCreator | null> => {
    return prisma.corporateAccount.findFirst({
      where: { id },
      include: { createdBy: { select: createdBySelect } },
    });
  },

  findAllActive: async (): Promise<CorporateAccountDropdownItem[]> => {
    return prisma.corporateAccount.findMany({
      where: { isActive: true },
      select: {
        id: true,
        companyName: true,
        currentBalance: true,
        creditLimit: true,
      },
      orderBy: { companyName: 'asc' },
    });
  },

  create: async (
    data: {
      companyName: string;
      contactName: string;
      contactPhone: string;
      contactEmail?: string;
      creditLimit?: string | null;
      billingCycleDay: number;
    },
    createdById: string,
  ): Promise<CorporateAccountWithCreator> => {
    return prisma.corporateAccount.create({
      data: {
        companyName: data.companyName,
        contactName: data.contactName,
        contactPhone: data.contactPhone,
        contactEmail: data.contactEmail,
        creditLimit: data.creditLimit != null ? new Prisma.Decimal(data.creditLimit) : null,
        billingCycleDay: data.billingCycleDay,
        createdById,
      },
      include: { createdBy: { select: createdBySelect } },
    });
  },

  update: async (
    id: string,
    data: {
      companyName?: string;
      contactName?: string;
      contactPhone?: string;
      contactEmail?: string | null;
      creditLimit?: string | null;
      billingCycleDay?: number;
      isActive?: boolean;
    },
  ): Promise<CorporateAccountWithCreator | null> => {
    const updated = await prisma.corporateAccount.updateMany({
      where: { id },
      data: {
        ...(data.companyName !== undefined ? { companyName: data.companyName } : {}),
        ...(data.contactName !== undefined ? { contactName: data.contactName } : {}),
        ...(data.contactPhone !== undefined ? { contactPhone: data.contactPhone } : {}),
        ...(data.contactEmail !== undefined ? { contactEmail: data.contactEmail } : {}),
        ...(data.creditLimit !== undefined
          ? { creditLimit: data.creditLimit != null ? new Prisma.Decimal(data.creditLimit) : null }
          : {}),
        ...(data.billingCycleDay !== undefined ? { billingCycleDay: data.billingCycleDay } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });

    if (updated.count === 0) return null;

    return prisma.corporateAccount.findFirst({
      where: { id },
      include: { createdBy: { select: createdBySelect } },
    });
  },

  incrementBalance: async (
    id: string,
    amount: Prisma.Decimal,
    tx: Prisma.TransactionClient,
  ): Promise<void> => {
    await tx.corporateAccount.update({
      where: { id },
      data: { currentBalance: { increment: amount } },
    });
  },

  findOrdersByAccountId: async (
    id: string,
    page: number,
    perPage: number,
    dateRange?: { startDate?: Date; endDate?: Date },
  ) => {
    const createdAt = buildDateRangeWhere(dateRange);
    const where: Prisma.OrderWhereInput = { corporateAccountId: id, ...(createdAt && { createdAt }) };
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        select: {
          id: true,
          dailyNumber: true,
          total: true,
          createdAt: true,
          organizationId: true,
          corporateEmployeeRef: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      prisma.order.count({ where }),
    ]);
    return { orders, total };
  },

  findSettlementsByAccountId: async (
    id: string,
    page: number,
    perPage: number,
    dateRange?: { startDate?: Date; endDate?: Date },
  ): Promise<{ settlements: (CorporateAccountSettlement & { settledBy: { id: string; name: string } })[]; total: number }> => {
    const createdAt = buildDateRangeWhere(dateRange);
    const where: Prisma.CorporateAccountSettlementWhereInput = {
      corporateAccountId: id,
      ...(createdAt && { createdAt }),
    };
    const [settlements, total] = await Promise.all([
      prisma.corporateAccountSettlement.findMany({
        where,
        include: { settledBy: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      prisma.corporateAccountSettlement.count({ where }),
    ]);
    return { settlements, total };
  },

  /** Sum of charges minus settlements strictly before `beforeDate` — the balance carried into a statement period. */
  getBalanceBefore: async (id: string, beforeDate: Date): Promise<Prisma.Decimal> => {
    const [chargesBefore, settlementsBefore] = await Promise.all([
      prisma.order.aggregate({
        where: { corporateAccountId: id, createdAt: { lt: beforeDate } },
        _sum: { total: true },
      }),
      prisma.corporateAccountSettlement.aggregate({
        where: { corporateAccountId: id, createdAt: { lt: beforeDate } },
        _sum: { amount: true },
      }),
    ]);
    const charged = chargesBefore._sum.total ?? new Prisma.Decimal(0);
    const settled = settlementsBefore._sum.amount ?? new Prisma.Decimal(0);
    return charged.minus(settled);
  },

  createSettlement: async (data: {
    corporateAccountId: string;
    amount: string;
    paymentMethod: 'MPESA' | 'CASH' | 'CARD';
    note: string | undefined;
    settledById: string;
  }): Promise<CorporateAccountSettlement> => {
    return prisma.corporateAccountSettlement.create({
      data: {
        corporateAccountId: data.corporateAccountId,
        amount: new Prisma.Decimal(data.amount),
        paymentMethod: data.paymentMethod,
        note: data.note,
        settledById: data.settledById,
      },
    });
  },
};
