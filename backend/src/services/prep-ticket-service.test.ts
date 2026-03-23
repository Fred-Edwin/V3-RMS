import type { PrepTicketStatus } from '@prisma/client';
import type { Request } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { orderRepository } from '../repositories/order-repository';
import { prepTicketRepository, type PrepTicketWithOrderRecord } from '../repositories/prep-ticket-repository';
import { socketService } from '../sockets/socket-service';
import { fcmService } from './fcm-service';
import { prepTicketService } from './prep-ticket-service';

vi.mock('../repositories/prep-ticket-repository', () => ({
  prepTicketRepository: {
    findByIdAndOrg: vi.fn(),
    findByStation: vi.fn(),
    claim: vi.fn(),
    markReady: vi.fn(),
    findAllByOrder: vi.fn(),
    reject: vi.fn(),
    unclaim: vi.fn(),
  },
}));

vi.mock('../repositories/order-repository', () => ({
  orderRepository: {
    findById: vi.fn(),
    updateStatus: vi.fn(),
  },
}));

vi.mock('../repositories/staff-repository', () => ({
  staffRepository: {
    findById: vi.fn(),
    findByIdOnShift: vi.fn(),
  },
}));

vi.mock('../sockets/socket-service', () => ({
  socketService: {
    emitOrderClaimed: vi.fn(),
    emitOrderReady: vi.fn(),
    emitOrderAllReady: vi.fn(),
    emitTicketRejected: vi.fn(),
    emitTicketUnclaimed: vi.fn(),
  },
}));

vi.mock('./fcm-service', () => ({
  fcmService: {
    sendOrderReadyPush: vi.fn(),
  },
}));

vi.mock('./incident-service', () => ({
  incidentService: {
    log: vi.fn(),
  },
}));

vi.mock('./inventory-service', () => ({
  inventoryService: {
    deductStockForPrepTicket: vi.fn().mockResolvedValue({ newQty: 10, isLowStock: false, isOutOfStock: false }),
  },
}));

vi.mock('../config/database', () => ({
  prisma: {
    $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn({})),
  },
}));

vi.mock('../sockets/socket', () => ({
  getSocketServer: vi.fn(() => ({ to: vi.fn(() => ({ emit: vi.fn() })) })),
  branchRoomName: vi.fn((id: string) => `org:${id}`),
}));

const organizationId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const chefActor = {
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  role: 'CHEF',
  organizationId,
} as NonNullable<Request['user']>;

const otherChefActor = {
  id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  role: 'CHEF',
  organizationId,
} as NonNullable<Request['user']>;

const kitchenDisplayActor = {
  id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  role: 'KITCHEN_DISPLAY',
  organizationId,
} as NonNullable<Request['user']>;

const buildTicket = (
  overrides: Partial<PrepTicketWithOrderRecord> = {},
  status: PrepTicketStatus = 'IN_PROGRESS',
): PrepTicketWithOrderRecord => {
  return {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    organizationId,
    orderId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
    station: 'KITCHEN',
    status,
    claimedById: chefActor.id,
    claimedAt: new Date('2026-03-06T10:00:00.000Z'),
    readyAt: null,
    items: [],
    createdAt: new Date('2026-03-06T09:55:00.000Z'),
    updatedAt: new Date('2026-03-06T10:00:00.000Z'),
    rejectedAt: null,
    rejectedById: null,
    rejectedReason: null,
    claimedBy: {
      id: chefActor.id,
      name: 'Chef One',
    },
    order: {
      id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      dailyNumber: 12,
      type: 'DINE_IN',
      tableNumber: '9',
      notes: null,
      createdById: '99999999-9999-4999-8999-999999999999',
      createdBy: { id: '99999999-9999-4999-8999-999999999999', name: 'Test Waiter' },
    },
    ...overrides,
  } as PrepTicketWithOrderRecord;
};

describe('prepTicketService ownership enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows the assigned chef to mark their own ticket ready', async () => {
    const ticket = buildTicket();
    const readyTicket = buildTicket({ status: 'READY', readyAt: new Date('2026-03-06T10:08:00.000Z') }, 'READY');

    vi.mocked(prepTicketRepository.findByIdAndOrg).mockResolvedValue(ticket);
    vi.mocked(prepTicketRepository.markReady).mockResolvedValue(readyTicket);
    vi.mocked(prepTicketRepository.findAllByOrder).mockResolvedValue([readyTicket]);
    vi.mocked(orderRepository.updateStatus).mockResolvedValue(null);

    const result = await prepTicketService.markReady(ticket.id, chefActor);

    expect(result.status).toBe('READY');
    expect(prepTicketRepository.markReady).toHaveBeenCalledWith(ticket.id, organizationId, {});
    expect(socketService.emitOrderReady).toHaveBeenCalled();
    expect(socketService.emitOrderAllReady).toHaveBeenCalled();
    expect(fcmService.sendOrderReadyPush).toHaveBeenCalled();
  });

  it('blocks a different chef from marking another chefs ticket ready', async () => {
    const ticket = buildTicket();

    vi.mocked(prepTicketRepository.findByIdAndOrg).mockResolvedValue(ticket);

    await expect(prepTicketService.markReady(ticket.id, otherChefActor)).rejects.toMatchObject({
      statusCode: 409,
      code: 'TICKET_ASSIGNED_TO_OTHER_STAFF',
      message: 'This ticket is assigned to Chef One.',
      details: {
        claimedById: chefActor.id,
        claimedByName: 'Chef One',
      },
    });

    expect(prepTicketRepository.markReady).not.toHaveBeenCalled();
    expect(socketService.emitOrderReady).not.toHaveBeenCalled();
  });

  it('still allows the shared kitchen display account to mark a claimed ticket ready', async () => {
    const ticket = buildTicket();
    const readyTicket = buildTicket({ status: 'READY', readyAt: new Date('2026-03-06T10:08:00.000Z') }, 'READY');

    vi.mocked(prepTicketRepository.findByIdAndOrg).mockResolvedValue(ticket);
    vi.mocked(prepTicketRepository.markReady).mockResolvedValue(readyTicket);
    vi.mocked(prepTicketRepository.findAllByOrder).mockResolvedValue([readyTicket]);
    vi.mocked(orderRepository.updateStatus).mockResolvedValue(null);

    const result = await prepTicketService.markReady(ticket.id, kitchenDisplayActor);

    expect(result.status).toBe('READY');
    expect(prepTicketRepository.markReady).toHaveBeenCalledWith(ticket.id, organizationId, {});
  });
});
