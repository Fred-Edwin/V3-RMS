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
  AccountOrderInput,
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

    // Group requested items by station
    const requestedByStation = new Map<PrepStation, ResolvedOrderItem[]>();
    for (const item of resolvedItems) {
      const list = requestedByStation.get(item.category.prepStation) ?? [];
      list.push(item);
      requestedByStation.set(item.category.prepStation, list);
    }

    const existingStations = [...new Set(existingOrder.prepTickets.map((t) => t.station))];
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
    const existingTicketIds = new Set(existingOrder.prepTickets.map((t) => t.id));

    // Assigns occurrence-indexed keys to a list of items/tickets so that two lines of the
    // same item (e.g. Samosa tapped twice) are distinguishable: [id,notes,0] vs [id,notes,1].
    const occurrenceKeys = (items: Array<{ menuItemId: string; notes: string | null }>): string[] => {
      const counts = new Map<string, number>();
      return items.map(({ menuItemId, notes }) => {
        const base = JSON.stringify([menuItemId, notes ?? null]);
        const n = counts.get(base) ?? 0;
        counts.set(base, n + 1);
        return JSON.stringify([menuItemId, notes ?? null, n]);
      });
    };

    // Extract the first item from a ticket's JSON snapshot (each ticket has exactly one item).
    const ticketItem = (ticket: FullOrderPrismaRecord['prepTickets'][number]) => {
      const parsed = parsePrepTicketItems(ticket.items as Prisma.JsonValue);
      return parsed[0] ?? null;
    };

    for (const station of allStations) {
      const requested = requestedByStation.get(station) ?? [];

      const stationTickets = existingOrder.prepTickets.filter((t) => t.station === station);
      const startedTickets = stationTickets.filter(
        (t) => t.status === PrepTicketStatus.IN_PROGRESS || t.status === PrepTicketStatus.READY,
      );
      const editableTickets = stationTickets.filter(
        (t) => t.status === PrepTicketStatus.PENDING || t.status === PrepTicketStatus.REJECTED,
      );

      // Build occurrence-indexed key maps for existing tickets and the incoming request.
      // Tickets use their first item's menuItemId+notes as identity.
      const startedKeys = occurrenceKeys(
        startedTickets.map((t) => ({ menuItemId: ticketItem(t)?.menuItemId ?? t.id, notes: ticketItem(t)?.notes ?? null })),
      );
      const editableKeys = occurrenceKeys(
        editableTickets.map((t) => ({ menuItemId: ticketItem(t)?.menuItemId ?? t.id, notes: ticketItem(t)?.notes ?? null })),
      );
      const requestedKeys = occurrenceKeys(
        requested.map((item) => ({ menuItemId: item.menuItemId, notes: item.notes })),
      );

      // Map from occurrence key → ticket for fast lookup
      const editableByKey = new Map(editableTickets.map((t, i) => [editableKeys[i]!, t]));

      if (startedTickets.length > 0) {
        // Station has started work — only additions are allowed.
        // Use order items (not tickets) as the source of truth for what has been committed,
        // so corrupt duplicate tickets from historical bugs don't inflate the count.
        const committedQty = new Map<string, number>();
        for (const oi of existingOrder.items) {
          if (oi.menuItem.category.prepStation !== station) continue;
          const base = JSON.stringify([oi.menuItemId, oi.notes ?? null]);
          committedQty.set(base, (committedQty.get(base) ?? 0) + oi.quantity);
        }
        const requestedQty = new Map<string, number>();
        for (const item of requested) {
          const base = JSON.stringify([item.menuItemId, item.notes ?? null]);
          requestedQty.set(base, (requestedQty.get(base) ?? 0) + item.quantity);
        }
        for (const [base, qty] of committedQty) {
          if ((requestedQty.get(base) ?? 0) < qty) {
            throw new ConflictError(
              'Order cannot be modified. Preparation has already started at one or more stations.',
            );
          }
        }

        // Create one ticket per requested item line that doesn't already have a ticket.
        // "Already has a ticket" means its occurrence key matches an existing ticket key.
        // Track new occurrences created per base key so the stepper pass below doesn't double-count.
        const allExistingKeys = new Set([...startedKeys, ...editableKeys]);
        const newOccurrenceQtyByBase = new Map<string, number>();
        for (let i = 0; i < requested.length; i++) {
          if (!allExistingKeys.has(requestedKeys[i]!)) {
            const item = requested[i]!;
            ticketCreates.push({
              station,
              items: [{ menuItemId: item.menuItemId, name: item.name, quantity: item.quantity, notes: item.notes }],
            });
            const base = JSON.stringify([item.menuItemId, item.notes ?? null]);
            newOccurrenceQtyByBase.set(base, (newOccurrenceQtyByBase.get(base) ?? 0) + item.quantity);
          }
        }

        // Stepper case: waiter sent qty=2 on a single line for an item that already has
        // one ticket of qty=1. The occurrence-key loop above won't create a ticket because
        // occurrence [id,null,0] already exists. Compare total requested vs total existing
        // qty per base key and create one extra ticket per additional unit.
        // Subtract any qty already created by the occurrence loop to avoid double-counting.
        const existingQtyByBase = new Map<string, number>();
        for (const t of stationTickets) {
          const first = ticketItem(t);
          if (!first) continue;
          const base = JSON.stringify([first.menuItemId ?? '', first.notes ?? null]);
          existingQtyByBase.set(base, (existingQtyByBase.get(base) ?? 0) + first.quantity);
        }
        const requestedQtyByBase = new Map<string, { item: ResolvedOrderItem; qty: number }>();
        for (const item of requested) {
          const base = JSON.stringify([item.menuItemId, item.notes ?? null]);
          const prev = requestedQtyByBase.get(base);
          requestedQtyByBase.set(base, { item, qty: (prev?.qty ?? 0) + item.quantity });
        }
        for (const [base, { item, qty }] of requestedQtyByBase) {
          const existing = existingQtyByBase.get(base) ?? 0;
          if (existing === 0) continue; // fully new item — already handled above
          const alreadyCreated = newOccurrenceQtyByBase.get(base) ?? 0;
          const extras = qty - existing - alreadyCreated;
          for (let e = 0; e < extras; e++) {
            ticketCreates.push({
              station,
              items: [{ menuItemId: item.menuItemId, name: item.name, quantity: 1, notes: item.notes }],
            });
          }
        }

        continue;
      }

      // Station not yet started — full reconciliation.
      // Match requested lines to editable tickets by occurrence key.
      // Unmatched requested lines → new tickets.
      // Unmatched editable tickets → rejected.
      // Stepper increase (qty > existing ticket qty) → keep existing ticket + new tickets for extra units.
      const matchedEditableIds = new Set<string>();

      for (let i = 0; i < requested.length; i++) {
        const item = requested[i]!;
        const existingTicket = editableByKey.get(requestedKeys[i]!);

        if (existingTicket) {
          matchedEditableIds.add(existingTicket.id);
          const existingQty = ticketItem(existingTicket)?.quantity ?? 1;
          // Existing ticket keeps its original quantity — extra units each get their own ticket.
          ticketUpdates.push({
            ticketId: existingTicket.id,
            station,
            status: PrepTicketStatus.PENDING,
            items: [{ menuItemId: item.menuItemId, name: item.name, quantity: existingQty, notes: item.notes }],
            clearRejection: existingTicket.status === PrepTicketStatus.REJECTED,
          });
          for (let extra = item.quantity - existingQty; extra > 0; extra--) {
            ticketCreates.push({
              station,
              items: [{ menuItemId: item.menuItemId, name: item.name, quantity: 1, notes: item.notes }],
            });
          }
        } else {
          ticketCreates.push({
            station,
            items: [{ menuItemId: item.menuItemId, name: item.name, quantity: item.quantity, notes: item.notes }],
          });
        }
      }

      // Reject editable tickets whose item line was removed
      for (const ticket of editableTickets) {
        if (!matchedEditableIds.has(ticket.id) && ticket.status === PrepTicketStatus.PENDING) {
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
    // Voided and REJECTED tickets are excluded — they no longer count toward order readiness.
    const remainingTickets = order.prepTickets.filter(
      (t) => !voidedTicketIds.has(t.id) && t.status !== PrepTicketStatus.REJECTED,
    );
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

  accountOrder: async (
    orderId: string,
    data: AccountOrderInput,
    actor: Actor,
    branchId?: string,
  ): Promise<OrderRecord> => {
    if (actor.role !== 'ACCOUNTANT' && actor.role !== 'SYSTEM_ADMIN') {
      throw new ForbiddenError('Only accountants can account for orders');
    }

    const organizationId = resolveOrganizationId(actor, branchId);
    const order = await orderRepository.findById(orderId, organizationId);
    if (!order) throw new NotFoundError('Order not found');

    if (order.status === OrderStatus.CLOSED || order.status === OrderStatus.CANCELLED) {
      throw new ConflictError('Order is already closed or cancelled');
    }

    const accounted = await orderRepository.accountOrder(orderId, organizationId, {
      paymentMethod: data.paymentMethod,
      mpesaCode: data.mpesaCode ?? null,
      mpesaAmount: data.paymentMethod === PaymentMethod.SPLIT ? (data.mpesaAmount ?? null) : null,
      cashAmount: data.paymentMethod === PaymentMethod.SPLIT ? (data.cashAmount ?? null) : null,
      cardAmount: data.paymentMethod === PaymentMethod.SPLIT ? (data.cardAmount ?? null) : null,
      splitType: data.paymentMethod === PaymentMethod.SPLIT ? (data.splitType ?? null) : null,
    });

    if (!accounted) throw new ConflictError('Order could not be accounted. Please refresh and try again.');

    const serialized = serializeOrder(accounted);

    incidentService.log({
      organizationId,
      orderId,
      type: 'ORDER_STALE',
      actorId: actor.id,
      details: {
        dailyNumber: serialized.dailyNumber,
        action: 'accounted_by_accountant',
        paymentMethod: data.paymentMethod,
        note: data.note ?? null,
      },
    });

    return serialized;
  },
};

