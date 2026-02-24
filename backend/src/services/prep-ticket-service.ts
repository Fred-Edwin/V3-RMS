import { OrderStatus, PrepTicketStatus, type PrepStation, type UserRole, type Prisma } from '@prisma/client';
import type { Request } from 'express';
import { orderRepository } from '../repositories/order-repository';
import { prepTicketRepository, type PrepTicketWithOrderRecord } from '../repositories/prep-ticket-repository';
import { staffRepository } from '../repositories/staff-repository';
import { socketService } from '../sockets/socket-service';
import { fcmService } from './fcm-service';
import { env } from '../config/env';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';
import type { ClaimPrepTicketInput, PrepTicketQueryInput } from '../validators/order-schemas';

type Actor = NonNullable<Request['user']>;

interface PaginationMeta {
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

interface PrepTicketResponse {
  id: string;
  orderId: string;
  orderDailyNumber: number;
  orderType: PrepTicketWithOrderRecord['order']['type'];
  tableNumber: string | null;
  orderNotes: string | null;
  station: PrepStation;
  status: PrepTicketStatus;
  claimedBy: {
    id: string;
    name: string;
  } | null;
  claimedAt: Date | null;
  readyAt: Date | null;
  items: Array<{
    name: string;
    quantity: number;
    notes: string | null;
  }>;
  createdAt: Date;
}

const kitchenRoles: UserRole[] = ['CHEF', 'KITCHEN_DISPLAY'];
const baristaRoles: UserRole[] = ['BARISTA', 'BARISTA_DISPLAY'];

const resolveOrganizationId = (actor: Actor): string => {
  if (!actor.organizationId) {
    throw new ForbiddenError('Branch context missing for this user');
  }

  return actor.organizationId;
};

const resolveStation = (role: UserRole): PrepStation => {
  if (kitchenRoles.includes(role)) {
    return 'KITCHEN';
  }
  if (baristaRoles.includes(role)) {
    return 'BARISTA';
  }

  throw new ForbiddenError('Role cannot access prep tickets');
};

const parseDateOnlyStart = (date: string): Date => {
  const parts = date.split('-');
  const year = Number(parts[0] ?? '0');
  const month = Number(parts[1] ?? '1');
  const day = Number(parts[2] ?? '1');
  return new Date(year, month - 1, day);
};

const parseDateOnlyEnd = (date: string): Date => {
  const start = parseDateOnlyStart(date);
  return new Date(start.getFullYear(), start.getMonth(), start.getDate(), 23, 59, 59, 999);
};

const parsePrepTicketItems = (value: Prisma.JsonValue): PrepTicketResponse['items'] => {
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

const serializePrepTicket = (ticket: PrepTicketWithOrderRecord): PrepTicketResponse => {
  return {
    id: ticket.id,
    orderId: ticket.orderId,
    orderDailyNumber: ticket.order.dailyNumber,
    orderType: ticket.order.type,
    tableNumber: ticket.order.tableNumber,
    orderNotes: ticket.order.notes,
    station: ticket.station,
    status: ticket.status,
    claimedBy: ticket.claimedBy ? { id: ticket.claimedBy.id, name: ticket.claimedBy.name } : null,
    claimedAt: ticket.claimedAt,
    readyAt: ticket.readyAt,
    items: parsePrepTicketItems(ticket.items),
    createdAt: ticket.createdAt,
  };
};

export const prepTicketService = {
  getByStation: async (
    actor: Actor,
    query: PrepTicketQueryInput,
  ): Promise<{ tickets: PrepTicketResponse[]; pagination: PaginationMeta }> => {
    const organizationId = resolveOrganizationId(actor);
    const station = resolveStation(actor.role);

    const result = await prepTicketRepository.findByStation(organizationId, station, {
      status: query.status,
      startDate: query.startDate ? parseDateOnlyStart(query.startDate) : undefined,
      endDate: query.endDate ? parseDateOnlyEnd(query.endDate) : undefined,
      page: query.page,
      perPage: query.perPage,
    });

    return {
      tickets: result.tickets.map(serializePrepTicket),
      pagination: {
        total: result.total,
        page: query.page,
        perPage: query.perPage,
        totalPages: Math.max(1, Math.ceil(result.total / query.perPage)),
      },
    };
  },

  claim: async (
    ticketId: string,
    data: ClaimPrepTicketInput,
    actor: Actor,
  ): Promise<PrepTicketResponse> => {
    const organizationId = resolveOrganizationId(actor);
    const station = resolveStation(actor.role);

    const ticket = await prepTicketRepository.findByIdAndOrg(ticketId, organizationId);
    if (!ticket) {
      throw new NotFoundError('Prep ticket not found');
    }

    if (ticket.station !== station) {
      throw new ForbiddenError('Cannot claim a ticket from another station');
    }

    if (ticket.status !== PrepTicketStatus.PENDING) {
      throw new ConflictError('This order has already been claimed.');
    }

    const allowedRoles: UserRole[] = station === 'KITCHEN' ? ['CHEF'] : ['BARISTA'];
    let claimedByName: string;

    if (env.SKIP_SHIFT_VALIDATION) {
      const claimedBy = await staffRepository.findById(data.claimedById, organizationId, allowedRoles);
      if (!claimedBy || !claimedBy.isActive) {
        throw new ValidationError('claimedById must be active and valid for this station');
      }
      claimedByName = claimedBy.name;
    } else {
      const claimedBy = await staffRepository.findByIdOnShift(data.claimedById, organizationId, allowedRoles);
      if (!claimedBy) {
        throw new ValidationError('claimedById must be on shift and valid for this station');
      }
      claimedByName = claimedBy.name;
    }

    const claimedTicket = await prepTicketRepository.claim(ticketId, organizationId, data.claimedById);
    if (!claimedTicket) {
      throw new ConflictError('This order has already been claimed.');
    }

    const parentOrder = await orderRepository.findById(ticket.orderId, organizationId);
    if (parentOrder?.status === OrderStatus.PENDING) {
      await orderRepository.updateStatus(ticket.orderId, organizationId, OrderStatus.IN_PROGRESS);
    }

    socketService.emitOrderClaimed(ticket.order.createdById, {
      orderId: ticket.orderId,
      ticketId: claimedTicket.id,
      station: claimedTicket.station,
      claimedBy: {
        id: data.claimedById,
        name: claimedByName,
      },
    });

    return serializePrepTicket(claimedTicket);
  },

  markReady: async (ticketId: string, actor: Actor): Promise<PrepTicketResponse> => {
    const organizationId = resolveOrganizationId(actor);
    const station = resolveStation(actor.role);

    const ticket = await prepTicketRepository.findByIdAndOrg(ticketId, organizationId);
    if (!ticket) {
      throw new NotFoundError('Prep ticket not found');
    }

    if (ticket.station !== station) {
      throw new ForbiddenError('Cannot update a ticket from another station');
    }

    if (ticket.status !== PrepTicketStatus.IN_PROGRESS) {
      throw new ConflictError('This ticket is not in progress.');
    }

    const readyTicket = await prepTicketRepository.markReady(ticketId, organizationId);
    if (!readyTicket) {
      throw new ConflictError('This ticket is not in progress.');
    }

    socketService.emitOrderReady(ticket.order.createdById, {
      orderId: readyTicket.orderId,
      ticketId: readyTicket.id,
      station: readyTicket.station,
      dailyNumber: ticket.order.dailyNumber,
    });

    const allOrderTickets = await prepTicketRepository.findAllByOrder(readyTicket.orderId, organizationId);
    const allReady = allOrderTickets.every((entry) => entry.status === PrepTicketStatus.READY);

    if (allReady) {
      await orderRepository.updateStatus(readyTicket.orderId, organizationId, OrderStatus.READY);
      socketService.emitOrderAllReady(ticket.order.createdById, {
        orderId: readyTicket.orderId,
        dailyNumber: ticket.order.dailyNumber,
      });
      await fcmService.sendOrderReadyPush(ticket.order.createdById, {
        orderId: readyTicket.orderId,
        dailyNumber: ticket.order.dailyNumber,
      });
    }

    return serializePrepTicket(readyTicket);
  },
};
