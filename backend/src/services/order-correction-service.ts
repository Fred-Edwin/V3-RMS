import { Decimal } from '@prisma/client/runtime/library';
import { orderCorrectionRepository } from '../repositories/order-correction-repository';
import { socketService } from '../sockets/socket-service';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors';
import type {
  AdjustOrderTotalInput,
  CorrectMpesaCodeInput,
  CorrectPaymentMethodInput,
  ForceOrderReadyInput,
  ListOrderCorrectionsQuery,
  RemoveOrderItemInput,
  RevertAwaitingAuthInput,
  RevertRejectedTicketInput,
} from '../validators/order-correction-schemas';

const MAX_CORRECTION_AGE_DAYS = 7;

const assertWithinCorrectionWindow = (createdAt: Date): void => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - MAX_CORRECTION_AGE_DAYS);
  if (createdAt < cutoff) {
    throw new ConflictError(
      `Corrections are only allowed on orders created within the last ${MAX_CORRECTION_AGE_DAYS} days`,
    );
  }
};

export const orderCorrectionService = {
  listOrders: async (query: ListOrderCorrectionsQuery) => {
    const { orders, total } = await orderCorrectionRepository.findMany(query);
    return {
      orders: orders.map((o) => ({
        id: o.id,
        dailyNumber: o.dailyNumber,
        orderDate: (o.orderDate as Date).toISOString().slice(0, 10),
        type: o.type,
        status: o.status,
        tableNumber: o.tableNumber,
        paymentMethod: o.paymentMethod,
        mpesaCode: o.mpesaCode,
        total: o.total.toFixed(2),
        createdAt: o.createdAt.toISOString(),
        closedAt: o.closedAt ? o.closedAt.toISOString() : null,
        organizationId: o.organizationId,
        organizationName: (o as { organization: { name: string } }).organization.name,
        createdByName: (o as { createdBy: { name: string } }).createdBy.name,
      })),
      pagination: {
        total,
        page: query.page,
        perPage: query.perPage,
        totalPages: Math.ceil(total / query.perPage),
      },
    };
  },

  getOrderDetail: async (orderId: string) => {
    const order = await orderCorrectionRepository.findById(orderId);
    if (!order) throw new NotFoundError('Order not found');

    return {
      id: order.id,
      dailyNumber: order.dailyNumber,
      orderDate: (order.orderDate as Date).toISOString().slice(0, 10),
      type: order.type,
      status: order.status,
      tableNumber: order.tableNumber,
      notes: order.notes,
      paymentMethod: order.paymentMethod,
      mpesaCode: order.mpesaCode,
      subtotal: order.subtotal.toFixed(2),
      deliveryFee: order.deliveryFee.toFixed(2),
      total: order.total.toFixed(2),
      createdAt: order.createdAt.toISOString(),
      closedAt: order.closedAt ? order.closedAt.toISOString() : null,
      organizationId: order.organizationId,
      organizationName: order.organization.name,
      createdByName: order.createdBy.name,
      items: order.items.map((item) => ({
        id: item.id,
        menuItemId: item.menuItemId,
        name: item.menuItem.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toFixed(2),
        subtotal: item.subtotal.toFixed(2),
        notes: item.notes,
      })),
      prepTickets: order.prepTickets,
      pendingAuthRequestId: order.houseAuthRequests[0]?.id ?? null,
    };
  },

  getAuditLog: async (orderId: string) => {
    const order = await orderCorrectionRepository.findById(orderId);
    if (!order) throw new NotFoundError('Order not found');

    const logs = await orderCorrectionRepository.findAuditLog(orderId);
    return logs.map((log) => ({
      id: log.id,
      type: log.type,
      actor: log.actor ? { id: log.actor.id, name: log.actor.name } : null,
      details: log.details as Record<string, unknown>,
      createdAt: log.createdAt.toISOString(),
    }));
  },

  correctMpesaCode: async (
    orderId: string,
    actorId: string,
    input: CorrectMpesaCodeInput,
  ) => {
    const order = await orderCorrectionRepository.findById(orderId);
    if (!order) throw new NotFoundError('Order not found');

    assertWithinCorrectionWindow(order.createdAt);

    if (order.status !== 'CLOSED') {
      throw new ConflictError('M-Pesa code correction is only allowed on CLOSED orders');
    }
    if (order.paymentMethod !== 'MPESA' && order.paymentMethod !== 'SPLIT' && order.paymentMethod !== 'GUEST_SPLIT') {
      throw new ConflictError('This order was not paid by M-Pesa');
    }

    await orderCorrectionRepository.correctMpesaCode(
      orderId,
      order.organizationId,
      input.mpesaCode,
      actorId,
      order.mpesaCode ?? '(none)',
      input.reason,
    );
  },

  correctPaymentMethod: async (
    orderId: string,
    actorId: string,
    input: CorrectPaymentMethodInput,
  ) => {
    const order = await orderCorrectionRepository.findById(orderId);
    if (!order) throw new NotFoundError('Order not found');

    assertWithinCorrectionWindow(order.createdAt);

    if (order.status !== 'CLOSED') {
      throw new ConflictError('Payment method correction is only allowed on CLOSED orders');
    }
    if (order.paymentMethod === input.paymentMethod) {
      throw new ValidationError('New payment method is the same as the current one');
    }

    await orderCorrectionRepository.correctPaymentMethod(
      orderId,
      order.organizationId,
      input.paymentMethod,
      actorId,
      order.paymentMethod ?? '(none)',
      input.reason,
    );
  },

  forceOrderReady: async (
    orderId: string,
    actorId: string,
    input: ForceOrderReadyInput,
  ) => {
    const order = await orderCorrectionRepository.findById(orderId);
    if (!order) throw new NotFoundError('Order not found');

    assertWithinCorrectionWindow(order.createdAt);

    if (order.status !== 'IN_PROGRESS') {
      throw new ConflictError('Order must be IN_PROGRESS to force READY');
    }

    const nonRejectedNotReady = order.prepTickets.filter(
      (t) => t.status !== 'REJECTED' && t.status !== 'READY',
    );
    if (nonRejectedNotReady.length > 0) {
      throw new ConflictError(
        'All non-rejected prep tickets must already be READY before forcing the order to READY',
      );
    }

    const hasRejected = order.prepTickets.some((t) => t.status === 'REJECTED');
    if (!hasRejected) {
      throw new ConflictError(
        'No rejected ticket found — order should transition to READY automatically',
      );
    }

    await orderCorrectionRepository.forceOrderReady(
      orderId,
      order.organizationId,
      actorId,
      input.reason,
    );
  },

  revertAwaitingAuth: async (
    orderId: string,
    actorId: string,
    input: RevertAwaitingAuthInput,
  ) => {
    const order = await orderCorrectionRepository.findById(orderId);
    if (!order) throw new NotFoundError('Order not found');

    assertWithinCorrectionWindow(order.createdAt);

    if (order.status !== 'AWAITING_AUTHORIZATION') {
      throw new ConflictError('Order must be AWAITING_AUTHORIZATION to revert');
    }

    const pendingAuth = order.houseAuthRequests[0];
    if (!pendingAuth) {
      throw new ConflictError('No pending house account auth request found on this order');
    }

    await orderCorrectionRepository.revertAwaitingAuth(
      orderId,
      order.organizationId,
      pendingAuth.id,
      actorId,
      input.reason,
    );
  },

  removeOrderItem: async (
    orderId: string,
    itemId: string,
    actorId: string,
    input: RemoveOrderItemInput,
  ) => {
    const order = await orderCorrectionRepository.findById(orderId);
    if (!order) throw new NotFoundError('Order not found');

    assertWithinCorrectionWindow(order.createdAt);

    if (order.status === 'CANCELLED' || order.status === 'PENDING') {
      throw new ConflictError(
        `Cannot remove items from a ${order.status} order`,
      );
    }

    const item = order.items.find((i) => i.id === itemId);
    if (!item) throw new NotFoundError('Order item not found');

    if (order.items.length === 1) {
      throw new ConflictError('Cannot remove the last item from an order');
    }

    const result = await orderCorrectionRepository.removeOrderItem(
      orderId,
      order.organizationId,
      itemId,
      actorId,
      item.menuItem.name,
      new Decimal(item.subtotal),
      input.reason,
    );

    if (!result) throw new NotFoundError('Order item not found');
  },

  revertRejectedTicket: async (
    orderId: string,
    ticketId: string,
    actorId: string,
    input: RevertRejectedTicketInput,
  ) => {
    const order = await orderCorrectionRepository.findById(orderId);
    if (!order) throw new NotFoundError('Order not found');

    assertWithinCorrectionWindow(order.createdAt);

    const ticket = order.prepTickets.find((t) => t.id === ticketId);
    if (!ticket) throw new NotFoundError('Prep ticket not found on this order');

    if (ticket.status !== 'REJECTED') {
      throw new ConflictError(`Ticket is ${ticket.status} — only REJECTED tickets can be reverted`);
    }

    const result = await orderCorrectionRepository.revertRejectedTicket(
      orderId,
      order.organizationId,
      ticketId,
      ticket.station,
      actorId,
      input.reason,
    );

    if (!result) throw new NotFoundError('Prep ticket not found');

    socketService.emitTicketReverted(order.organizationId, {
      orderId,
      ticketId,
      station: ticket.station,
      dailyNumber: order.dailyNumber,
    });
  },

  adjustOrderTotal: async (
    orderId: string,
    actorId: string,
    input: AdjustOrderTotalInput,
  ) => {
    const order = await orderCorrectionRepository.findById(orderId);
    if (!order) throw new NotFoundError('Order not found');

    assertWithinCorrectionWindow(order.createdAt);

    if (order.status === 'CANCELLED') {
      throw new ConflictError('Cannot adjust the total of a CANCELLED order');
    }

    const before = order.total.toFixed(2);
    const newTotal = new Decimal(input.newTotal);

    await orderCorrectionRepository.adjustOrderTotal(
      orderId,
      order.organizationId,
      newTotal,
      actorId,
      before,
      input.reason,
    );
  },
};
