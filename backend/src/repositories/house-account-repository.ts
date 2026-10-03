import { Prisma, type HouseAccount, type HouseAccountSettlement } from '@prisma/client';
import { prisma } from '../config/database';

export type HouseAccountWithUser = HouseAccount & {
  user: { id: string; name: string; email: string; role: string };
  grantedBy: { id: string; name: string };
};

export interface HouseAccountDropdownItem {
  id: string;
  userName: string;
  currentBalance: string;
  creditLimit: string | null;
}

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
} as const;

const grantedBySelect = {
  id: true,
  name: true,
} as const;

const houseAccountInclude = {
  user: { select: userSelect },
  grantedBy: { select: grantedBySelect },
} as const;

export const houseAccountRepository = {
  findAllActive: async (): Promise<HouseAccountDropdownItem[]> => {
    const accounts = await prisma.houseAccount.findMany({
      where: { isActive: true },
      select: {
        id: true,
        currentBalance: true,
        creditLimit: true,
        user: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return accounts.map((a) => ({
      id: a.id,
      userName: a.user.name,
      currentBalance: a.currentBalance.toFixed(2),
      creditLimit: a.creditLimit != null ? a.creditLimit.toFixed(2) : null,
    }));
  },

  findAll: async (): Promise<HouseAccountWithUser[]> => {
    return prisma.houseAccount.findMany({
      include: houseAccountInclude,
      orderBy: { createdAt: 'desc' },
    });
  },

  findById: async (id: string): Promise<HouseAccountWithUser | null> => {
    return prisma.houseAccount.findFirst({
      where: { id },
      include: houseAccountInclude,
    });
  },

  findByUserId: async (userId: string): Promise<HouseAccountWithUser | null> => {
    return prisma.houseAccount.findFirst({
      where: { userId },
      include: houseAccountInclude,
    });
  },

  create: async (data: {
    userId: string;
    creditLimit: string | null | undefined;
    grantedById: string;
  }): Promise<HouseAccountWithUser> => {
    return prisma.houseAccount.create({
      data: {
        userId: data.userId,
        creditLimit: data.creditLimit != null ? new Prisma.Decimal(data.creditLimit) : null,
        grantedById: data.grantedById,
      },
      include: houseAccountInclude,
    });
  },

  update: async (
    id: string,
    data: { creditLimit?: string | null; isActive?: boolean },
  ): Promise<HouseAccountWithUser | null> => {
    const updated = await prisma.houseAccount.updateMany({
      where: { id },
      data: {
        ...(data.creditLimit !== undefined
          ? { creditLimit: data.creditLimit != null ? new Prisma.Decimal(data.creditLimit) : null }
          : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });

    if (updated.count === 0) return null;

    return prisma.houseAccount.findFirst({
      where: { id },
      include: houseAccountInclude,
    });
  },

  incrementBalance: async (
    id: string,
    amount: Prisma.Decimal,
    tx: Prisma.TransactionClient,
  ): Promise<void> => {
    await tx.houseAccount.update({
      where: { id },
      data: { currentBalance: { increment: amount } },
    });
  },

  decrementBalance: async (
    id: string,
    amount: Prisma.Decimal,
  ): Promise<void> => {
    await prisma.houseAccount.update({
      where: { id },
      data: { currentBalance: { decrement: amount } },
    });
  },

  findOrdersByAccountId: async (
    id: string,
    page: number,
    perPage: number,
    date?: string,
  ): Promise<{
    orders: Array<{
      id: string;
      dailyNumber: number;
      total: Prisma.Decimal;
      createdAt: Date;
      siteId: string;
      createdBy: { name: string };
      items: Array<{ id: string; quantity: number; unitPrice: Prisma.Decimal; subtotal: Prisma.Decimal; notes: string | null; menuItem: { name: string } }>;
    }>;
    total: number;
  }> => {
    const dateFilter = date
      ? { gte: new Date(`${date}T00:00:00.000Z`), lte: new Date(`${date}T23:59:59.999Z`) }
      : undefined;
    const where: Prisma.OrderWhereInput = {
      houseAccountId: id,
      ...(dateFilter ? { createdAt: dateFilter } : {}),
    };
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        select: {
          id: true,
          dailyNumber: true,
          total: true,
          createdAt: true,
          siteId: true,
          createdBy: { select: { name: true } },
          items: {
            select: {
              id: true,
              quantity: true,
              unitPrice: true,
              subtotal: true,
              notes: true,
              menuItem: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      prisma.order.count({ where }),
    ]);
    return { orders, total };
  },

  createSettlement: async (data: {
    houseAccountId: string;
    amount: string;
    note: string | undefined;
    settledById: string;
  }): Promise<HouseAccountSettlement> => {
    return prisma.houseAccountSettlement.create({
      data: {
        houseAccountId: data.houseAccountId,
        amount: new Prisma.Decimal(data.amount),
        note: data.note,
        settledById: data.settledById,
      },
    });
  },

  findSettlementsByAccountId: async (id: string): Promise<HouseAccountSettlement[]> => {
    return prisma.houseAccountSettlement.findMany({
      where: { houseAccountId: id },
      orderBy: { createdAt: 'desc' },
    });
  },
};
