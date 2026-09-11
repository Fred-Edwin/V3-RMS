import type { Request } from 'express';
import { Decimal } from '@prisma/client/runtime/library';
import { orderCorrectionRepository } from '../repositories/order-correction-repository';
import { socketService } from '../sockets/socket-service';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';
import type {
  AddSplitLineCorrectionInput,
  AdjustOrderTotalInput,
  CorrectMpesaCodeInput,
  CorrectPaymentMethodInput,
  ForceOrderReadyInput,
  ListOrderCorrectionsQuery,
  RemoveOrderItemInput,
  RemoveSplitLineInput,
  RevertAwaitingAuthInput,
  RevertRejectedTicketInput,
} from '../validators/order-correction-schemas';

type Actor = NonNullable<Request['user']>;

// SYSTEM_ADMIN has no age limit. MANAGER/DIRECTOR are branch-scoped instead of
// org-unrestricted, so they get a much longer window rather than a hard cutoff —
// branch managers correct disputed orders days or weeks after the fact.
const MAX_CORRECTION_AGE_DAYS: Partial<Record<Actor['role'], number>> = {
  MANAGER: 90,
  DIRECTOR: 90,
};

const assertWithinCorrectionWindow = (createdAt: Date, actor: Actor): void => {
  const maxDays = MAX_CORRECTION_AGE_DAYS[actor.role];
  if (maxDays === undefined) return; // SYSTEM_ADMIN and any other allowed role: unbounded
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - maxDays);
  if (createdAt < cutoff) {
    throw new ConflictError(
      `Corrections are only allowed on orders created within the last ${maxDays} days`,
    );
  }
};

// MANAGER/DIRECTOR may only correct orders belonging to their own organization
// (branch). SYSTEM_ADMIN is unrestricted. Every method that loads an order by ID
// must call this before performing any read or write.
const assertOrderInScope = (orderOrganizationId: string, actor: Actor): void => {
  if (actor.role === 'SYSTEM_ADMIN') return;
  if (orderOrganizationId !== actor.organizationId) {
    throw new ForbiddenError('Cannot access orders for another branch');
  }
};

export const orderCorrectionService = {
  listOrders: async (query: ListOrderCorrectionsQuery, actor: Actor) => {
    const scopedQuery =
      actor.role === 'SYSTEM_ADMIN'
        ? query
        : { ...query, branchId: actor.organizationId ?? undefined };
    const { orders, total } = await orderCorrectionRepository.findMany(scopedQuery);
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

  getOrderDetail: async (orderId: string, actor: Actor) => {
    const order = await orderCorrectionRepository.findById(orderId);
    if (!order) throw new NotFoundError('Order not found');
    assertOrderInScope(order.organizationId, actor);

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
      splitPaymentLines: order.splitPaymentLines.map((line) => ({
        id: line.id,
        label: line.label,
        amount: line.amount.toFixed(2),
        method: line.method,
        mpesaCode: line.mpesaCode,
      })),
    };
  },

  getAuditLog: async (orderId: string, actor: Actor) => {
    const order = await orderCorrectionRepository.findById(orderId);
    if (!order) throw new NotFoundError('Order not found');
    assertOrderInScope(order.organizationId, actor);

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
    actor: Actor,
    input: CorrectMpesaCodeInput,
  ) => {
    const order = await orderCorrectionRepository.findById(orderId);
    if (!order) throw new NotFoundError('Order not found');
    assertOrderInScope(order.organizationId, actor);

    assertWithinCorrectionWindow(order.createdAt, actor);

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
      actor.id,
      order.mpesaCode ?? '(none)',
      input.reason,
    );
  },

  correctPaymentMethod: async (
    orderId: string,
    actor: Actor,
    input: CorrectPaymentMethodInput,
  ) => {
    const order = await orderCorrectionRepository.findById(orderId);
    if (!order) throw new NotFoundError('Order not found');
    assertOrderInScope(order.organizationId, actor);

    assertWithinCorrectionWindow(order.createdAt, actor);

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
      actor.id,
      order.paymentMethod ?? '(none)',
      input.reason,
    );
  },

  forceOrderReady: async (
    orderId: string,
    actor: Actor,
    input: ForceOrderReadyInput,
  ) => {
    const order = await orderCorrectionRepository.findById(orderId);
    if (!order) throw new NotFoundError('Order not found');
    assertOrderInScope(order.organizationId, actor);

    assertWithinCorrectionWindow(order.createdAt, actor);

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
      actor.id,
      input.reason,
    );
  },

  revertAwaitingAuth: async (
    orderId: string,
    actor: Actor,
    input: RevertAwaitingAuthInput,
  ) => {
    const order = await orderCorrectionRepository.findById(orderId);
    if (!order) throw new NotFoundError('Order not found');
    assertOrderInScope(order.organizationId, actor);

    assertWithinCorrectionWindow(order.createdAt, actor);

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
      actor.id,
      input.reason,
    );
  },

  removeOrderItem: async (
    orderId: string,
    itemId: string,
    actor: Actor,
    input: RemoveOrderItemInput,
  ) => {
    const order = await orderCorrectionRepository.findById(orderId);
    if (!order) throw new NotFoundError('Order not found');
    assertOrderInScope(order.organizationId, actor);

    assertWithinCorrectionWindow(order.createdAt, actor);

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
      actor.id,
      item.menuItem.name,
      new Decimal(item.subtotal),
      input.reason,
    );

    if (!result) throw new NotFoundError('Order item not found');
  },

  revertRejectedTicket: async (
    orderId: string,
    ticketId: string,
    actor: Actor,
    input: RevertRejectedTicketInput,
  ) => {
    const order = await orderCorrectionRepository.findById(orderId);
    if (!order) throw new NotFoundError('Order not found');
    assertOrderInScope(order.organizationId, actor);

    assertWithinCorrectionWindow(order.createdAt, actor);

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
      actor.id,
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
    actor: Actor,
    input: AdjustOrderTotalInput,
  ) => {
    const order = await orderCorrectionRepository.findById(orderId);
    if (!order) throw new NotFoundError('Order not found');
    assertOrderInScope(order.organizationId, actor);

    assertWithinCorrectionWindow(order.createdAt, actor);

    if (order.status === 'CANCELLED') {
      throw new ConflictError('Cannot adjust the total of a CANCELLED order');
    }

    const before = order.total.toFixed(2);
    const newTotal = new Decimal(input.newTotal);

    await orderCorrectionRepository.adjustOrderTotal(
      orderId,
      order.organizationId,
      newTotal,
      actor.id,
      before,
      input.reason,
    );
  },

  removeSplitLine: async (
    orderId: string,
    lineId: string,
    actor: Actor,
    input: RemoveSplitLineInput,
  ) => {
    const order = await orderCorrectionRepository.findById(orderId);
    if (!order) throw new NotFoundError('Order not found');
    assertOrderInScope(order.organizationId, actor);

    assertWithinCorrectionWindow(order.createdAt, actor);

    if (order.status !== 'CLOSED') {
      throw new ConflictError('Split payment line correction is only allowed on CLOSED orders');
    }

    const line = order.splitPaymentLines.find((l) => l.id === lineId);
    if (!line) throw new NotFoundError('Payment line not found');

    if (order.splitPaymentLines.length === 1) {
      throw new ConflictError('Cannot remove the last payment line from a split order');
    }

    const result = await orderCorrectionRepository.removeSplitLine(
      orderId,
      order.organizationId,
      lineId,
      actor.id,
      input.reason,
    );

    if (!result) throw new NotFoundError('Payment line not found');
  },

  addSplitLine: async (
    orderId: string,
    actor: Actor,
    input: AddSplitLineCorrectionInput,
  ) => {
    const order = await orderCorrectionRepository.findById(orderId);
    if (!order) throw new NotFoundError('Order not found');
    assertOrderInScope(order.organizationId, actor);

    assertWithinCorrectionWindow(order.createdAt, actor);

    if (order.status !== 'CLOSED') {
      throw new ConflictError('Split payment line correction is only allowed on CLOSED orders');
    }

    const orderTotal = Number(order.total);
    const existingSum = order.splitPaymentLines.reduce((sum, l) => sum + Number(l.amount), 0);
    const newSum = existingSum + input.amount;

    if (newSum > orderTotal + 1) {
      throw new ConflictError(
        `Adding KES ${input.amount} would exceed the order total of KES ${orderTotal.toFixed(2)}`,
      );
    }

    return orderCorrectionRepository.addSplitLine(
      orderId,
      order.organizationId,
      { label: input.label, amount: new Decimal(input.amount), method: input.method, mpesaCode: input.mpesaCode },
      actor.id,
      input.reason,
    );
  },
};
