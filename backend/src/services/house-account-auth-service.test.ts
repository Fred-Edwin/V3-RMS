import type { Request } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { houseAccountAuthRequestRepository } from '../repositories/house-account-auth-request-repository';
import { houseAccountRepository } from '../repositories/house-account-repository';
import { orderRepository } from '../repositories/order-repository';
import { socketService } from '../sockets/socket-service';
import { fcmService } from './fcm-service';
import { incidentService } from './incident-service';
import { prisma } from '../config/database';
import { houseAccountAuthService } from './house-account-auth-service';

vi.mock('../repositories/house-account-auth-request-repository', () => ({
  houseAccountAuthRequestRepository: {
    findPendingByHolderUserId: vi.fn(),
    findPendingBySite: vi.fn(),
    findPendingByOrderId: vi.fn(),
    findById: vi.fn(),
    resolveIfPending: vi.fn(),
  },
}));

vi.mock('../repositories/house-account-repository', () => ({
  houseAccountRepository: { findById: vi.fn() },
}));

vi.mock('../repositories/order-repository', () => ({
  orderRepository: {
    findById: vi.fn(),
    recordPayment: vi.fn(),
    updateStatus: vi.fn(),
  },
}));

vi.mock('../sockets/socket-service', () => ({
  socketService: {
    emitAuthPending: vi.fn(),
    emitAuthResolved: vi.fn(),
    emitOrderClosed: vi.fn(),
  },
}));

vi.mock('./fcm-service', () => ({
  fcmService: {
    sendHouseAccountAuthPush: vi.fn(),
    sendHouseAccountAuthPushToManagers: vi.fn(),
    sendAuthResolutionPush: vi.fn(),
  },
}));

vi.mock('./incident-service', () => ({
  incidentService: { log: vi.fn() },
}));

vi.mock('../config/database', () => ({
  prisma: { $transaction: vi.fn() },
}));

vi.mock('../config/queues', () => ({ authQueue: {} }));
vi.mock('../jobs/house-account-auth-timeout', () => ({ cancelAuthTimeoutJob: vi.fn() }));
vi.mock('../utils/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const orgId = '11111111-1111-4111-8111-111111111111';
const orderId = 'oooooooo-oooo-4ooo-8ooo-oooooooooooo';
const authRequestId = 'rrrrrrrr-rrrr-4rrr-8rrr-rrrrrrrrrrrr';
const accountId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const holderId = '22222222-2222-4222-8222-222222222222';
const managerId = '33333333-3333-4333-8333-333333333333';
const waiterId = '44444444-4444-4444-8444-444444444444';
const directorId = '55555555-5555-4555-8555-555555555555';

type Actor = NonNullable<Request['user']>;

const holderActor: Actor = { id: holderId, role: 'DIRECTOR', siteId: null } as Actor;
const managerActor: Actor = { id: managerId, role: 'MANAGER', siteId: orgId } as Actor;
const waiterActor: Actor = { id: waiterId, role: 'WAITER', siteId: orgId } as Actor;
const directorActor: Actor = { id: directorId, role: 'DIRECTOR', siteId: null } as Actor;

const buildAuthRequest = (overrides = {}) => ({
  id: authRequestId,
  siteId: orgId,
  orderId,
  houseAccountId: accountId,
  requestedById: waiterId,
  amount: { toString: () => '5000.00' },
  status: 'PENDING',
  bullmqJobId: 'job-123',
  expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
  resolvedById: null,
  resolvedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  order: { id: orderId, dailyNumber: 7, total: { toString: () => '5000.00' }, items: [] },
  houseAccount: { id: accountId, user: { id: holderId, name: 'Director' } },
  requestedBy: { id: waiterId, name: 'Waiter' },
  resolvedBy: null,
  ...overrides,
});

describe('houseAccountAuthService.listPending', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('scopes to holder userId for actor with no organizationId', async () => {
    vi.mocked(houseAccountAuthRequestRepository.findPendingByHolderUserId).mockResolvedValue([buildAuthRequest() as never]);
    const result = await houseAccountAuthService.listPending(holderActor);
    expect(houseAccountAuthRequestRepository.findPendingByHolderUserId).toHaveBeenCalledWith(holderId);
    expect(result).toHaveLength(1);
  });

  it('scopes to organizationId for branch actor', async () => {
    vi.mocked(houseAccountAuthRequestRepository.findPendingBySite).mockResolvedValue([buildAuthRequest() as never]);
    const result = await houseAccountAuthService.listPending(managerActor);
    expect(houseAccountAuthRequestRepository.findPendingBySite).toHaveBeenCalledWith(orgId);
    expect(result).toHaveLength(1);
  });
});

describe('houseAccountAuthService.createAuthRequest', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('creates auth request, sets order to AWAITING_AUTHORIZATION, fires notifications', async () => {
    const mockOrder = { id: orderId, dailyNumber: 7, total: { toString: () => '5000.00' }, prepTickets: [] };
    const mockAccount = { id: accountId, isActive: true, userId: holderId };
    const createdRequest = buildAuthRequest();

    vi.mocked(orderRepository.findById).mockResolvedValue(mockOrder as never);
    vi.mocked(houseAccountRepository.findById).mockResolvedValue(mockAccount as never);
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
      const tx = {
        houseAccountAuthRequest: { create: vi.fn().mockResolvedValue(createdRequest) },
        order: { updateMany: vi.fn() },
      };
      return (fn as (tx: unknown) => Promise<unknown>)(tx);
    });

    const result = await houseAccountAuthService.createAuthRequest(orderId, accountId, orgId, waiterActor);

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(socketService.emitAuthPending).toHaveBeenCalled();
    expect(result.orderId).toBe(orderId);
  });

  it('throws NotFoundError when order not found', async () => {
    vi.mocked(orderRepository.findById).mockResolvedValue(null);
    await expect(
      houseAccountAuthService.createAuthRequest(orderId, accountId, orgId, waiterActor),
    ).rejects.toThrow('Order not found');
  });

  it('throws NotFoundError when house account not found', async () => {
    vi.mocked(orderRepository.findById).mockResolvedValue({ id: orderId, dailyNumber: 1, total: { toString: () => '100' } } as never);
    vi.mocked(houseAccountRepository.findById).mockResolvedValue(null);
    await expect(
      houseAccountAuthService.createAuthRequest(orderId, accountId, orgId, waiterActor),
    ).rejects.toThrow('House account not found or inactive');
  });
});

describe('houseAccountAuthService.getById', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns auth request for the account holder', async () => {
    vi.mocked(houseAccountAuthRequestRepository.findById).mockResolvedValue(buildAuthRequest() as never);
    const result = await houseAccountAuthService.getById(authRequestId, holderActor);
    expect(result.id).toBe(authRequestId);
  });

  it('returns auth request for a manager', async () => {
    vi.mocked(houseAccountAuthRequestRepository.findById).mockResolvedValue(buildAuthRequest() as never);
    const result = await houseAccountAuthService.getById(authRequestId, managerActor);
    expect(result.id).toBe(authRequestId);
  });

  it('throws ForbiddenError for non-holder waiter', async () => {
    vi.mocked(houseAccountAuthRequestRepository.findById).mockResolvedValue(buildAuthRequest() as never);
    await expect(houseAccountAuthService.getById(authRequestId, waiterActor)).rejects.toThrow('Access denied');
  });

  it('throws NotFoundError when request not found', async () => {
    vi.mocked(houseAccountAuthRequestRepository.findById).mockResolvedValue(null);
    await expect(houseAccountAuthService.getById(authRequestId, holderActor)).rejects.toThrow('Authorization request not found');
  });
});

describe('houseAccountAuthService.resolve', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('allows holder to approve', async () => {
    const req = buildAuthRequest();
    const resolved = buildAuthRequest({ status: 'APPROVED' });
    vi.mocked(houseAccountAuthRequestRepository.findById).mockResolvedValue(req as never);
    vi.mocked(houseAccountAuthRequestRepository.resolveIfPending).mockResolvedValue(resolved as never);
    vi.mocked(orderRepository.recordPayment).mockResolvedValue(undefined as never);
    vi.mocked(orderRepository.findById).mockResolvedValue(null);

    await houseAccountAuthService.resolve(authRequestId, 'APPROVED', holderActor);
    expect(houseAccountAuthRequestRepository.resolveIfPending).toHaveBeenCalledWith(
      authRequestId, orgId, 'APPROVED', holderId,
    );
  });

  it('allows holder to reject', async () => {
    const req = buildAuthRequest();
    const resolved = buildAuthRequest({ status: 'REJECTED' });
    vi.mocked(houseAccountAuthRequestRepository.findById).mockResolvedValue(req as never);
    vi.mocked(houseAccountAuthRequestRepository.resolveIfPending).mockResolvedValue(resolved as never);
    vi.mocked(orderRepository.updateStatus).mockResolvedValue(undefined as never);

    await houseAccountAuthService.resolve(authRequestId, 'REJECTED', holderActor);
    expect(incidentService.log).toHaveBeenCalled();
  });

  it('throws ForbiddenError for non-holder', async () => {
    vi.mocked(houseAccountAuthRequestRepository.findById).mockResolvedValue(buildAuthRequest() as never);
    await expect(houseAccountAuthService.resolve(authRequestId, 'APPROVED', waiterActor)).rejects.toThrow(
      'Only the account holder',
    );
  });

  it('throws NotFoundError when request not found', async () => {
    vi.mocked(houseAccountAuthRequestRepository.findById).mockResolvedValue(null);
    await expect(houseAccountAuthService.resolve(authRequestId, 'APPROVED', holderActor)).rejects.toThrow(
      'Authorization request not found',
    );
  });
});

describe('houseAccountAuthService.managerOverride', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('allows manager to override (approve)', async () => {
    const req = buildAuthRequest();
    const resolved = buildAuthRequest({ status: 'APPROVED' });
    vi.mocked(houseAccountAuthRequestRepository.findById).mockResolvedValue(req as never);
    vi.mocked(houseAccountAuthRequestRepository.resolveIfPending).mockResolvedValue(resolved as never);
    vi.mocked(orderRepository.recordPayment).mockResolvedValue(undefined as never);
    vi.mocked(orderRepository.findById).mockResolvedValue(null);

    await houseAccountAuthService.managerOverride(authRequestId, 'APPROVED', managerActor);
    expect(houseAccountAuthRequestRepository.resolveIfPending).toHaveBeenCalledWith(
      authRequestId, orgId, 'APPROVED', managerId,
    );
  });

  it('allows director (no orgId) to override', async () => {
    const req = buildAuthRequest();
    const resolved = buildAuthRequest({ status: 'REJECTED' });
    vi.mocked(houseAccountAuthRequestRepository.findById).mockResolvedValue(req as never);
    vi.mocked(houseAccountAuthRequestRepository.resolveIfPending).mockResolvedValue(resolved as never);
    vi.mocked(orderRepository.updateStatus).mockResolvedValue(undefined as never);

    await houseAccountAuthService.managerOverride(authRequestId, 'REJECTED', directorActor);
    expect(houseAccountAuthRequestRepository.resolveIfPending).toHaveBeenCalled();
  });

  it('throws ForbiddenError for waiter', async () => {
    await expect(
      houseAccountAuthService.managerOverride(authRequestId, 'APPROVED', waiterActor),
    ).rejects.toThrow('Only managers and directors');
  });

  it('throws NotFoundError when request not found', async () => {
    vi.mocked(houseAccountAuthRequestRepository.findById).mockResolvedValue(null);
    await expect(
      houseAccountAuthService.managerOverride(authRequestId, 'APPROVED', managerActor),
    ).rejects.toThrow('Authorization request not found');
  });

  it('throws ForbiddenError when manager from wrong branch', async () => {
    const req = buildAuthRequest({ siteId: 'other-org-id' });
    vi.mocked(houseAccountAuthRequestRepository.findById).mockResolvedValue(req as never);
    await expect(
      houseAccountAuthService.managerOverride(authRequestId, 'APPROVED', managerActor),
    ).rejects.toThrow('Access denied');
  });
});

describe('houseAccountAuthService.handleTimeout', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('no-ops when request not found', async () => {
    vi.mocked(houseAccountAuthRequestRepository.findById).mockResolvedValue(null);
    await houseAccountAuthService.handleTimeout(authRequestId);
    expect(houseAccountAuthRequestRepository.resolveIfPending).not.toHaveBeenCalled();
  });

  it('no-ops when request already resolved', async () => {
    vi.mocked(houseAccountAuthRequestRepository.findById).mockResolvedValue(
      buildAuthRequest({ status: 'APPROVED' }) as never,
    );
    await houseAccountAuthService.handleTimeout(authRequestId);
    expect(houseAccountAuthRequestRepository.resolveIfPending).not.toHaveBeenCalled();
  });

  it('rejects pending request as TIMED_OUT', async () => {
    const req = buildAuthRequest();
    const resolved = buildAuthRequest({ status: 'TIMED_OUT' });
    vi.mocked(houseAccountAuthRequestRepository.findById).mockResolvedValue(req as never);
    vi.mocked(houseAccountAuthRequestRepository.resolveIfPending).mockResolvedValue(resolved as never);
    vi.mocked(orderRepository.updateStatus).mockResolvedValue(undefined as never);

    await houseAccountAuthService.handleTimeout(authRequestId);
    expect(houseAccountAuthRequestRepository.resolveIfPending).toHaveBeenCalledWith(
      authRequestId, orgId, 'TIMED_OUT', waiterId,
    );
  });
});

describe('houseAccountAuthService.forceExpire', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('throws ForbiddenError for waiter', async () => {
    await expect(houseAccountAuthService.forceExpire(authRequestId, waiterActor)).rejects.toThrow(
      'Only managers and directors',
    );
  });

  it('throws NotFoundError when request not found', async () => {
    vi.mocked(houseAccountAuthRequestRepository.findById).mockResolvedValue(null);
    await expect(houseAccountAuthService.forceExpire(authRequestId, managerActor)).rejects.toThrow(
      'Authorization request not found',
    );
  });

  it('throws ConflictError when request already resolved', async () => {
    vi.mocked(houseAccountAuthRequestRepository.findById).mockResolvedValue(
      buildAuthRequest({ status: 'APPROVED' }) as never,
    );
    await expect(houseAccountAuthService.forceExpire(authRequestId, managerActor)).rejects.toThrow(
      'already resolved',
    );
  });

  it('throws ConflictError when request not yet expired', async () => {
    vi.mocked(houseAccountAuthRequestRepository.findById).mockResolvedValue(
      buildAuthRequest({ expiresAt: new Date(Date.now() + 60 * 60 * 1000) }) as never,
    );
    await expect(houseAccountAuthService.forceExpire(authRequestId, managerActor)).rejects.toThrow(
      'not yet expired',
    );
  });

  it('force-expires an expired pending request', async () => {
    const req = buildAuthRequest({ expiresAt: new Date(Date.now() - 1000) });
    const resolved = buildAuthRequest({ status: 'TIMED_OUT' });
    vi.mocked(houseAccountAuthRequestRepository.findById).mockResolvedValue(req as never);
    vi.mocked(houseAccountAuthRequestRepository.resolveIfPending).mockResolvedValue(resolved as never);
    vi.mocked(orderRepository.updateStatus).mockResolvedValue(undefined as never);

    await houseAccountAuthService.forceExpire(authRequestId, managerActor);
    expect(houseAccountAuthRequestRepository.resolveIfPending).toHaveBeenCalledWith(
      authRequestId, orgId, 'TIMED_OUT', managerId,
    );
  });
});
