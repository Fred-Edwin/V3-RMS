import { OrderStatus, OrderType, PaymentMethod, PrepStation, PrepTicketStatus, Prisma, type UserRole } from '@prisma/client';
import { houseAccountAuthService } from './house-account-auth-service';
import { staffDiscountAuthService } from './staff-discount-auth-service';
import { customerDiscountAuthService } from './customer-discount-auth-service';
import { authRepository } from '../repositories/auth-repository';
import type { Request } from 'express';
import { deliveryZoneRepository } from '../repositories/delivery-zone-repository';
import { houseAccountRepository } from '../repositories/house-account-repository';
import { corporateAccountRepository } from '../repositories/corporate-account-repository';
import { customerCreditRepository } from '../repositories/customer-credit-repository';
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
  buildPerItemTicketSnapshots,
  calculateOrderTotals,
  deriveStationsFromItems,
} from '../utils/order-utils';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';
import type {
  ActiveOrderQueryInput,
  CreateOrderInput,
  ManagerRemoveItemsInput,
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
  totalValue: number;
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
  if (actor.role === 'MANAGER' || actor.role === 'DIRECTOR' || actor.role === 'ACCOUNTANT') {
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
        menuItemId: typeof (item as { menuItemId?: unknown }).menuItemId === 'string' ? (item as unknown as { menuItemId: string }).menuItemId : undefined,
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
    rejectedReason: ticket.rejectedReason,
    items: parsePrepTicketItems(ticket.items),
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
  };
};

const deriveItemLabel = (items: Prisma.JsonValue): string => {
  const parsed = parsePrepTicketItems(items);
  const first = parsed[0];
  if (!first) return '';
  return first.quantity > 1 ? `${first.name} x${first.quantity}` : first.name;
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
    rejectedReason: ticket.rejectedReason,
    itemLabel: deriveItemLabel(ticket.items),
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
    mpesaCode: order.mpesaCode,
    mpesaAmount: order.mpesaAmount?.toString() ?? null,
    cashAmount: order.cashAmount?.toString() ?? null,
    cardAmount: order.cardAmount?.toString() ?? null,
    splitType: order.splitType ?? null,
    paidAt: order.paidAt,
    cancelReason: order.cancelReason,
    cancelledBy: order.cancelledBy ? { id: order.cancelledBy.id, name: order.cancelledBy.name } : null,
    discountPercent: order.discountPercent?.toString() ?? null,
    discountAmount: order.discountAmount?.toString() ?? null,
    discountedById: order.discountedById ?? null,
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
    mpesaCode: order.mpesaCode,
    mpesaAmount: order.mpesaAmount?.toString() ?? null,
    cashAmount: order.cashAmount?.toString() ?? null,
    cardAmount: order.cardAmount?.toString() ?? null,
    splitType: order.splitType ?? null,
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

/**
 * Builds one PrepTicket descriptor per order-item line per station.
 * e.g. 3 Lattes + 2 Teas → 2 BARISTA tickets; 2 Fries + 1 Pizza → 2 KITCHEN tickets.
 */
const buildPerItemTicketDescriptors = (
  items: ResolvedOrderItem[],
  stations: PrepStation[],
): Array<{ station: PrepStation; items: PrepTicketItemSnapshot[] }> => {
  const descriptors: Array<{ station: PrepStation; items: PrepTicketItemSnapshot[] }> = [];
  stations.forEach((station) => {
    const perItemSnapshots = buildPerItemTicketSnapshots(items, station);
    perItemSnapshots.forEach((snapshot) => {
      descriptors.push({ station, items: snapshot });
    });
  });
  return descriptors;
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
    const ticketDescriptors = buildPerItemTicketDescriptors(resolvedItems, stations);

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
      prepTickets: ticketDescriptors.map((descriptor) => ({
        organizationId,
        station: descriptor.station,
        status: PrepTicketStatus.PENDING,
        items: descriptor.items,
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
    // Runs after the response is sent â€” does not block order creation latency.
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
    const isManagerOrDirector = actor.role === 'MANAGER' || actor.role === 'DIRECTOR';
    const createdById = actor.role === 'WAITER'
      ? actor.id
      : (isManagerOrDirector ? query.createdById : undefined);
    const prepTicketClaimedById =
      actor.role === 'CHEF' || actor.role === 'BARISTA'
        ? actor.id
        : (isManagerOrDirector ? query.prepTicketClaimedById : undefined);

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
      prepTicketClaimedById,
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
        totalValue: result.totalValue,
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
      totalValue: result.totalValue,
    };
  },

  getActive: async (
    actor: Actor,
    query: ActiveOrderQueryInput = { view: 'full' },
  ): Promise<Array<OrderRecord | OrderSummaryRecord>> => {
    const organizationId = resolveOrganizationId(actor);
    const today = normalizeOrderDate(new Date());
    const createdById = actor.role === 'WAITER' ? actor.id : undefined;
    if (query.view === 'summary') {
      const orders = await orderRepository.findActiveSummary(organizationId, today, createdById);
      return orders.map(serializeOrderSummary);
    }

    const orders = await orderRepository.findActive(organizationId, today, createdById);
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

    if (existingOrder.status === OrderStatus.CLOSED || existingOrder.status === OrderStatus.CANCELLED) {
      throw new ConflictError('This order is closed and cannot be modified.');
    }

    const resolvedItems = await resolveOrderItems(organizationId, data.items);
    const newItemsByStation = new Map<PrepStation, ResolvedOrderItem[]>();

    resolvedItems.forEach((item) => {
      const station = item.category.prepStation;
      const current = newItemsByStation.get(station) ?? [];
      current.push(item);
      newItemsByStation.set(station, current);
    });

    const existingStations = [...new Set(existingOrder.prepTickets.map((ticket) => ticket.station))];
    const newStations = deriveStationsFromItems(resolvedItems);
    const allStations = [...new Set([...existingStations, ...newStations])];

    const ticketUpdates: Array<{
      ticketId: string;
      station: PrepStation;
      status: PrepTicketStatus;
      items: PrepTicketItemSnapshot[];
      rejectedReason?: string;
      clearRejection?: boolean;
    }> = [];

    const ticketCreates: Array<{ station: PrepStation; items: PrepTicketItemSnapshot[] }> = [];

    const existingTicketIds = new Set(existingOrder.prepTickets.map((ticket) => ticket.id));

    // Each per-item ticket carries exactly one item in its JSON snapshot.
    // Keys are occurrence-indexed so two lines of the same item (e.g. Beef Wrap x1, Beef Wrap x1)
    // are distinguishable: ["id", null, 0] vs ["id", null, 1].
    // Without the index a Map/Set would collapse both lines to the same key and the second
    // ticket would never be created (the original bug).
    const buildOccurrenceKeys = (
      tickets: FullOrderPrismaRecord['prepTickets'],
    ): Map<string, string> => {
      // Returns ticketId → occurrence-indexed key
      const occurrenceCounts = new Map<string, number>();
      const result = new Map<string, string>();
      for (const ticket of tickets) {
        const parsed = parsePrepTicketItems(ticket.items as Prisma.JsonValue);
        const first = parsed[0];
        if (!first) {
          result.set(ticket.id, ticket.id); // fallback
          continue;
        }
        const base = JSON.stringify([first.menuItemId ?? '', first.notes ?? null]);
        const n = occurrenceCounts.get(base) ?? 0;
        occurrenceCounts.set(base, n + 1);
        result.set(ticket.id, JSON.stringify([first.menuItemId ?? '', first.notes ?? null, n]));
      }
      return result;
    };

    const buildItemKeys = (items: ResolvedOrderItem[]): string[] => {
      const occurrenceCounts = new Map<string, number>();
      return items.map((item) => {
        const base = JSON.stringify([item.menuItemId, item.notes ?? null]);
        const n = occurrenceCounts.get(base) ?? 0;
        occurrenceCounts.set(base, n + 1);
        return JSON.stringify([item.menuItemId, item.notes ?? null, n]);
      });
    };

    for (const station of allStations) {
      const requestedStationItems = newItemsByStation.get(station) ?? [];

      const hasStartedTicket = existingOrder.prepTickets.some(
        (ticket) =>
          ticket.station === station &&
          (ticket.status === PrepTicketStatus.IN_PROGRESS || ticket.status === PrepTicketStatus.READY),
      );

      // Existing editable tickets for this station (PENDING or REJECTED), keyed by occurrence-indexed item key
      const stationEditableTickets = existingOrder.prepTickets.filter(
        (ticket) =>
          ticket.station === station &&
          (ticket.status === PrepTicketStatus.PENDING || ticket.status === PrepTicketStatus.REJECTED),
      );
      const editableOccurrenceKeys = buildOccurrenceKeys(stationEditableTickets);
      // Map from occurrence-indexed key → ticket (safe: keys are now unique per line)
      const editableTicketsByKey = new Map<string, FullOrderPrismaRecord['prepTickets'][number]>();
      stationEditableTickets.forEach((ticket) => {
        const key = editableOccurrenceKeys.get(ticket.id);
        if (key) editableTicketsByKey.set(key, ticket);
      });

      if (hasStartedTicket) {
        // Station already in progress — only allow brand-new item lines (additive only).
        // Existing started items cannot be removed.
        const startedTickets = existingOrder.prepTickets.filter(
          (ticket) =>
            ticket.station === station &&
            (ticket.status === PrepTicketStatus.IN_PROGRESS || ticket.status === PrepTicketStatus.READY),
        );
        // Build a multiset of started item base-keys (menuItemId+notes) to count how many of
        // each are started, so we can verify the new request still covers them all.
        const startedBaseCounts = new Map<string, number>();
        for (const ticket of startedTickets) {
          const parsed = parsePrepTicketItems(ticket.items as Prisma.JsonValue);
          const first = parsed[0];
          if (!first) continue;
          const base = JSON.stringify([first.menuItemId ?? '', first.notes ?? null]);
          startedBaseCounts.set(base, (startedBaseCounts.get(base) ?? 0) + 1);
        }

        const requestedBaseCounts = new Map<string, number>();
        for (const item of requestedStationItems) {
          const base = JSON.stringify([item.menuItemId, item.notes ?? null]);
          requestedBaseCounts.set(base, (requestedBaseCounts.get(base) ?? 0) + 1);
        }

        for (const [base, count] of startedBaseCounts) {
          // Each started occurrence must still be present in the new request
          if ((requestedBaseCounts.get(base) ?? 0) < count) {
            throw new ConflictError(
              'Order cannot be modified. Preparation has already started at one or more stations.',
            );
          }
        }

        // Create tickets only for genuinely new item lines not already present.
        // Use occurrence-indexed keys across ALL existing tickets for this station.
        const allStationTickets = existingOrder.prepTickets.filter((ticket) => ticket.station === station);
        const allOccurrenceKeys = buildOccurrenceKeys(allStationTickets);
        const allExistingKeySet = new Set(allOccurrenceKeys.values());

        const requestedKeys = buildItemKeys(requestedStationItems);
        requestedKeys.forEach((key, idx) => {
          if (!allExistingKeySet.has(key)) {
            const item = requestedStationItems[idx]!;
            ticketCreates.push({
              station,
              items: [{ menuItemId: item.menuItemId, name: item.name, quantity: item.quantity, notes: item.notes }],
            });
          }
        });

        continue;
      }

      // Station not yet started — full reconciliation per item line.
      // Use occurrence-indexed keys so two lines of the same item are treated as distinct.
      const matchedTicketIds = new Set<string>();
      const requestedKeys = buildItemKeys(requestedStationItems);

      requestedKeys.forEach((key, idx) => {
        const item = requestedStationItems[idx]!;
        const snapshot: PrepTicketItemSnapshot[] = [
          { menuItemId: item.menuItemId, name: item.name, quantity: item.quantity, notes: item.notes },
        ];
        const existingTicket = editableTicketsByKey.get(key);

        if (existingTicket) {
          matchedTicketIds.add(existingTicket.id);
          // Update quantity/notes in case they changed
          ticketUpdates.push({
            ticketId: existingTicket.id,
            station,
            status: PrepTicketStatus.PENDING,
            items: snapshot,
            clearRejection: existingTicket.status === PrepTicketStatus.REJECTED,
          });
        } else {
          // New item line not previously on the order
          ticketCreates.push({ station, items: snapshot });
        }
      });

      // Reject editable tickets whose item line was removed from the order
      for (const [, ticket] of editableTicketsByKey) {
        if (!matchedTicketIds.has(ticket.id) && ticket.status === PrepTicketStatus.PENDING) {
          ticketUpdates.push({
            ticketId: ticket.id,
            station,
            status: PrepTicketStatus.REJECTED,
            items: [],
            rejectedReason: 'Removed from order',
          });
        }
      }
    }

    const totals = calculateOrderTotals(resolvedItems, existingOrder.deliveryFee);
    const reopenOrder = existingOrder.status === OrderStatus.READY && ticketCreates.length > 0;

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
      {
        updates: ticketUpdates,
        creates: ticketCreates,
        actorId: actor.id,
        reopenOrder,
        orderNotes: data.notes,
      },
    );

    if (!updatedOrder) {
      throw new ConflictError('Order could not be modified. Please refresh and try again.');
    }

    const serialized = serializeOrder(updatedOrder);

    const newTickets = serialized.prepTickets.filter((ticket) => !existingTicketIds.has(ticket.id));
    if (newTickets.length > 0) {
      socketService.emitNewOrder(organizationId, newTickets);
    }

    const updatedTicketIds = new Set(ticketUpdates.map((update) => update.ticketId));
    const modifiedTickets = serialized.prepTickets.filter((ticket) => updatedTicketIds.has(ticket.id));
    if (modifiedTickets.length > 0) {
      socketService.emitOrderModified(organizationId, modifiedTickets);
    }

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

    // Staff discount authorization — deferred payment flow
    if (data.applyStaffDiscount === true) {
      await staffDiscountAuthService.createAuthRequest(orderId, organizationId, actor);
      const pendingOrder = await orderRepository.findById(orderId, organizationId);
      if (!pendingOrder) throw new NotFoundError('Order not found');
      return serializeOrder(pendingOrder);
    }

    // Customer discount — auto-apply or deferred approval depending on discount.requiresApproval
    if (data.applyDiscountId !== undefined) {
      const result = await customerDiscountAuthService.createAuthRequest(
        orderId,
        data.applyDiscountId,
        organizationId,
        actor,
      );
      const updatedOrder = await orderRepository.findById(orderId, organizationId);
      if (!updatedOrder) throw new NotFoundError('Order not found');
      // If approval required, order is now AWAITING_AUTHORIZATION — return early
      if (result.requiresApproval) {
        return serializeOrder(updatedOrder);
      }
      // Auto-applied — order is still READY with discount written, fall through to normal payment
      // Re-read the updated order (total is now discounted)
      const discountedOrder = await orderRepository.findById(orderId, organizationId);
      if (!discountedOrder) throw new NotFoundError('Order not found');
      // Continue with normal payment collection at the discounted total
      // by replacing `order` reference — done by reassigning data flow below
      // We return early so the waiter must re-submit payment after seeing the discounted total
      return serializeOrder(discountedOrder);
    }

    // Validate credit accounts exist, are active, and won't exceed credit limit (fast-fail check)
    if (data.paymentMethod === PaymentMethod.HOUSE_ACCOUNT) {
      const account = await houseAccountRepository.findById(data.houseAccountId!);
      if (!account || !account.isActive) {
        throw new NotFoundError('House account not found or inactive');
      }
      if (account.creditLimit !== null) {
        const newBalance = new Prisma.Decimal(account.currentBalance).add(new Prisma.Decimal(order.total));
        if (newBalance.greaterThan(new Prisma.Decimal(account.creditLimit))) {
          throw new ConflictError(`Credit limit of KES ${account.creditLimit} would be exceeded`);
        }
      }

      // Authorization flow — always require holder approval for house account charges.
      // FCM notification is fire-and-forget; if the holder has no token registered,
      // the notification silently fails but the pending state still applies.
      // The holder (or a manager) must approve via the authorize page or the orders screen.
      const holderFcmToken = await authRepository.findFcmToken(account.userId);
      if (!holderFcmToken) {
        // Warn managers that the holder won't receive a push — they must approve manually.
        socketService.emitAuthBypassed(organizationId, {
          orderId,
          dailyNumber: order.dailyNumber,
          houseAccountId: data.houseAccountId!,
        });
      }

      await houseAccountAuthService.createAuthRequest(
        orderId,
        data.houseAccountId!,
        organizationId,
        actor,
      );
      // Return the order in AWAITING_AUTHORIZATION status — not yet closed
      const pendingOrder = await orderRepository.findById(orderId, organizationId);
      if (!pendingOrder) throw new NotFoundError('Order not found');
      return serializeOrder(pendingOrder);
    }

    if (data.paymentMethod === PaymentMethod.CORPORATE_ACCOUNT) {
      const account = await corporateAccountRepository.findById(data.corporateAccountId!);
      if (!account || !account.isActive) {
        throw new NotFoundError('Corporate account not found or inactive');
      }
      if (account.creditLimit !== null) {
        const newBalance = new Prisma.Decimal(account.currentBalance).add(new Prisma.Decimal(order.total));
        if (newBalance.greaterThan(new Prisma.Decimal(account.creditLimit))) {
          throw new ConflictError(`Credit limit of KES ${account.creditLimit} would be exceeded`);
        }
      }
    }

    if (data.paymentMethod === PaymentMethod.CUSTOMER_CREDIT) {
      const account = await customerCreditRepository.findById(data.customerCreditAccountId!, organizationId);
      if (!account || !account.isActive) {
        throw new NotFoundError('Customer credit account not found or inactive');
      }
      const newBalance = new Prisma.Decimal(account.currentBalance).add(new Prisma.Decimal(order.total));
      if (newBalance.greaterThan(new Prisma.Decimal(account.creditLimit))) {
        throw new ConflictError(`Credit limit of KES ${account.creditLimit} would be exceeded`);
      }
    }

    // For split payment, validate that amounts sum to the order total
    if (data.paymentMethod === PaymentMethod.SPLIT) {
      const orderTotal = Number(order.total);
      const splitTotal = (data.mpesaAmount ?? 0) + (data.cashAmount ?? 0) + (data.cardAmount ?? 0);
      // Allow a 1 KES tolerance for decimal rounding
      if (Math.abs(splitTotal - orderTotal) > 1) {
        throw new ValidationError(
          `Split amounts (${splitTotal.toFixed(2)}) must equal the order total (${orderTotal.toFixed(2)})`,
        );
      }
    }

    let updated;
    try {
      updated = await orderRepository.recordPayment(orderId, organizationId, {
        paymentMethod: data.paymentMethod,
        mpesaCode: data.mpesaCode ?? null,
        mpesaAmount: data.paymentMethod === PaymentMethod.SPLIT ? (data.mpesaAmount ?? null) : null,
        cashAmount: data.paymentMethod === PaymentMethod.SPLIT ? (data.cashAmount ?? null) : null,
        cardAmount: data.paymentMethod === PaymentMethod.SPLIT ? (data.cardAmount ?? null) : null,
        splitType: data.paymentMethod === PaymentMethod.SPLIT ? (data.splitType ?? null) : null,
        houseAccountId: data.houseAccountId ?? null,
        corporateAccountId: data.corporateAccountId ?? null,
        corporateEmployeeRef: data.corporateEmployeeRef ?? null,
        customerCreditAccountId: data.customerCreditAccountId ?? null,
      });
    } catch (err) {
      if (err instanceof Error && err.message === 'CREDIT_LIMIT_EXCEEDED') {
        throw new ConflictError('Credit limit would be exceeded by this order');
      }
      throw err;
    }
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

  /**
   * Manager-only: remove specific order items from any PENDING / IN_PROGRESS / READY order.
   *
   * Rules:
   * - CLOSED / CANCELLED orders are immutable.
   * - Removing all items cancels the order instead of leaving an empty order.
   * - Tickets for removed items are voided (status → REJECTED) regardless of whether
   *   they are IN_PROGRESS or READY — manager has override authority.
   * - A READY order is reopened to IN_PROGRESS when any unresolved tickets remain.
   * - Totals are recalculated atomically.
   * - Every call is logged to IncidentLog as ORDER_ITEM_REMOVED with the reason.
   */
  managerRemoveItems: async (
    orderId: string,
    data: ManagerRemoveItemsInput,
    actor: Actor,
  ): Promise<OrderRecord> => {
    if (actor.role !== 'MANAGER') {
      throw new ForbiddenError('Only managers can use this endpoint');
    }

    const organizationId = resolveOrganizationId(actor);
    const order = await orderRepository.findById(orderId, organizationId);
    if (!order) {
      throw new NotFoundError('Order not found');
    }

    if (order.status === OrderStatus.CLOSED || order.status === OrderStatus.CANCELLED) {
      throw new ConflictError('Closed or cancelled orders cannot be modified.');
    }

    // Validate that every ID in removeItemIds actually belongs to this order
    const orderItemIds = new Set(order.items.map((i) => i.id));
    for (const id of data.removeItemIds) {
      if (!orderItemIds.has(id)) {
        throw new ValidationError(`Item ${id} does not belong to this order`);
      }
    }

    const removeSet = new Set(data.removeItemIds);
    const remainingItems = order.items.filter((i) => !removeSet.has(i.id));

    // If removing everything — cancel the order instead
    if (remainingItems.length === 0) {
      const cancelReason = `Manager edit: all items removed — ${data.reason}`;
      const cancelled = await orderRepository.cancel(
        orderId,
        organizationId,
        [OrderStatus.PENDING, OrderStatus.IN_PROGRESS, OrderStatus.READY],
        cancelReason,
        actor.id,
      );
      if (!cancelled) {
        throw new ConflictError('Order could not be cancelled. Please refresh and try again.');
      }

      const serialized = serializeOrder(cancelled);
      const stations = order.prepTickets.map((t) => t.station);
      socketService.emitOrderForceCancelled(organizationId, stations, order.createdById, {
        orderId: serialized.id,
        dailyNumber: serialized.dailyNumber,
        cancelledBy: actor.id,
      });
      void fcmService.sendOrderForceCancelledPush(order.createdById, {
        orderId: serialized.id,
        dailyNumber: serialized.dailyNumber,
      });

      incidentService.log({
        organizationId,
        orderId,
        type: 'ORDER_ITEM_REMOVED',
        actorId: actor.id,
        details: {
          dailyNumber: serialized.dailyNumber,
          reason: data.reason,
          removedItems: order.items
            .filter((i) => removeSet.has(i.id))
            .map((i) => ({ name: i.menuItem.name, quantity: i.quantity })),
          resultedInCancellation: true,
        },
      });

      return serialized;
    }

    // Build the new totals from remaining items
    const newSubtotal = remainingItems.reduce(
      (acc, item) => acc.add(new Prisma.Decimal(item.subtotal)),
      new Prisma.Decimal(0),
    );
    const newTotal = newSubtotal.add(new Prisma.Decimal(order.deliveryFee));

    // Build a helper to map a ticket to its item key (same logic as updateItems)
    const getTicketItemKey = (ticket: FullOrderPrismaRecord['prepTickets'][number]): string => {
      const parsed = parsePrepTicketItems(ticket.items as Prisma.JsonValue);
      const first = parsed[0];
      if (!first) return ticket.id;
      return JSON.stringify([first.menuItemId ?? '', first.notes ?? null]);
    };

    // For each removed item, build the key and find matching tickets to void
    const removedItems = order.items.filter((i) => removeSet.has(i.id));

    const ticketUpdates: Array<{
      ticketId: string;
      station: PrepStation;
      status: PrepTicketStatus;
      items: PrepTicketItemSnapshot[];
      rejectedReason: string;
    }> = [];

    const voidedTicketIds = new Set<string>();

    for (const removedItem of removedItems) {
      const itemKey = JSON.stringify([removedItem.menuItemId, removedItem.notes ?? null]);

      for (const ticket of order.prepTickets) {
        if (getTicketItemKey(ticket) === itemKey && !voidedTicketIds.has(ticket.id)) {
          // Manager can void any status except already-REJECTED tickets
          if (ticket.status !== PrepTicketStatus.REJECTED) {
            ticketUpdates.push({
              ticketId: ticket.id,
              station: ticket.station,
              status: PrepTicketStatus.REJECTED,
              items: [],
              rejectedReason: `Manager removed: ${data.reason}`,
            });
            voidedTicketIds.add(ticket.id);
          }
          break;
        }
      }
    }

    // After voiding, determine the correct order status based on remaining tickets.
    // A ticket is "resolved" if it is READY (not PENDING or IN_PROGRESS).
    // Voided tickets are excluded — they no longer count toward order readiness.
    const remainingTickets = order.prepTickets.filter((t) => !voidedTicketIds.has(t.id));
    const hasUnresolvedTickets = remainingTickets.some(
      (t) => t.status === PrepTicketStatus.PENDING || t.status === PrepTicketStatus.IN_PROGRESS,
    );
    const allRemainingReady =
      remainingTickets.length > 0 &&
      remainingTickets.every((t) => t.status === PrepTicketStatus.READY);

    // Three outcomes:
    // 1. All remaining tickets are READY → promote to READY (covers IN_PROGRESS orders where
    //    the only unresolved tickets were the ones just voided by the manager)
    // 2. Order was READY but voiding revealed unresolved tickets → reopen to IN_PROGRESS
    // 3. Otherwise → keep current status
    const targetStatus: OrderStatus | null = allRemainingReady
      ? OrderStatus.READY
      : order.status === OrderStatus.READY && hasUnresolvedTickets
        ? OrderStatus.IN_PROGRESS
        : null;

    // Build the new item list for the repository
    const newItemDtos = remainingItems.map((item) => ({
      menuItemId: item.menuItemId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: item.subtotal,
      notes: item.notes,
    }));

    const updatedOrder = await orderRepository.managerUpdateItems(
      orderId,
      organizationId,
      newItemDtos,
      { subtotal: newSubtotal, total: newTotal },
      { voidTicketUpdates: ticketUpdates, actorId: actor.id, targetStatus },
    );

    if (!updatedOrder) {
      throw new ConflictError('Order could not be updated. Please refresh and try again.');
    }

    const serialized = serializeOrder(updatedOrder);

    // Notify kitchen/barista of voided tickets
    if (ticketUpdates.length > 0) {
      const voidedSerialised = serialized.prepTickets.filter((t) => voidedTicketIds.has(t.id));
      if (voidedSerialised.length > 0) {
        socketService.emitOrderModified(organizationId, voidedSerialised);
      }
    }

    // If voiding the removed tickets caused the order to become fully READY,
    // notify waiters/managers so the order card updates to READY
    if (targetStatus === OrderStatus.READY) {
      socketService.emitOrderAllReady(order.createdById, {
        orderId: serialized.id,
        dailyNumber: serialized.dailyNumber,
      });
    }

    incidentService.log({
      organizationId,
      orderId,
      type: 'ORDER_ITEM_REMOVED',
      actorId: actor.id,
      details: {
        dailyNumber: serialized.dailyNumber,
        reason: data.reason,
        removedItems: removedItems.map((i) => ({ name: i.menuItem.name, quantity: i.quantity })),
        previousStatus: order.status,
        resultedInCancellation: false,
      },
    });

    return serialized;
  },
};





