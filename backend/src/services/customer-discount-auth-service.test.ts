import { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { customerDiscountAuthRepository } from '../repositories/customer-discount-auth-repository';
import { discountRepository } from '../repositories/discount-repository';
import { orderRepository } from '../repositories/order-repository';
import { socketService } from '../sockets/socket-service';
import type { FullOrderPrismaRecord } from '../repositories/order-repository';
import { customerDiscountAuthService } from './customer-discount-auth-service';

vi.mock('../repositories/customer-discount-auth-repository', () => ({
  customerDiscountAuthRepository: {
    create: vi.fn(),
    findById: vi.fn(),
    findPendingByOrderId: vi.fn(),
    findPendingBySite: vi.fn(),
    resolveIfPending: vi.fn(),
  },
}));

vi.mock('../repositories/discount-repository', () => ({
  discountRepository: {
    findById: vi.fn(),
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
    emitCustomerDiscountAuthPending: vi.fn(),
    emitCustomerDiscountAuthResolved: vi.fn(),
  },
}));

const siteId = '11111111-1111-4111-8111-111111111111';
const orderId = '33333333-3333-4333-8333-333333333333';
const discountId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const authRequestId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

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

const buildReadyOrder = (): FullOrderPrismaRecord => ({
  id: orderId,
  siteId,
  dailyNumber: 7,
  orderDate: new Date('2026-04-10T00:00:00.000Z'),
  type: 'DINE_IN',
  status: 'READY',
  tableNumber: '5',
  notes: null,
  subtotal: new Prisma.Decimal('2000.00'),
  deliveryFee: new Prisma.Decimal('0.00'),
  total: new Prisma.Decimal('2000.00'),
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
} as unknown as FullOrderPrismaRecord);

const buildPercentageDiscount = (requiresApproval = true) => ({
  id: discountId,
  siteId,
  name: 'Senior Citizen',
  type: 'PERCENTAGE' as const,
  value: new Prisma.Decimal('15.00'),
  requiresApproval,
  isActive: true,
  createdById: 'director-id',
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: { id: 'director-id', name: 'Director One' },
});

const buildPendingAuthRequest = () => ({
  id: authRequestId,
  siteId,
  orderId,
  discountId,
  requestedById: waiterActor.id,
  discountPercent: new Prisma.Decimal('15.00'),
  discountFixed: null,
  originalAmount: new Prisma.Decimal('2000.00'),
  discountAmount: new Prisma.Decimal('300.00'),
  status: 'PENDING' as const,
  resolvedById: null,
  resolvedAt: null,
  createdAt: new Date('2026-04-10T10:01:00.000Z'),
  updatedAt: new Date('2026-04-10T10:01:00.000Z'),
  order: { id: orderId, dailyNumber: 7, total: new Prisma.Decimal('2000.00') },
  discount: { id: discountId, name: 'Senior Citizen', type: 'PERCENTAGE' as const, value: new Prisma.Decimal('15.00') },
  requestedBy: { id: waiterActor.id, name: 'Waiter One' },
  resolvedBy: null,
});

describe('customerDiscountAuthService.createAuthRequest', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('creates a pending auth request for an approval-required discount', async () => {
    vi.mocked(orderRepository.findById).mockResolvedValue(buildReadyOrder());
    vi.mocked(discountRepository.findById).mockResolvedValue(buildPercentageDiscount(true));
    vi.mocked(customerDiscountAuthRepository.findPendingByOrderId).mockResolvedValue(null);
    vi.mocked(customerDiscountAuthRepository.create).mockResolvedValue(buildPendingAuthRequest());
    vi.mocked(orderRepository.updateStatus).mockResolvedValue(buildReadyOrder());

    const result = await customerDiscountAuthService.createAuthRequest(
      orderId, discountId, siteId, waiterActor,
    );

    expect(result.requiresApproval).toBe(true);
    expect(customerDiscountAuthRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ orderId, discountId, siteId, discountPercent: '15' }),
    );
    expect(orderRepository.updateStatus).toHaveBeenCalledWith(orderId, siteId, 'AWAITING_AUTHORIZATION');
    expect(socketService.emitCustomerDiscountAuthPending).toHaveBeenCalledWith(
      waiterActor.id,
      siteId,
      expect.objectContaining({ orderId, discountName: 'Senior Citizen' }),
    );
  });

  it('auto-applies discount when requiresApproval is false', async () => {
    vi.mocked(orderRepository.findById).mockResolvedValue(buildReadyOrder());
    vi.mocked(discountRepository.findById).mockResolvedValue(buildPercentageDiscount(false));
    vi.mocked(customerDiscountAuthRepository.findPendingByOrderId).mockResolvedValue(null);
    vi.mocked(orderRepository.applyDiscount).mockResolvedValue(buildReadyOrder());

    const result = await customerDiscountAuthService.createAuthRequest(
      orderId, discountId, siteId, waiterActor,
    );

    expect(result.requiresApproval).toBe(false);
    expect(orderRepository.applyDiscount).toHaveBeenCalledWith(
      orderId, siteId, '15', expect.any(String), waiterActor.id, discountId,
    );
    expect(orderRepository.updateStatus).not.toHaveBeenCalled();
    expect(customerDiscountAuthRepository.create).not.toHaveBeenCalled();
  });

  it('throws NotFoundError when order does not exist', async () => {
    vi.mocked(orderRepository.findById).mockResolvedValue(null);
    await expect(
      customerDiscountAuthService.createAuthRequest(orderId, discountId, siteId, waiterActor),
    ).rejects.toThrow('Order not found');
  });

  it('throws NotFoundError when discount is inactive', async () => {
    vi.mocked(orderRepository.findById).mockResolvedValue(buildReadyOrder());
    vi.mocked(discountRepository.findById).mockResolvedValue({ ...buildPercentageDiscount(), isActive: false });
    await expect(
      customerDiscountAuthService.createAuthRequest(orderId, discountId, siteId, waiterActor),
    ).rejects.toThrow('Discount not found or inactive');
  });

  it('throws ConflictError when a pending request already exists', async () => {
    vi.mocked(orderRepository.findById).mockResolvedValue(buildReadyOrder());
    vi.mocked(discountRepository.findById).mockResolvedValue(buildPercentageDiscount());
    vi.mocked(customerDiscountAuthRepository.findPendingByOrderId).mockResolvedValue(
      buildPendingAuthRequest(),
    );
    await expect(
      customerDiscountAuthService.createAuthRequest(orderId, discountId, siteId, waiterActor),
    ).rejects.toThrow('A discount approval request is already pending');
  });
});

describe('customerDiscountAuthService.managerApprove', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('throws ForbiddenError when actor is not a manager/director', async () => {
    await expect(
      customerDiscountAuthService.managerApprove(authRequestId, 'APPROVED', waiterActor),
    ).rejects.toThrow('Only managers and directors can approve');
  });

  it('approves the request and applies the discount', async () => {
    const pendingReq = buildPendingAuthRequest();
    const resolvedReq = { ...pendingReq, status: 'APPROVED' as const, resolvedById: managerActor.id };

    vi.mocked(customerDiscountAuthRepository.findById).mockResolvedValue(pendingReq);
    vi.mocked(customerDiscountAuthRepository.resolveIfPending).mockResolvedValue(resolvedReq);
    vi.mocked(orderRepository.applyDiscount).mockResolvedValue(buildReadyOrder());
    vi.mocked(orderRepository.updateStatus).mockResolvedValue(buildReadyOrder());

    const result = await customerDiscountAuthService.managerApprove(
      authRequestId, 'APPROVED', managerActor,
    );

    expect(orderRepository.applyDiscount).toHaveBeenCalled();
    expect(orderRepository.updateStatus).toHaveBeenCalledWith(orderId, siteId, 'READY');
    expect(socketService.emitCustomerDiscountAuthResolved).toHaveBeenCalledWith(
      waiterActor.id,
      siteId,
      expect.objectContaining({ approved: true }),
    );
    expect(result.status).toBe('APPROVED');
  });

  it('rejects the request and returns order to READY without applying discount', async () => {
    const pendingReq = buildPendingAuthRequest();
    const resolvedReq = { ...pendingReq, status: 'REJECTED' as const, resolvedById: managerActor.id };

    vi.mocked(customerDiscountAuthRepository.findById).mockResolvedValue(pendingReq);
    vi.mocked(customerDiscountAuthRepository.resolveIfPending).mockResolvedValue(resolvedReq);
    vi.mocked(orderRepository.updateStatus).mockResolvedValue(buildReadyOrder());

    await customerDiscountAuthService.managerApprove(authRequestId, 'REJECTED', managerActor);

    expect(orderRepository.applyDiscount).not.toHaveBeenCalled();
    expect(orderRepository.updateStatus).toHaveBeenCalledWith(orderId, siteId, 'READY');
    expect(socketService.emitCustomerDiscountAuthResolved).toHaveBeenCalledWith(
      waiterActor.id,
      siteId,
      expect.objectContaining({ approved: false }),
    );
  });
});
