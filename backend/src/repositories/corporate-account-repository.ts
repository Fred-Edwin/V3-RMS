import { Prisma, type CorporateAccount, type CorporateAccountSettlement } from '@prisma/client';
import { prisma } from '../config/database';

const createdBySelect = { id: true, name: true } as const;

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
  ) => {
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: { corporateAccountId: id },
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
      prisma.order.count({ where: { corporateAccountId: id } }),
    ]);
    return { orders, total };
  },

  createSettlement: async (data: {
    corporateAccountId: string;
    amount: string;
    note: string | undefined;
    settledById: string;
  }): Promise<CorporateAccountSettlement> => {
    return prisma.corporateAccountSettlement.create({
      data: {
        corporateAccountId: data.corporateAccountId,
        amount: new Prisma.Decimal(data.amount),
        note: data.note,
        settledById: data.settledById,
      },
    });
  },
};
