import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../config/database';
import { dispatchRepository } from '../repositories/dispatch-repository';
import { requisitionRepository } from '../repositories/requisition-repository';
import { inventoryItemRepository } from '../repositories/inventory-item-repository';
import { inventoryTransactionRepository } from '../repositories/inventory-transaction-repository';
import { locationRepository } from '../repositories/location-repository';
import { branchRepository } from '../repositories/branch-repository';
import { fcmService } from './fcm-service';
import { dispatchService } from './dispatch-service';
import { ConflictError, ForbiddenError, ValidationError } from '../utils/errors';

vi.mock('../config/database', () => ({
  prisma: {
    $transaction: vi.fn(),
    requisition: { findUnique: vi.fn(), findMany: vi.fn() },
    location: { findUnique: vi.fn() },
  },
}));

vi.mock('../repositories/dispatch-repository', () => ({
  dispatchRepository: {
    create: vi.fn(),
    findVisibleTo: vi.fn(),
    listVisibleTo: vi.fn(),
    transitionStatus: vi.fn(),
    updateLineDispatchedQty: vi.fn(),
    updateLineReceivedQty: vi.fn(),
  },
}));

vi.mock('../repositories/requisition-repository', () => ({
  requisitionRepository: {
    transitionStatus: vi.fn(),
  },
}));

vi.mock('../repositories/inventory-item-repository', () => ({
  inventoryItemRepository: {
    findById: vi.fn(),
  },
}));

vi.mock('../repositories/inventory-transaction-repository', () => ({
  inventoryTransactionRepository: {
    create: vi.fn(),
    sumQuantityByItemAndLocation: vi.fn(),
  },
}));

vi.mock('../repositories/location-repository', () => ({
  locationRepository: {
    findCentralStore: vi.fn(),
  },
}));

vi.mock('../repositories/branch-repository', () => ({
  branchRepository: {
    findHub: vi.fn(),
  },
}));

vi.mock('./fcm-service', () => ({
  fcmService: {
    sendDispatchInTransitPush: vi.fn(),
    sendReceiptVariancePush: vi.fn(),
    sendRequisitionDecisionPush: vi.fn(),
  },
}));

const d = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);

const hubOrgId = '11111111-1111-4111-8111-111111111111';
const branchOrgId = '22222222-2222-4222-8222-222222222222';
const thirdBranchOrgId = '33333333-3333-4333-8333-333333333333';
const centralStoreId = '44444444-4444-4444-8444-444444444444';
const deptLocationId = '55555555-5555-4555-8555-555555555555';
const dispatchId = '66666666-6666-4666-8666-666666666666';
const lineId = '77777777-7777-4777-8777-777777777777';
const itemId = '88888888-8888-4888-8888-888888888888';
const reqId = '99999999-9999-4999-8999-999999999999';
const headId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const storeManagerId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const storeActor = { id: storeManagerId, role: 'STORE_MANAGER' as const, organizationId: hubOrgId };
const headActor = {
  id: headId,
  role: 'CHEF' as const,
  isDepartmentHead: true,
  organizationId: branchOrgId,
  departmentTag: 'KITCHEN' as const,
};

const buildDispatch = (overrides: Record<string, unknown> = {}) => ({
  id: dispatchId,
  fromOrganizationId: hubOrgId,
  toOrganizationId: branchOrgId,
  requisitionId: reqId,
  fromLocationId: centralStoreId,
  toLocationId: deptLocationId,
  status: 'PICKING' as const,
  dispatchedById: null,
  dispatchedAt: null,
  receivedById: null,
  receivedAt: null,
  deliveryNoteNumber: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  fromLocation: { id: centralStoreId, name: 'Central Store' },
  toLocation: { id: deptLocationId, name: 'Kitchen', departmentTag: 'KITCHEN', organizationId: branchOrgId },
  requisition: { id: reqId, requestedById: headId },
  dispatchedBy: null,
  receivedBy: null,
  lines: [
    {
      id: lineId,
      dispatchId,
      inventoryItemId: itemId,
      requestedQty: d(10),
      dispatchedQty: d(8),
      receivedQty: null,
      unitCost: d(50),
      inventoryItem: { id: itemId, name: 'Tomatoes', buyUnit: 'kg', usageUnit: 'kg' },
    },
  ],
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.$transaction).mockImplementation((fn) => (fn as (tx: unknown) => Promise<unknown>)(prisma));
});

describe('dispatchService D-16 — either-side visibility', () => {
  it('an uninvolved third branch sees nothing via findVisibleTo', async () => {
    vi.mocked(dispatchRepository.findVisibleTo).mockResolvedValue(null);

    const thirdBranchActor = { id: 'x', role: 'CHEF' as const, isDepartmentHead: true, organizationId: thirdBranchOrgId };
    await expect(dispatchService.getById(thirdBranchActor as never, dispatchId)).rejects.toThrow('Dispatch not found');
    expect(dispatchRepository.findVisibleTo).toHaveBeenCalledWith(dispatchId, thirdBranchOrgId);
  });

  it('the hub org (from side) can see the dispatch', async () => {
    vi.mocked(dispatchRepository.findVisibleTo).mockResolvedValue(buildDispatch() as never);
    const result = await dispatchService.getById(storeActor as never, dispatchId);
    expect(result.id).toBe(dispatchId);
  });

  it('the branch org (to side) can see the dispatch', async () => {
    vi.mocked(dispatchRepository.findVisibleTo).mockResolvedValue(buildDispatch() as never);
    const result = await dispatchService.getById(headActor as never, dispatchId);
    expect(result.id).toBe(dispatchId);
  });
});

describe('dispatchService.createFromRequisition', () => {
  it('rejects a non-store actor', async () => {
    await expect(
      dispatchService.createFromRequisition(headActor as never, reqId, {
        lines: [{ inventoryItemId: itemId, dispatchedQty: 5 }],
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('rejects fulfilling a requisition that is not APPROVED', async () => {
    vi.mocked(branchRepository.findHub).mockResolvedValue({ id: hubOrgId } as never);
    vi.mocked(locationRepository.findCentralStore).mockResolvedValue({ id: centralStoreId } as never);
    vi.mocked(prisma.requisition.findUnique).mockResolvedValue({
      id: reqId,
      status: 'PENDING_MANAGER_APPROVAL',
      organizationId: branchOrgId,
      locationId: deptLocationId,
      location: { id: deptLocationId, organizationId: branchOrgId },
      lines: [{ inventoryItemId: itemId, approvedQty: d(8), requestedQty: d(10), inventoryItem: { currentCost: d(50) } }],
    } as never);

    await expect(
      dispatchService.createFromRequisition(storeActor as never, reqId, {
        lines: [{ inventoryItemId: itemId, dispatchedQty: 5 }],
      }),
    ).rejects.toThrow(ConflictError);
  });

  it('creates a PICKING dispatch with dispatched qty allowed to be less than requested (partial, D-6)', async () => {
    vi.mocked(branchRepository.findHub).mockResolvedValue({ id: hubOrgId } as never);
    vi.mocked(locationRepository.findCentralStore).mockResolvedValue({ id: centralStoreId } as never);
    vi.mocked(prisma.requisition.findUnique).mockResolvedValue({
      id: reqId,
      status: 'APPROVED',
      organizationId: branchOrgId,
      locationId: deptLocationId,
      location: { id: deptLocationId, organizationId: branchOrgId },
      lines: [{ inventoryItemId: itemId, approvedQty: d(8), requestedQty: d(10), inventoryItem: { currentCost: d(50) } }],
    } as never);
    vi.mocked(dispatchRepository.create).mockResolvedValue(buildDispatch({ status: 'PICKING' }) as never);
    vi.mocked(requisitionRepository.transitionStatus).mockResolvedValue(true);
    vi.mocked(dispatchRepository.findVisibleTo).mockResolvedValue(buildDispatch() as never);

    const result = await dispatchService.createFromRequisition(storeActor as never, reqId, {
      lines: [{ inventoryItemId: itemId, dispatchedQty: 3 }],
    });

    expect(dispatchRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ fromOrganizationId: hubOrgId, toOrganizationId: branchOrgId, requisitionId: reqId }),
      prisma,
    );
    expect(result.status).toBe('PICKING');
  });
});

describe('dispatchService.confirmDispatch — D-16 ledger correctness', () => {
  it('rejects confirming when a line has no dispatchedQty set', async () => {
    vi.mocked(branchRepository.findHub).mockResolvedValue({ id: hubOrgId } as never);
    vi.mocked(dispatchRepository.findVisibleTo).mockResolvedValue(
      buildDispatch({ lines: [{ ...buildDispatch().lines[0], dispatchedQty: null }] }) as never,
    );

    await expect(dispatchService.confirmDispatch(storeActor as never, dispatchId)).rejects.toThrow(ValidationError);
  });

  it('writes exactly one DISPATCH_OUT transaction at the Central Store under the hub org (single-org, D-16)', async () => {
    vi.mocked(branchRepository.findHub).mockResolvedValue({ id: hubOrgId } as never);
    vi.mocked(dispatchRepository.findVisibleTo)
      .mockResolvedValueOnce(buildDispatch() as never)
      .mockResolvedValueOnce(buildDispatch({ status: 'IN_TRANSIT' }) as never);
    vi.mocked(dispatchRepository.transitionStatus).mockResolvedValue(true);

    await dispatchService.confirmDispatch(storeActor as never, dispatchId);

    expect(inventoryTransactionRepository.create).toHaveBeenCalledTimes(1);
    expect(inventoryTransactionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: hubOrgId,
        locationId: centralStoreId,
        type: 'DISPATCH_OUT',
        quantity: expect.objectContaining({ s: -1 }), // negative Decimal (stock leaving)
      }),
      prisma,
    );
    expect(dispatchRepository.transitionStatus).toHaveBeenCalledWith(
      dispatchId,
      hubOrgId,
      ['PICKING'],
      'IN_TRANSIT',
      expect.objectContaining({ dispatchedById: storeManagerId }),
      prisma,
    );
    expect(fcmService.sendDispatchInTransitPush).toHaveBeenCalledWith(headId, expect.objectContaining({ dispatchId }));
  });

  it('rejects confirming a dispatch that is not PICKING', async () => {
    vi.mocked(branchRepository.findHub).mockResolvedValue({ id: hubOrgId } as never);
    vi.mocked(dispatchRepository.findVisibleTo).mockResolvedValue(
      buildDispatch({ status: 'IN_TRANSIT' }) as never,
    );

    await expect(dispatchService.confirmDispatch(storeActor as never, dispatchId)).rejects.toThrow(ConflictError);
  });
});

describe('dispatchService.receive — D-16 ledger correctness + Q2', () => {
  it('rejects an actor from an org other than the receiving branch', async () => {
    vi.mocked(dispatchRepository.findVisibleTo).mockResolvedValue(buildDispatch({ status: 'IN_TRANSIT' }) as never);
    const thirdBranchHead = {
      id: 'x',
      role: 'CHEF' as const,
      isDepartmentHead: true,
      organizationId: thirdBranchOrgId,
      departmentTag: 'KITCHEN' as const,
    };

    await expect(
      dispatchService.receive(thirdBranchHead as never, dispatchId, { lines: [{ lineId, receivedQty: 8 }] }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('writes exactly one DISPATCH_IN transaction at the department location under the branch org (single-org, D-16)', async () => {
    vi.mocked(dispatchRepository.findVisibleTo)
      .mockResolvedValueOnce(buildDispatch({ status: 'IN_TRANSIT' }) as never)
      .mockResolvedValueOnce(buildDispatch({ status: 'RECEIVED' }) as never);
    vi.mocked(dispatchRepository.transitionStatus).mockResolvedValue(true);
    vi.mocked(inventoryTransactionRepository.sumQuantityByItemAndLocation).mockResolvedValue(d(0));
    vi.mocked(inventoryItemRepository.findById).mockResolvedValue({ currentCost: d(50) } as never);

    await dispatchService.receive(headActor as never, dispatchId, { lines: [{ lineId, receivedQty: 8 }] });

    expect(inventoryTransactionRepository.create).toHaveBeenCalledTimes(1);
    expect(inventoryTransactionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: branchOrgId,
        locationId: deptLocationId,
        type: 'DISPATCH_IN',
        quantity: d(8),
      }),
      prisma,
    );
    expect(fcmService.sendReceiptVariancePush).not.toHaveBeenCalled();
  });

  it('flags variance when received != dispatched, including receiving MORE than dispatched (Q2)', async () => {
    vi.mocked(dispatchRepository.findVisibleTo)
      .mockResolvedValueOnce(buildDispatch({ status: 'IN_TRANSIT' }) as never)
      .mockResolvedValueOnce(buildDispatch({ status: 'RECEIVED' }) as never);
    vi.mocked(dispatchRepository.transitionStatus).mockResolvedValue(true);
    vi.mocked(inventoryTransactionRepository.sumQuantityByItemAndLocation).mockResolvedValue(d(0));
    vi.mocked(inventoryItemRepository.findById).mockResolvedValue({ currentCost: d(50) } as never);

    // dispatchedQty is 8; receiving 9 (more than dispatched) must still succeed and flag variance.
    await dispatchService.receive(headActor as never, dispatchId, { lines: [{ lineId, receivedQty: 9 }] });

    expect(fcmService.sendReceiptVariancePush).toHaveBeenCalledWith(
      hubOrgId,
      expect.objectContaining({ dispatchId }),
    );
  });

  it('rejects receiving a dispatch that is not IN_TRANSIT', async () => {
    vi.mocked(dispatchRepository.findVisibleTo).mockResolvedValue(buildDispatch({ status: 'PICKING' }) as never);

    await expect(
      dispatchService.receive(headActor as never, dispatchId, { lines: [{ lineId, receivedQty: 8 }] }),
    ).rejects.toThrow(ConflictError);
  });
});

describe('dispatchService.createUnsolicited (Q5)', () => {
  it('allows a store dispatch with no requisitionId', async () => {
    vi.mocked(branchRepository.findHub).mockResolvedValue({ id: hubOrgId } as never);
    vi.mocked(locationRepository.findCentralStore).mockResolvedValue({ id: centralStoreId } as never);
    vi.mocked(prisma.location.findUnique).mockResolvedValue({
      id: deptLocationId,
      type: 'BRANCH_DEPARTMENT',
      organizationId: branchOrgId,
    } as never);
    vi.mocked(inventoryItemRepository.findById).mockResolvedValue({ id: itemId, currentCost: d(50) } as never);
    vi.mocked(dispatchRepository.create).mockResolvedValue(
      buildDispatch({ requisitionId: null, requisition: null }) as never,
    );
    vi.mocked(dispatchRepository.findVisibleTo).mockResolvedValue(
      buildDispatch({ requisitionId: null, requisition: null }) as never,
    );

    const result = await dispatchService.createUnsolicited(storeActor as never, {
      toLocationId: deptLocationId,
      lines: [{ inventoryItemId: itemId, dispatchedQty: 5 }],
    });

    expect(dispatchRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ requisitionId: null }),
      prisma,
    );
    expect(result.requisitionId).toBeNull();
  });
});
