import { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { staffDiscountAuthRequestRepository } from '../repositories/staff-discount-auth-request-repository';
import { orderRepository } from '../repositories/order-repository';
import { socketService } from '../sockets/socket-service';
import { fcmService } from './fcm-service';
import type { FullOrderPrismaRecord } from '../repositories/order-repository';
import { staffDiscountAuthService } from './staff-discount-auth-service';

vi.mock('../repositories/staff-discount-auth-request-repository', () => ({
  staffDiscountAuthRequestRepository: {
    create: vi.fn(),
    findById: vi.fn(),
    findPendingByOrderId: vi.fn(),
    findPendingByOrganization: vi.fn(),
    findAllPending: vi.fn(),
    resolveIfPending: vi.fn(),
    cancelIfPending: vi.fn(),
  },
}));

vi.mock('../repositories/order-repository', () => ({
  orderRepository: {
    findById: vi.fn(),
    updateStatus: vi.fn(),
    applyDiscount: vi.fn(),
  },
}));

vi.mock('../sockets/socket-service', () => ({
  socketService: {
    emitStaffDiscountAuthPending: vi.fn(),
    emitStaffDiscountAuthResolved: vi.fn(),
  },
}));

vi.mock('./fcm-service', () => ({
  fcmService: {
    sendStaffDiscountAuthPushToDirectors: vi.fn().mockResolvedValue(undefined),
  },
}));

const organizationId = '11111111-1111-4111-8111-111111111111';
const orderId = '33333333-3333-4333-8333-333333333333';
const authRequestId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const waiterActor = {
  id: '22222222-2222-4222-8222-222222222222',
  role: 'WAITER',
  organizationId,
} as NonNullable<Request['user']>;

const managerActor = {
  id: '55555555-5555-4555-8555-555555555555',
  role: 'MANAGER',
  organizationId,
} as NonNullable<Request['user']>;

// Directors are system-level: no organizationId. They approve staff discounts for any branch.
const directorActor = {
  id: '77777777-7777-4777-8777-777777777777',
  role: 'DIRECTOR',
  organizationId: undefined,
} as unknown as NonNullable<Request['user']>;

const buildReadyOrder = (): FullOrderPrismaRecord => {
  return {
    id: orderId,
    organizationId,
    dailyNumber: 5,
    orderDate: new Date('2026-04-10T00:00:00.000Z'),
    type: 'DINE_IN',
    status: 'READY',
    tableNumber: '3',
    notes: null,
    subtotal: new Prisma.Decimal('1000.00'),
    deliveryFee: new Prisma.Decimal('0.00'),
    total: new Prisma.Decimal('1000.00'),
    paymentMethod: null,
    paidAt: null,
    closedAt: null,
    deliveryZoneId: null,
    discountPercent: null,
    discountAmount: null,
    discountedById: null,
    createdById: waiterActor.id,
    createdAt: new Date('2026-04-10T10:00:00.000Z'),
    updatedAt: new Date('2026-04-10T10:00:00.000Z'),
    createdBy: { id: waiterActor.id, name: 'Waiter One' },
    cancelledBy: null,
    deliveryZone: null,
    items: [],
    prepTickets: [],
  } as unknown as FullOrderPrismaRecord;
};

const buildPendingAuthRequest = () => ({
  id: authRequestId,
  organizationId,
  orderId,
  requestedById: waiterActor.id,
  discountPercent: new Prisma.Decimal('20'),
  originalAmount: new Prisma.Decimal('1000.00'),
  discountAmount: new Prisma.Decimal('200.00'),
  status: 'PENDING' as const,
  resolvedById: null,
  resolvedAt: null,
  createdAt: new Date('2026-04-10T10:01:00.000Z'),
  updatedAt: new Date('2026-04-10T10:01:00.000Z'),
  order: { id: orderId, dailyNumber: 5, total: new Prisma.Decimal('1000.00') },
  requestedBy: { id: waiterActor.id, name: 'Waiter One' },
  resolvedBy: null,
});

describe('staffDiscountAuthService.createAuthRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a pending auth request for own READY order', async () => {
    const readyOrder = buildReadyOrder();
    const pendingRequest = buildPendingAuthRequest();

    vi.mocked(orderRepository.findById).mockResolvedValue(readyOrder);
    vi.mocked(staffDiscountAuthRequestRepository.findPendingByOrderId).mockResolvedValue(null);
    vi.mocked(staffDiscountAuthRequestRepository.create).mockResolvedValue(pendingRequest);
    vi.mocked(orderRepository.updateStatus).mockResolvedValue(readyOrder);

    const result = await staffDiscountAuthService.createAuthRequest(orderId, organizationId, waiterActor);

    expect(staffDiscountAuthRequestRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId,
        orderId,
        requestedById: waiterActor.id,
        discountPercent: '20',
        originalAmount: '1000',
        discountAmount: '200',
      }),
    );
    expect(orderRepository.updateStatus).toHaveBeenCalledWith(orderId, organizationId, 'AWAITING_AUTHORIZATION');
    expect(socketService.emitStaffDiscountAuthPending).toHaveBeenCalledWith(
      waiterActor.id,
      organizationId,
      expect.objectContaining({ orderId, authRequestId, discountAmount: '200' }),
    );
    expect(result.status).toBe('PENDING');
    expect(result.discountAmount).toBe('200');
  });

  it('fires an FCM push to directors with the order, requester and amounts', async () => {
    const readyOrder = buildReadyOrder();
    const pendingRequest = buildPendingAuthRequest();

    vi.mocked(orderRepository.findById).mockResolvedValue(readyOrder);
    vi.mocked(staffDiscountAuthRequestRepository.findPendingByOrderId).mockResolvedValue(null);
    vi.mocked(staffDiscountAuthRequestRepository.create).mockResolvedValue(pendingRequest);
    vi.mocked(orderRepository.updateStatus).mockResolvedValue(readyOrder);

    await staffDiscountAuthService.createAuthRequest(orderId, organizationId, waiterActor);

    expect(fcmService.sendStaffDiscountAuthPushToDirectors).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId,
        dailyNumber: 5,
        requesterName: 'Waiter One',
        originalAmount: '1000',
        discountedAmount: '800',
      }),
    );
  });

  it('still succeeds when the director FCM push rejects', async () => {
    const readyOrder = buildReadyOrder();
    const pendingRequest = buildPendingAuthRequest();

    vi.mocked(orderRepository.findById).mockResolvedValue(readyOrder);
    vi.mocked(staffDiscountAuthRequestRepository.findPendingByOrderId).mockResolvedValue(null);
    vi.mocked(staffDiscountAuthRequestRepository.create).mockResolvedValue(pendingRequest);
    vi.mocked(orderRepository.updateStatus).mockResolvedValue(readyOrder);
    vi.mocked(fcmService.sendStaffDiscountAuthPushToDirectors).mockRejectedValueOnce(
      new Error('FCM unavailable'),
    );

    const result = await staffDiscountAuthService.createAuthRequest(orderId, organizationId, waiterActor);

    expect(result.status).toBe('PENDING');
  });

  it('throws NotFoundError when order does not exist', async () => {
    vi.mocked(orderRepository.findById).mockResolvedValue(null);

    await expect(
      staffDiscountAuthService.createAuthRequest(orderId, organizationId, waiterActor),
    ).rejects.toThrow('Order not found');
  });

  it('throws ConflictError when order is not in READY status', async () => {
    const order = { ...buildReadyOrder(), status: 'PENDING' as const };
    vi.mocked(orderRepository.findById).mockResolvedValue(order as unknown as FullOrderPrismaRecord);

    await expect(
      staffDiscountAuthService.createAuthRequest(orderId, organizationId, waiterActor),
    ).rejects.toThrow('Order must be in READY status');
  });

  it('throws ForbiddenError when actor is not the order creator', async () => {
    const order = { ...buildReadyOrder(), createdById: 'different-user-id' };
    vi.mocked(orderRepository.findById).mockResolvedValue(order as unknown as FullOrderPrismaRecord);

    await expect(
      staffDiscountAuthService.createAuthRequest(orderId, organizationId, waiterActor),
    ).rejects.toThrow('Staff discount can only be applied to your own orders');
  });

  it('throws ConflictError when a pending request already exists', async () => {
    vi.mocked(orderRepository.findById).mockResolvedValue(buildReadyOrder());
    vi.mocked(staffDiscountAuthRequestRepository.findPendingByOrderId).mockResolvedValue(
      buildPendingAuthRequest(),
    );

    await expect(
      staffDiscountAuthService.createAuthRequest(orderId, organizationId, waiterActor),
    ).rejects.toThrow('A staff discount approval request is already pending');
  });
});

describe('staffDiscountAuthService.managerApprove', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws ForbiddenError when actor is not a director', async () => {
    await expect(
      staffDiscountAuthService.managerApprove(authRequestId, 'APPROVED', waiterActor),
    ).rejects.toThrow('Only directors can approve');
  });

  it('throws ForbiddenError when a manager tries to approve', async () => {
    await expect(
      staffDiscountAuthService.managerApprove(authRequestId, 'APPROVED', managerActor),
    ).rejects.toThrow('Only directors can approve');
  });

  it('APPROVED: applies discount, sets order to READY, emits resolved socket', async () => {
    const pendingRequest = buildPendingAuthRequest();
    const discountedOrder = {
      ...buildReadyOrder(),
      total: new Prisma.Decimal('800.00'),
      discountPercent: new Prisma.Decimal('20'),
      discountAmount: new Prisma.Decimal('200.00'),
      discountedById: directorActor.id,
      status: 'AWAITING_AUTHORIZATION' as const,
    };

    vi.mocked(staffDiscountAuthRequestRepository.findById).mockResolvedValue(pendingRequest);
    vi.mocked(staffDiscountAuthRequestRepository.resolveIfPending).mockResolvedValue({
      ...pendingRequest,
      status: 'APPROVED' as const,
      resolvedById: directorActor.id,
      resolvedAt: new Date(),
    });
    vi.mocked(orderRepository.applyDiscount).mockResolvedValue(
      discountedOrder as unknown as FullOrderPrismaRecord,
    );
    vi.mocked(orderRepository.updateStatus).mockResolvedValue(
      { ...discountedOrder, status: 'READY' } as unknown as FullOrderPrismaRecord,
    );

    const result = await staffDiscountAuthService.managerApprove(authRequestId, 'APPROVED', directorActor);

    expect(orderRepository.applyDiscount).toHaveBeenCalledWith(
      orderId,
      organizationId,
      '20',
      '200',
      directorActor.id,
    );
    expect(orderRepository.updateStatus).toHaveBeenCalledWith(orderId, organizationId, 'READY');
    expect(socketService.emitStaffDiscountAuthResolved).toHaveBeenCalledWith(
      waiterActor.id,
      organizationId,
      expect.objectContaining({ orderId, approved: true, discountedTotal: '800' }),
    );
    expect(result.status).toBe('APPROVED');
  });

  it('REJECTED: returns order to READY without applying discount', async () => {
    const pendingRequest = buildPendingAuthRequest();

    vi.mocked(staffDiscountAuthRequestRepository.findById).mockResolvedValue(pendingRequest);
    vi.mocked(staffDiscountAuthRequestRepository.resolveIfPending).mockResolvedValue({
      ...pendingRequest,
      status: 'REJECTED' as const,
      resolvedById: directorActor.id,
      resolvedAt: new Date(),
    });
    vi.mocked(orderRepository.updateStatus).mockResolvedValue(buildReadyOrder());

    const result = await staffDiscountAuthService.managerApprove(authRequestId, 'REJECTED', directorActor);

    expect(orderRepository.applyDiscount).not.toHaveBeenCalled();
    expect(orderRepository.updateStatus).toHaveBeenCalledWith(orderId, organizationId, 'READY');
    expect(socketService.emitStaffDiscountAuthResolved).toHaveBeenCalledWith(
      waiterActor.id,
      organizationId,
      expect.objectContaining({ orderId, approved: false }),
    );
    expect(result.status).toBe('REJECTED');
  });
});

describe('staffDiscountAuthService.listPending', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns all pending requests across branches for a director', async () => {
    vi.mocked(staffDiscountAuthRequestRepository.findAllPending).mockResolvedValue([
      buildPendingAuthRequest(),
    ]);

    const result = await staffDiscountAuthService.listPending(directorActor);

    expect(staffDiscountAuthRequestRepository.findAllPending).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
    expect(result[0]?.status).toBe('PENDING');
  });

  it('returns an empty list for a non-director (managers no longer approve staff discounts)', async () => {
    const result = await staffDiscountAuthService.listPending(managerActor);

    expect(result).toEqual([]);
    expect(staffDiscountAuthRequestRepository.findAllPending).not.toHaveBeenCalled();
  });
});

describe('staffDiscountAuthService.withdraw', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws ForbiddenError when the actor is not the requester', async () => {
    vi.mocked(staffDiscountAuthRequestRepository.findById).mockResolvedValue(buildPendingAuthRequest());

    await expect(
      staffDiscountAuthService.withdraw(authRequestId, managerActor),
    ).rejects.toThrow('Only the waiter who requested the discount can withdraw it');
  });

  it('cancels a pending request, returns the order to READY, emits resolved', async () => {
    const pending = buildPendingAuthRequest();
    vi.mocked(staffDiscountAuthRequestRepository.findById).mockResolvedValue(pending);
    vi.mocked(staffDiscountAuthRequestRepository.cancelIfPending).mockResolvedValue({
      ...pending,
      status: 'CANCELLED' as const,
      resolvedById: waiterActor.id,
      resolvedAt: new Date(),
    });
    vi.mocked(orderRepository.updateStatus).mockResolvedValue(buildReadyOrder());

    const result = await staffDiscountAuthService.withdraw(authRequestId, waiterActor);

    expect(staffDiscountAuthRequestRepository.cancelIfPending).toHaveBeenCalledWith(authRequestId, waiterActor.id);
    expect(orderRepository.updateStatus).toHaveBeenCalledWith(orderId, organizationId, 'READY');
    expect(orderRepository.applyDiscount).not.toHaveBeenCalled();
    expect(socketService.emitStaffDiscountAuthResolved).toHaveBeenCalledWith(
      waiterActor.id,
      organizationId,
      expect.objectContaining({ orderId, approved: false }),
    );
    expect(result.status).toBe('CANCELLED');
  });

  it('no-ops when the request was already resolved (returns current state, no order change)', async () => {
    const pending = buildPendingAuthRequest();
    vi.mocked(staffDiscountAuthRequestRepository.findById)
      .mockResolvedValueOnce(pending)
      .mockResolvedValueOnce({ ...pending, status: 'APPROVED' as const });
    vi.mocked(staffDiscountAuthRequestRepository.cancelIfPending).mockResolvedValue(null);

    const result = await staffDiscountAuthService.withdraw(authRequestId, waiterActor);

    expect(orderRepository.updateStatus).not.toHaveBeenCalled();
    expect(result.status).toBe('APPROVED');
  });
});
