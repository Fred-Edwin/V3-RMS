import type { PaymentMethod } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../config/database';
import { ConflictError } from '../utils/errors';
import type { ListOrderCorrectionsQuery } from '../validators/order-correction-schemas';
import type { SplitPaymentLineRecord } from '../types/order.types';

const serializeSplitLine = (line: {
  id: string;
  orderId: string;
  label: string;
  amount: { toString(): string };
  method: PaymentMethod;
  mpesaCode: string | null;
  paidAt: Date;
  createdAt: Date;
}): SplitPaymentLineRecord => ({
  id: line.id,
  orderId: line.orderId,
  label: line.label,
  amount: line.amount.toString(),
  method: line.method,
  mpesaCode: line.mpesaCode,
  paidAt: line.paidAt,
  createdAt: line.createdAt,
});

const assertOrderUpdated = (count: number): void => {
  if (count === 0) {
    throw new ConflictError('Order could not be updated — it may have changed or been removed');
  }
};

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
  splitPaymentLines: {
    orderBy: { createdAt: 'asc' as const },
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
      const orderDate: Record<string, Date> = {};
      if (query.dateFrom) orderDate.gte = new Date(`${query.dateFrom}T00:00:00.000Z`);
      if (query.dateTo) orderDate.lte = new Date(`${query.dateTo}T23:59:59.999Z`);
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
      assertOrderUpdated(order.count);
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
    paymentMethod: PaymentMethod,
    actorId: string,
    before: string,
    reason: string,
  ) => {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.updateMany({
        where: { id: orderId, organizationId },
        data: { paymentMethod },
      });
      assertOrderUpdated(order.count);
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
      assertOrderUpdated(order.count);
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
      assertOrderUpdated(order.count);
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
      assertOrderUpdated(updated.count);

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
      assertOrderUpdated(order.count);
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

  removeSplitLine: async (
    orderId: string,
    organizationId: string,
    lineId: string,
    actorId: string,
    reason: string,
  ) => {
    return prisma.$transaction(async (tx) => {
      const line = await tx.splitPaymentLine.findFirst({ where: { id: lineId, orderId } });
      if (!line) return null;

      await tx.splitPaymentLine.delete({ where: { id: lineId } });

      await tx.incidentLog.create({
        data: {
          organizationId,
          orderId,
          type: 'ORDER_CORRECTION',
          actorId,
          details: {
            action: 'REMOVE_SPLIT_LINE',
            field: 'splitPaymentLines',
            before: `${line.label}: ${line.method} KES ${new Decimal(line.amount).toFixed(2)}`,
            after: 'removed',
            reason,
          },
        },
      });

      return line;
    });
  },

  addSplitLine: async (
    orderId: string,
    organizationId: string,
    input: { label: string; amount: Decimal; method: PaymentMethod; mpesaCode?: string },
    actorId: string,
    reason: string,
  ): Promise<SplitPaymentLineRecord> => {
    return prisma.$transaction(async (tx) => {
      const line = await tx.splitPaymentLine.create({
        data: {
          orderId,
          label: input.label,
          amount: input.amount,
          method: input.method,
          mpesaCode: input.mpesaCode ?? null,
        },
      });

      await tx.incidentLog.create({
        data: {
          organizationId,
          orderId,
          type: 'ORDER_CORRECTION',
          actorId,
          details: {
            action: 'ADD_SPLIT_LINE',
            field: 'splitPaymentLines',
            before: '(none)',
            after: `${input.label}: ${input.method} KES ${input.amount.toFixed(2)}`,
            reason,
          },
        },
      });

      return serializeSplitLine(line);
    });
  },
};
