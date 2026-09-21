import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { requisitionService } from './requisitions-service';
import { requisitionRepository } from './requisitions-repository';
import { inventoryItemRepository, restockLevelRepository } from '../inventory/inventory-repository';
import { branchRepository } from '../../repositories/branch-repository';
import { locationRepository } from '../../repositories/location-repository';
import { ConflictError, ForbiddenError, NotFoundError } from '../../utils/errors';

vi.mock('./requisitions-repository', () => ({
  requisitionRepository: {
    create: vi.fn(),
    findAllByOrganization: vi.fn(),
    findById: vi.fn(),
    markPendingApprovalIfOpen: vi.fn(),
    findSectionWithLines: vi.fn(),
    findSectionById: vi.fn(),
    updateLineQty: vi.fn(),
    createLine: vi.fn(),
    updateManagerNote: vi.fn(),
    setSectionStatus: vi.fn(),
  },
}));

vi.mock('../inventory/inventory-repository', () => ({
  inventoryItemRepository: { findLiveByIds: vi.fn() },
  restockLevelRepository: { findByItemIdsForLocation: vi.fn() },
}));

vi.mock('../../repositories/location-repository', () => ({
  locationRepository: { findByOrganizationTypeDepartment: vi.fn() },
}));

vi.mock('../../repositories/branch-repository', () => ({
  branchRepository: { findHub: vi.fn() },
}));

const txStub = {};
vi.mock('../../config/database', () => ({
  prisma: {
    $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(txStub)),
    category: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

const branchOrgId = '11111111-1111-4111-8111-111111111111';
const hubOrgId = '99999999-9999-4999-8999-999999999999';
const requisitionId = '22222222-2222-4222-8222-222222222222';
const sectionId = '33333333-3333-4333-8333-333333333333';
const itemId = '44444444-4444-4444-8444-444444444444';
const locationId = '55555555-5555-4555-8555-555555555555';
const lineId = '66666666-6666-4666-8666-666666666666';

const kitchenHead = {
  id: 'head-1',
  role: 'CHEF' as const,
  organizationId: branchOrgId,
  isDepartmentHead: true,
  departmentTag: 'KITCHEN' as const,
};

const baristaHead = {
  id: 'head-2',
  role: 'BARISTA' as const,
  organizationId: branchOrgId,
  isDepartmentHead: true,
  departmentTag: 'BARISTA' as const,
};

const buildSection = (overrides: Record<string, unknown> = {}) => ({
  id: sectionId,
  requisitionId,
  departmentTag: 'KITCHEN' as const,
  status: 'NOT_STARTED' as const,
  submittedById: null,
  submittedAt: null,
  returnedNote: null,
  managerNote: null,
  requisition: { id: requisitionId, status: 'OPEN' as const },
  lines: [],
  ...overrides,
});

const buildLine = (overrides: Record<string, unknown> = {}) => ({
  id: lineId,
  requisitionSectionId: sectionId,
  inventoryItemId: itemId,
  parAtRequest: new Prisma.Decimal(20),
  requestedQty: null,
  approvedQty: null,
  addedFromNote: false,
  editedById: null,
  editReason: null,
  deletedAt: null,
  item: { id: itemId, name: 'Chicken', usageUnit: 'kg', category: null },
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(branchRepository.findHub).mockResolvedValue({ id: hubOrgId, name: 'Central Store', isHub: true, isActive: true } as never);
});

describe('requisitionService.openRequisition', () => {
  it('creates exactly 5 sections (via the repository) for the caller\'s branch', async () => {
    vi.mocked(requisitionRepository.create).mockResolvedValue({
      id: requisitionId,
      organizationId: branchOrgId,
      type: 'MORNING',
      note: null,
      status: 'OPEN',
      openedById: kitchenHead.id,
      openedAt: new Date(),
      approvedById: null,
      approvedAt: null,
    } as never);
    vi.mocked(requisitionRepository.findAllByOrganization).mockResolvedValue([
      {
        id: requisitionId,
        organizationId: branchOrgId,
        type: 'MORNING',
        note: null,
        status: 'OPEN',
        openedById: kitchenHead.id,
        openedAt: new Date(),
        approvedById: null,
        approvedAt: null,
        sections: [
          { departmentTag: 'KITCHEN', status: 'NOT_STARTED' },
          { departmentTag: 'PASTRY', status: 'NOT_STARTED' },
          { departmentTag: 'BARISTA', status: 'NOT_STARTED' },
          { departmentTag: 'SERVICE', status: 'NOT_STARTED' },
          { departmentTag: 'HOUSEKEEPING', status: 'NOT_STARTED' },
        ],
      },
    ] as never);

    const row = await requisitionService.openRequisition(kitchenHead, { type: 'MORNING' });

    expect(requisitionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: branchOrgId, type: 'MORNING', openedById: kitchenHead.id }),
    );
    expect(row.mySectionStatus).toBe('NOT_STARTED');
  });
});

describe('requisitionService — cross-department authorization guard', () => {
  it('getSection throws ForbiddenError when departmentTag !== actor.departmentTag', async () => {
    await expect(requisitionService.getSection(kitchenHead, requisitionId, 'BARISTA')).rejects.toThrow(ForbiddenError);
    expect(requisitionRepository.findSectionWithLines).not.toHaveBeenCalled();
  });

  it('upsertLines throws ForbiddenError when departmentTag !== actor.departmentTag', async () => {
    await expect(
      requisitionService.upsertLines(kitchenHead, requisitionId, 'BARISTA', { lines: [] }),
    ).rejects.toThrow(ForbiddenError);
    expect(requisitionRepository.findSectionById).not.toHaveBeenCalled();
  });

  it('submitSection throws ForbiddenError when departmentTag !== actor.departmentTag', async () => {
    await expect(requisitionService.submitSection(kitchenHead, requisitionId, 'BARISTA')).rejects.toThrow(
      ForbiddenError,
    );
    expect(requisitionRepository.findSectionById).not.toHaveBeenCalled();
  });

  it('recallSection throws ForbiddenError when departmentTag !== actor.departmentTag', async () => {
    await expect(requisitionService.recallSection(kitchenHead, requisitionId, 'BARISTA')).rejects.toThrow(
      ForbiddenError,
    );
    expect(requisitionRepository.findById).not.toHaveBeenCalled();
  });

  it('a Barista head reaching a Kitchen section is also rejected (symmetry check)', async () => {
    await expect(requisitionService.getSection(baristaHead, requisitionId, 'KITCHEN')).rejects.toThrow(
      ForbiddenError,
    );
  });
});

describe('requisitionService.upsertLines', () => {
  it('zero-not-delete: requestedQty "0" keeps the row (updateLineQty called with 0, no delete)', async () => {
    vi.mocked(requisitionRepository.findSectionById).mockResolvedValue(buildSection({ status: 'DRAFT' }) as never);
    vi.mocked(requisitionRepository.findSectionWithLines).mockResolvedValue(
      buildSection({ status: 'DRAFT', lines: [buildLine({ requestedQty: new Prisma.Decimal(0) })] }) as never,
    );

    await requisitionService.upsertLines(kitchenHead, requisitionId, 'KITCHEN', {
      lines: [{ id: lineId, requestedQty: '0' }],
    });

    expect(requisitionRepository.updateLineQty).toHaveBeenCalledWith(lineId, expect.any(Prisma.Decimal), txStub);
    const [, qtyArg] = vi.mocked(requisitionRepository.updateLineQty).mock.calls[0]!;
    expect((qtyArg as Prisma.Decimal).toString()).toBe('0');
  });

  it('rejects when section is SUBMITTED', async () => {
    vi.mocked(requisitionRepository.findSectionById).mockResolvedValue(buildSection({ status: 'SUBMITTED' }) as never);

    await expect(
      requisitionService.upsertLines(kitchenHead, requisitionId, 'KITCHEN', { lines: [{ id: lineId, requestedQty: '5' }] }),
    ).rejects.toThrow(ConflictError);
  });

  it('rejects when section is RETURNED', async () => {
    vi.mocked(requisitionRepository.findSectionById).mockResolvedValue(buildSection({ status: 'RETURNED' }) as never);

    await expect(
      requisitionService.upsertLines(kitchenHead, requisitionId, 'KITCHEN', { lines: [{ id: lineId, requestedQty: '5' }] }),
    ).rejects.toThrow(ConflictError);
  });

  it('validates a new line\'s inventoryItemId against the hub org, not the branch org (regression: catalog lives on the hub only, D-15)', async () => {
    vi.mocked(requisitionRepository.findSectionById).mockResolvedValue(buildSection({ status: 'DRAFT' }) as never);
    vi.mocked(inventoryItemRepository.findLiveByIds).mockResolvedValue([{ id: itemId }] as never);
    vi.mocked(locationRepository.findByOrganizationTypeDepartment).mockResolvedValue({ id: locationId } as never);
    vi.mocked(restockLevelRepository.findByItemIdsForLocation).mockResolvedValue(new Map());
    vi.mocked(requisitionRepository.findSectionWithLines).mockResolvedValue(buildSection({ status: 'DRAFT' }) as never);

    await requisitionService.upsertLines(kitchenHead, requisitionId, 'KITCHEN', {
      lines: [{ inventoryItemId: itemId, requestedQty: '3' }],
    });

    expect(inventoryItemRepository.findLiveByIds).toHaveBeenCalledWith([itemId], hubOrgId);
    expect(inventoryItemRepository.findLiveByIds).not.toHaveBeenCalledWith([itemId], branchOrgId);
  });

  it('parAtRequest snapshot is null when no RestockLevel row exists', async () => {
    vi.mocked(requisitionRepository.findSectionById).mockResolvedValue(buildSection({ status: 'DRAFT' }) as never);
    vi.mocked(inventoryItemRepository.findLiveByIds).mockResolvedValue([{ id: itemId }] as never);
    vi.mocked(locationRepository.findByOrganizationTypeDepartment).mockResolvedValue({ id: locationId } as never);
    vi.mocked(restockLevelRepository.findByItemIdsForLocation).mockResolvedValue(new Map());
    vi.mocked(requisitionRepository.findSectionWithLines).mockResolvedValue(buildSection({ status: 'DRAFT' }) as never);

    await requisitionService.upsertLines(kitchenHead, requisitionId, 'KITCHEN', {
      lines: [{ inventoryItemId: itemId, requestedQty: '3' }],
    });

    expect(requisitionRepository.createLine).toHaveBeenCalledWith(
      sectionId,
      expect.objectContaining({ inventoryItemId: itemId, parAtRequest: null }),
      txStub,
    );
  });

  it('parAtRequest snapshot is the real value when a RestockLevel row exists', async () => {
    vi.mocked(requisitionRepository.findSectionById).mockResolvedValue(buildSection({ status: 'DRAFT' }) as never);
    vi.mocked(inventoryItemRepository.findLiveByIds).mockResolvedValue([{ id: itemId }] as never);
    vi.mocked(locationRepository.findByOrganizationTypeDepartment).mockResolvedValue({ id: locationId } as never);
    vi.mocked(restockLevelRepository.findByItemIdsForLocation).mockResolvedValue(
      new Map([[itemId, new Prisma.Decimal(20)]]),
    );
    vi.mocked(requisitionRepository.findSectionWithLines).mockResolvedValue(buildSection({ status: 'DRAFT' }) as never);

    await requisitionService.upsertLines(kitchenHead, requisitionId, 'KITCHEN', {
      lines: [{ inventoryItemId: itemId, requestedQty: '3' }],
    });

    const [, dataArg] = vi.mocked(requisitionRepository.createLine).mock.calls[0]!;
    expect((dataArg.parAtRequest as Prisma.Decimal).toString()).toBe('20');
  });
});

describe('requisitionService.submitSection', () => {
  it('transitions NOT_STARTED/DRAFT/RETURNED -> SUBMITTED and flips parent status once', async () => {
    vi.mocked(requisitionRepository.findSectionById).mockResolvedValue(buildSection({ status: 'DRAFT' }) as never);
    vi.mocked(requisitionRepository.setSectionStatus).mockResolvedValue(1);
    vi.mocked(requisitionRepository.findSectionWithLines).mockResolvedValue(buildSection({ status: 'SUBMITTED' }) as never);

    await requisitionService.submitSection(kitchenHead, requisitionId, 'KITCHEN');

    expect(requisitionRepository.setSectionStatus).toHaveBeenCalledWith(
      sectionId,
      ['NOT_STARTED', 'DRAFT', 'RETURNED'],
      expect.objectContaining({ status: 'SUBMITTED' }),
      txStub,
    );
    expect(requisitionRepository.markPendingApprovalIfOpen).toHaveBeenCalledWith(requisitionId, txStub);
  });

  it('resubmit (from RETURNED) clears returnedNote server-side (regression: resubmit was previously rejected as a state-machine bug)', async () => {
    vi.mocked(requisitionRepository.findSectionById).mockResolvedValue(
      buildSection({ status: 'RETURNED', returnedNote: 'Check the walk-in count first' }) as never,
    );
    vi.mocked(requisitionRepository.setSectionStatus).mockResolvedValue(1);
    vi.mocked(requisitionRepository.findSectionWithLines).mockResolvedValue(buildSection({ status: 'SUBMITTED' }) as never);

    await requisitionService.submitSection(kitchenHead, requisitionId, 'KITCHEN');

    expect(requisitionRepository.setSectionStatus).toHaveBeenCalledWith(
      sectionId,
      ['NOT_STARTED', 'DRAFT', 'RETURNED'],
      expect.objectContaining({ status: 'SUBMITTED', returnedNote: null }),
      txStub,
    );
  });

  it('throws ConflictError on a simulated zero-count race (already submitted concurrently)', async () => {
    vi.mocked(requisitionRepository.findSectionById).mockResolvedValue(buildSection({ status: 'DRAFT' }) as never);
    vi.mocked(requisitionRepository.setSectionStatus).mockResolvedValue(0);

    await expect(requisitionService.submitSection(kitchenHead, requisitionId, 'KITCHEN')).rejects.toThrow(
      ConflictError,
    );
  });
});

describe('requisitionService.recallSection', () => {
  it('transitions SUBMITTED -> DRAFT', async () => {
    vi.mocked(requisitionRepository.findById).mockResolvedValue({ id: requisitionId, status: 'PENDING_APPROVAL' } as never);
    vi.mocked(requisitionRepository.findSectionById).mockResolvedValue(buildSection({ status: 'SUBMITTED' }) as never);
    vi.mocked(requisitionRepository.setSectionStatus).mockResolvedValue(1);
    vi.mocked(requisitionRepository.findSectionWithLines).mockResolvedValue(buildSection({ status: 'DRAFT' }) as never);

    await requisitionService.recallSection(kitchenHead, requisitionId, 'KITCHEN');

    expect(requisitionRepository.setSectionStatus).toHaveBeenCalledWith(sectionId, ['SUBMITTED'], { status: 'DRAFT' }, txStub);
  });

  it('rejected when requisition is APPROVED', async () => {
    vi.mocked(requisitionRepository.findById).mockResolvedValue({ id: requisitionId, status: 'APPROVED' } as never);

    await expect(requisitionService.recallSection(kitchenHead, requisitionId, 'KITCHEN')).rejects.toThrow(
      ConflictError,
    );
  });

  it('throws NotFoundError when the requisition does not exist', async () => {
    vi.mocked(requisitionRepository.findById).mockResolvedValue(null);

    await expect(requisitionService.recallSection(kitchenHead, requisitionId, 'KITCHEN')).rejects.toThrow(
      NotFoundError,
    );
  });
});
