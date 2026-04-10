import { OrderStatus, PaymentMethod, Prisma, type PrepStation, PrepTicketStatus } from '@prisma/client';
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
    select: {
      id: true,
      station: true,
      status: true,
      items: true,
      claimedAt: true,
      readyAt: true,
      rejectedReason: true,
      createdAt: true,
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

      // Assign per-station sequence numbers so multiple tickets for the same
      // station don't violate the @@unique([orderId, station, sequence]) constraint.
      const stationSequence = new Map<string, number>();
      await tx.prepTicket.createMany({
        data: data.prepTickets.map((ticket) => {
          const seq = (stationSequence.get(ticket.station) ?? 0) + 1;
          stationSequence.set(ticket.station, seq);
          return {
            organizationId: ticket.organizationId,
            orderId: order.id,
            station: ticket.station,
            sequence: seq,
            status: ticket.status,
            items: ticket.items as unknown as Prisma.InputJsonValue,
          };
        }),
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
  ): Promise<{ orders: FullOrderPrismaRecord[]; total: number; totalValue: number }> => {
    const where = buildWhere(organizationId, filters);
    // Revenue total always excludes CANCELLED regardless of the status filter
    const revenueWhere: Prisma.OrderWhereInput = { ...where, status: { not: OrderStatus.CANCELLED } };

    const [total, aggregate, orders] = await prisma.$transaction([
      prisma.order.count({ where }),
      prisma.order.aggregate({ where: revenueWhere, _sum: { total: true } }),
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
      totalValue: aggregate._sum.total?.toNumber() ?? 0,
      orders,
    };
  },

  findManySummary: async (
    organizationId: string,
    filters: OrderFilters,
  ): Promise<{ orders: SummaryOrderPrismaRecord[]; total: number; totalValue: number }> => {
    const where = buildWhere(organizationId, filters);
    // Revenue total always excludes CANCELLED regardless of the status filter
    const revenueWhere: Prisma.OrderWhereInput = { ...where, status: { not: OrderStatus.CANCELLED } };

    const [total, aggregate, orders] = await prisma.$transaction([
      prisma.order.count({ where }),
      prisma.order.aggregate({ where: revenueWhere, _sum: { total: true } }),
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
      totalValue: aggregate._sum.total?.toNumber() ?? 0,
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

  findStaleOrders: async (
    organizationId: string,
    beforeDate: Date,
  ): Promise<Array<{ id: string; dailyNumber: number; status: OrderStatus; orderDate: Date; _count: { items: number }; createdBy: { id: string; name: string } }>> => {
    return prisma.order.findMany({
      where: {
        organizationId,
        orderDate: { lt: beforeDate },
        status: { notIn: [OrderStatus.CLOSED, OrderStatus.CANCELLED] },
      },
      select: {
        id: true,
        dailyNumber: true,
        status: true,
        orderDate: true,
        _count: { select: { items: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { orderDate: 'asc' },
    });
  },

  findIdleReadyOrders: async (
    organizationId: string,
    idleSince: Date,
    orderDate: Date,
  ): Promise<Array<{ id: string; dailyNumber: number; createdById: string }>> => {
    return prisma.order.findMany({
      where: {
        organizationId,
        orderDate,
        status: OrderStatus.READY,
        updatedAt: { lt: idleSince },
      },
      select: {
        id: true,
        dailyNumber: true,
        createdById: true,
      },
      orderBy: { updatedAt: 'asc' },
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
      orderNotes?: string;
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
          ...(ticketPlan.orderNotes !== undefined ? { notes: ticketPlan.orderNotes || null } : {}),
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
      cardAmount: number | null;
      splitType: string | null;
      houseAccountId?: string | null;
      corporateAccountId?: string | null;
      corporateEmployeeRef?: string | null;
      customerCreditAccountId?: string | null;
    },
  ): Promise<FullOrderPrismaRecord | null> => {
    const paidAt = new Date();
    const creditMethods: PaymentMethod[] = [
      PaymentMethod.HOUSE_ACCOUNT,
      PaymentMethod.CORPORATE_ACCOUNT,
      PaymentMethod.CUSTOMER_CREDIT,
    ];
    const isCreditPayment = creditMethods.includes(payment.paymentMethod);

    if (isCreditPayment) {
      return prisma.$transaction(async (tx) => {
        const updated = await tx.order.updateMany({
          where: {
            id: orderId,
            organizationId,
            status: { in: [OrderStatus.READY, OrderStatus.AWAITING_AUTHORIZATION] },
          },
          data: {
            status: OrderStatus.CLOSED,
            paymentMethod: payment.paymentMethod,
            houseAccountId: payment.houseAccountId ?? null,
            corporateAccountId: payment.corporateAccountId ?? null,
            corporateEmployeeRef: payment.corporateEmployeeRef ?? null,
            customerCreditAccountId: payment.customerCreditAccountId ?? null,
            paidAt,
            closedAt: paidAt,
          },
        });

        if (updated.count === 0) return null;

        const orderRecord = await tx.order.findFirst({
          where: { id: orderId },
          select: { total: true },
        });
        if (!orderRecord) return null;

        // Atomic balance increment — definitive credit limit check inside transaction
        if (payment.houseAccountId) {
          const account = await tx.houseAccount.findFirst({
            where: { id: payment.houseAccountId },
            select: { currentBalance: true, creditLimit: true },
          });
          if (account?.creditLimit !== null && account?.creditLimit !== undefined) {
            const newBalance = account.currentBalance.add(orderRecord.total);
            if (newBalance.greaterThan(account.creditLimit)) {
              throw new Error('CREDIT_LIMIT_EXCEEDED');
            }
          }
          await tx.houseAccount.update({
            where: { id: payment.houseAccountId },
            data: { currentBalance: { increment: orderRecord.total } },
          });
        } else if (payment.corporateAccountId) {
          const account = await tx.corporateAccount.findFirst({
            where: { id: payment.corporateAccountId },
            select: { currentBalance: true, creditLimit: true },
          });
          if (account?.creditLimit !== null && account?.creditLimit !== undefined) {
            const newBalance = account.currentBalance.add(orderRecord.total);
            if (newBalance.greaterThan(account.creditLimit)) {
              throw new Error('CREDIT_LIMIT_EXCEEDED');
            }
          }
          await tx.corporateAccount.update({
            where: { id: payment.corporateAccountId },
            data: { currentBalance: { increment: orderRecord.total } },
          });
        } else if (payment.customerCreditAccountId) {
          const account = await tx.customerCreditAccount.findFirst({
            where: { id: payment.customerCreditAccountId },
            select: { currentBalance: true, creditLimit: true },
          });
          if (account) {
            const newBalance = account.currentBalance.add(orderRecord.total);
            if (newBalance.greaterThan(account.creditLimit)) {
              throw new Error('CREDIT_LIMIT_EXCEEDED');
            }
          }
          await tx.customerCreditAccount.update({
            where: { id: payment.customerCreditAccountId },
            data: { currentBalance: { increment: orderRecord.total } },
          });
        }

        return tx.order.findFirst({
          where: { id: orderId, organizationId },
          include: orderInclude,
        });
      });
    }

    // Non-credit payment path (unchanged)
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
        cardAmount: payment.cardAmount ?? undefined,
        splitType: payment.splitType ?? undefined,
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

  /**
   * Manager override: replace order items + void specified tickets atomically.
   * Unlike updateItems, this does NOT check whether tickets are IN_PROGRESS or
   * READY — managers have authority to void any non-already-REJECTED ticket.
   */
  managerUpdateItems: async (
    orderId: string,
    organizationId: string,
    newItems: Array<{
      menuItemId: string;
      quantity: number;
      unitPrice: Prisma.Decimal;
      subtotal: Prisma.Decimal;
      notes: string | null;
    }>,
    newTotals: { subtotal: Prisma.Decimal; total: Prisma.Decimal },
    plan: {
      voidTicketUpdates: Array<{
        ticketId: string;
        station: PrepStation;
        status: PrepTicketStatus;
        items: PrepTicketItemSnapshot[];
        rejectedReason: string;
      }>;
      actorId: string;
      /** Explicit target status to apply; null = keep current status */
      targetStatus: OrderStatus | null;
    },
  ): Promise<FullOrderPrismaRecord | null> => {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.order.findFirst({
        where: { id: orderId, organizationId },
        select: { id: true },
      });
      if (!existing) return null;

      // Replace all order items atomically
      await tx.orderItem.deleteMany({ where: { orderId } });
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

      // Update order totals and apply the computed target status if set
      await tx.order.update({
        where: { id: orderId },
        data: {
          subtotal: newTotals.subtotal,
          total: newTotals.total,
          ...(plan.targetStatus !== null ? { status: plan.targetStatus } : {}),
        },
      });

      // Void the matching tickets — manager can void any status
      for (const update of plan.voidTicketUpdates) {
        await tx.prepTicket.update({
          where: { id: update.ticketId },
          data: {
            status: PrepTicketStatus.REJECTED,
            claimedById: null,
            claimedAt: null,
            readyAt: null,
            rejectedById: plan.actorId,
            rejectedReason: update.rejectedReason,
            rejectedAt: new Date(),
            items: update.items as unknown as Prisma.InputJsonValue,
          },
        });
      }

      return tx.order.findFirst({
        where: { id: orderId, organizationId },
        include: orderInclude,
      });
    });
  },

  /**
   * Applies a staff discount to an order that is in AWAITING_AUTHORIZATION status.
   * Atomically reduces order.total by discountAmount and records the discount metadata.
   * Does NOT change order status — the caller is responsible for that.
   */
  applyDiscount: async (
    orderId: string,
    organizationId: string,
    discountPercent: string,
    discountAmount: string,
    discountedById: string,
  ): Promise<FullOrderPrismaRecord | null> => {
    const { Prisma } = await import('@prisma/client');
    const discountDecimal = new Prisma.Decimal(discountAmount);

    const updated = await prisma.order.updateMany({
      where: {
        id: orderId,
        organizationId,
        status: OrderStatus.AWAITING_AUTHORIZATION,
      },
      data: {
        total: {
          decrement: discountDecimal,
        },
        discountPercent,
        discountAmount,
        discountedById,
      },
    });

    if (updated.count === 0) {
      return null;
    }

    return prisma.order.findFirst({
      where: { id: orderId, organizationId },
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



