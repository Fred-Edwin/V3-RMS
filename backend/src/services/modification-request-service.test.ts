import type { Request } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { orderRepository } from '../repositories/order-repository';
import { modificationRequestRepository } from '../repositories/modification-request-repository';
import { socketService } from '../sockets/socket-service';
import { incidentService } from './incident-service';
import { modificationRequestService } from './modification-request-service';

vi.mock('../repositories/order-repository', () => ({
  orderRepository: { findById: vi.fn() },
}));

vi.mock('../repositories/modification-request-repository', () => ({
  modificationRequestRepository: {
    findPendingByOrder: vi.fn(),
    findByOrder: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    review: vi.fn(),
  },
}));

vi.mock('../sockets/socket-service', () => ({
  socketService: {
    emitModificationRequested: vi.fn(),
    emitModificationReviewed: vi.fn(),
  },
}));

vi.mock('./incident-service', () => ({
  incidentService: { log: vi.fn() },
}));

const orgId = '11111111-1111-4111-8111-111111111111';
const orderId = 'oooooooo-oooo-4ooo-8ooo-oooooooooooo';
const requestId = 'rrrrrrrr-rrrr-4rrr-8rrr-rrrrrrrrrrrr';
const waiterId = '22222222-2222-4222-8222-222222222222';
const managerId = '33333333-3333-4333-8333-333333333333';

type Actor = NonNullable<Request['user']>;

const waiterActor: Actor = { id: waiterId, role: 'WAITER', siteId: orgId } as Actor;
const managerActor: Actor = { id: managerId, role: 'MANAGER', siteId: orgId } as Actor;
const noOrgActor: Actor = { id: waiterId, role: 'WAITER', siteId: null } as Actor;

const buildOrder = (overrides = {}) => ({
  id: orderId,
  siteId: orgId,
  dailyNumber: 5,
  createdById: waiterId,
  status: 'IN_PROGRESS',
  prepTickets: [{ station: 'KITCHEN' }],
  total: { toString: () => '500.00' },
  ...overrides,
});

const buildModRequest = (overrides = {}) => ({
  id: requestId,
  siteId: orgId,
  orderId,
  description: 'Remove onions',
  status: 'PENDING',
  requestedById: waiterId,
  requestedBy: { id: waiterId, name: 'Waiter' },
  reviewedBy: null,
  reviewedAt: null,
  reviewNote: null,
  createdAt: new Date(),
  ...overrides,
});

describe('modificationRequestService.create', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('creates a modification request for the order waiter', async () => {
    vi.mocked(orderRepository.findById).mockResolvedValue(buildOrder() as never);
    vi.mocked(modificationRequestRepository.findPendingByOrder).mockResolvedValue(null);
    vi.mocked(modificationRequestRepository.create).mockResolvedValue(buildModRequest() as never);

    const result = await modificationRequestService.create(orderId, 'Remove onions', waiterActor);

    expect(modificationRequestRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ siteId: orgId, orderId, requestedById: waiterId }),
    );
    expect(socketService.emitModificationRequested).toHaveBeenCalled();
    expect(result.status).toBe('PENDING');
  });

  it('throws ForbiddenError when actor has no organizationId', async () => {
    await expect(
      modificationRequestService.create(orderId, 'desc', noOrgActor),
    ).rejects.toThrow('Branch context required');
  });

  it('throws NotFoundError when order not found', async () => {
    vi.mocked(orderRepository.findById).mockResolvedValue(null);
    await expect(
      modificationRequestService.create(orderId, 'desc', waiterActor),
    ).rejects.toThrow('Order not found');
  });

  it('throws ForbiddenError when actor is not the order creator', async () => {
    vi.mocked(orderRepository.findById).mockResolvedValue(buildOrder({ createdById: 'another-waiter' }) as never);
    await expect(
      modificationRequestService.create(orderId, 'desc', waiterActor),
    ).rejects.toThrow('Only the waiter who created this order');
  });

  it('throws ConflictError when order is not IN_PROGRESS', async () => {
    vi.mocked(orderRepository.findById).mockResolvedValue(buildOrder({ status: 'CLOSED' }) as never);
    await expect(
      modificationRequestService.create(orderId, 'desc', waiterActor),
    ).rejects.toThrow('only be made for in-progress orders');
  });

  it('throws ConflictError when a pending request already exists', async () => {
    vi.mocked(orderRepository.findById).mockResolvedValue(buildOrder() as never);
    vi.mocked(modificationRequestRepository.findPendingByOrder).mockResolvedValue(buildModRequest() as never);
    await expect(
      modificationRequestService.create(orderId, 'desc', waiterActor),
    ).rejects.toThrow('already a pending modification request');
  });
});

describe('modificationRequestService.getByOrder', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns requests for the order', async () => {
    vi.mocked(modificationRequestRepository.findByOrder).mockResolvedValue([buildModRequest() as never]);
    const result = await modificationRequestService.getByOrder(orderId, waiterActor);
    expect(modificationRequestRepository.findByOrder).toHaveBeenCalledWith(orderId, orgId);
    expect(result).toHaveLength(1);
  });

  it('throws ForbiddenError when actor has no organizationId', async () => {
    await expect(
      modificationRequestService.getByOrder(orderId, noOrgActor),
    ).rejects.toThrow('Branch context required');
  });
});

describe('modificationRequestService.review', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('approves a modification request', async () => {
    vi.mocked(modificationRequestRepository.findById).mockResolvedValue(buildModRequest() as never);
    vi.mocked(modificationRequestRepository.review).mockResolvedValue(buildModRequest({ status: 'APPROVED' }) as never);

    const result = await modificationRequestService.review(requestId, 'APPROVED', undefined, managerActor);

    expect(modificationRequestRepository.review).toHaveBeenCalledWith(
      requestId,
      orgId,
      expect.objectContaining({ status: 'APPROVED', reviewedById: managerId }),
    );
    expect(socketService.emitModificationReviewed).toHaveBeenCalled();
    expect(result.status).toBe('APPROVED');
  });

  it('rejects a modification request', async () => {
    vi.mocked(modificationRequestRepository.findById).mockResolvedValue(buildModRequest() as never);
    vi.mocked(modificationRequestRepository.review).mockResolvedValue(buildModRequest({ status: 'REJECTED' }) as never);

    const result = await modificationRequestService.review(requestId, 'REJECTED', 'Not possible', managerActor);
    expect(result.status).toBe('REJECTED');
    expect(incidentService.log).toHaveBeenCalled();
  });

  it('throws ForbiddenError when actor has no organizationId', async () => {
    await expect(
      modificationRequestService.review(requestId, 'APPROVED', undefined, noOrgActor),
    ).rejects.toThrow('Branch context required');
  });

  it('throws NotFoundError when request not found', async () => {
    vi.mocked(modificationRequestRepository.findById).mockResolvedValue(null);
    await expect(
      modificationRequestService.review(requestId, 'APPROVED', undefined, managerActor),
    ).rejects.toThrow('Modification request not found');
  });

  it('throws ConflictError when request already reviewed', async () => {
    vi.mocked(modificationRequestRepository.findById).mockResolvedValue(buildModRequest() as never);
    vi.mocked(modificationRequestRepository.review).mockResolvedValue(null);
    await expect(
      modificationRequestService.review(requestId, 'APPROVED', undefined, managerActor),
    ).rejects.toThrow('already been reviewed');
  });
});
