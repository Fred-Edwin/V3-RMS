import { OrderStatus, type PaymentMethod, Prisma, type PrepStation } from '@prisma/client';
import { prisma } from '../config/database';
import type { CreateOrderWithTicketsDto, CreateOrderItemWithPriceDto, PrepTicketItemSnapshot } from '../types/order.types';

const orderInclude = {
  items: {
    include: {
      menuItem: {
        select: {
          id: true,
          name: true,
          category: {
            select: {
              prepStation: true,
            },
          },
        },
      },
    },
  },
  prepTickets: {
    include: {
      claimedBy: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  },
  createdBy: {
    select: {
      id: true,
      name: true,
    },
  },
  deliveryZone: {
    select: {
      id: true,
      name: true,
      fee: true,
    },
  },
} as const;

const orderSummaryInclude = {
  prepTickets: {
    include: {
      claimedBy: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  },
  createdBy: {
    select: {
      id: true,
      name: true,
    },
  },
} as const;

export type FullOrderPrismaRecord = Prisma.OrderGetPayload<{
  include: typeof orderInclude;
}>;

export type SummaryOrderPrismaRecord = Prisma.OrderGetPayload<{
  include: typeof orderSummaryInclude;
}>;

interface OrderFilters {
  status?: Prisma.OrderWhereInput['status'];
  type?: Prisma.OrderWhereInput['type'];
  orderDate?: Date;
  orderDateGte?: Date;
  orderDateLte?: Date;
  createdById?: string;
  page: number;
  perPage: number;
}

const toOrderItemCreateManyData = (items: CreateOrderItemWithPriceDto[]): Prisma.OrderItemCreateManyOrderInput[] => {
  return items.map((item) => ({
    menuItemId: item.menuItemId,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    subtotal: item.subtotal,
    notes: item.notes,
  }));
};

const buildWhere = (organizationId: string, filters: OrderFilters): Prisma.OrderWhereInput => {
  return {
    organizationId,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.createdById ? { createdById: filters.createdById } : {}),
    ...(filters.orderDate ? { orderDate: filters.orderDate } : {}),
    ...(filters.orderDateGte || filters.orderDateLte
      ? {
          orderDate: {
            ...(filters.orderDateGte ? { gte: filters.orderDateGte } : {}),
            ...(filters.orderDateLte ? { lte: filters.orderDateLte } : {}),
          },
        }
      : {}),
  };
};

export const orderRepository = {
  createWithItemsAndTickets: async (data: CreateOrderWithTicketsDto): Promise<FullOrderPrismaRecord> => {
    return prisma.$transaction(async (tx) => {
      const counter = await tx.orderCounter.upsert({
        where: {
          organizationId_orderDate: {
            organizationId: data.organizationId,
            orderDate: data.orderDate,
          },
        },
        create: {
          organizationId: data.organizationId,
          orderDate: data.orderDate,
          lastNumber: 1,
        },
        update: {
          lastNumber: {
            increment: 1,
          },
        },
        select: {
          lastNumber: true,
        },
      });

      const order = await tx.order.create({
        data: {
          organizationId: data.organizationId,
          dailyNumber: counter.lastNumber,
          orderDate: data.orderDate,
          type: data.type,
          status: data.status,
          tableNumber: data.tableNumber,
          notes: data.notes,
          subtotal: data.subtotal,
          deliveryFee: data.deliveryFee,
          total: data.total,
          deliveryZoneId: data.deliveryZoneId,
          createdById: data.createdById,
          items: {
            createMany: {
              data: toOrderItemCreateManyData(data.items),
            },
          },
        },
      });

      await tx.prepTicket.createMany({
        data: data.prepTickets.map((ticket) => ({
          organizationId: ticket.organizationId,
          orderId: order.id,
          station: ticket.station,
          status: ticket.status,
          items: ticket.items as unknown as Prisma.InputJsonValue,
        })),
      });

      return tx.order.findFirstOrThrow({
        where: {
          id: order.id,
          organizationId: data.organizationId,
        },
        include: orderInclude,
      });
    });
  },

  findById: async (id: string, organizationId: string): Promise<FullOrderPrismaRecord | null> => {
    return prisma.order.findFirst({
      where: {
        id,
        organizationId,
      },
      include: orderInclude,
    });
  },

  findMany: async (
    organizationId: string,
    filters: OrderFilters,
  ): Promise<{ orders: FullOrderPrismaRecord[]; total: number }> => {
    const where = buildWhere(organizationId, filters);

    const [total, orders] = await prisma.$transaction([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        include: orderInclude,
        orderBy: {
          createdAt: 'desc',
        },
        skip: (filters.page - 1) * filters.perPage,
        take: filters.perPage,
      }),
    ]);

    return {
      total,
      orders,
    };
  },

  findManySummary: async (
    organizationId: string,
    filters: OrderFilters,
  ): Promise<{ orders: SummaryOrderPrismaRecord[]; total: number }> => {
    const where = buildWhere(organizationId, filters);

    const [total, orders] = await prisma.$transaction([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        include: orderSummaryInclude,
        orderBy: {
          createdAt: 'desc',
        },
        skip: (filters.page - 1) * filters.perPage,
        take: filters.perPage,
      }),
    ]);

    return {
      total,
      orders,
    };
  },

  findActive: async (organizationId: string): Promise<FullOrderPrismaRecord[]> => {
    return prisma.order.findMany({
      where: {
        organizationId,
        status: {
          notIn: [OrderStatus.CLOSED, OrderStatus.CANCELLED],
        },
      },
      include: orderInclude,
      orderBy: {
        createdAt: 'asc',
      },
    });
  },

  findActiveSummary: async (organizationId: string): Promise<SummaryOrderPrismaRecord[]> => {
    return prisma.order.findMany({
      where: {
        organizationId,
        status: {
          notIn: [OrderStatus.CLOSED, OrderStatus.CANCELLED],
        },
      },
      include: orderSummaryInclude,
      orderBy: {
        createdAt: 'asc',
      },
    });
  },

  updateItems: async (
    orderId: string,
    organizationId: string,
    newItems: CreateOrderItemWithPriceDto[],
    newTotals: { subtotal: Prisma.Decimal; total: Prisma.Decimal },
    ticketSnapshots: Partial<Record<PrepStation, PrepTicketItemSnapshot[]>>,
  ): Promise<FullOrderPrismaRecord | null> => {
    return prisma.$transaction(async (tx) => {
      const existingOrder = await tx.order.findFirst({
        where: {
          id: orderId,
          organizationId,
        },
      });

      if (!existingOrder) {
        return null;
      }

      await tx.orderItem.deleteMany({
        where: {
          orderId,
        },
      });

      if (newItems.length > 0) {
        await tx.orderItem.createMany({
          data: newItems.map((item) => ({
            orderId,
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            subtotal: item.subtotal,
            notes: item.notes,
          })),
        });
      }

      await tx.order.update({
        where: {
          id: orderId,
        },
        data: {
          subtotal: newTotals.subtotal,
          total: newTotals.total,
        },
      });

      const stations = Object.keys(ticketSnapshots) as PrepStation[];
      await Promise.all(
        stations.map((station) =>
          tx.prepTicket.updateMany({
            where: {
              orderId,
              organizationId,
              station,
            },
            data: {
              items: (ticketSnapshots[station] ?? []) as unknown as Prisma.InputJsonValue,
            },
          }),
        ),
      );

      return tx.order.findFirst({
        where: {
          id: orderId,
          organizationId,
        },
        include: orderInclude,
      });
    });
  },

  recordPayment: async (
    orderId: string,
    organizationId: string,
    paymentMethod: PaymentMethod,
  ): Promise<FullOrderPrismaRecord | null> => {
    const paidAt = new Date();

    const updated = await prisma.order.updateMany({
      where: {
        id: orderId,
        organizationId,
      },
      data: {
        status: OrderStatus.CLOSED,
        paymentMethod,
        paidAt,
        closedAt: paidAt,
      },
    });

    if (updated.count === 0) {
      return null;
    }

    return prisma.order.findFirst({
      where: {
        id: orderId,
        organizationId,
      },
      include: orderInclude,
    });
  },

  cancel: async (orderId: string, organizationId: string): Promise<FullOrderPrismaRecord | null> => {
    const updated = await prisma.order.updateMany({
      where: {
        id: orderId,
        organizationId,
      },
      data: {
        status: OrderStatus.CANCELLED,
      },
    });

    if (updated.count === 0) {
      return null;
    }

    return prisma.order.findFirst({
      where: {
        id: orderId,
        organizationId,
      },
      include: orderInclude,
    });
  },

  updateStatus: async (
    orderId: string,
    organizationId: string,
    status: OrderStatus,
  ): Promise<FullOrderPrismaRecord | null> => {
    const updated = await prisma.order.updateMany({
      where: {
        id: orderId,
        organizationId,
      },
      data: {
        status,
      },
    });

    if (updated.count === 0) {
      return null;
    }

    return prisma.order.findFirst({
      where: {
        id: orderId,
        organizationId,
      },
      include: orderInclude,
    });
  },
};
