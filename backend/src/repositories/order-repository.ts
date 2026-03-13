import { OrderStatus, type PaymentMethod, Prisma, type PrepStation, PrepTicketStatus } from '@prisma/client';
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
  cancelledBy: {
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
  cancelledBy: {
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
  /** Filter to orders that have at least one prep ticket claimed by this user */
  prepTicketClaimedById?: string;
  page: number;
  perPage: number;
}

const counterWhere = (organizationId: string, orderDate: Date) => ({
  organizationId_orderDate: {
    organizationId,
    orderDate,
  },
});

const isUniqueConstraintError = (error: unknown): error is Prisma.PrismaClientKnownRequestError => {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
};

const getMaxDailyNumber = async (
  tx: Prisma.TransactionClient,
  organizationId: string,
  orderDate: Date,
): Promise<number> => {
  const aggregate = await tx.order.aggregate({
    where: {
      organizationId,
      orderDate,
    },
    _max: {
      dailyNumber: true,
    },
  });

  return aggregate._max.dailyNumber ?? 0;
};

const ensureOrderCounterInitialized = async (
  tx: Prisma.TransactionClient,
  organizationId: string,
  orderDate: Date,
): Promise<void> => {
  // Always sync counter to MAX(actual orders) to handle seed data or any
  // out-of-band inserts that bypassed the counter. GREATEST ensures we never
  // move the counter backwards.
  const maxDailyNumber = await getMaxDailyNumber(tx, organizationId, orderDate);

  await tx.$executeRaw`
    INSERT INTO order_counters (id, organization_id, order_date, last_number, created_at, updated_at)
    VALUES (gen_random_uuid(), ${organizationId}, ${orderDate}::date, ${maxDailyNumber}, NOW(), NOW())
    ON CONFLICT (organization_id, order_date)
    DO UPDATE SET
      last_number = GREATEST(order_counters.last_number, ${maxDailyNumber}),
      updated_at  = NOW()
  `;
};

const allocateNextDailyNumber = async (
  tx: Prisma.TransactionClient,
  organizationId: string,
  orderDate: Date,
): Promise<number> => {
  await ensureOrderCounterInitialized(tx, organizationId, orderDate);

  const counter = await tx.orderCounter.update({
    where: counterWhere(organizationId, orderDate),
    data: {
      lastNumber: {
        increment: 1,
      },
    },
    select: {
      lastNumber: true,
    },
  });

  return counter.lastNumber;
};

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
    ...(filters.prepTicketClaimedById
      ? { prepTickets: { some: { claimedById: filters.prepTicketClaimedById } } }
      : {}),
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
      let order: { id: string } | null = null;

      for (let attempt = 0; attempt < 3; attempt += 1) {
        const dailyNumber = await allocateNextDailyNumber(tx, data.organizationId, data.orderDate);

        await tx.$executeRawUnsafe('SAVEPOINT create_order');
        try {
          order = await tx.order.create({
            data: {
              organizationId: data.organizationId,
              dailyNumber,
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
            select: {
              id: true,
            },
          });
          await tx.$executeRawUnsafe('RELEASE SAVEPOINT create_order');
          break;
        } catch (error) {
          await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT create_order');
          if (isUniqueConstraintError(error) && attempt < 2) {
            continue;
          }
          throw error;
        }
      }

      if (!order) {
        throw new Error('Failed to allocate a unique daily order number');
      }

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

  findActive: async (organizationId: string, orderDate: Date, createdById?: string): Promise<FullOrderPrismaRecord[]> => {
    return prisma.order.findMany({
      where: {
        organizationId,
        orderDate,
        status: {
          notIn: [OrderStatus.CLOSED, OrderStatus.CANCELLED],
        },
        ...(createdById ? { createdById } : {}),
      },
      include: orderInclude,
      orderBy: {
        createdAt: 'asc',
      },
      take: 200,
    });
  },

  findActiveSummary: async (organizationId: string, orderDate: Date, createdById?: string): Promise<SummaryOrderPrismaRecord[]> => {
    return prisma.order.findMany({
      where: {
        organizationId,
        orderDate,
        status: {
          notIn: [OrderStatus.CLOSED, OrderStatus.CANCELLED],
        },
        ...(createdById ? { createdById } : {}),
      },
      include: orderSummaryInclude,
      orderBy: {
        createdAt: 'asc',
      },
      take: 200,
    });
  },
  updateItems: async (
    orderId: string,
    organizationId: string,
    newItems: CreateOrderItemWithPriceDto[],
    newTotals: { subtotal: Prisma.Decimal; total: Prisma.Decimal },
    ticketPlan: {
      updates: Array<{
        ticketId: string;
        station: PrepStation;
        status: PrepTicketStatus;
        items: PrepTicketItemSnapshot[];
        rejectedReason?: string;
        clearRejection?: boolean;
      }>;
      creates: Array<{ station: PrepStation; items: PrepTicketItemSnapshot[] }>;
      actorId: string;
      reopenOrder: boolean;
    },
  ): Promise<FullOrderPrismaRecord | null> => {
    return prisma.$transaction(async (tx) => {
      const existingOrder = await tx.order.findFirst({
        where: {
          id: orderId,
          organizationId,
        },
        include: {
          prepTickets: { select: { id: true, station: true, status: true, sequence: true } },
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
          ...(ticketPlan.reopenOrder ? { status: OrderStatus.IN_PROGRESS } : {}),
        },
      });
      for (const update of ticketPlan.updates) {
        const existingTicket = await tx.prepTicket.findFirst({
          where: {
            id: update.ticketId,
            organizationId,
            status: { in: [PrepTicketStatus.PENDING, PrepTicketStatus.REJECTED] },
          },
          select: {
            id: true,
            status: true,
          },
        });

        if (!existingTicket) {
          return null;
        }

        const data: Prisma.PrepTicketUncheckedUpdateInput = {
          items: update.items as unknown as Prisma.InputJsonValue,
        };

        if (update.clearRejection) {
          data.status = PrepTicketStatus.PENDING;
          data.rejectedById = null;
          data.rejectedReason = null;
          data.rejectedAt = null;
        }

        if (update.status === PrepTicketStatus.REJECTED) {
          data.status = PrepTicketStatus.REJECTED;
          data.claimedById = null;
          data.claimedAt = null;
          data.readyAt = null;
          data.rejectedById = ticketPlan.actorId;
          data.rejectedReason = update.rejectedReason ?? 'Removed from order';
          data.rejectedAt = new Date();
        }

        await tx.prepTicket.update({
          where: {
            id: update.ticketId,
          },
          data,
        });
      }

      for (const create of ticketPlan.creates) {
        const maxSeq = await tx.prepTicket.aggregate({
          where: {
            orderId,
            organizationId,
            station: create.station,
          },
          _max: {
            sequence: true,
          },
        });

        const sequence = (maxSeq._max.sequence ?? 0) + 1;

        await tx.prepTicket.create({
          data: {
            organizationId,
            orderId,
            station: create.station,
            sequence,
            status: PrepTicketStatus.PENDING,
            items: create.items as unknown as Prisma.InputJsonValue,
          },
        });
      }

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
    payment: {
      paymentMethod: PaymentMethod;
      mpesaCode: string | null;
      mpesaAmount: number | null;
      cashAmount: number | null;
    },
  ): Promise<FullOrderPrismaRecord | null> => {
    const paidAt = new Date();

    const updated = await prisma.order.updateMany({
      where: {
        id: orderId,
        organizationId,
        status: OrderStatus.READY,
      },
      data: {
        status: OrderStatus.CLOSED,
        paymentMethod: payment.paymentMethod,
        mpesaCode: payment.mpesaCode,
        mpesaAmount: payment.mpesaAmount ?? undefined,
        cashAmount: payment.cashAmount ?? undefined,
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

  cancel: async (
    orderId: string,
    organizationId: string,
    allowedStatuses: OrderStatus[],
    cancelReason: string,
    cancelledById: string,
  ): Promise<FullOrderPrismaRecord | null> => {
    const updated = await prisma.order.updateMany({
      where: {
        id: orderId,
        organizationId,
        status: { in: allowedStatuses },
      },
      data: {
        status: OrderStatus.CANCELLED,
        cancelReason,
        cancelledById,
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



