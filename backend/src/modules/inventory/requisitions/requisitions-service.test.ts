import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { requisitionService } from './requisitions-service';
import { requisitionRepository } from './requisitions-repository';
import { inventoryItemRepository, restockLevelRepository } from '../catalog/inventory-repository';
import { branchRepository } from '../../../repositories/branch-repository';
import { locationRepository } from '../../../repositories/location-repository';
import { authRepository } from '../../../repositories/auth-repository';
import { socketService } from '../../../sockets/socket-service';
import { fcmService } from '../../../services/fcm-service';
import { comparePin } from '../../../utils/password';
import { ConflictError, ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from '../../../utils/errors';

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
    findByIdWithAllSections: vi.fn(),
    findAllByOrganizationForManager: vi.fn(),
    updateLineApproval: vi.fn(),
    softDeleteLine: vi.fn(),
    createManagerLine: vi.fn(),
    markApprovedIfPendingApproval: vi.fn(),
    findHistoryRows: vi.fn(),
    findBranchManagers: vi.fn().mockResolvedValue([]),
    findSectionHeads: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../catalog/inventory-repository', () => ({
  inventoryItemRepository: { findLiveByIds: vi.fn() },
  restockLevelRepository: { findByItemIdsForLocation: vi.fn() },
}));

vi.mock('../../../repositories/location-repository', () => ({
  locationRepository: { findByOrganizationTypeDepartment: vi.fn() },
}));

vi.mock('../../../repositories/branch-repository', () => ({
  branchRepository: { findHub: vi.fn() },
}));

vi.mock('../../../repositories/auth-repository', () => ({
  authRepository: { findUserByIdWithPassword: vi.fn() },
}));

vi.mock('../../../sockets/socket-service', () => ({
  socketService: {
    emitRequisitionSubmitted: vi.fn(),
    emitRequisitionDecision: vi.fn(),
    emitRequisitionSectionReturned: vi.fn(),
    emitRequisitionNudge: vi.fn(),
  },
}));

vi.mock('../../../services/fcm-service', () => ({
  fcmService: {
    sendRequisitionSubmittedPush: vi.fn().mockResolvedValue(undefined),
    sendRequisitionDecisionPush: vi.fn().mockResolvedValue(undefined),
    sendRequisitionSectionReturnedPush: vi.fn().mockResolvedValue(undefined),
    sendRequisitionNudgePush: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../../utils/password', () => ({
  comparePin: vi.fn(),
}));

const txStub = {};
vi.mock('../../../config/database', () => ({
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

const manager = {
  id: 'manager-1',
  role: 'MANAGER' as const,
  organizationId: branchOrgId,
  isDepartmentHead: false,
  departmentTag: null,
};

const otherOrgId = '77777777-7777-4777-8777-777777777777';

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
  vi.mocked(requisitionRepository.findBranchManagers).mockResolvedValue([]);
  vi.mocked(requisitionRepository.findSectionHeads).mockResolvedValue([]);
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

// ---------------------------------------------------------------------------
// Session B — Branch Manager approval.
// ---------------------------------------------------------------------------

const buildApprovalSection = (overrides: Record<string, unknown> = {}) => ({
  id: sectionId,
  requisitionId,
  departmentTag: 'KITCHEN' as const,
  status: 'SUBMITTED' as const,
  submittedById: 'head-1',
  submittedAt: new Date(),
  returnedNote: null,
  managerNote: null,
  submittedBy: { id: 'head-1', name: 'Kitchen Head' },
  lines: [],
  ...overrides,
});

const buildApprovalLine = (overrides: Record<string, unknown> = {}) => ({
  id: lineId,
  requisitionSectionId: sectionId,
  inventoryItemId: itemId,
  parAtRequest: new Prisma.Decimal(20),
  requestedQty: new Prisma.Decimal(14),
  approvedQty: null,
  addedFromNote: false,
  editedById: null,
  editReason: null,
  deletedAt: null,
  item: { id: itemId, name: 'Chicken', usageUnit: 'kg', category: null },
  ...overrides,
});

const buildRequisitionWithSections = (sections: unknown[], overrides: Record<string, unknown> = {}) => ({
  id: requisitionId,
  organizationId: branchOrgId,
  type: 'MORNING' as const,
  note: null,
  status: 'PENDING_APPROVAL' as const,
  openedById: 'head-1',
  openedAt: new Date(),
  approvedById: null,
  approvedAt: null,
  approvedBy: null,
  sections,
  dispatches: [],
  ...overrides,
});

describe('requisitionService — manager authorization guard', () => {
  it('getRequisitionForApproval throws ForbiddenError for a department head', async () => {
    await expect(requisitionService.getRequisitionForApproval(kitchenHead, requisitionId)).rejects.toThrow(ForbiddenError);
    expect(requisitionRepository.findByIdWithAllSections).not.toHaveBeenCalled();
  });

  it('getRequisitionForApproval throws NotFoundError (not a 403 leak) for another org\'s requisition', async () => {
    vi.mocked(requisitionRepository.findByIdWithAllSections).mockResolvedValue(null);
    await expect(requisitionService.getRequisitionForApproval({ ...manager, organizationId: otherOrgId }, requisitionId)).rejects.toThrow(
      NotFoundError,
    );
  });
});

describe('requisitionService.getRequisitionForApproval', () => {
  it('serializes onHand as null on every line', async () => {
    vi.mocked(requisitionRepository.findByIdWithAllSections).mockResolvedValue(
      buildRequisitionWithSections([buildApprovalSection({ lines: [buildApprovalLine()] })]) as never,
    );

    const detail = await requisitionService.getRequisitionForApproval(manager, requisitionId);

    expect(detail.sections[0]!.lines[0]!.onHand).toBeNull();
  });

  it('isAsRequested is true and changedLineCount is 0 when no line differs', async () => {
    vi.mocked(requisitionRepository.findByIdWithAllSections).mockResolvedValue(
      buildRequisitionWithSections([
        buildApprovalSection({ lines: [buildApprovalLine({ requestedQty: new Prisma.Decimal('14.0000'), approvedQty: new Prisma.Decimal('14') })] }),
      ]) as never,
    );

    const detail = await requisitionService.getRequisitionForApproval(manager, requisitionId);

    expect(detail.sections[0]!.isAsRequested).toBe(true);
    expect(detail.sections[0]!.changedLineCount).toBe(0);
  });

  it('a never-reviewed line (approvedQty null) is not edited — regression: null was compared to requestedQty as "changed"', async () => {
    vi.mocked(requisitionRepository.findByIdWithAllSections).mockResolvedValue(
      buildRequisitionWithSections([
        buildApprovalSection({ lines: [buildApprovalLine({ requestedQty: new Prisma.Decimal('2'), approvedQty: null })] }),
      ]) as never,
    );

    const detail = await requisitionService.getRequisitionForApproval(manager, requisitionId);

    expect(detail.sections[0]!.lines[0]!.isEdited).toBe(false);
    expect(detail.sections[0]!.isAsRequested).toBe(true);
    expect(detail.sections[0]!.changedLineCount).toBe(0);
  });

  it('a never-reviewed line (approvedQty still null) is NOT edited, even though it differs from requestedQty as a raw value (regression: null was miscounted as "changed")', async () => {
    vi.mocked(requisitionRepository.findByIdWithAllSections).mockResolvedValue(
      buildRequisitionWithSections([
        buildApprovalSection({ lines: [buildApprovalLine({ requestedQty: new Prisma.Decimal('2'), approvedQty: null })] }),
      ]) as never,
    );

    const detail = await requisitionService.getRequisitionForApproval(manager, requisitionId);

    expect(detail.sections[0]!.lines[0]!.isEdited).toBe(false);
    expect(detail.sections[0]!.isAsRequested).toBe(true);
    expect(detail.sections[0]!.changedLineCount).toBe(0);
  });
});

describe('requisitionService.upsertApprovalLines', () => {
  it('change without a reason throws ValidationError', async () => {
    vi.mocked(requisitionRepository.findById).mockResolvedValue({ id: requisitionId, status: 'PENDING_APPROVAL' } as never);
    vi.mocked(requisitionRepository.findSectionWithLines).mockResolvedValue(
      buildSection({ status: 'SUBMITTED', lines: [buildApprovalLine({ requestedQty: new Prisma.Decimal(14) })] }) as never,
    );

    await expect(
      requisitionService.upsertApprovalLines(manager, requisitionId, 'KITCHEN', { lines: [{ id: lineId, approvedQty: '20' }] }),
    ).rejects.toThrow(ValidationError);
  });

  it('equal value with no reason succeeds — the decimal trap: "14" vs Decimal("14.0000")', async () => {
    vi.mocked(requisitionRepository.findById).mockResolvedValue({ id: requisitionId, status: 'PENDING_APPROVAL' } as never);
    vi.mocked(requisitionRepository.findSectionWithLines).mockResolvedValue(
      buildSection({ status: 'SUBMITTED', lines: [buildApprovalLine({ requestedQty: new Prisma.Decimal('14.0000') })] }) as never,
    );

    await requisitionService.upsertApprovalLines(manager, requisitionId, 'KITCHEN', {
      lines: [{ id: lineId, approvedQty: '14' }],
    });

    expect(requisitionRepository.updateLineApproval).toHaveBeenCalledWith(
      lineId,
      expect.objectContaining({ editReason: null }),
      txStub,
    );
  });

  it('sets editedById on the update', async () => {
    vi.mocked(requisitionRepository.findById).mockResolvedValue({ id: requisitionId, status: 'PENDING_APPROVAL' } as never);
    vi.mocked(requisitionRepository.findSectionWithLines).mockResolvedValue(
      buildSection({ status: 'SUBMITTED', lines: [buildApprovalLine({ requestedQty: new Prisma.Decimal(14) })] }) as never,
    );

    await requisitionService.upsertApprovalLines(manager, requisitionId, 'KITCHEN', {
      lines: [{ id: lineId, approvedQty: '20', editReason: 'Low stock' }],
    });

    expect(requisitionRepository.updateLineApproval).toHaveBeenCalledWith(
      lineId,
      expect.objectContaining({ editedById: manager.id, editReason: 'Low stock' }),
      txStub,
    );
  });

  it('deleted: true soft-deletes the line', async () => {
    vi.mocked(requisitionRepository.findById).mockResolvedValue({ id: requisitionId, status: 'PENDING_APPROVAL' } as never);
    vi.mocked(requisitionRepository.findSectionWithLines).mockResolvedValue(
      buildSection({ status: 'SUBMITTED', lines: [buildApprovalLine({ requestedQty: new Prisma.Decimal(14) })] }) as never,
    );

    await requisitionService.upsertApprovalLines(manager, requisitionId, 'KITCHEN', {
      lines: [{ id: lineId, approvedQty: null, deleted: true }],
    });

    expect(requisitionRepository.softDeleteLine).toHaveBeenCalledWith(lineId, txStub);
    expect(requisitionRepository.updateLineApproval).not.toHaveBeenCalled();
  });

  it('editing an approved requisition throws ConflictError', async () => {
    vi.mocked(requisitionRepository.findById).mockResolvedValue({ id: requisitionId, status: 'APPROVED' } as never);

    await expect(
      requisitionService.upsertApprovalLines(manager, requisitionId, 'KITCHEN', { lines: [{ id: lineId, approvedQty: '20' }] }),
    ).rejects.toThrow(ConflictError);
  });

  it('a manager-added line keeps requestedQty null and sets approvedQty (decision #5)', async () => {
    vi.mocked(requisitionRepository.findById).mockResolvedValue({ id: requisitionId, status: 'PENDING_APPROVAL' } as never);
    vi.mocked(requisitionRepository.findSectionWithLines).mockResolvedValue(buildSection({ status: 'SUBMITTED', lines: [] }) as never);
    vi.mocked(inventoryItemRepository.findLiveByIds).mockResolvedValue([{ id: itemId }] as never);

    await requisitionService.upsertApprovalLines(manager, requisitionId, 'KITCHEN', {
      lines: [{ inventoryItemId: itemId, approvedQty: '5', editReason: 'Ran low mid-shift' }],
    });

    expect(requisitionRepository.createManagerLine).toHaveBeenCalledWith(
      sectionId,
      expect.objectContaining({ inventoryItemId: itemId, editedById: manager.id }),
      txStub,
    );
  });

  describe('fillMyself', () => {
    it('requestedQty: null + approvedQty set; section NOT_STARTED -> SUBMITTED with submittedById = manager.id; calls markPendingApprovalIfOpen', async () => {
      vi.mocked(requisitionRepository.findById).mockResolvedValue({ id: requisitionId, status: 'OPEN' } as never);
      vi.mocked(requisitionRepository.findSectionWithLines).mockResolvedValue(buildSection({ status: 'NOT_STARTED', lines: [] }) as never);
      vi.mocked(requisitionRepository.setSectionStatus).mockResolvedValue(1);
      vi.mocked(inventoryItemRepository.findLiveByIds).mockResolvedValue([{ id: itemId }] as never);

      await requisitionService.upsertApprovalLines(manager, requisitionId, 'KITCHEN', {
        lines: [{ inventoryItemId: itemId, approvedQty: '10' }],
        fillMyself: true,
      });

      expect(requisitionRepository.setSectionStatus).toHaveBeenCalledWith(
        sectionId,
        ['NOT_STARTED', 'DRAFT'],
        expect.objectContaining({ status: 'SUBMITTED', submittedById: manager.id }),
        txStub,
      );
      expect(requisitionRepository.markPendingApprovalIfOpen).toHaveBeenCalledWith(requisitionId, txStub);
    });

    it('head-submitted-first throws ConflictError before writing', async () => {
      vi.mocked(requisitionRepository.findById).mockResolvedValue({ id: requisitionId, status: 'PENDING_APPROVAL' } as never);
      vi.mocked(requisitionRepository.findSectionWithLines).mockResolvedValue(buildSection({ status: 'SUBMITTED', lines: [] }) as never);

      await expect(
        requisitionService.upsertApprovalLines(manager, requisitionId, 'KITCHEN', { lines: [], fillMyself: true }),
      ).rejects.toThrow(ConflictError);
    });

    it('already-submitted (race) throws ConflictError', async () => {
      vi.mocked(requisitionRepository.findById).mockResolvedValue({ id: requisitionId, status: 'OPEN' } as never);
      vi.mocked(requisitionRepository.findSectionWithLines).mockResolvedValue(buildSection({ status: 'NOT_STARTED', lines: [] }) as never);
      vi.mocked(requisitionRepository.setSectionStatus).mockResolvedValue(0);

      await expect(
        requisitionService.upsertApprovalLines(manager, requisitionId, 'KITCHEN', { lines: [], fillMyself: true }),
      ).rejects.toThrow(ConflictError);
    });
  });
});

describe('requisitionService.returnSection', () => {
  it('sets the note and transitions SUBMITTED -> RETURNED', async () => {
    vi.mocked(requisitionRepository.findById).mockResolvedValue({ id: requisitionId, status: 'PENDING_APPROVAL' } as never);
    vi.mocked(requisitionRepository.findSectionWithLines).mockResolvedValue(buildApprovalSection() as never);
    vi.mocked(requisitionRepository.setSectionStatus).mockResolvedValue(1);
    vi.mocked(requisitionRepository.findByIdWithAllSections).mockResolvedValue(buildRequisitionWithSections([]) as never);

    await requisitionService.returnSection(manager, requisitionId, 'KITCHEN', { note: 'Check the walk-in first' });

    expect(requisitionRepository.setSectionStatus).toHaveBeenCalledWith(
      sectionId,
      ['SUBMITTED'],
      { status: 'RETURNED', returnedNote: 'Check the walk-in first' },
      txStub,
    );
  });

  it('count 0 throws ConflictError', async () => {
    vi.mocked(requisitionRepository.findById).mockResolvedValue({ id: requisitionId, status: 'PENDING_APPROVAL' } as never);
    vi.mocked(requisitionRepository.findSectionWithLines).mockResolvedValue(buildApprovalSection() as never);
    vi.mocked(requisitionRepository.setSectionStatus).mockResolvedValue(0);

    await expect(requisitionService.returnSection(manager, requisitionId, 'KITCHEN', { note: 'x' })).rejects.toThrow(ConflictError);
  });

  it('return on an approved requisition throws ConflictError', async () => {
    vi.mocked(requisitionRepository.findById).mockResolvedValue({ id: requisitionId, status: 'APPROVED' } as never);

    await expect(requisitionService.returnSection(manager, requisitionId, 'KITCHEN', { note: 'x' })).rejects.toThrow(ConflictError);
  });
});

describe('requisitionService.nudgeHead', () => {
  it('makes no state change and does notify', async () => {
    vi.mocked(requisitionRepository.findSectionById).mockResolvedValue(buildSection({ status: 'NOT_STARTED' }) as never);
    vi.mocked(requisitionRepository.findSectionHeads).mockResolvedValue([{ id: 'head-1', name: 'Kitchen Head' }]);

    await requisitionService.nudgeHead(manager, requisitionId, 'KITCHEN');
    await Promise.resolve();
    await Promise.resolve();

    expect(requisitionRepository.setSectionStatus).not.toHaveBeenCalled();
    expect(socketService.emitRequisitionNudge).toHaveBeenCalledWith('head-1', expect.objectContaining({ requisitionId }));
  });

  it('nudge on a submitted section throws ConflictError', async () => {
    vi.mocked(requisitionRepository.findSectionById).mockResolvedValue(buildSection({ status: 'SUBMITTED' }) as never);

    await expect(requisitionService.nudgeHead(manager, requisitionId, 'KITCHEN')).rejects.toThrow(ConflictError);
  });
});

describe('requisitionService.approveRequisition', () => {
  const validRequisition = () =>
    buildRequisitionWithSections([buildApprovalSection({ lines: [buildApprovalLine({ approvedQty: new Prisma.Decimal(14) })] })]);

  it('wrong PIN throws UnauthorizedError and the approve write is never called', async () => {
    vi.mocked(authRepository.findUserByIdWithPassword).mockResolvedValue({ id: manager.id, name: 'Manager', pinHash: 'hash' } as never);
    vi.mocked(comparePin).mockResolvedValue(false);

    await expect(requisitionService.approveRequisition(manager, requisitionId, { pin: '0000' })).rejects.toThrow(UnauthorizedError);
    expect(requisitionRepository.markApprovedIfPendingApproval).not.toHaveBeenCalled();
  });

  it('no PIN set throws UnauthorizedError', async () => {
    vi.mocked(authRepository.findUserByIdWithPassword).mockResolvedValue({ id: manager.id, name: 'Manager', pinHash: null } as never);

    await expect(requisitionService.approveRequisition(manager, requisitionId, { pin: '1234' })).rejects.toThrow(UnauthorizedError);
  });

  it('happy path threads txStub through every write', async () => {
    vi.mocked(authRepository.findUserByIdWithPassword).mockResolvedValue({ id: manager.id, name: 'Manager', pinHash: 'hash' } as never);
    vi.mocked(comparePin).mockResolvedValue(true);
    vi.mocked(requisitionRepository.findByIdWithAllSections).mockResolvedValue(validRequisition() as never);
    vi.mocked(requisitionRepository.setSectionStatus).mockResolvedValue(1);
    vi.mocked(requisitionRepository.markApprovedIfPendingApproval).mockResolvedValue(1);

    await requisitionService.approveRequisition(manager, requisitionId, { pin: '1234' });

    expect(requisitionRepository.setSectionStatus).toHaveBeenCalledWith(sectionId, ['SUBMITTED'], { status: 'SUBMITTED' }, txStub);
    expect(requisitionRepository.markApprovedIfPendingApproval).toHaveBeenCalledWith(requisitionId, manager.id, txStub);
  });

  it('recall race (setSectionStatus -> 0) throws ConflictError with no approve write', async () => {
    vi.mocked(authRepository.findUserByIdWithPassword).mockResolvedValue({ id: manager.id, name: 'Manager', pinHash: 'hash' } as never);
    vi.mocked(comparePin).mockResolvedValue(true);
    vi.mocked(requisitionRepository.findByIdWithAllSections).mockResolvedValue(validRequisition() as never);
    vi.mocked(requisitionRepository.setSectionStatus).mockResolvedValue(0);

    await expect(requisitionService.approveRequisition(manager, requisitionId, { pin: '1234' })).rejects.toThrow(ConflictError);
    expect(requisitionRepository.markApprovedIfPendingApproval).not.toHaveBeenCalled();
  });

  it('already-approved race (markApprovedIfPendingApproval -> 0) throws ConflictError', async () => {
    vi.mocked(authRepository.findUserByIdWithPassword).mockResolvedValue({ id: manager.id, name: 'Manager', pinHash: 'hash' } as never);
    vi.mocked(comparePin).mockResolvedValue(true);
    vi.mocked(requisitionRepository.findByIdWithAllSections).mockResolvedValue(validRequisition() as never);
    vi.mocked(requisitionRepository.setSectionStatus).mockResolvedValue(1);
    vi.mocked(requisitionRepository.markApprovedIfPendingApproval).mockResolvedValue(0);

    await expect(requisitionService.approveRequisition(manager, requisitionId, { pin: '1234' })).rejects.toThrow(ConflictError);
  });

  it('pre-load APPROVED throws ConflictError before the transaction', async () => {
    vi.mocked(authRepository.findUserByIdWithPassword).mockResolvedValue({ id: manager.id, name: 'Manager', pinHash: 'hash' } as never);
    vi.mocked(comparePin).mockResolvedValue(true);
    vi.mocked(requisitionRepository.findByIdWithAllSections).mockResolvedValue(buildRequisitionWithSections([], { status: 'APPROVED' }) as never);

    await expect(requisitionService.approveRequisition(manager, requisitionId, { pin: '1234' })).rejects.toThrow(ConflictError);
    expect(requisitionRepository.setSectionStatus).not.toHaveBeenCalled();
  });

  it('nothing SUBMITTED throws ConflictError before the transaction', async () => {
    vi.mocked(authRepository.findUserByIdWithPassword).mockResolvedValue({ id: manager.id, name: 'Manager', pinHash: 'hash' } as never);
    vi.mocked(comparePin).mockResolvedValue(true);
    vi.mocked(requisitionRepository.findByIdWithAllSections).mockResolvedValue(
      buildRequisitionWithSections([buildApprovalSection({ status: 'NOT_STARTED', submittedById: null, submittedBy: null })]) as never,
    );

    await expect(requisitionService.approveRequisition(manager, requisitionId, { pin: '1234' })).rejects.toThrow(ConflictError);
  });

  it('freeze writes requestedQty into a null approvedQty line and does not re-write an already-set one', async () => {
    vi.mocked(authRepository.findUserByIdWithPassword).mockResolvedValue({ id: manager.id, name: 'Manager', pinHash: 'hash' } as never);
    vi.mocked(comparePin).mockResolvedValue(true);
    vi.mocked(requisitionRepository.findByIdWithAllSections).mockResolvedValue(
      buildRequisitionWithSections([
        buildApprovalSection({
          lines: [
            buildApprovalLine({ id: 'line-null', requestedQty: new Prisma.Decimal(20), approvedQty: null }),
            buildApprovalLine({ id: 'line-set', requestedQty: new Prisma.Decimal(14), approvedQty: new Prisma.Decimal(14) }),
          ],
        }),
      ]) as never,
    );
    vi.mocked(requisitionRepository.setSectionStatus).mockResolvedValue(1);
    vi.mocked(requisitionRepository.markApprovedIfPendingApproval).mockResolvedValue(1);

    await requisitionService.approveRequisition(manager, requisitionId, { pin: '1234' });

    expect(requisitionRepository.updateLineApproval).toHaveBeenCalledTimes(1);
    expect(requisitionRepository.updateLineApproval).toHaveBeenCalledWith(
      'line-null',
      expect.objectContaining({ approvedQty: expect.anything() }),
      txStub,
    );
  });

  it('unsubmitted sections are never frozen and never block approval', async () => {
    vi.mocked(authRepository.findUserByIdWithPassword).mockResolvedValue({ id: manager.id, name: 'Manager', pinHash: 'hash' } as never);
    vi.mocked(comparePin).mockResolvedValue(true);
    vi.mocked(requisitionRepository.findByIdWithAllSections).mockResolvedValue(
      buildRequisitionWithSections([
        buildApprovalSection({ lines: [buildApprovalLine({ approvedQty: new Prisma.Decimal(14) })] }),
        buildApprovalSection({
          id: 'section-2',
          departmentTag: 'BARISTA',
          status: 'NOT_STARTED',
          submittedById: null,
          submittedBy: null,
          lines: [buildApprovalLine({ id: 'unsubmitted-line', approvedQty: null })],
        }),
      ]) as never,
    );
    vi.mocked(requisitionRepository.setSectionStatus).mockResolvedValue(1);
    vi.mocked(requisitionRepository.markApprovedIfPendingApproval).mockResolvedValue(1);

    await requisitionService.approveRequisition(manager, requisitionId, { pin: '1234' });

    expect(requisitionRepository.updateLineApproval).not.toHaveBeenCalledWith('unsubmitted-line', expect.anything(), expect.anything());
  });

  it('a rejected notification promise does not reject approve', async () => {
    vi.mocked(authRepository.findUserByIdWithPassword).mockResolvedValue({ id: manager.id, name: 'Manager', pinHash: 'hash' } as never);
    vi.mocked(comparePin).mockResolvedValue(true);
    vi.mocked(requisitionRepository.findByIdWithAllSections).mockResolvedValue(validRequisition() as never);
    vi.mocked(requisitionRepository.setSectionStatus).mockResolvedValue(1);
    vi.mocked(requisitionRepository.markApprovedIfPendingApproval).mockResolvedValue(1);
    const notificationFailure = new Error('notification pipe down');
    vi.mocked(requisitionRepository.findSectionHeads).mockRejectedValue(notificationFailure);

    // The service fires this notification with a bare `void` (never
    // awaited) — catch it here so the test doesn't leak an unhandled
    // rejection while still proving approve() itself resolves.
    const unhandledRejection = new Promise<void>((resolve) => {
      process.once('unhandledRejection', (reason) => {
        expect(reason).toBe(notificationFailure);
        resolve();
      });
    });

    await expect(requisitionService.approveRequisition(manager, requisitionId, { pin: '1234' })).resolves.toBeDefined();
    await unhandledRejection;
  });
});

describe('requisitionService.listHistory', () => {
  it('threads cursor as { cursor: { id }, skip: 1 } and filters on openedAt not approvedAt', async () => {
    vi.mocked(requisitionRepository.findHistoryRows).mockResolvedValue([]);

    await requisitionService.listHistory(manager, { limit: 25, cursor: requisitionId });

    expect(requisitionRepository.findHistoryRows).toHaveBeenCalledWith(
      branchOrgId,
      expect.objectContaining({ cursor: requisitionId, limit: 25 }),
    );
  });

  it('displayStatus derives RETURNED from any returned section', async () => {
    vi.mocked(requisitionRepository.findHistoryRows).mockResolvedValue([
      buildRequisitionWithSections(
        [{ status: 'RETURNED', returnedNote: 'x', lines: [] }],
        { status: 'PENDING_APPROVAL' },
      ),
    ] as never);

    const rows = await requisitionService.listHistory(manager, { limit: 25 });

    expect(rows[0]!.displayStatus).toBe('RETURNED');
  });

  it('signedByName comes from approvedBy, null when unapproved', async () => {
    vi.mocked(requisitionRepository.findHistoryRows).mockResolvedValue([
      buildRequisitionWithSections([{ status: 'SUBMITTED', returnedNote: null, lines: [] }], { status: 'PENDING_APPROVAL', approvedBy: null }),
    ] as never);

    const rows = await requisitionService.listHistory(manager, { limit: 25 });

    expect(rows[0]!.signedByName).toBeNull();
  });
});
