import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../config/database';
import type { ListOrderCorrectionsQuery } from '../validators/order-correction-schemas';

const orderWithDetailInclude = {
  organization: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  items: {
    select: {
      id: true,
      menuItemId: true,
      quantity: true,
      unitPrice: true,
      subtotal: true,
      notes: true,
      menuItem: { select: { name: true } },
    },
  },
  prepTickets: {
    select: { id: true, station: true, status: true, sequence: true, claimedById: true },
  },
  houseAuthRequests: {
    where: { status: 'PENDING' as const },
    select: { id: true, status: true },
    take: 1,
  },
} as const;

export const orderCorrectionRepository = {
  findMany: async (query: ListOrderCorrectionsQuery) => {
    const where: Record<string, unknown> = {};

    if (query.branchId) {
      where.organizationId = query.branchId;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.dateFrom || query.dateTo) {
      const orderDate: Record<string, string> = {};
      if (query.dateFrom) orderDate.gte = query.dateFrom;
      if (query.dateTo) orderDate.lte = query.dateTo;
      where.orderDate = orderDate;
    }
    if (query.search) {
      const num = Number.parseInt(query.search, 10);
      if (!Number.isNaN(num)) {
        where.dailyNumber = num;
      } else {
        where.tableNumber = { contains: query.search, mode: 'insensitive' };
      }
    }

    const [total, orders] = await prisma.$transaction([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        include: {
          organization: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
        },
        orderBy: [{ orderDate: 'desc' }, { dailyNumber: 'desc' }],
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
      }),
    ]);

    return { orders, total };
  },

  findById: async (orderId: string) => {
    return prisma.order.findUnique({
      where: { id: orderId },
      include: orderWithDetailInclude,
    });
  },

  findAuditLog: async (orderId: string) => {
    return prisma.incidentLog.findMany({
      where: { orderId, type: 'ORDER_CORRECTION' },
      include: { actor: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  },

  correctMpesaCode: async (
    orderId: string,
    organizationId: string,
    mpesaCode: string,
    actorId: string,
    before: string,
    reason: string,
  ) => {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.updateMany({
        where: { id: orderId, organizationId },
        data: { mpesaCode },
      });
      await tx.incidentLog.create({
        data: {
          organizationId,
          orderId,
          type: 'ORDER_CORRECTION',
          actorId,
          details: {
            action: 'CORRECT_MPESA_CODE',
            field: 'mpesaCode',
            before,
            after: mpesaCode,
            reason,
          },
        },
      });
      return order;
    });
  },

  correctPaymentMethod: async (
    orderId: string,
    organizationId: string,
    paymentMethod: string,
    actorId: string,
    before: string,
    reason: string,
  ) => {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.updateMany({
        where: { id: orderId, organizationId },
        data: { paymentMethod: paymentMethod as never },
      });
      await tx.incidentLog.create({
        data: {
          organizationId,
          orderId,
          type: 'ORDER_CORRECTION',
          actorId,
          details: {
            action: 'CORRECT_PAYMENT_METHOD',
            field: 'paymentMethod',
            before,
            after: paymentMethod,
            reason,
          },
        },
      });
      return order;
    });
  },

  forceOrderReady: async (
    orderId: string,
    organizationId: string,
    actorId: string,
    reason: string,
  ) => {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.updateMany({
        where: { id: orderId, organizationId },
        data: { status: 'READY' },
      });
      await tx.incidentLog.create({
        data: {
          organizationId,
          orderId,
          type: 'ORDER_CORRECTION',
          actorId,
          details: {
            action: 'FORCE_ORDER_READY',
            field: 'status',
            before: 'IN_PROGRESS',
            after: 'READY',
            reason,
          },
        },
      });
      return order;
    });
  },

  revertAwaitingAuth: async (
    orderId: string,
    organizationId: string,
    authRequestId: string,
    actorId: string,
    reason: string,
  ) => {
    return prisma.$transaction(async (tx) => {
      await tx.houseAccountAuthRequest.delete({ where: { id: authRequestId } });
      const order = await tx.order.updateMany({
        where: { id: orderId, organizationId },
        data: { status: 'READY' },
      });
      await tx.incidentLog.create({
        data: {
          organizationId,
          orderId,
          type: 'ORDER_CORRECTION',
          actorId,
          details: {
            action: 'REVERT_AWAITING_AUTH',
            field: 'status',
            before: 'AWAITING_AUTHORIZATION',
            after: 'READY',
            reason,
          },
        },
      });
      return order;
    });
  },

  removeOrderItem: async (
    orderId: string,
    organizationId: string,
    itemId: string,
    actorId: string,
    itemName: string,
    itemSubtotal: Decimal,
    reason: string,
  ) => {
    return prisma.$transaction(async (tx) => {
      const item = await tx.orderItem.findFirst({ where: { id: itemId, orderId } });
      if (!item) return null;

      await tx.orderItem.delete({ where: { id: itemId } });

      const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
      const newSubtotal = new Decimal(order.subtotal).minus(itemSubtotal);
      const newTotal = new Decimal(order.total).minus(itemSubtotal);

      const updated = await tx.order.updateMany({
        where: { id: orderId, organizationId },
        data: {
          subtotal: newSubtotal,
          total: newTotal,
        },
      });

      await tx.incidentLog.create({
        data: {
          organizationId,
          orderId,
          type: 'ORDER_CORRECTION',
          actorId,
          details: {
            action: 'REMOVE_ORDER_ITEM',
            field: 'items',
            before: `${itemName} (KES ${itemSubtotal.toFixed(2)})`,
            after: 'removed',
            totalBefore: order.total.toFixed(2),
            totalAfter: newTotal.toFixed(2),
            reason,
          },
        },
      });

      return updated;
    });
  },

  revertRejectedTicket: async (
    orderId: string,
    organizationId: string,
    ticketId: string,
    ticketStation: string,
    actorId: string,
    reason: string,
  ) => {
    return prisma.$transaction(async (tx) => {
      const ticket = await tx.prepTicket.findFirst({ where: { id: ticketId, orderId } });
      if (!ticket) return null;

      await tx.prepTicket.update({
        where: { id: ticketId },
        data: { status: 'PENDING', claimedById: null, claimedAt: null },
      });

      await tx.incidentLog.create({
        data: {
          organizationId,
          orderId,
          type: 'ORDER_CORRECTION',
          actorId,
          details: {
            action: 'REVERT_REJECTED_TICKET',
            field: 'prepTicket.status',
            before: 'REJECTED',
            after: 'PENDING',
            station: ticketStation,
            reason,
          },
        },
      });

      return ticket;
    });
  },

  adjustOrderTotal: async (
    orderId: string,
    organizationId: string,
    newTotal: Decimal,
    actorId: string,
    before: string,
    reason: string,
  ) => {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.updateMany({
        where: { id: orderId, organizationId },
        data: { total: newTotal },
      });
      await tx.incidentLog.create({
        data: {
          organizationId,
          orderId,
          type: 'ORDER_CORRECTION',
          actorId,
          details: {
            action: 'ADJUST_ORDER_TOTAL',
            field: 'total',
            before,
            after: newTotal.toFixed(2),
            reason,
          },
        },
      });
      return order;
    });
  },
};
