import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { dispatchService } from './dispatch-service';
import { dispatchRepository } from './dispatch-repository';
import { discrepancyRepository } from './discrepancy-repository';
import { referenceCounterRepository } from '../purchasing/receiving-repository';
import { locationRepository } from '../../../repositories/location-repository';
import { authRepository } from '../../../repositories/auth-repository';
import { fcmService } from '../../../services/fcm-service';
import { comparePin } from '../../../utils/password';
import { ConflictError, ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from '../../../utils/errors';

vi.mock('./dispatch-repository', () => ({
  dispatchRepository: {
    findByIdWithLinesForBranch: vi.fn(),
    markConfirmed: vi.fn(),
  },
}));

vi.mock('./discrepancy-repository', () => ({
  discrepancyRepository: {
    createForLine: vi.fn(),
  },
}));

vi.mock('../purchasing/receiving-repository', () => ({
  referenceCounterRepository: { nextReference: vi.fn().mockResolvedValue('DSC-0001') },
}));

vi.mock('../../../repositories/location-repository', () => ({
  locationRepository: { findCentralStore: vi.fn(), findByOrganizationTypeDepartment: vi.fn() },
}));

vi.mock('../../../repositories/auth-repository', () => ({
  authRepository: { findUserByIdWithPassword: vi.fn() },
}));

vi.mock('../../../services/fcm-service', () => ({
  fcmService: { sendReceiptVariancePush: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../../../utils/password', () => ({
  comparePin: vi.fn(),
}));

const { txDispatchLineUpdate, txDispatchUpdate, txInventoryTransactionCreate } = vi.hoisted(() => ({
  txDispatchLineUpdate: vi.fn(),
  txDispatchUpdate: vi.fn(),
  txInventoryTransactionCreate: vi.fn(),
}));

vi.mock('../../../config/database', () => ({
  prisma: {
    $transaction: vi.fn((fn: (tx: unknown) => unknown) =>
      fn({
        dispatchLine: { update: txDispatchLineUpdate },
        dispatch: { update: txDispatchUpdate },
        inventoryTransaction: { create: txInventoryTransactionCreate },
      }),
    ),
  },
}));

const branchOrgId = '22222222-2222-4222-8222-222222222222';
const dispatchId = '77777777-7777-4777-8777-777777777777';
const dispatchLineId = '88888888-8888-4888-8888-888888888888';
const itemId = '44444444-4444-4444-8444-444444444444';
const departmentLocationId = '99999999-9999-4999-8999-999999999999';
const centralStoreId = '55555555-5555-4555-8555-555555555555';

const departmentHead = {
  id: 'dh1',
  role: 'CHEF' as const,
  organizationId: branchOrgId,
  departmentTag: 'KITCHEN' as const,
  isDepartmentHead: true,
};
const branchManager = { id: 'bm1', role: 'MANAGER' as const, organizationId: branchOrgId };

const centralStore = { id: centralStoreId, organizationId: 'hub1', type: 'CENTRAL_STORE' as const };
const departmentLocation = { id: departmentLocationId, organizationId: branchOrgId, type: 'BRANCH_DEPARTMENT' as const };

const buildDispatch = (overrides: Record<string, unknown> = {}) => ({
  id: dispatchId,
  organizationId: 'hub1',
  toOrganizationId: branchOrgId,
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
  vi.mocked(locationRepository.findCentralStore).mockResolvedValue(centralStore as never);
  vi.mocked(locationRepository.findByOrganizationTypeDepartment).mockResolvedValue(departmentLocation as never);
  vi.mocked(authRepository.findUserByIdWithPassword).mockResolvedValue({ id: departmentHead.id, pinHash: 'hash' } as never);
  vi.mocked(comparePin).mockResolvedValue(true);
  vi.mocked(dispatchRepository.markConfirmed).mockResolvedValue(1);
  vi.mocked(dispatchRepository.findByIdWithLinesForBranch).mockResolvedValue(buildDispatch() as never);
});

describe('dispatchService.confirmDelivery — clean receipt', () => {
  it('writes a positive-signed DISPATCH_IN transaction at the branch department location, no discrepancy', async () => {
    await dispatchService.confirmDelivery(departmentHead, dispatchId, {
      lines: [{ dispatchLineId, confirmedQty: '10' }],
      pin: '1234',
    });

    expect(txInventoryTransactionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'DISPATCH_IN',
          locationId: departmentLocationId,
          quantity: expect.objectContaining({ toString: expect.any(Function) }),
        }),
      }),
    );
    const call = txInventoryTransactionCreate.mock.calls[0]![0].data;
    expect(call.quantity.toString()).toBe('10'); // positive — arriving at the branch, not negated

    expect(discrepancyRepository.createForLine).not.toHaveBeenCalled();
    expect(txDispatchUpdate).not.toHaveBeenCalled(); // status stays CONFIRMED, set by markConfirmed
  });

  it('a wrong PIN is rejected', async () => {
    vi.mocked(comparePin).mockResolvedValue(false);
    await expect(
      dispatchService.confirmDelivery(departmentHead, dispatchId, { lines: [{ dispatchLineId, confirmedQty: '10' }], pin: '0000' }),
    ).rejects.toThrow(UnauthorizedError);
  });

  it('an already-confirmed dispatch (concurrent confirm) rolls back with no partial write', async () => {
    vi.mocked(dispatchRepository.markConfirmed).mockResolvedValue(0);
    await expect(
      dispatchService.confirmDelivery(departmentHead, dispatchId, { lines: [{ dispatchLineId, confirmedQty: '10' }], pin: '1234' }),
    ).rejects.toThrow(ConflictError);
  });

  it('a dispatch not in IN_TRANSIT is rejected before the transaction starts', async () => {
    vi.mocked(dispatchRepository.findByIdWithLinesForBranch).mockResolvedValue(buildDispatch({ status: 'CONFIRMED' }) as never);
    await expect(
      dispatchService.confirmDelivery(departmentHead, dispatchId, { lines: [{ dispatchLineId, confirmedQty: '10' }], pin: '1234' }),
    ).rejects.toThrow(ConflictError);
  });

  it('a department head confirming outside their own department is rejected', async () => {
    vi.mocked(dispatchRepository.findByIdWithLinesForBranch).mockResolvedValue(buildDispatch({ departmentTag: 'BARISTA' }) as never);
    await expect(
      dispatchService.confirmDelivery(departmentHead, dispatchId, { lines: [{ dispatchLineId, confirmedQty: '10' }], pin: '1234' }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('a Branch Manager must use confirm-on-behalf, not confirmDelivery', async () => {
    await expect(
      dispatchService.confirmDelivery(branchManager, dispatchId, { lines: [{ dispatchLineId, confirmedQty: '10' }], pin: '1234' }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('a missing line in the confirm payload is rejected', async () => {
    await expect(dispatchService.confirmDelivery(departmentHead, dispatchId, { lines: [], pin: '1234' })).rejects.toThrow();
  });
});

describe('dispatchService.confirmDelivery — shortfall opens a discrepancy', () => {
  it('a mismatched line writes DISPATCH_IN at the confirmed qty and creates an OPEN Discrepancy, dispatch -> DISCREPANCY_OPEN', async () => {
    await dispatchService.confirmDelivery(departmentHead, dispatchId, {
      lines: [{ dispatchLineId, confirmedQty: '7' }],
      pin: '1234',
    });

    const ledgerCall = txInventoryTransactionCreate.mock.calls[0]![0].data;
    expect(ledgerCall.quantity.toString()).toBe('7'); // confirmed qty, not dispatched qty

    expect(discrepancyRepository.createForLine).toHaveBeenCalledTimes(1);
    const discrepancyCall = vi.mocked(discrepancyRepository.createForLine).mock.calls[0]![0];
    expect(discrepancyCall.dispatchLineId).toBe(dispatchLineId);
    expect(discrepancyCall.gapQty.toString()).toBe('-3'); // confirmed(7) - dispatched(10)
    expect(referenceCounterRepository.nextReference).toHaveBeenCalledWith(expect.anything(), centralStore.organizationId, 'DSC');

    expect(txDispatchUpdate).toHaveBeenCalledWith({ where: { id: dispatchId }, data: { status: 'DISCREPANCY_OPEN' } });
    expect(fcmService.sendReceiptVariancePush).toHaveBeenCalled();
  });

  it('a zero confirmed qty writes no ledger row but still opens a discrepancy', async () => {
    await dispatchService.confirmDelivery(departmentHead, dispatchId, { lines: [{ dispatchLineId, confirmedQty: '0' }], pin: '1234' });

    expect(txInventoryTransactionCreate).not.toHaveBeenCalled();
    expect(discrepancyRepository.createForLine).toHaveBeenCalledTimes(1);
  });
});

describe('dispatchService.confirmDeliveryOnBehalf — Flow 10b', () => {
  it('a Branch Manager confirms, confirmedOnBehalf is set true, real signer is the manager', async () => {
    await dispatchService.confirmDeliveryOnBehalf(branchManager, dispatchId, {
      lines: [{ dispatchLineId, confirmedQty: '10' }],
      pin: '1234',
    });

    expect(dispatchRepository.markConfirmed).toHaveBeenCalledWith(
      dispatchId,
      branchOrgId,
      expect.anything(),
      expect.objectContaining({ confirmedById: branchManager.id, confirmedOnBehalf: true }),
    );
  });

  it('a non-manager actor is rejected', async () => {
    await expect(
      dispatchService.confirmDeliveryOnBehalf(departmentHead, dispatchId, { lines: [{ dispatchLineId, confirmedQty: '10' }], pin: '1234' }),
    ).rejects.toThrow(ForbiddenError);
  });
});

describe('dispatchService.listDeliveries / getDeliveryDetail — role scoping', () => {
  it('is exercised in dispatch-repository.test.ts for the department filter; here we just confirm the guard raises for a user with no department', async () => {
    const noDeptHead = { id: 'x', role: 'CHEF' as const, organizationId: branchOrgId, isDepartmentHead: true, departmentTag: undefined };
    await expect(dispatchService.listDeliveries(noDeptHead as never, { limit: 50 })).rejects.toThrow(ValidationError);
  });

  it('getDeliveryDetail rejects a not-found dispatch', async () => {
    vi.mocked(dispatchRepository.findByIdWithLinesForBranch).mockResolvedValue(null);
    await expect(dispatchService.getDeliveryDetail(branchManager, dispatchId)).rejects.toThrow(NotFoundError);
  });
});
