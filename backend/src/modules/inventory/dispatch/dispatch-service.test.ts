import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { dispatchService } from './dispatch-service';
import { dispatchRepository } from './dispatch-repository';
import { branchRepository } from '../../../repositories/branch-repository';
import { locationRepository } from '../../../repositories/location-repository';
import { restockLevelRepository } from '../catalog/inventory-repository';
import { authRepository } from '../../../repositories/auth-repository';
import { fcmService } from '../../../services/fcm-service';
import { comparePin } from '../../../utils/password';
import { ConflictError, ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from '../../../utils/errors';

vi.mock('./dispatch-repository', () => ({
  dispatchRepository: {
    findQueueByBranchOrgIds: vi.fn(),
    findRequisitionForFulfil: vi.fn(),
    countDispatchesTodayForBranch: vi.fn(),
    findByRequisitionAndDepartment: vi.fn(),
    create: vi.fn(),
    findByIdWithLines: vi.fn(),
    findByIdWithLinesForHub: vi.fn(),
    findDepartmentHeads: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../catalog/inventory-repository', () => ({
  restockLevelRepository: { sumOnHandByItemForLocation: vi.fn() },
}));

vi.mock('../../../repositories/location-repository', () => ({
  locationRepository: { findCentralStore: vi.fn() },
}));

vi.mock('../../../repositories/branch-repository', () => ({
  branchRepository: { findHub: vi.fn(), findActiveBranchIds: vi.fn() },
}));

vi.mock('../../../repositories/auth-repository', () => ({
  authRepository: { findUserByIdWithPassword: vi.fn() },
}));

vi.mock('../../../services/fcm-service', () => ({
  fcmService: { sendDispatchInTransitPush: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../../../utils/password', () => ({
  comparePin: vi.fn(),
}));

const { txDispatchFindUniqueOrThrow, txInventoryTransactionCreate, txInventoryItemFindMany } = vi.hoisted(() => ({
  txDispatchFindUniqueOrThrow: vi.fn(),
  txInventoryTransactionCreate: vi.fn(),
  txInventoryItemFindMany: vi.fn(),
}));

vi.mock('../../../config/database', () => ({
  prisma: {
    $transaction: vi.fn((fn: (tx: unknown) => unknown) =>
      fn({
        dispatch: { findUniqueOrThrow: txDispatchFindUniqueOrThrow },
        inventoryTransaction: { create: txInventoryTransactionCreate },
      }),
    ),
    inventoryItem: { findMany: txInventoryItemFindMany },
  },
}));

const hubOrgId = '11111111-1111-4111-8111-111111111111';
const branchOrgId = '22222222-2222-4222-8222-222222222222';
const requisitionId = '33333333-3333-4333-8333-333333333333';
const itemId = '44444444-4444-4444-8444-444444444444';
const centralStoreId = '55555555-5555-4555-8555-555555555555';
const requisitionLineId = '66666666-6666-4666-8666-666666666666';
const dispatchId = '77777777-7777-4777-8777-777777777777';

const storeManager = { id: 'sm1', role: 'STORE_MANAGER' as const, organizationId: hubOrgId };
const nonHubStoreManager = { id: 'sm2', role: 'STORE_MANAGER' as const, organizationId: branchOrgId };

const hubOrg = { id: hubOrgId, name: 'Central Store', isHub: true, isActive: true };
const centralStore = { id: centralStoreId, organizationId: hubOrgId, type: 'CENTRAL_STORE' as const };

const buildRequisitionForFulfil = (overrides: Record<string, unknown> = {}) => ({
  id: requisitionId,
  organizationId: branchOrgId,
  status: 'APPROVED',
  type: 'MORNING',
  openedAt: new Date('2026-09-17T05:00:00.000Z'),
  toOrganizationName: 'Nyeri Town',
  sections: [
    {
      id: 'section-1',
      departmentTag: 'KITCHEN',
      status: 'SUBMITTED',
      requisition: { id: requisitionId, organizationId: branchOrgId, toOrganizationName: 'Nyeri Town' },
      lines: [
        {
          id: requisitionLineId,
          inventoryItemId: itemId,
          requestedQty: new Prisma.Decimal(10),
          approvedQty: new Prisma.Decimal(10),
          item: { id: itemId, name: 'Milk', usageUnit: 'L', currentCost: new Prisma.Decimal(60) },
        },
      ],
    },
  ],
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(branchRepository.findHub).mockResolvedValue(hubOrg as never);
  vi.mocked(branchRepository.findActiveBranchIds).mockResolvedValue([branchOrgId]);
  vi.mocked(locationRepository.findCentralStore).mockResolvedValue(centralStore as never);
});

describe('dispatchService — hub-org actor guard', () => {
  it('a non-hub actor is rejected on listQueue', async () => {
    await expect(dispatchService.listQueue(nonHubStoreManager, { limit: 50 })).rejects.toThrow(ForbiddenError);
  });

  it('a non-hub actor is rejected on fulfilDepartment', async () => {
    await expect(
      dispatchService.fulfilDepartment(nonHubStoreManager, requisitionId, 'KITCHEN', { lines: [], pin: '1234' }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('no hub org configured throws ValidationError', async () => {
    vi.mocked(branchRepository.findHub).mockResolvedValue(null);
    await expect(dispatchService.listQueue(storeManager, { limit: 50 })).rejects.toThrow(ValidationError);
  });
});

describe('dispatchService.listQueue', () => {
  it('scopes the cross-org read to the explicit active branch id list', async () => {
    vi.mocked(dispatchRepository.findQueueByBranchOrgIds).mockResolvedValue([]);

    await dispatchService.listQueue(storeManager, { limit: 50 });

    expect(dispatchRepository.findQueueByBranchOrgIds).toHaveBeenCalledWith([branchOrgId], 50);
  });
});

describe('dispatchService.getFulfilDetail', () => {
  it('pre-fills dispatchQty as min(requested, onHand) — a short dispatch is not a validation error', async () => {
    vi.mocked(dispatchRepository.findRequisitionForFulfil).mockResolvedValue(buildRequisitionForFulfil() as never);
    vi.mocked(restockLevelRepository.sumOnHandByItemForLocation).mockResolvedValue(new Map([[itemId, new Prisma.Decimal(4)]]));
    vi.mocked(dispatchRepository.findByRequisitionAndDepartment).mockResolvedValue(null);

    const detail = await dispatchService.getFulfilDetail(storeManager, requisitionId);

    expect(detail.sections[0]!.lines[0]!.dispatchQty).toBe('4');
    expect(detail.sections[0]!.lines[0]!.requestedQty).toBe('10');
  });

  it('pre-fills the full requested qty when on-hand covers it', async () => {
    vi.mocked(dispatchRepository.findRequisitionForFulfil).mockResolvedValue(buildRequisitionForFulfil() as never);
    vi.mocked(restockLevelRepository.sumOnHandByItemForLocation).mockResolvedValue(new Map([[itemId, new Prisma.Decimal(50)]]));
    vi.mocked(dispatchRepository.findByRequisitionAndDepartment).mockResolvedValue(null);

    const detail = await dispatchService.getFulfilDetail(storeManager, requisitionId);

    expect(detail.sections[0]!.lines[0]!.dispatchQty).toBe('10');
  });

  it('unknown requisition throws NotFoundError', async () => {
    vi.mocked(dispatchRepository.findRequisitionForFulfil).mockResolvedValue(null);
    await expect(dispatchService.getFulfilDetail(storeManager, requisitionId)).rejects.toThrow(NotFoundError);
  });

  it('requestedQty shown to the store is the approved (effective) quantity, not the raw ask, when a manager edited it', async () => {
    vi.mocked(dispatchRepository.findRequisitionForFulfil).mockResolvedValue(
      buildRequisitionForFulfil({
        sections: [
          {
            id: 'section-1',
            departmentTag: 'KITCHEN',
            status: 'SUBMITTED',
            requisition: { id: requisitionId, organizationId: branchOrgId, toOrganizationName: 'Nyeri Town' },
            lines: [
              {
                id: requisitionLineId,
                inventoryItemId: itemId,
                requestedQty: new Prisma.Decimal(3),
                approvedQty: new Prisma.Decimal(5),
                item: { id: itemId, name: 'Grilled Chicken Portion', usageUnit: 'portion', currentCost: new Prisma.Decimal(60) },
              },
            ],
          },
        ],
      }) as never,
    );
    vi.mocked(restockLevelRepository.sumOnHandByItemForLocation).mockResolvedValue(new Map([[itemId, new Prisma.Decimal(10)]]));
    vi.mocked(dispatchRepository.findByRequisitionAndDepartment).mockResolvedValue(null);

    const detail = await dispatchService.getFulfilDetail(storeManager, requisitionId);

    expect(detail.sections[0]!.lines[0]!.requestedQty).toBe('5');
    expect(detail.sections[0]!.lines[0]!.dispatchQty).toBe('5');
  });
});

describe('dispatchService.fulfilDepartment — sign + PIN gate', () => {
  const validInput = { lines: [{ requisitionLineId, inventoryItemId: itemId, dispatchQty: '10' }], pin: '1234' };

  it('wrong PIN throws UnauthorizedError and no dispatch is created', async () => {
    vi.mocked(authRepository.findUserByIdWithPassword).mockResolvedValue({ id: storeManager.id, pinHash: 'hash' } as never);
    vi.mocked(comparePin).mockResolvedValue(false);

    await expect(dispatchService.fulfilDepartment(storeManager, requisitionId, 'KITCHEN', validInput)).rejects.toThrow(UnauthorizedError);
    expect(dispatchRepository.create).not.toHaveBeenCalled();
  });

  it('no PIN set throws UnauthorizedError', async () => {
    vi.mocked(authRepository.findUserByIdWithPassword).mockResolvedValue({ id: storeManager.id, pinHash: null } as never);

    await expect(dispatchService.fulfilDepartment(storeManager, requisitionId, 'KITCHEN', validInput)).rejects.toThrow(UnauthorizedError);
  });

  it('a non-APPROVED requisition throws ConflictError', async () => {
    vi.mocked(authRepository.findUserByIdWithPassword).mockResolvedValue({ id: storeManager.id, pinHash: 'hash' } as never);
    vi.mocked(comparePin).mockResolvedValue(true);
    vi.mocked(dispatchRepository.findRequisitionForFulfil).mockResolvedValue(buildRequisitionForFulfil({ status: 'PENDING_APPROVAL' }) as never);

    await expect(dispatchService.fulfilDepartment(storeManager, requisitionId, 'KITCHEN', validInput)).rejects.toThrow(ConflictError);
  });

  it('a department already dispatched (double-dispatch guard) throws ConflictError', async () => {
    vi.mocked(authRepository.findUserByIdWithPassword).mockResolvedValue({ id: storeManager.id, pinHash: 'hash' } as never);
    vi.mocked(comparePin).mockResolvedValue(true);
    vi.mocked(dispatchRepository.findRequisitionForFulfil).mockResolvedValue(buildRequisitionForFulfil() as never);
    vi.mocked(dispatchRepository.findByRequisitionAndDepartment).mockResolvedValue({ id: 'existing-dispatch' } as never);

    await expect(dispatchService.fulfilDepartment(storeManager, requisitionId, 'KITCHEN', validInput)).rejects.toThrow(ConflictError);
    expect(dispatchRepository.create).not.toHaveBeenCalled();
  });

  it('empty lines throws ValidationError', async () => {
    vi.mocked(authRepository.findUserByIdWithPassword).mockResolvedValue({ id: storeManager.id, pinHash: 'hash' } as never);
    vi.mocked(comparePin).mockResolvedValue(true);
    vi.mocked(dispatchRepository.findRequisitionForFulfil).mockResolvedValue(buildRequisitionForFulfil() as never);
    vi.mocked(dispatchRepository.findByRequisitionAndDepartment).mockResolvedValue(null);

    await expect(
      dispatchService.fulfilDepartment(storeManager, requisitionId, 'KITCHEN', { lines: [], pin: '1234' }),
    ).rejects.toThrow(ValidationError);
  });

  it('happy path writes a negative-signed DISPATCH_OUT ledger row per non-zero line', async () => {
    vi.mocked(authRepository.findUserByIdWithPassword).mockResolvedValue({ id: storeManager.id, pinHash: 'hash' } as never);
    vi.mocked(comparePin).mockResolvedValue(true);
    vi.mocked(dispatchRepository.findRequisitionForFulfil).mockResolvedValue(buildRequisitionForFulfil() as never);
    vi.mocked(dispatchRepository.findByRequisitionAndDepartment).mockResolvedValue(null);
    vi.mocked(dispatchRepository.countDispatchesTodayForBranch).mockResolvedValue(3);
    vi.mocked(dispatchRepository.create).mockResolvedValue({ id: dispatchId, sequenceLabel: 'Dispatch 4' } as never);
    txDispatchFindUniqueOrThrow.mockResolvedValue({
      id: dispatchId,
      sequenceLabel: 'Dispatch 4',
      lines: [
        {
          id: 'dispatch-line-1',
          inventoryItemId: itemId,
          dispatchedQty: new Prisma.Decimal(10),
          costAtDispatch: new Prisma.Decimal(60),
        },
      ],
    });
    vi.mocked(dispatchRepository.findByIdWithLinesForHub).mockResolvedValue({
      id: dispatchId,
      sequenceLabel: 'Dispatch 4',
      status: 'IN_TRANSIT',
      departmentTag: 'KITCHEN',
      toOrganization: { id: branchOrgId, name: 'Nyeri Town' },
      dispatchedBy: { id: storeManager.id, name: 'Store Manager' },
      dispatchedAt: new Date(),
      confirmedBy: null,
      confirmedAt: null,
      confirmedOnBehalf: false,
      lines: [
        {
          id: 'dispatch-line-1',
          inventoryItemId: itemId,
          requestedQty: new Prisma.Decimal(10),
          dispatchedQty: new Prisma.Decimal(10),
          isSubstitute: false,
          substituteNote: null,
          item: { id: itemId, name: 'Milk', usageUnit: 'L' },
        },
      ],
    } as never);

    await dispatchService.fulfilDepartment(storeManager, requisitionId, 'KITCHEN', validInput);

    expect(dispatchRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: hubOrgId, toOrganizationId: branchOrgId, departmentTag: 'KITCHEN' }),
      expect.anything(),
    );
    expect(txInventoryTransactionCreate).toHaveBeenCalledTimes(1);
    expect(txInventoryTransactionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: hubOrgId,
        locationId: centralStoreId,
        inventoryItemId: itemId,
        type: 'DISPATCH_OUT',
        quantity: expect.objectContaining({ s: -1 }), // negated Decimal — outbound from the store
        dispatchLineId: 'dispatch-line-1',
      }),
    });
  });

  it('a zero-quantity dispatch line writes no ledger row (a fully short-dispatched line)', async () => {
    vi.mocked(authRepository.findUserByIdWithPassword).mockResolvedValue({ id: storeManager.id, pinHash: 'hash' } as never);
    vi.mocked(comparePin).mockResolvedValue(true);
    vi.mocked(dispatchRepository.findRequisitionForFulfil).mockResolvedValue(buildRequisitionForFulfil() as never);
    vi.mocked(dispatchRepository.findByRequisitionAndDepartment).mockResolvedValue(null);
    vi.mocked(dispatchRepository.countDispatchesTodayForBranch).mockResolvedValue(0);
    vi.mocked(dispatchRepository.create).mockResolvedValue({ id: dispatchId, sequenceLabel: 'Dispatch 1' } as never);
    txDispatchFindUniqueOrThrow.mockResolvedValue({
      id: dispatchId,
      sequenceLabel: 'Dispatch 1',
      lines: [
        {
          id: 'dispatch-line-1',
          inventoryItemId: itemId,
          dispatchedQty: new Prisma.Decimal(0),
          costAtDispatch: new Prisma.Decimal(60),
        },
      ],
    });
    vi.mocked(dispatchRepository.findByIdWithLinesForHub).mockResolvedValue({
      id: dispatchId,
      sequenceLabel: 'Dispatch 1',
      status: 'IN_TRANSIT',
      departmentTag: 'KITCHEN',
      toOrganization: { id: branchOrgId, name: 'Nyeri Town' },
      dispatchedBy: null,
      dispatchedAt: null,
      confirmedBy: null,
      confirmedAt: null,
      confirmedOnBehalf: false,
      lines: [],
    } as never);

    await dispatchService.fulfilDepartment(storeManager, requisitionId, 'KITCHEN', {
      lines: [{ requisitionLineId, inventoryItemId: itemId, dispatchQty: '0' }],
      pin: '1234',
    });

    expect(txInventoryTransactionCreate).not.toHaveBeenCalled();
  });

  it('a rejected department-head notification promise does not reject fulfilDepartment', async () => {
    vi.mocked(authRepository.findUserByIdWithPassword).mockResolvedValue({ id: storeManager.id, pinHash: 'hash' } as never);
    vi.mocked(comparePin).mockResolvedValue(true);
    vi.mocked(dispatchRepository.findRequisitionForFulfil).mockResolvedValue(buildRequisitionForFulfil() as never);
    vi.mocked(dispatchRepository.findByRequisitionAndDepartment).mockResolvedValue(null);
    vi.mocked(dispatchRepository.countDispatchesTodayForBranch).mockResolvedValue(0);
    vi.mocked(dispatchRepository.create).mockResolvedValue({ id: dispatchId, sequenceLabel: 'Dispatch 1' } as never);
    txDispatchFindUniqueOrThrow.mockResolvedValue({
      id: dispatchId,
      sequenceLabel: 'Dispatch 1',
      lines: [{ id: 'dispatch-line-1', inventoryItemId: itemId, dispatchedQty: new Prisma.Decimal(10), costAtDispatch: new Prisma.Decimal(60) }],
    });
    vi.mocked(dispatchRepository.findByIdWithLinesForHub).mockResolvedValue({
      id: dispatchId,
      sequenceLabel: 'Dispatch 1',
      status: 'IN_TRANSIT',
      departmentTag: 'KITCHEN',
      toOrganization: { id: branchOrgId, name: 'Nyeri Town' },
      dispatchedBy: null,
      dispatchedAt: null,
      confirmedBy: null,
      confirmedAt: null,
      confirmedOnBehalf: false,
      lines: [],
    } as never);
    const notificationFailure = new Error('fcm down');
    vi.mocked(dispatchRepository.findDepartmentHeads).mockRejectedValue(notificationFailure);

    const unhandledRejection = new Promise<void>((resolve) => {
      process.once('unhandledRejection', (reason) => {
        expect(reason).toBe(notificationFailure);
        resolve();
      });
    });

    await expect(dispatchService.fulfilDepartment(storeManager, requisitionId, 'KITCHEN', validInput)).resolves.toBeDefined();
    await unhandledRejection;
  });
});

describe('dispatchService.getDeliveryNoteForHub', () => {
  it('unknown dispatch throws NotFoundError', async () => {
    vi.mocked(dispatchRepository.findByIdWithLinesForHub).mockResolvedValue(null);
    await expect(dispatchService.getDeliveryNoteForHub(storeManager, dispatchId)).rejects.toThrow(NotFoundError);
  });
});
