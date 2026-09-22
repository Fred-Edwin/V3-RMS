import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { discrepancyService } from './discrepancy-service';
import { discrepancyRepository } from './discrepancy-repository';
import { dispatchRepository } from './dispatch-repository';
import { branchRepository } from '../../repositories/branch-repository';
import { locationRepository } from '../../repositories/location-repository';
import { authRepository } from '../../repositories/auth-repository';
import { fcmService } from '../../services/fcm-service';
import { comparePin } from '../../utils/password';
import { ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from '../../utils/errors';

vi.mock('./discrepancy-repository', () => ({
  discrepancyRepository: {
    findAllForHub: vi.fn(),
    findAllForBranch: vi.fn(),
    findByIdForHub: vi.fn(),
    findByIdForBranch: vi.fn(),
    markResolved: vi.fn(),
  },
}));

vi.mock('./dispatch-repository', () => ({
  dispatchRepository: {
    countDispatchesTodayForBranch: vi.fn().mockResolvedValue(0),
    create: vi.fn(),
    findBranchManagers: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../repositories/branch-repository', () => ({
  branchRepository: { findHub: vi.fn(), findActiveBranchIds: vi.fn() },
}));

vi.mock('../../repositories/location-repository', () => ({
  locationRepository: { findCentralStore: vi.fn(), findByOrganizationTypeDepartment: vi.fn() },
}));

vi.mock('../../repositories/auth-repository', () => ({
  authRepository: { findUserByIdWithPassword: vi.fn() },
}));

vi.mock('../../services/fcm-service', () => ({
  fcmService: { sendDiscrepancyResolvedPush: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../../utils/password', () => ({
  comparePin: vi.fn(),
}));

const {
  txInventoryTransactionCreate,
  txDispatchFindUniqueOrThrow,
  txLocationFindFirst,
} = vi.hoisted(() => ({
  txInventoryTransactionCreate: vi.fn(),
  txDispatchFindUniqueOrThrow: vi.fn(),
  txLocationFindFirst: vi.fn(),
}));

vi.mock('../../config/database', () => ({
  prisma: {
    $transaction: vi.fn((fn: (tx: unknown) => unknown) =>
      fn({
        inventoryTransaction: { create: txInventoryTransactionCreate },
        dispatch: { findUniqueOrThrow: txDispatchFindUniqueOrThrow },
        location: { findFirst: txLocationFindFirst },
      }),
    ),
  },
}));

const hubOrgId = '11111111-1111-4111-8111-111111111111';
const branchOrgId = '22222222-2222-4222-8222-222222222222';
const discrepancyId = '77777777-7777-4777-8777-777777777777';
const dispatchLineId = '88888888-8888-4888-8888-888888888888';
const itemId = '44444444-4444-4444-8444-444444444444';
const dispatchId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const centralStoreId = '55555555-5555-4555-8555-555555555555';
const departmentLocationId = '99999999-9999-4999-8999-999999999999';

const storeManager = { id: 'sm1', role: 'STORE_MANAGER' as const, organizationId: hubOrgId };
const branchManager = { id: 'bm1', role: 'MANAGER' as const, organizationId: branchOrgId };

const hubOrg = { id: hubOrgId, name: 'Central Kitchen', isHub: true, isActive: true };
const centralStore = { id: centralStoreId, organizationId: hubOrgId, type: 'CENTRAL_STORE' as const };
const departmentLocation = { id: departmentLocationId, organizationId: branchOrgId, type: 'BRANCH_DEPARTMENT' as const };

const buildDiscrepancy = (overrides: Record<string, unknown> = {}) => ({
  id: discrepancyId,
  dispatchLineId,
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
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(branchRepository.findHub).mockResolvedValue(hubOrg as never);
  vi.mocked(branchRepository.findActiveBranchIds).mockResolvedValue([branchOrgId]);
  vi.mocked(locationRepository.findCentralStore).mockResolvedValue(centralStore as never);
  vi.mocked(locationRepository.findByOrganizationTypeDepartment).mockResolvedValue(departmentLocation as never);
  vi.mocked(authRepository.findUserByIdWithPassword).mockResolvedValue({ id: storeManager.id, pinHash: 'hash' } as never);
  vi.mocked(comparePin).mockResolvedValue(true);
  vi.mocked(discrepancyRepository.findByIdForHub).mockResolvedValue(buildDiscrepancy() as never);
  vi.mocked(discrepancyRepository.markResolved).mockResolvedValue(1);
  txLocationFindFirst.mockResolvedValue(centralStore);
});

describe('discrepancyService.listDiscrepancies — role-gated shape', () => {
  it('hub actor sees all branches', async () => {
    vi.mocked(discrepancyRepository.findAllForHub).mockResolvedValue([]);
    await discrepancyService.listDiscrepancies(storeManager, { limit: 50 });
    expect(discrepancyRepository.findAllForHub).toHaveBeenCalledWith([branchOrgId], 50);
  });

  it('branch actor sees only their own branch', async () => {
    vi.mocked(discrepancyRepository.findAllForBranch).mockResolvedValue([]);
    await discrepancyService.listDiscrepancies(branchManager, { limit: 50 });
    expect(discrepancyRepository.findAllForBranch).toHaveBeenCalledWith(branchOrgId, 50);
  });
});

describe('discrepancyService.resolveDiscrepancy — auth guards', () => {
  it('a non-hub actor is rejected', async () => {
    await expect(
      discrepancyService.resolveDiscrepancy(branchManager, discrepancyId, { outcome: 'MISCOUNT_CORRECTED', resolutionNote: 'note', pin: '1234' }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('a wrong PIN is rejected', async () => {
    vi.mocked(comparePin).mockResolvedValue(false);
    await expect(
      discrepancyService.resolveDiscrepancy(storeManager, discrepancyId, { outcome: 'MISCOUNT_CORRECTED', resolutionNote: 'note', pin: '0000' }),
    ).rejects.toThrow(UnauthorizedError);
  });

  it('an already-resolved discrepancy is rejected', async () => {
    vi.mocked(discrepancyRepository.findByIdForHub).mockResolvedValue(buildDiscrepancy({ status: 'RESOLVED' }) as never);
    await expect(
      discrepancyService.resolveDiscrepancy(storeManager, discrepancyId, { outcome: 'MISCOUNT_CORRECTED', resolutionNote: 'note', pin: '1234' }),
    ).rejects.toThrow(ValidationError);
  });

  it('an unknown discrepancy throws NotFoundError', async () => {
    vi.mocked(discrepancyRepository.findByIdForHub).mockResolvedValue(null);
    await expect(
      discrepancyService.resolveDiscrepancy(storeManager, discrepancyId, { outcome: 'MISCOUNT_CORRECTED', resolutionNote: 'note', pin: '1234' }),
    ).rejects.toThrow(NotFoundError);
  });
});

describe('discrepancyService.resolveDiscrepancy — TRANSIT_LOSS_WRITEOFF', () => {
  it('writes a negative ADJUSTMENT at the Central Store for the gap magnitude', async () => {
    await discrepancyService.resolveDiscrepancy(storeManager, discrepancyId, {
      outcome: 'TRANSIT_LOSS_WRITEOFF',
      resolutionNote: 'Lost in transit',
      pin: '1234',
    });

    expect(txInventoryTransactionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'ADJUSTMENT', locationId: centralStoreId, organizationId: hubOrgId }),
      }),
    );
    const call = txInventoryTransactionCreate.mock.calls[0]![0].data;
    expect(call.quantity.toString()).toBe('-3'); // negative — a stock reduction at the store
    expect(discrepancyRepository.markResolved).toHaveBeenCalledWith(
      discrepancyId,
      expect.anything(),
      expect.objectContaining({ outcome: 'TRANSIT_LOSS_WRITEOFF' }),
    );
  });

  it('normalizes an already-negative gapQty to stay negative (never double-negates)', async () => {
    vi.mocked(discrepancyRepository.findByIdForHub).mockResolvedValue(
      buildDiscrepancy({ gapQty: new Prisma.Decimal(-3) }) as never,
    );
    await discrepancyService.resolveDiscrepancy(storeManager, discrepancyId, {
      outcome: 'TRANSIT_LOSS_WRITEOFF',
      resolutionNote: 'note',
      pin: '1234',
    });
    const call = txInventoryTransactionCreate.mock.calls[0]![0].data;
    expect(call.quantity.toString()).toBe('-3');
  });
});

describe('discrepancyService.resolveDiscrepancy — MISCOUNT_CORRECTED', () => {
  it('writes an ADJUSTMENT at the branch department location, sign follows the gap direction', async () => {
    await discrepancyService.resolveDiscrepancy(storeManager, discrepancyId, {
      outcome: 'MISCOUNT_CORRECTED',
      resolutionNote: 'Recounted, found short',
      pin: '1234',
    });

    expect(txInventoryTransactionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'ADJUSTMENT', locationId: departmentLocationId, organizationId: branchOrgId }),
      }),
    );
    const call = txInventoryTransactionCreate.mock.calls[0]![0].data;
    expect(call.quantity.toString()).toBe('-3'); // gapQty as-is, sign follows the correction direction
  });

  it('no branch department location configured throws ValidationError', async () => {
    vi.mocked(locationRepository.findByOrganizationTypeDepartment).mockResolvedValue(null);
    await expect(
      discrepancyService.resolveDiscrepancy(storeManager, discrepancyId, { outcome: 'MISCOUNT_CORRECTED', resolutionNote: 'note', pin: '1234' }),
    ).rejects.toThrow(ValidationError);
  });
});

describe('discrepancyService.resolveDiscrepancy — FOUND_REDELIVERED', () => {
  it('spawns a follow-up Dispatch for the gap magnitude and sets followUpDispatchId, writes no direct ledger row itself', async () => {
    txDispatchFindUniqueOrThrow.mockResolvedValueOnce({ requisitionId: 'req-1' }).mockResolvedValueOnce({
      id: 'new-dispatch-1',
      lines: [{ id: 'new-line-1', dispatchedQty: new Prisma.Decimal(3), costAtDispatch: new Prisma.Decimal(60), inventoryItemId: itemId }],
    });
    vi.mocked(dispatchRepository.create).mockResolvedValue({ id: 'new-dispatch-1' } as never);

    await discrepancyService.resolveDiscrepancy(storeManager, discrepancyId, {
      outcome: 'FOUND_REDELIVERED',
      resolutionNote: 'Redelivering the shortfall',
      pin: '1234',
    });

    expect(dispatchRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        lines: [expect.objectContaining({ dispatchedQty: expect.objectContaining({ toString: expect.any(Function) }) })],
      }),
      expect.anything(),
    );
    const createArgs = vi.mocked(dispatchRepository.create).mock.calls[0]![0];
    expect(createArgs.lines[0]!.dispatchedQty.toString()).toBe('3'); // abs(gapQty)

    // The follow-up dispatch's own DISPATCH_OUT write happens (Central Store leaving stock again)
    expect(txInventoryTransactionCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'DISPATCH_OUT' }) }),
    );

    expect(discrepancyRepository.markResolved).toHaveBeenCalledWith(
      discrepancyId,
      expect.anything(),
      expect.objectContaining({ outcome: 'FOUND_REDELIVERED', followUpDispatchId: 'new-dispatch-1' }),
    );
  });
});
