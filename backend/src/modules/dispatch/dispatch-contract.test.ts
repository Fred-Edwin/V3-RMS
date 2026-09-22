/**
 * Contract drift guard (requisitions-contract.test.ts precedent): asserts
 * request schemas accept valid / reject invalid payloads, and the service's
 * actual serialized output satisfies the response schemas declared in
 * dispatch-validators.ts.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { dispatchService } from './dispatch-service';
import { dispatchRepository } from './dispatch-repository';
import { branchRepository } from '../../repositories/branch-repository';
import { locationRepository } from '../../repositories/location-repository';
import { restockLevelRepository } from '../inventory/inventory-repository';
import { authRepository } from '../../repositories/auth-repository';
import { comparePin } from '../../utils/password';
import {
  DeliveryNoteSchema,
  DispatchQueueRowSchema,
  FulfilDepartmentSchema,
  FulfilDetailSchema,
  ListDispatchQueueQuerySchema,
} from './dispatch-validators';

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

vi.mock('../inventory/inventory-repository', () => ({
  restockLevelRepository: { sumOnHandByItemForLocation: vi.fn() },
}));

vi.mock('../../repositories/location-repository', () => ({
  locationRepository: { findCentralStore: vi.fn() },
}));

vi.mock('../../repositories/branch-repository', () => ({
  branchRepository: { findHub: vi.fn(), findActiveBranchIds: vi.fn() },
}));

vi.mock('../../repositories/auth-repository', () => ({
  authRepository: { findUserByIdWithPassword: vi.fn() },
}));

vi.mock('../../services/fcm-service', () => ({
  fcmService: { sendDispatchInTransitPush: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../../utils/password', () => ({
  comparePin: vi.fn(),
}));

const { txDispatchFindUniqueOrThrow, txInventoryTransactionCreate } = vi.hoisted(() => ({
  txDispatchFindUniqueOrThrow: vi.fn(),
  txInventoryTransactionCreate: vi.fn(),
}));

vi.mock('../../config/database', () => ({
  prisma: {
    $transaction: vi.fn((fn: (tx: unknown) => unknown) =>
      fn({
        dispatch: { findUniqueOrThrow: txDispatchFindUniqueOrThrow },
        inventoryTransaction: { create: txInventoryTransactionCreate },
      }),
    ),
    inventoryItem: { findMany: vi.fn().mockResolvedValue([]) },
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
const hubOrg = { id: hubOrgId, name: 'Central Store', isHub: true, isActive: true };
const centralStore = { id: centralStoreId, organizationId: hubOrgId, type: 'CENTRAL_STORE' as const };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(branchRepository.findHub).mockResolvedValue(hubOrg as never);
  vi.mocked(branchRepository.findActiveBranchIds).mockResolvedValue([branchOrgId]);
  vi.mocked(locationRepository.findCentralStore).mockResolvedValue(centralStore as never);
});

describe('Dispatch request schemas', () => {
  it('ListDispatchQueueQuerySchema defaults limit to 50', () => {
    expect(ListDispatchQueueQuerySchema.parse({}).limit).toBe(50);
  });

  it('FulfilDepartmentSchema accepts a valid payload', () => {
    expect(() =>
      FulfilDepartmentSchema.parse({ lines: [{ inventoryItemId: itemId, dispatchQty: '10' }], pin: '1234' }),
    ).not.toThrow();
  });

  it('FulfilDepartmentSchema rejects a negative dispatchQty', () => {
    expect(() =>
      FulfilDepartmentSchema.parse({ lines: [{ inventoryItemId: itemId, dispatchQty: '-1' }], pin: '1234' }),
    ).toThrow();
  });

  it('FulfilDepartmentSchema rejects a non-4-digit PIN', () => {
    expect(() =>
      FulfilDepartmentSchema.parse({ lines: [{ inventoryItemId: itemId, dispatchQty: '10' }], pin: '12345' }),
    ).toThrow();
  });

  it('FulfilDepartmentSchema rejects a substitute line with no note', () => {
    expect(() =>
      FulfilDepartmentSchema.parse({
        lines: [{ inventoryItemId: itemId, dispatchQty: '10', isSubstitute: true }],
        pin: '1234',
      }),
    ).toThrow();
  });

  it('FulfilDepartmentSchema accepts a substitute line with a note', () => {
    expect(() =>
      FulfilDepartmentSchema.parse({
        lines: [{ inventoryItemId: itemId, dispatchQty: '10', isSubstitute: true, substituteNote: 'Out of stock, swapped for oat milk' }],
        pin: '1234',
      }),
    ).not.toThrow();
  });
});

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

describe('Dispatch response contract shapes', () => {
  it('listQueue output satisfies DispatchQueueRowSchema', async () => {
    vi.mocked(dispatchRepository.findQueueByBranchOrgIds).mockResolvedValue([
      {
        id: requisitionId,
        organizationId: branchOrgId,
        type: 'MORNING',
        openedAt: new Date('2026-09-17T05:00:00.000Z'),
        toOrganization: { id: branchOrgId, name: 'Nyeri Town' },
        sections: [
          {
            departmentTag: 'KITCHEN',
            lines: [{ requestedQty: new Prisma.Decimal(10), approvedQty: new Prisma.Decimal(10) }],
          },
        ],
        dispatches: [],
      },
    ] as never);

    const rows = await dispatchService.listQueue(storeManager, { limit: 50 });
    for (const row of rows) {
      expect(() => DispatchQueueRowSchema.parse(row)).not.toThrow();
    }
  });

  it('getFulfilDetail output satisfies FulfilDetailSchema', async () => {
    vi.mocked(dispatchRepository.findRequisitionForFulfil).mockResolvedValue(buildRequisitionForFulfil() as never);
    vi.mocked(restockLevelRepository.sumOnHandByItemForLocation).mockResolvedValue(new Map([[itemId, new Prisma.Decimal(4)]]));
    vi.mocked(dispatchRepository.findByRequisitionAndDepartment).mockResolvedValue(null);

    const detail = await dispatchService.getFulfilDetail(storeManager, requisitionId);
    expect(() => FulfilDetailSchema.parse(detail)).not.toThrow();
  });

  it('fulfilDepartment output satisfies DeliveryNoteSchema', async () => {
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

    const note = await dispatchService.fulfilDepartment(storeManager, requisitionId, 'KITCHEN', {
      lines: [{ requisitionLineId, inventoryItemId: itemId, dispatchQty: '10' }],
      pin: '1234',
    });
    expect(() => DeliveryNoteSchema.parse(note)).not.toThrow();
  });

  it('getDeliveryNoteForHub output satisfies DeliveryNoteSchema', async () => {
    vi.mocked(dispatchRepository.findByIdWithLinesForHub).mockResolvedValue({
      id: dispatchId,
      sequenceLabel: 'Dispatch 1',
      status: 'CONFIRMED',
      departmentTag: 'KITCHEN',
      toOrganization: { id: branchOrgId, name: 'Nyeri Town' },
      dispatchedBy: { id: storeManager.id, name: 'Store Manager' },
      dispatchedAt: new Date(),
      confirmedBy: { id: 'head-1', name: 'Kitchen Head' },
      confirmedAt: new Date(),
      confirmedOnBehalf: false,
      lines: [
        {
          id: 'dispatch-line-1',
          inventoryItemId: itemId,
          requestedQty: null,
          dispatchedQty: new Prisma.Decimal(3),
          isSubstitute: true,
          substituteNote: 'Oat milk instead of dairy',
          item: { id: itemId, name: 'Oat Milk', usageUnit: 'L' },
        },
      ],
    } as never);

    const note = await dispatchService.getDeliveryNoteForHub(storeManager, dispatchId);
    expect(() => DeliveryNoteSchema.parse(note)).not.toThrow();
  });
});
