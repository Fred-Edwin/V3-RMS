import { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { staffDiscountAuthRequestRepository } from '../repositories/staff-discount-auth-request-repository';
import { orderRepository } from '../repositories/order-repository';
import { socketService } from '../sockets/socket-service';
import type { FullOrderPrismaRecord } from '../repositories/order-repository';
import { staffDiscountAuthService } from './staff-discount-auth-service';

vi.mock('../repositories/staff-discount-auth-request-repository', () => ({
  staffDiscountAuthRequestRepository: {
    create: vi.fn(),
    findById: vi.fn(),
    findPendingByOrderId: vi.fn(),
    findPendingByOrganization: vi.fn(),
    resolveIfPending: vi.fn(),
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

const otherBranchManagerActor = {
  id: '66666666-6666-4666-8666-666666666666',
  role: 'MANAGER',
  organizationId: '99999999-9999-4999-8999-999999999999',
} as NonNullable<Request['user']>;

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
  discountPercent: new Prisma.Decimal('30'),
  originalAmount: new Prisma.Decimal('1000.00'),
  discountAmount: new Prisma.Decimal('300.00'),
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
        discountPercent: '30',
        originalAmount: '1000',
        discountAmount: '300',
      }),
    );
    expect(orderRepository.updateStatus).toHaveBeenCalledWith(orderId, organizationId, 'AWAITING_AUTHORIZATION');
    expect(socketService.emitStaffDiscountAuthPending).toHaveBeenCalledWith(
      waiterActor.id,
      organizationId,
      expect.objectContaining({ orderId, authRequestId, discountAmount: '300' }),
    );
    expect(result.status).toBe('PENDING');
    expect(result.discountAmount).toBe('300');
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

  it('throws ForbiddenError when actor is not a manager or director', async () => {
    await expect(
      staffDiscountAuthService.managerApprove(authRequestId, 'APPROVED', waiterActor),
    ).rejects.toThrow('Only managers and directors can approve');
  });

  it('throws ForbiddenError for cross-branch manager', async () => {
    vi.mocked(staffDiscountAuthRequestRepository.findById).mockResolvedValue(buildPendingAuthRequest());

    await expect(
      staffDiscountAuthService.managerApprove(authRequestId, 'APPROVED', otherBranchManagerActor),
    ).rejects.toThrow('Access denied');
  });

  it('APPROVED: applies discount, sets order to READY, emits resolved socket', async () => {
    const pendingRequest = buildPendingAuthRequest();
    const discountedOrder = {
      ...buildReadyOrder(),
      total: new Prisma.Decimal('700.00'),
      discountPercent: new Prisma.Decimal('30'),
      discountAmount: new Prisma.Decimal('300.00'),
      discountedById: managerActor.id,
      status: 'AWAITING_AUTHORIZATION' as const,
    };

    vi.mocked(staffDiscountAuthRequestRepository.findById).mockResolvedValue(pendingRequest);
    vi.mocked(staffDiscountAuthRequestRepository.resolveIfPending).mockResolvedValue({
      ...pendingRequest,
      status: 'APPROVED' as const,
      resolvedById: managerActor.id,
      resolvedAt: new Date(),
    });
    vi.mocked(orderRepository.applyDiscount).mockResolvedValue(
      discountedOrder as unknown as FullOrderPrismaRecord,
    );
    vi.mocked(orderRepository.updateStatus).mockResolvedValue(
      { ...discountedOrder, status: 'READY' } as unknown as FullOrderPrismaRecord,
    );

    const result = await staffDiscountAuthService.managerApprove(authRequestId, 'APPROVED', managerActor);

    expect(orderRepository.applyDiscount).toHaveBeenCalledWith(
      orderId,
      organizationId,
      '30',
      '300',
      managerActor.id,
    );
    expect(orderRepository.updateStatus).toHaveBeenCalledWith(orderId, organizationId, 'READY');
    expect(socketService.emitStaffDiscountAuthResolved).toHaveBeenCalledWith(
      waiterActor.id,
      organizationId,
      expect.objectContaining({ orderId, approved: true, discountedTotal: '700' }),
    );
    expect(result.status).toBe('APPROVED');
  });

  it('REJECTED: returns order to READY without applying discount', async () => {
    const pendingRequest = buildPendingAuthRequest();

    vi.mocked(staffDiscountAuthRequestRepository.findById).mockResolvedValue(pendingRequest);
    vi.mocked(staffDiscountAuthRequestRepository.resolveIfPending).mockResolvedValue({
      ...pendingRequest,
      status: 'REJECTED' as const,
      resolvedById: managerActor.id,
      resolvedAt: new Date(),
    });
    vi.mocked(orderRepository.updateStatus).mockResolvedValue(buildReadyOrder());

    const result = await staffDiscountAuthService.managerApprove(authRequestId, 'REJECTED', managerActor);

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
