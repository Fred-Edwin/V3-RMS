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
  findAllByOrganization: async (
    organizationId: string,
  ): Promise<CustomerCreditAccountWithCreator[]> => {
    return prisma.customerCreditAccount.findMany({
      where: { organizationId },
      include: { createdBy: { select: createdBySelect } },
      orderBy: { createdAt: 'desc' },
    });
  },

  findById: async (
    id: string,
    organizationId: string,
  ): Promise<CustomerCreditAccountWithCreator | null> => {
    return prisma.customerCreditAccount.findFirst({
      where: { id, organizationId },
      include: { createdBy: { select: createdBySelect } },
    });
  },

  findActiveByOrganization: async (
    organizationId: string,
  ): Promise<CustomerCreditDropdownItem[]> => {
    return prisma.customerCreditAccount.findMany({
      where: { organizationId, isActive: true },
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
    organizationId: string,
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
        organizationId,
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
    organizationId: string,
    data: {
      customerName?: string;
      customerPhone?: string;
      creditLimit?: string;
      notes?: string | null;
      isActive?: boolean;
    },
  ): Promise<CustomerCreditAccountWithCreator | null> => {
    const updated = await prisma.customerCreditAccount.updateMany({
      where: { id, organizationId },
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
      where: { id, organizationId },
      include: { createdBy: { select: createdBySelect } },
    });
  },

  incrementBalance: async (
    id: string,
    organizationId: string,
    amount: Prisma.Decimal,
    tx: Prisma.TransactionClient,
  ): Promise<void> => {
    await tx.customerCreditAccount.updateMany({
      where: { id, organizationId },
      data: { currentBalance: { increment: amount } },
    });
  },

  findOrdersByAccountId: async (
    id: string,
    organizationId: string,
    page: number,
    perPage: number,
  ) => {
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: { customerCreditAccountId: id, organizationId },
        select: { id: true, dailyNumber: true, total: true, createdAt: true, organizationId: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      prisma.order.count({ where: { customerCreditAccountId: id, organizationId } }),
    ]);
    return { orders, total };
  },

  createSettlement: async (
    organizationId: string,
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
