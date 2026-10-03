import { OrderStatus, Prisma } from '@prisma/client';
import type { Request } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { orderCancellationRequestRepository } from '../repositories/order-cancellation-request-repository';
import { orderRepository, type FullOrderPrismaRecord } from '../repositories/order-repository';
import { socketService } from '../sockets/socket-service';
import { incidentService } from './incident-service';
import { orderCancellationAuthService } from './order-cancellation-auth-service';

vi.mock('../repositories/order-cancellation-request-repository', () => ({
  orderCancellationRequestRepository: {
    createPendingForOrder: vi.fn(),
    findById: vi.fn(),
    findPendingByOrderId: vi.fn(),
    findPendingBySite: vi.fn(),
    resolveIfPending: vi.fn(),
  },
}));

vi.mock('../repositories/order-repository', () => ({
  orderRepository: {
    findById: vi.fn(),
  },
}));

vi.mock('../sockets/socket-service', () => ({
  socketService: {
    emitOrderCancellationPending: vi.fn(),
    emitOrderCancellationResolved: vi.fn(),
    emitOrderCancelled: vi.fn(),
    emitOrderForceCancelled: vi.fn(),
  },
}));

vi.mock('./incident-service', () => ({
  incidentService: {
    log: vi.fn(),
  },
}));

const siteId = '11111111-1111-4111-8111-111111111111';
const orderId = '33333333-3333-4333-8333-333333333333';
const authRequestId = '77777777-7777-4777-8777-777777777777';

const waiterActor = {
  id: '22222222-2222-4222-8222-222222222222',
  role: 'WAITER',
  siteId,
} as NonNullable<Request['user']>;

const managerActor = {
  id: '55555555-5555-4555-8555-555555555555',
  role: 'MANAGER',
  siteId,
} as NonNullable<Request['user']>;

const otherBranchManagerActor = {
  id: '66666666-6666-4666-8666-666666666666',
  role: 'MANAGER',
  siteId: '99999999-9999-4999-8999-999999999999',
} as NonNullable<Request['user']>;

const buildOrder = (status: OrderStatus = OrderStatus.IN_PROGRESS): FullOrderPrismaRecord => ({
  id: orderId,
  siteId,
  dailyNumber: 8,
  orderDate: new Date('2026-05-13T00:00:00.000Z'),
  type: 'DINE_IN',
  status,
  tableNumber: '5',
  notes: null,
  subtotal: new Prisma.Decimal('850.00'),
  deliveryFee: new Prisma.Decimal('0.00'),
  total: new Prisma.Decimal('850.00'),
  paymentMethod: null,
  mpesaCode: null,
  mpesaAmount: null,
  cashAmount: null,
  cardAmount: null,
  splitType: null,
  paidAt: null,
  cancelReason: null,
  cancelledById: null,
  closedAt: null,
  deliveryZoneId: null,
  houseAccountId: null,
  corporateAccountId: null,
  corporateEmployeeRef: null,
  customerCreditAccountId: null,
  discountPercent: null,
  discountAmount: null,
  discountedById: null,
  discountId: null,
  createdById: waiterActor.id,
  createdAt: new Date('2026-05-13T10:00:00.000Z'),
  updatedAt: new Date('2026-05-13T10:00:00.000Z'),
  createdBy: { id: waiterActor.id, name: 'Waiter One' },
  cancelledBy: null,
  deliveryZone: null,
  items: [],
  prepTickets: [
    {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      orderId,
      siteId,
      station: 'BARISTA',
      sequence: 1,
      status: 'IN_PROGRESS',
      claimedById: null,
      claimedAt: null,
      readyAt: null,
      rejectedById: null,
      rejectedReason: null,
      rejectedAt: null,
      items: [],
      createdAt: new Date('2026-05-13T10:00:00.000Z'),
      updatedAt: new Date('2026-05-13T10:00:00.000Z'),
      claimedBy: null,
      rejectedBy: null,
    },
  ],
  modificationRequests: [],
  incidents: [],
  printJobs: [],
  houseAuthRequests: [],
  staffDiscountAuthRequests: [],
  customerDiscountAuthRequests: [],
  splitPaymentLines: [],
} as unknown as FullOrderPrismaRecord);

const buildRequest = (status: 'PENDING' | 'APPROVED' | 'REJECTED' = 'PENDING') => ({
  id: authRequestId,
  siteId,
  orderId,
  requestedById: waiterActor.id,
  reason: 'Customer left',
  reasonDetail: null,
  previousStatus: OrderStatus.IN_PROGRESS,
  status,
  resolvedById: status === 'PENDING' ? null : managerActor.id,
  resolvedAt: status === 'PENDING' ? null : new Date('2026-05-13T10:05:00.000Z'),
  resolutionNote: null,
  createdAt: new Date('2026-05-13T10:01:00.000Z'),
  updatedAt: new Date('2026-05-13T10:01:00.000Z'),
  order: {
    id: orderId,
    dailyNumber: 8,
    status: status === 'APPROVED' ? OrderStatus.CANCELLED : OrderStatus.AWAITING_CANCELLATION_APPROVAL,
    total: new Prisma.Decimal('850.00'),
  },
  requestedBy: { id: waiterActor.id, name: 'Waiter One' },
  resolvedBy: status === 'PENDING' ? null : { id: managerActor.id, name: 'Manager One' },
});

describe('orderCancellationAuthService.createRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a pending cancellation request for own active order', async () => {
    const order = buildOrder();
    const request = buildRequest();

    vi.mocked(orderRepository.findById).mockResolvedValue(order);
    vi.mocked(orderCancellationRequestRepository.findPendingByOrderId).mockResolvedValue(null);
    vi.mocked(orderCancellationRequestRepository.createPendingForOrder).mockResolvedValue(request);

    const result = await orderCancellationAuthService.createRequest(
      orderId,
      'Customer left',
      null,
      waiterActor,
    );

    expect(orderCancellationRequestRepository.createPendingForOrder).toHaveBeenCalledWith({
      siteId,
      orderId,
      requestedById: waiterActor.id,
      reason: 'Customer left',
      reasonDetail: null,
      previousStatus: OrderStatus.IN_PROGRESS,
    });
    expect(socketService.emitOrderCancellationPending).toHaveBeenCalledWith(
      waiterActor.id,
      siteId,
      expect.objectContaining({ orderId, dailyNumber: 8, authRequestId }),
    );
    expect(result.status).toBe('PENDING');
  });

  it('rejects cancellation requests for another waiter order', async () => {
    vi.mocked(orderRepository.findById).mockResolvedValue({
      ...buildOrder(),
      createdById: 'different-user',
    } as unknown as FullOrderPrismaRecord);

    await expect(
      orderCancellationAuthService.createRequest(orderId, 'Customer left', null, waiterActor),
    ).rejects.toThrow('Only the waiter who created this order can request cancellation');
  });

  it('rejects duplicate pending cancellation requests', async () => {
    vi.mocked(orderRepository.findById).mockResolvedValue(buildOrder());
    vi.mocked(orderCancellationRequestRepository.findPendingByOrderId).mockResolvedValue(buildRequest());

    await expect(
      orderCancellationAuthService.createRequest(orderId, 'Customer left', null, waiterActor),
    ).rejects.toThrow('already pending');
  });
});

describe('orderCancellationAuthService.override', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects cross-branch manager approval', async () => {
    vi.mocked(orderCancellationRequestRepository.findById).mockResolvedValue(buildRequest());

    await expect(
      orderCancellationAuthService.override(authRequestId, 'APPROVED', otherBranchManagerActor, null),
    ).rejects.toThrow('Access denied');
  });

  it('approves a pending cancellation request and emits cancellation events', async () => {
    const request = buildRequest();
    vi.mocked(orderCancellationRequestRepository.findById).mockResolvedValue(request);
    vi.mocked(orderCancellationRequestRepository.resolveIfPending).mockResolvedValue(buildRequest('APPROVED'));
    vi.mocked(orderRepository.findById).mockResolvedValue(buildOrder(OrderStatus.CANCELLED));

    const result = await orderCancellationAuthService.override(authRequestId, 'APPROVED', managerActor, null);

    expect(orderCancellationRequestRepository.resolveIfPending).toHaveBeenCalledWith(
      expect.objectContaining({
        id: authRequestId,
        siteId,
        decision: 'APPROVED',
        resolvedById: managerActor.id,
      }),
    );
    expect(socketService.emitOrderForceCancelled).toHaveBeenCalled();
    expect(socketService.emitOrderCancellationResolved).toHaveBeenCalledWith(
      waiterActor.id,
      siteId,
      expect.objectContaining({ orderId, approved: true }),
    );
    expect(incidentService.log).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'ORDER_CANCELLED', actorId: managerActor.id }),
    );
    expect(result.status).toBe('APPROVED');
  });

  it('rejects a pending cancellation request and restores the previous status', async () => {
    const request = buildRequest();
    vi.mocked(orderCancellationRequestRepository.findById).mockResolvedValue(request);
    vi.mocked(orderCancellationRequestRepository.resolveIfPending).mockResolvedValue(buildRequest('REJECTED'));

    const result = await orderCancellationAuthService.override(authRequestId, 'REJECTED', managerActor, 'Serve it');

    expect(socketService.emitOrderCancellationResolved).toHaveBeenCalledWith(
      waiterActor.id,
      siteId,
      expect.objectContaining({
        orderId,
        approved: false,
        restoredStatus: OrderStatus.IN_PROGRESS,
      }),
    );
    expect(incidentService.log).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'ORDER_CANCELLATION_REJECTED', actorId: managerActor.id }),
    );
    expect(result.status).toBe('REJECTED');
  });
});
