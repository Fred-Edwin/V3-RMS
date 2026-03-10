import { OrderStatus, OrderType, PaymentMethod, PrepStation, PrepTicketStatus, Prisma, type UserRole } from '@prisma/client';
import type { Request } from 'express';
import { deliveryZoneRepository } from '../repositories/delivery-zone-repository';
import { menuRepository, type MenuItemWithCategoryRecord } from '../repositories/menu-repository';
import {
  orderRepository,
  type FullOrderPrismaRecord,
  type SummaryOrderPrismaRecord,
} from '../repositories/order-repository';
import { idempotencyRepository } from '../repositories/idempotency-repository';
import { socketService } from '../sockets/socket-service';
import { fcmService } from './fcm-service';
import { incidentService } from './incident-service';
import type {
  OrderRecord,
  OrderSummaryRecord,
  PrepTicketItemSnapshot,
  PrepTicketRecord,
  PrepTicketSummaryRecord,
} from '../types/order.types';
import {
  buildPrepTicketItemsSnapshot,
  calculateOrderTotals,
  deriveStationsFromItems,
} from '../utils/order-utils';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';
import type {
  ActiveOrderQueryInput,
  CreateOrderInput,
  OrderQueryInput,
  RecordPaymentInput,
  UpdateOrderItemsInput,
} from '../validators/order-schemas';

type Actor = NonNullable<Request['user']>;

interface PaginationMeta {
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

interface OrderListResult {
  orders: Array<OrderRecord | OrderSummaryRecord>;
  pagination: PaginationMeta;
}

interface ResolvedOrderItem {
  menuItemId: string;
  name: string;
  quantity: number;
  notes: string | null;
  unitPrice: Prisma.Decimal;
  subtotal: Prisma.Decimal;
  category: {
    prepStation: PrepStation;
  };
}

const branchScopedRoles: UserRole[] = [
  'MANAGER',
  'WAITER',
  'CHEF',
  'BARISTA',
  'KITCHEN_DISPLAY',
  'BARISTA_DISPLAY',
];

const formatDateOnly = (date: Date): string => date.toISOString().slice(0, 10);

const parseDateOnly = (date: string): Date => {
  const parts = date.split('-');
  const year = Number(parts[0] ?? '0');
  const month = Number(parts[1] ?? '1');
  const day = Number(parts[2] ?? '1');
  return new Date(year, month - 1, day);
};

const normalizeOrderDate = (date: Date): Date => {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const resolveOrganizationId = (actor: Actor, requestedBranchId?: string): string => {
  if (branchScopedRoles.includes(actor.role)) {
    if (!actor.organizationId) {
      throw new ForbiddenError('Branch context missing for this user');
    }
    if (requestedBranchId && requestedBranchId !== actor.organizationId) {
      throw new ForbiddenError('Cannot access orders for another branch');
    }
    return actor.organizationId;
  }

  if (!requestedBranchId) {
    throw new ValidationError('branchId query param is required for this role');
  }

  return requestedBranchId;
};

const assertOwnership = (order: FullOrderPrismaRecord, actor: Actor): void => {
  if (actor.role === 'MANAGER' || actor.role === 'DIRECTOR') {
    return;
  }
  if (order.createdById !== actor.id) {
    throw new ForbiddenError('Only the waiter who created this order can perform this action');
  }
};

const parsePrepTicketItems = (value: Prisma.JsonValue): PrepTicketItemSnapshot[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const isSnapshotItem = (
    item: unknown,
  ): item is { name: string; quantity: number; notes?: unknown } => {
    return (
      typeof item === 'object' &&
      item !== null &&
      'name' in item &&
      typeof item['name'] === 'string' &&
      'quantity' in item &&
      typeof item['quantity'] === 'number'
    );
  };

  return value.flatMap((item) => {
    if (!isSnapshotItem(item)) {
      return [];
    }

    return [
      {
        name: item.name,
        quantity: item.quantity,
        notes: typeof item.notes === 'string' ? item.notes : null,
      },
    ];
  });
};

const serializePrepTicket = (
  ticket: FullOrderPrismaRecord['prepTickets'][number],
): PrepTicketRecord => {
  return {
    id: ticket.id,
    orderId: ticket.orderId,
    station: ticket.station,
    status: ticket.status,
    claimedById: ticket.claimedById,
    claimedBy: ticket.claimedBy ? { id: ticket.claimedBy.id, name: ticket.claimedBy.name } : null,
    claimedAt: ticket.claimedAt,
    readyAt: ticket.readyAt,
    items: parsePrepTicketItems(ticket.items),
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
  };
};

const serializePrepTicketSummary = (
  ticket: SummaryOrderPrismaRecord['prepTickets'][number],
): PrepTicketSummaryRecord => {
  return {
    id: ticket.id,
    station: ticket.station,
    status: ticket.status,
    claimedBy: ticket.claimedBy ? { id: ticket.claimedBy.id, name: ticket.claimedBy.name } : null,
    claimedAt: ticket.claimedAt,
    readyAt: ticket.readyAt,
  };
};

const serializeOrder = (order: FullOrderPrismaRecord): OrderRecord => {
  return {
    id: order.id,
    organizationId: order.organizationId,
    dailyNumber: order.dailyNumber,
    orderDate: formatDateOnly(order.orderDate),
    type: order.type,
    status: order.status,
    tableNumber: order.tableNumber,
    notes: order.notes,
    subtotal: order.subtotal.toString(),
    deliveryFee: order.deliveryFee.toString(),
    total: order.total.toString(),
    paymentMethod: order.paymentMethod,
    paidAt: order.paidAt,
    cancelReason: order.cancelReason,
    cancelledBy: order.cancelledBy ? { id: order.cancelledBy.id, name: order.cancelledBy.name } : null,
    closedAt: order.closedAt,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    createdBy: {
      id: order.createdBy.id,
      name: order.createdBy.name,
    },
    deliveryZone: order.deliveryZone
      ? {
          id: order.deliveryZone.id,
          name: order.deliveryZone.name,
          fee: order.deliveryZone.fee.toString(),
        }
      : null,
    items: order.items.map((item) => ({
      id: item.id,
      menuItemId: item.menuItemId,
      name: item.menuItem.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice.toString(),
      subtotal: item.subtotal.toString(),
      notes: item.notes,
    })),
    prepTickets: order.prepTickets.map(serializePrepTicket),
  };
};

const serializeOrderSummary = (order: SummaryOrderPrismaRecord): OrderSummaryRecord => {
  return {
    id: order.id,
    dailyNumber: order.dailyNumber,
    orderDate: formatDateOnly(order.orderDate),
    type: order.type,
    status: order.status,
    tableNumber: order.tableNumber,
    notes: order.notes,
    subtotal: order.subtotal.toString(),
    deliveryFee: order.deliveryFee.toString(),
    total: order.total.toString(),
    paymentMethod: order.paymentMethod,
    paidAt: order.paidAt,
    cancelReason: order.cancelReason,
    cancelledBy: order.cancelledBy ? { id: order.cancelledBy.id, name: order.cancelledBy.name } : null,
    createdAt: order.createdAt,
    createdBy: {
      id: order.createdBy.id,
      name: order.createdBy.name,
    },
    prepTickets: order.prepTickets.map(serializePrepTicketSummary),
  };
};

const getMenuItemsMap = (menuItems: MenuItemWithCategoryRecord[]): Map<string, MenuItemWithCategoryRecord> => {
  return new Map(menuItems.map((menuItem) => [menuItem.id, menuItem]));
};

const resolveOrderItems = async (
  organizationId: string,
  items: CreateOrderInput['items'] | UpdateOrderItemsInput['items'],
): Promise<ResolvedOrderItem[]> => {
  const menuItemIds = [...new Set(items.map((item) => item.menuItemId))];
  const menuItems = await menuRepository.findItemsWithCategoriesByIds(menuItemIds, organizationId);
  const menuItemsMap = getMenuItemsMap(menuItems);

  if (menuItems.length !== menuItemIds.length) {
    throw new ValidationError('One or more menu items are invalid or unavailable');
  }

  return items.map((item) => {
    const menuItem = menuItemsMap.get(item.menuItemId);
    if (!menuItem) {
      throw new ValidationError('One or more menu items are invalid or unavailable');
    }

    const branchOverride = menuItem.branchOverrides[0];
    if (branchOverride?.isAvailable === false) {
      throw new ValidationError(`Menu item "${menuItem.name}" is unavailable at this branch`);
    }

    return {
      menuItemId: item.menuItemId,
      name: menuItem.name,
      quantity: item.quantity,
      notes: item.notes ?? null,
      unitPrice: menuItem.price,
      subtotal: menuItem.price.mul(item.quantity),
      category: {
        prepStation: menuItem.category.prepStation,
      },
    };
  });
};

const buildTicketSnapshotsByStation = (
  items: ResolvedOrderItem[],
  stations: PrepStation[],
): Partial<Record<PrepStation, PrepTicketItemSnapshot[]>> => {
  const snapshots: Partial<Record<PrepStation, PrepTicketItemSnapshot[]>> = {};
  stations.forEach((station) => {
    snapshots[station] = buildPrepTicketItemsSnapshot(items, station);
  });
  return snapshots;
};

const stringifyStationItems = (items: Array<{ menuItemId: string; quantity: number; notes: string | null }>): string => {
  return JSON.stringify(
    [...items]
      .sort((a, b) => a.menuItemId.localeCompare(b.menuItemId))
      .map((item) => ({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        notes: item.notes,
      })),
  );
};

const serializeTicketsForSocket = (order: OrderRecord): PrepTicketRecord[] => order.prepTickets;

export const orderService = {
  create: async (data: CreateOrderInput, actor: Actor, idempotencyKey?: string): Promise<OrderRecord> => {
    const startedAt = Date.now();
    const organizationId = resolveOrganizationId(actor);

    if (idempotencyKey) {
      const existing = await idempotencyRepository.findByKey(idempotencyKey);
      if (existing) {
        const existingOrder = await orderRepository.findById(existing.orderId, organizationId);
        if (existingOrder) {
          return serializeOrder(existingOrder);
        }
      }
    }

    const resolvedItemsStart = Date.now();
    const resolvedItems = await resolveOrderItems(organizationId, data.items);
    const resolveItemsMs = Date.now() - resolvedItemsStart;

    const deliveryFeeLookupStart = Date.now();
    const deliveryFee =
      data.type === OrderType.DELIVERY
        ? (
            await deliveryZoneRepository.findActiveByIdAndOrganization(data.deliveryZoneId, organizationId)
          )?.fee
        : new Prisma.Decimal(0);
    const resolveDeliveryZoneMs = Date.now() - deliveryFeeLookupStart;

    if (data.type === OrderType.DELIVERY && !deliveryFee) {
      throw new ValidationError('deliveryZoneId is invalid for this branch');
    }

    const totals = calculateOrderTotals(resolvedItems, deliveryFee ?? new Prisma.Decimal(0));
    const stations = deriveStationsFromItems(resolvedItems);
    const ticketSnapshots = buildTicketSnapshotsByStation(resolvedItems, stations);

    const createOrderStart = Date.now();
    const created = await orderRepository.createWithItemsAndTickets({
      organizationId,
      orderDate: normalizeOrderDate(new Date()),
      type: data.type,
      status: OrderStatus.PENDING,
      tableNumber: data.type === OrderType.DINE_IN ? data.tableNumber : null,
      notes: data.notes ?? null,
      subtotal: totals.subtotal,
      deliveryFee: deliveryFee ?? new Prisma.Decimal(0),
      total: totals.total,
      deliveryZoneId: data.type === OrderType.DELIVERY ? data.deliveryZoneId : null,
      createdById: actor.id,
      items: resolvedItems.map((item) => ({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal,
        notes: item.notes,
      })),
      prepTickets: stations.map((station) => ({
        organizationId,
        station,
        status: PrepTicketStatus.PENDING,
        items: ticketSnapshots[station] ?? [],
      })),
    });
    const createOrderMs = Date.now() - createOrderStart;

    if (idempotencyKey) {
      await idempotencyRepository.create(idempotencyKey, created.id);
    }

    const serializeStart = Date.now();
    const serialized = serializeOrder(created);
    const serializeMs = Date.now() - serializeStart;

    const socketEmitStart = Date.now();
    const ticketsForSocket = serializeTicketsForSocket(serialized);
    socketService.emitNewOrder(organizationId, ticketsForSocket);
    const emitSocketMs = Date.now() - socketEmitStart;

    // Fire-and-forget FCM push to kitchen/barista staff for each ticket station.
    // Runs after the response is sent — does not block order creation latency.
    for (const ticket of ticketsForSocket) {
      void fcmService.sendNewOrderPush(organizationId, {
        orderId: created.id,
        dailyNumber: serialized.dailyNumber,
        station: ticket.station,
      });
    }

    logger.debug(
      {
        actorId: actor.id,
        organizationId,
        orderType: data.type,
        itemCount: data.items.length,
        timingsMs: {
          resolveItems: resolveItemsMs,
          resolveDeliveryZone: resolveDeliveryZoneMs,
          createOrder: createOrderMs,
          serialize: serializeMs,
          socketEmit: emitSocketMs,
          total: Date.now() - startedAt,
        },
      },
      'Order creation performance metrics',
    );
    return serialized;
  },

  getMany: async (actor: Actor, query: OrderQueryInput): Promise<OrderListResult> => {
    const organizationId = resolveOrganizationId(actor, query.branchId);
    const createdById = actor.role === 'WAITER' ? actor.id : undefined;

    const orderDate = query.date ? parseDateOnly(query.date) : undefined;
    const orderDateGte = query.startDate ? parseDateOnly(query.startDate) : undefined;
    const orderDateLte = query.endDate ? parseDateOnly(query.endDate) : undefined;

    const filters = {
      status: query.status,
      type: query.type,
      orderDate,
      orderDateGte,
      orderDateLte,
      createdById,
      page: query.page,
      perPage: query.perPage,
    };

    if (query.view === 'summary') {
      const result = await orderRepository.findManySummary(organizationId, filters);
      return {
        orders: result.orders.map(serializeOrderSummary),
        pagination: {
          total: result.total,
          page: query.page,
          perPage: query.perPage,
          totalPages: Math.max(1, Math.ceil(result.total / query.perPage)),
        },
      };
    }

    const result = await orderRepository.findMany(organizationId, filters);
    return {
      orders: result.orders.map(serializeOrder),
      pagination: {
        total: result.total,
        page: query.page,
        perPage: query.perPage,
        totalPages: Math.max(1, Math.ceil(result.total / query.perPage)),
      },
    };
  },

  getActive: async (
    actor: Actor,
    query: ActiveOrderQueryInput = { view: 'full' },
  ): Promise<Array<OrderRecord | OrderSummaryRecord>> => {
    const organizationId = resolveOrganizationId(actor);
    const today = normalizeOrderDate(new Date());
    if (query.view === 'summary') {
      const orders = await orderRepository.findActiveSummary(organizationId, today);
      return orders.map(serializeOrderSummary);
    }

    const orders = await orderRepository.findActive(organizationId, today);
    return orders.map(serializeOrder);
  },

  getById: async (id: string, actor: Actor, branchId?: string): Promise<OrderRecord> => {
    const organizationId = resolveOrganizationId(actor, branchId);
    const order = await orderRepository.findById(id, organizationId);
    if (!order) {
      throw new NotFoundError('Order not found');
    }

    return serializeOrder(order);
  },

  updateItems: async (orderId: string, data: UpdateOrderItemsInput, actor: Actor): Promise<OrderRecord> => {
    const organizationId = resolveOrganizationId(actor);
    const existingOrder = await orderRepository.findById(orderId, organizationId);
    if (!existingOrder) {
      throw new NotFoundError('Order not found');
    }

    assertOwnership(existingOrder, actor);

    const anyTicketBeyondPending = existingOrder.prepTickets.some((ticket) => ticket.status !== 'PENDING');
    if (anyTicketBeyondPending) {
      throw new ConflictError('Order is being prepared and cannot be edited.');
    }

    const resolvedItems = await resolveOrderItems(organizationId, data.items);
    const newStations = deriveStationsFromItems(resolvedItems);
    const existingStations = [...new Set(existingOrder.prepTickets.map((ticket) => ticket.station))];

    if (newStations.some((station) => !existingStations.includes(station))) {
      throw new ValidationError('Cannot add items for a new prep station after order creation');
    }

    for (const station of existingStations) {
      const currentStationItems = existingOrder.items
        .filter((item) => item.menuItem.category.prepStation === station)
        .map((item) => ({
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          notes: item.notes ?? null,
        }));

      const newStationItems = resolvedItems
        .filter((item) => item.category.prepStation === station)
        .map((item) => ({
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          notes: item.notes,
        }));

      const stationChanged = stringifyStationItems(currentStationItems) !== stringifyStationItems(newStationItems);
      const stationTicket = existingOrder.prepTickets.find((ticket) => ticket.station === station);

      if (stationChanged && stationTicket && stationTicket.status !== 'PENDING') {
        throw new ConflictError('Order cannot be modified. Preparation has already started at one or more stations.');
      }
    }

    const totals = calculateOrderTotals(resolvedItems, existingOrder.deliveryFee);
    const ticketSnapshots = buildTicketSnapshotsByStation(resolvedItems, existingStations);
    const updatedOrder = await orderRepository.updateItems(
      orderId,
      organizationId,
      resolvedItems.map((item) => ({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal,
        notes: item.notes,
      })),
      totals,
      ticketSnapshots,
    );

    if (!updatedOrder) {
      throw new NotFoundError('Order not found');
    }

    const serialized = serializeOrder(updatedOrder);
    socketService.emitOrderModified(organizationId, serializeTicketsForSocket(serialized));
    return serialized;
  },

  recordPayment: async (
    orderId: string,
    data: RecordPaymentInput,
    actor: Actor,
  ): Promise<OrderRecord> => {
    const organizationId = resolveOrganizationId(actor);
    const order = await orderRepository.findById(orderId, organizationId);
    if (!order) {
      throw new NotFoundError('Order not found');
    }

    assertOwnership(order, actor);

    if (order.status !== OrderStatus.READY) {
      throw new ConflictError('Payment can only be recorded when the order is ready.');
    }

    if (order.type === OrderType.DELIVERY && data.paymentMethod !== PaymentMethod.MPESA) {
      throw new ValidationError('Delivery orders only accept MPESA payment');
    }

    const updated = await orderRepository.recordPayment(orderId, organizationId, data.paymentMethod);
    if (!updated) {
      throw new NotFoundError('Order not found');
    }

    const serialized = serializeOrder(updated);

    socketService.emitOrderPaid(actor.id, {
      orderId: serialized.id,
      dailyNumber: serialized.dailyNumber,
    });

    const stations = [...new Set(order.prepTickets.map((t) => t.station))] as PrepStation[];
    socketService.emitOrderClosed(organizationId, stations, {
      orderId: serialized.id,
      dailyNumber: serialized.dailyNumber,
    });

    return serialized;
  },

  cancel: async (orderId: string, reason: string, actor: Actor): Promise<OrderRecord> => {
    const organizationId = resolveOrganizationId(actor);
    const order = await orderRepository.findById(orderId, organizationId);
    if (!order) {
      throw new NotFoundError('Order not found');
    }

    assertOwnership(order, actor);

    const allowedStatuses = [OrderStatus.PENDING, OrderStatus.IN_PROGRESS, OrderStatus.READY];

    const cancelled = await orderRepository.cancel(orderId, organizationId, allowedStatuses, reason, actor.id);
    if (!cancelled) {
      throw new ConflictError('Order cannot be cancelled in its current state.');
    }

    const isManager = actor.role === 'MANAGER' || actor.role === 'DIRECTOR';

    const serialized = serializeOrder(cancelled);
    const stations = order.prepTickets.map((ticket) => ticket.station);
    const wasForceCancelled = isManager && order.status !== OrderStatus.PENDING;

    if (wasForceCancelled) {
      socketService.emitOrderForceCancelled(organizationId, stations, order.createdById, {
        orderId: serialized.id,
        dailyNumber: serialized.dailyNumber,
        cancelledBy: actor.id,
      });
      void fcmService.sendOrderForceCancelledPush(order.createdById, {
        orderId: serialized.id,
        dailyNumber: serialized.dailyNumber,
      });
    } else {
      socketService.emitOrderCancelled(organizationId, stations, { orderId: serialized.id });
    }

    incidentService.log({
      organizationId,
      orderId,
      type: 'ORDER_CANCELLED',
      actorId: actor.id,
      details: {
        dailyNumber: serialized.dailyNumber,
        previousStatus: order.status,
        reason,
        forceCancelled: wasForceCancelled,
      },
    });

    return serialized;
  },
};
