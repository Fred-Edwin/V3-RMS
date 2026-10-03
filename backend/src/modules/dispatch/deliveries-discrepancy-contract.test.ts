/**
 * Contract drift guard (dispatch-contract.test.ts / requisitions-contract.test.ts
 * precedent) for Milestone Five Session B's request/response schemas —
 * deliveries/confirm and discrepancies/resolve.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { dispatchService } from './dispatch-service';
import { discrepancyService } from './discrepancy-service';
import { dispatchRepository } from './dispatch-repository';
import { discrepancyRepository } from './discrepancy-repository';
import { branchRepository } from '../../repositories/branch-repository';
import { locationRepository } from '../../repositories/location-repository';
import { authRepository } from '../../repositories/auth-repository';
import { comparePin } from '../../utils/password';
import {
  ConfirmDeliverySchema,
  DeliveryNoteSchema,
  DeliveryRowSchema,
  DiscrepancyDetailSchema,
  DiscrepancyRowSchema,
  ResolveDiscrepancySchema,
} from './dispatch-validators';

vi.mock('./dispatch-repository', () => ({
  dispatchRepository: {
    findByIdWithLinesForBranch: vi.fn(),
    findDispatchesForBranch: vi.fn(),
    markConfirmed: vi.fn(),
    countDispatchesTodayForBranch: vi.fn().mockResolvedValue(0),
    create: vi.fn(),
    findBranchManagers: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('./discrepancy-repository', () => ({
  discrepancyRepository: {
    createForLine: vi.fn(),
    findAllForHub: vi.fn(),
    findByIdForHub: vi.fn(),
    markResolved: vi.fn(),
    closeDispatchIfResolved: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../inventory/purchasing/receiving-repository', () => ({
  referenceCounterRepository: { nextReference: vi.fn().mockResolvedValue('DSC-0001') },
}));

vi.mock('../../repositories/location-repository', () => ({
  locationRepository: { findCentralStore: vi.fn(), findByOrganizationTypeDepartment: vi.fn() },
}));

vi.mock('../../repositories/branch-repository', () => ({
  branchRepository: { findHub: vi.fn(), findActiveBranchIds: vi.fn() },
}));

vi.mock('../../repositories/auth-repository', () => ({
  authRepository: { findUserByIdWithPassword: vi.fn() },
}));

vi.mock('../../services/fcm-service', () => ({
  fcmService: { sendReceiptVariancePush: vi.fn().mockResolvedValue(undefined), sendDiscrepancyResolvedPush: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../../utils/password', () => ({
  comparePin: vi.fn(),
}));

const {
  txDispatchLineUpdate,
  txDispatchUpdate,
  txInventoryTransactionCreate,
  txDispatchFindUniqueOrThrow,
  txLocationFindFirst,
} = vi.hoisted(() => ({
  txDispatchLineUpdate: vi.fn(),
  txDispatchUpdate: vi.fn(),
  txInventoryTransactionCreate: vi.fn(),
  txDispatchFindUniqueOrThrow: vi.fn(),
  txLocationFindFirst: vi.fn(),
}));

vi.mock('../../config/database', () => ({
  prisma: {
    $transaction: vi.fn((fn: (tx: unknown) => unknown) =>
      fn({
        dispatchLine: { update: txDispatchLineUpdate },
        dispatch: { update: txDispatchUpdate, findUniqueOrThrow: txDispatchFindUniqueOrThrow },
        inventoryTransaction: { create: txInventoryTransactionCreate },
        location: { findFirst: txLocationFindFirst },
      }),
    ),
  },
}));

const hubOrgId = '11111111-1111-4111-8111-111111111111';
const branchOrgId = '22222222-2222-4222-8222-222222222222';
const itemId = '44444444-4444-4444-8444-444444444444';
const centralStoreId = '55555555-5555-4555-8555-555555555555';
const departmentLocationId = '66666666-6666-4666-8666-666666666666';
const dispatchId = '77777777-7777-4777-8777-777777777777';
const dispatchLineId = '88888888-8888-4888-8888-888888888888';
const discrepancyId = '99999999-9999-4999-8999-999999999999';

const departmentHead = {
  id: 'dh1',
  role: 'CHEF' as const,
  organizationId: branchOrgId,
  departmentTag: 'KITCHEN' as const,
  isDepartmentHead: true,
};
const storeManager = { id: 'sm1', role: 'STORE_MANAGER' as const, organizationId: hubOrgId };

const hubOrg = { id: hubOrgId, name: 'Central Kitchen', isHub: true, isActive: true };
const centralStore = { id: centralStoreId, organizationId: hubOrgId, type: 'CENTRAL_STORE' as const };
const departmentLocation = { id: departmentLocationId, organizationId: branchOrgId, type: 'BRANCH_DEPARTMENT' as const };

const buildDispatchWithLines = (overrides: Record<string, unknown> = {}) => ({
  id: dispatchId,
  toOrganizationId: branchOrgId,
  organizationId: hubOrgId,
  departmentTag: 'KITCHEN',
  status: 'IN_TRANSIT',
  sequenceLabel: 'Dispatch 1 · Nyeri Town · 22 Sep',
  toOrganization: { id: branchOrgId, name: 'Nyeri Town' },
  dispatchedBy: { id: 'sm1', name: 'Store Manager' },
  confirmedBy: null,
  dispatchedAt: new Date('2026-09-22T05:00:00.000Z'),
  confirmedAt: null,
  confirmedOnBehalf: false,
  lines: [
    {
      id: dispatchLineId,
      dispatchedQty: new Prisma.Decimal(10),
      confirmedQty: null,
      requestedQty: new Prisma.Decimal(10),
      costAtDispatch: new Prisma.Decimal(60),
      inventoryItemId: itemId,
      isSubstitute: false,
      substituteNote: null,
      item: { id: itemId, name: 'Milk', usageUnit: 'L' },
    },
  ],
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(branchRepository.findHub).mockResolvedValue(hubOrg as never);
  vi.mocked(branchRepository.findActiveBranchIds).mockResolvedValue([branchOrgId]);
  vi.mocked(locationRepository.findCentralStore).mockResolvedValue(centralStore as never);
  vi.mocked(locationRepository.findByOrganizationTypeDepartment).mockResolvedValue(departmentLocation as never);
  vi.mocked(authRepository.findUserByIdWithPassword).mockResolvedValue({ id: departmentHead.id, pinHash: 'hash' } as never);
  vi.mocked(comparePin).mockResolvedValue(true);
  vi.mocked(dispatchRepository.markConfirmed).mockResolvedValue(1);
  txLocationFindFirst.mockResolvedValue(centralStore);
});

describe('Deliveries / Discrepancy request schemas', () => {
  it('ConfirmDeliverySchema accepts a valid payload', () => {
    expect(() =>
      ConfirmDeliverySchema.parse({ lines: [{ dispatchLineId, confirmedQty: '10' }], pin: '1234' }),
    ).not.toThrow();
  });

  it('ConfirmDeliverySchema rejects an empty lines array', () => {
    expect(() => ConfirmDeliverySchema.parse({ lines: [], pin: '1234' })).toThrow();
  });

  it('ConfirmDeliverySchema rejects a negative confirmedQty', () => {
    expect(() =>
      ConfirmDeliverySchema.parse({ lines: [{ dispatchLineId, confirmedQty: '-1' }], pin: '1234' }),
    ).toThrow();
  });

  it('ResolveDiscrepancySchema accepts a valid payload', () => {
    expect(() =>
      ResolveDiscrepancySchema.parse({ outcome: 'MISCOUNT_CORRECTED', resolutionNote: 'Recounted', pin: '1234' }),
    ).not.toThrow();
  });

  it('ResolveDiscrepancySchema rejects an empty resolutionNote', () => {
    expect(() =>
      ResolveDiscrepancySchema.parse({ outcome: 'MISCOUNT_CORRECTED', resolutionNote: '', pin: '1234' }),
    ).toThrow();
  });

  it('ResolveDiscrepancySchema rejects an unknown outcome', () => {
    expect(() =>
      ResolveDiscrepancySchema.parse({ outcome: 'SOMETHING_ELSE', resolutionNote: 'note', pin: '1234' }),
    ).toThrow();
  });
});

describe('Deliveries / Discrepancy response contract shapes', () => {
  it('listDeliveries output satisfies DeliveryRowSchema', async () => {
    vi.mocked(dispatchRepository.findDispatchesForBranch).mockResolvedValue([buildDispatchWithLines()] as never);
    const rows = await dispatchService.listDeliveries(departmentHead, { limit: 50 });
    for (const row of rows) {
      expect(() => DeliveryRowSchema.parse(row)).not.toThrow();
    }
  });

  it('confirmDelivery (clean receipt) output satisfies DeliveryNoteSchema', async () => {
    vi.mocked(dispatchRepository.findByIdWithLinesForBranch).mockResolvedValue(buildDispatchWithLines() as never);
    const note = await dispatchService.confirmDelivery(departmentHead, dispatchId, {
      lines: [{ dispatchLineId, confirmedQty: '10' }],
      pin: '1234',
    });
    expect(() => DeliveryNoteSchema.parse(note)).not.toThrow();
  });

  it('confirmDelivery (shortfall) output satisfies DeliveryNoteSchema', async () => {
    vi.mocked(dispatchRepository.findByIdWithLinesForBranch).mockResolvedValue(buildDispatchWithLines() as never);
    const note = await dispatchService.confirmDelivery(departmentHead, dispatchId, {
      lines: [{ dispatchLineId, confirmedQty: '7' }],
      pin: '1234',
    });
    expect(() => DeliveryNoteSchema.parse(note)).not.toThrow();
  });

  it('listDiscrepancies output satisfies DiscrepancyRowSchema', async () => {
    vi.mocked(discrepancyRepository.findAllForHub).mockResolvedValue([
      {
        id: discrepancyId,
        referenceNumber: 'DSC-0001',
        gapQty: new Prisma.Decimal(-3),
        status: 'OPEN',
        outcome: null,
        resolutionNote: null,
        resolvedById: null,
        resolvedAt: null,
        followUpDispatchId: null,
        createdAt: new Date('2026-09-22T06:00:00.000Z'),
        dispatchLine: {
          id: dispatchLineId,
          dispatchedQty: new Prisma.Decimal(10),
          confirmedQty: new Prisma.Decimal(7),
          costAtDispatch: new Prisma.Decimal(60),
          item: { id: itemId, name: 'Milk', usageUnit: 'L' },
          dispatch: {
            id: dispatchId,
            sequenceLabel: 'Dispatch 1 · Nyeri Town · 22 Sep',
            departmentTag: 'KITCHEN',
            organizationId: hubOrgId,
            toOrganizationId: branchOrgId,
            toOrganization: { id: branchOrgId, name: 'Nyeri Town' },
          },
        },
        resolvedBy: null,
      },
    ] as never);

    const rows = await discrepancyService.listDiscrepancies(storeManager, { limit: 50 });
    for (const row of rows) {
      expect(() => DiscrepancyRowSchema.parse(row)).not.toThrow();
    }
  });

  it('resolveDiscrepancy (MISCOUNT_CORRECTED) output satisfies DiscrepancyDetailSchema', async () => {
    vi.mocked(discrepancyRepository.findByIdForHub).mockResolvedValue({
      id: discrepancyId,
      referenceNumber: 'DSC-0001',
      gapQty: new Prisma.Decimal(-3),
      status: 'OPEN',
      outcome: null,
      resolutionNote: null,
      resolvedById: null,
      resolvedAt: null,
      followUpDispatchId: null,
      createdAt: new Date('2026-09-22T06:00:00.000Z'),
      dispatchLine: {
        id: dispatchLineId,
        dispatchedQty: new Prisma.Decimal(10),
        confirmedQty: new Prisma.Decimal(7),
        costAtDispatch: new Prisma.Decimal(60),
        item: { id: itemId, name: 'Milk', usageUnit: 'L' },
        dispatch: {
          id: dispatchId,
          sequenceLabel: 'Dispatch 1 · Nyeri Town · 22 Sep',
          departmentTag: 'KITCHEN',
          organizationId: hubOrgId,
          toOrganizationId: branchOrgId,
          toOrganization: { id: branchOrgId, name: 'Nyeri Town' },
        },
      },
      resolvedBy: null,
    } as never);
    vi.mocked(discrepancyRepository.markResolved).mockResolvedValue(1);

    const detail = await discrepancyService.resolveDiscrepancy(storeManager, discrepancyId, {
      outcome: 'MISCOUNT_CORRECTED',
      resolutionNote: 'Recounted, found short',
      pin: '1234',
    });
    expect(() => DiscrepancyDetailSchema.parse(detail)).not.toThrow();
  });
});
