import { Prisma, type CustomerCreditAccount, type CustomerCreditSettlement } from '@prisma/client';
import { prisma } from '../config/database';

export type CustomerCreditAccountWithCreator = CustomerCreditAccount & {
  createdBy: { id: string; name: string };
};

export type CustomerCreditDropdownItem = {
  id: string;
  customerName: string;
  customerPhone: string;
  creditLimit: Prisma.Decimal;
  currentBalance: Prisma.Decimal;
};

const createdBySelect = { id: true, name: true } as const;

export const customerCreditRepository = {
  findAllBySite: async (
    siteId: string,
  ): Promise<CustomerCreditAccountWithCreator[]> => {
    return prisma.customerCreditAccount.findMany({
      where: { siteId },
      include: { createdBy: { select: createdBySelect } },
      orderBy: { createdAt: 'desc' },
    });
  },

  findById: async (
    id: string,
    siteId: string,
  ): Promise<CustomerCreditAccountWithCreator | null> => {
    return prisma.customerCreditAccount.findFirst({
      where: { id, siteId },
      include: { createdBy: { select: createdBySelect } },
    });
  },

  findActiveBySite: async (
    siteId: string,
  ): Promise<CustomerCreditDropdownItem[]> => {
    return prisma.customerCreditAccount.findMany({
      where: { siteId, isActive: true },
      select: {
        id: true,
        customerName: true,
        customerPhone: true,
        creditLimit: true,
        currentBalance: true,
      },
      orderBy: { customerName: 'asc' },
    });
  },

  create: async (
    siteId: string,
    data: {
      customerName: string;
      customerPhone: string;
      creditLimit: string;
      notes?: string;
    },
    createdById: string,
  ): Promise<CustomerCreditAccountWithCreator> => {
    return prisma.customerCreditAccount.create({
      data: {
        siteId,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        creditLimit: new Prisma.Decimal(data.creditLimit),
        notes: data.notes,
        createdById,
      },
      include: { createdBy: { select: createdBySelect } },
    });
  },

  update: async (
    id: string,
    siteId: string,
    data: {
      customerName?: string;
      customerPhone?: string;
      creditLimit?: string;
      notes?: string | null;
      isActive?: boolean;
    },
  ): Promise<CustomerCreditAccountWithCreator | null> => {
    const updated = await prisma.customerCreditAccount.updateMany({
      where: { id, siteId },
      data: {
        ...(data.customerName !== undefined ? { customerName: data.customerName } : {}),
        ...(data.customerPhone !== undefined ? { customerPhone: data.customerPhone } : {}),
        ...(data.creditLimit !== undefined
          ? { creditLimit: new Prisma.Decimal(data.creditLimit) }
          : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });

    if (updated.count === 0) return null;

    return prisma.customerCreditAccount.findFirst({
      where: { id, siteId },
      include: { createdBy: { select: createdBySelect } },
    });
  },

  incrementBalance: async (
    id: string,
    siteId: string,
    amount: Prisma.Decimal,
    tx: Prisma.TransactionClient,
  ): Promise<void> => {
    await tx.customerCreditAccount.updateMany({
      where: { id, siteId },
      data: { currentBalance: { increment: amount } },
    });
  },

  findOrdersByAccountId: async (
    id: string,
    siteId: string,
    page: number,
    perPage: number,
  ) => {
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: { customerCreditAccountId: id, siteId },
        select: { id: true, dailyNumber: true, total: true, createdAt: true, siteId: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      prisma.order.count({ where: { customerCreditAccountId: id, siteId } }),
    ]);
    return { orders, total };
  },

  createSettlement: async (
    siteId: string,
    data: {
      customerCreditAccountId: string;
      amount: string;
      note: string | undefined;
      settledById: string;
    },
  ): Promise<CustomerCreditSettlement> => {
    return prisma.customerCreditSettlement.create({
      data: {
        customerCreditAccountId: data.customerCreditAccountId,
        amount: new Prisma.Decimal(data.amount),
        note: data.note,
        settledById: data.settledById,
      },
    });
  },
};
