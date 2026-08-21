import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../config/database';
import { requisitionRepository } from '../repositories/requisition-repository';
import { locationRepository } from '../repositories/location-repository';
import { inventoryItemRepository } from '../repositories/inventory-item-repository';
import { inventoryTransactionRepository } from '../repositories/inventory-transaction-repository';
import { parLevelRepository } from '../repositories/par-level-repository';
import { branchRepository } from '../repositories/branch-repository';
import { fcmService } from './fcm-service';
import { requisitionService } from './requisition-service';
import { ConflictError, ForbiddenError, ValidationError } from '../utils/errors';

vi.mock('../config/database', () => ({
  prisma: { $transaction: vi.fn() },
}));

vi.mock('../repositories/requisition-repository', () => ({
  requisitionRepository: {
    create: vi.fn(),
    findById: vi.fn(),
    findAllByOrganization: vi.fn(),
    transitionStatus: vi.fn(),
    updateLineApprovedQty: vi.fn(),
    replaceLines: vi.fn(),
  },
}));

vi.mock('../repositories/location-repository', () => ({
  locationRepository: {
    findByOrganizationTypeDepartment: vi.fn(),
    findCentralStore: vi.fn(),
  },
}));

vi.mock('../repositories/inventory-item-repository', () => ({
  inventoryItemRepository: {
    findById: vi.fn(),
    findAllByOrganization: vi.fn(),
  },
}));

vi.mock('../repositories/inventory-transaction-repository', () => ({
  inventoryTransactionRepository: {
    sumQuantityByItemAndLocation: vi.fn(),
  },
}));

vi.mock('../repositories/par-level-repository', () => ({
  parLevelRepository: {
    findByLocationAndItem: vi.fn(),
  },
}));

vi.mock('../repositories/branch-repository', () => ({
  branchRepository: {
    findHub: vi.fn(),
  },
}));

vi.mock('./fcm-service', () => ({
  fcmService: {
    sendRequisitionSubmittedPush: vi.fn(),
    sendRequisitionDecisionPush: vi.fn(),
  },
}));

const d = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);

const branchOrgId = '11111111-1111-4111-8111-111111111111';
const otherBranchOrgId = '99999999-9999-4999-8999-999999999999';
const hubOrgId = '22222222-2222-4222-8222-222222222222';
const headId = '33333333-3333-4333-8333-333333333333';
const managerId = '44444444-4444-4444-8444-444444444444';
const locationId = '55555555-5555-4555-8555-555555555555';
const itemId = '66666666-6666-4666-8666-666666666666';
const reqId = '77777777-7777-4777-8777-777777777777';
const lineId = '88888888-8888-4888-8888-888888888888';

const headActor = {
  id: headId,
  role: 'DEPARTMENT_HEAD' as const,
  organizationId: branchOrgId,
  departmentTag: 'KITCHEN' as const,
};

const managerActor = { id: managerId, role: 'MANAGER' as const, organizationId: branchOrgId };
const otherManagerActor = { id: 'zz', role: 'MANAGER' as const, organizationId: otherBranchOrgId };

const buildRequisition = (overrides: Record<string, unknown> = {}) => ({
  id: reqId,
  organizationId: branchOrgId,
  locationId,
  requestedById: headId,
  status: 'PENDING_MANAGER_APPROVAL' as const,
  approvedById: null,
  approvedAt: null,
  rejectionReason: null,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  location: { id: locationId, name: 'Kitchen', departmentTag: 'KITCHEN' },
  requestedBy: { id: headId, name: 'Head One', role: 'DEPARTMENT_HEAD' },
  approvedBy: null,
  lines: [
    {
      id: lineId,
      requisitionId: reqId,
      inventoryItemId: itemId,
      requestedQty: d(10),
      approvedQty: null,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      inventoryItem: { id: itemId, name: 'Tomatoes', buyUnit: 'kg', usageUnit: 'kg', currentCost: d(50) },
    },
  ],
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.$transaction).mockImplementation((fn) => (fn as (tx: unknown) => Promise<unknown>)(prisma));
});

describe('requisitionService.raise', () => {
  it('rejects a non-department-head actor', async () => {
    await expect(
      requisitionService.raise(managerActor as never, { lines: [{ inventoryItemId: itemId, requestedQty: 5 }] }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('rejects an item not tagged for the department (D-1b)', async () => {
    vi.mocked(locationRepository.findByOrganizationTypeDepartment).mockResolvedValue({
      id: locationId,
    } as never);
    vi.mocked(branchRepository.findHub).mockResolvedValue({ id: hubOrgId } as never);
    vi.mocked(inventoryItemRepository.findById).mockResolvedValue({
      id: itemId,
      name: 'Coffee Beans',
      departmentTags: ['BARISTA'],
    } as never);

    await expect(
      requisitionService.raise(headActor as never, { lines: [{ inventoryItemId: itemId, requestedQty: 5 }] }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('creates a PENDING_MANAGER_APPROVAL requisition and notifies the branch Manager', async () => {
    vi.mocked(locationRepository.findByOrganizationTypeDepartment).mockResolvedValue({
      id: locationId,
    } as never);
    vi.mocked(branchRepository.findHub).mockResolvedValue({ id: hubOrgId } as never);
    vi.mocked(inventoryItemRepository.findById).mockResolvedValue({
      id: itemId,
      name: 'Tomatoes',
      departmentTags: ['KITCHEN'],
    } as never);
    vi.mocked(requisitionRepository.create).mockResolvedValue(buildRequisition() as never);

    const result = await requisitionService.raise(headActor as never, {
      lines: [{ inventoryItemId: itemId, requestedQty: 10 }],
    });

    expect(result.status).toBe('PENDING_MANAGER_APPROVAL');
    expect(requisitionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: branchOrgId, locationId, requestedById: headId }),
    );
    expect(fcmService.sendRequisitionSubmittedPush).toHaveBeenCalled();
  });
});

describe('requisitionService.approve', () => {
  it('rejects a Manager from a different branch', async () => {
    vi.mocked(requisitionRepository.findById).mockResolvedValue(buildRequisition() as never);

    await expect(
      requisitionService.approve(otherManagerActor as never, reqId, { lines: [] }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('rejects approving a requisition not PENDING_MANAGER_APPROVAL', async () => {
    vi.mocked(requisitionRepository.findById).mockResolvedValue(
      buildRequisition({ status: 'APPROVED' }) as never,
    );

    await expect(requisitionService.approve(managerActor as never, reqId, { lines: [] })).rejects.toThrow(
      ConflictError,
    );
  });

  it('preserves requestedQty and sets approvedQty when the Manager edits a line', async () => {
    vi.mocked(requisitionRepository.findById)
      .mockResolvedValueOnce(buildRequisition() as never)
      .mockResolvedValueOnce(buildRequisition({ status: 'APPROVED', approvedById: managerId }) as never);
    vi.mocked(requisitionRepository.transitionStatus).mockResolvedValue(true);

    await requisitionService.approve(managerActor as never, reqId, {
      lines: [{ lineId, approvedQty: 6 }],
    });

    // requestedQty (10) must never be touched — only approvedQty is written.
    expect(requisitionRepository.updateLineApprovedQty).toHaveBeenCalledWith(lineId, reqId, 6, prisma);
    expect(requisitionRepository.transitionStatus).toHaveBeenCalledWith(
      reqId,
      branchOrgId,
      ['PENDING_MANAGER_APPROVAL'],
      'APPROVED',
      expect.objectContaining({ approvedById: managerId }),
      prisma,
    );
  });

  it('approves an un-edited line as requested (approvedQty = requestedQty)', async () => {
    vi.mocked(requisitionRepository.findById)
      .mockResolvedValueOnce(buildRequisition() as never)
      .mockResolvedValueOnce(buildRequisition({ status: 'APPROVED' }) as never);
    vi.mocked(requisitionRepository.transitionStatus).mockResolvedValue(true);

    await requisitionService.approve(managerActor as never, reqId, { lines: [] });

    expect(requisitionRepository.updateLineApprovedQty).toHaveBeenCalledWith(lineId, reqId, d(10), prisma);
  });

  it('treats an explicit approvedQty of 0 as a valid decision, not "not yet approved"', async () => {
    vi.mocked(requisitionRepository.findById)
      .mockResolvedValueOnce(buildRequisition() as never)
      .mockResolvedValueOnce(buildRequisition({ status: 'APPROVED' }) as never);
    vi.mocked(requisitionRepository.transitionStatus).mockResolvedValue(true);

    await requisitionService.approve(managerActor as never, reqId, { lines: [{ lineId, approvedQty: 0 }] });

    expect(requisitionRepository.updateLineApprovedQty).toHaveBeenCalledWith(lineId, reqId, 0, prisma);
  });
});

describe('requisitionService.reject', () => {
  it('requires a reason', async () => {
    await expect(requisitionService.reject(managerActor as never, reqId, '')).rejects.toThrow(ValidationError);
  });

  it('rejects with a reason and notifies the department head', async () => {
    vi.mocked(requisitionRepository.findById)
      .mockResolvedValueOnce(buildRequisition() as never)
      .mockResolvedValueOnce(buildRequisition({ status: 'REJECTED', rejectionReason: 'Over budget' }) as never);
    vi.mocked(requisitionRepository.transitionStatus).mockResolvedValue(true);

    const result = await requisitionService.reject(managerActor as never, reqId, 'Over budget');

    expect(result.status).toBe('REJECTED');
    expect(fcmService.sendRequisitionDecisionPush).toHaveBeenCalledWith(
      headId,
      expect.objectContaining({ decision: 'REJECTED', reason: 'Over budget' }),
    );
  });
});

describe('requisitionService.cancel', () => {
  it('rejects a non-raiser', async () => {
    vi.mocked(requisitionRepository.findById).mockResolvedValue(buildRequisition() as never);

    await expect(requisitionService.cancel(managerActor as never, reqId)).rejects.toThrow(ForbiddenError);
  });

  it('cancels a pending requisition raised by the actor', async () => {
    vi.mocked(requisitionRepository.findById)
      .mockResolvedValueOnce(buildRequisition() as never)
      .mockResolvedValueOnce(buildRequisition({ status: 'CANCELLED' }) as never);
    vi.mocked(requisitionRepository.transitionStatus).mockResolvedValue(true);

    const result = await requisitionService.cancel(headActor as never, reqId);
    expect(result.status).toBe('CANCELLED');
  });
});

describe('requisitionService.editAndResubmit (Q6)', () => {
  it('rejects editing a requisition that is not REJECTED', async () => {
    vi.mocked(requisitionRepository.findById).mockResolvedValue(
      buildRequisition({ status: 'PENDING_MANAGER_APPROVAL' }) as never,
    );

    await expect(
      requisitionService.editAndResubmit(headActor as never, reqId, {
        lines: [{ inventoryItemId: itemId, requestedQty: 5 }],
      }),
    ).rejects.toThrow(ConflictError);
  });

  it('replaces lines and resubmits a rejected requisition, keeping the audit trail intact', async () => {
    vi.mocked(requisitionRepository.findById)
      .mockResolvedValueOnce(buildRequisition({ status: 'REJECTED' }) as never)
      .mockResolvedValueOnce(buildRequisition({ status: 'PENDING_MANAGER_APPROVAL' }) as never);
    vi.mocked(branchRepository.findHub).mockResolvedValue({ id: hubOrgId } as never);
    vi.mocked(inventoryItemRepository.findById).mockResolvedValue({
      id: itemId,
      name: 'Tomatoes',
      departmentTags: ['KITCHEN'],
    } as never);

    const result = await requisitionService.editAndResubmit(headActor as never, reqId, {
      lines: [{ inventoryItemId: itemId, requestedQty: 12 }],
    });

    expect(requisitionRepository.replaceLines).toHaveBeenCalled();
    expect(result.status).toBe('PENDING_MANAGER_APPROVAL');
  });
});

describe('requisitionService.listOrderableItems', () => {
  it('only returns items tagged for the actor department, with suggested qty = par - onHand', async () => {
    vi.mocked(branchRepository.findHub).mockResolvedValue({ id: hubOrgId } as never);
    vi.mocked(inventoryItemRepository.findAllByOrganization).mockResolvedValue([
      { id: itemId, name: 'Tomatoes', departmentTags: ['KITCHEN'] },
      { id: 'other-item', name: 'Coffee Beans', departmentTags: ['BARISTA'] },
    ] as never);
    vi.mocked(locationRepository.findByOrganizationTypeDepartment).mockResolvedValue({
      id: locationId,
    } as never);
    vi.mocked(inventoryTransactionRepository.sumQuantityByItemAndLocation).mockResolvedValue(d(4));
    vi.mocked(parLevelRepository.findByLocationAndItem).mockResolvedValue({ parQty: d(10) } as never);

    const result = await requisitionService.listOrderableItems(headActor as never);

    expect(result).toHaveLength(1);
    expect(result[0]!.item.id).toBe(itemId);
    expect(result[0]!.suggestedQty!.toString()).toBe('6');
  });
});
