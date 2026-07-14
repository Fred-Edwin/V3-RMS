import { beforeEach, describe, expect, it, vi } from 'vitest';
import { assignContractAndSyncBalances } from './hr-repository';

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  profileUpdate: vi.fn(),
  policyFindMany: vi.fn(),
  balanceFindMany: vi.fn(),
  balanceUpsert: vi.fn(),
  balanceUpdate: vi.fn(),
}));

vi.mock('../config/database', () => ({
  prisma: {
    $transaction: mocks.transaction,
    employeeProfile: { update: mocks.profileUpdate },
    leavePolicy: { findMany: mocks.policyFindMany },
    leaveBalance: {
      findMany: mocks.balanceFindMany,
      upsert: mocks.balanceUpsert,
      update: mocks.balanceUpdate,
    },
  },
}));

describe('assignContractAndSyncBalances', () => {
  const tx = {
    employeeProfile: { update: mocks.profileUpdate },
    leaveBalance: { upsert: mocks.balanceUpsert, update: mocks.balanceUpdate },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation(async (arg: unknown) =>
      typeof arg === 'function' ? (arg as (t: typeof tx) => Promise<unknown>)(tx) : Promise.all(arg as Array<Promise<unknown>>),
    );
    mocks.profileUpdate.mockResolvedValue({ id: 'profile-1' });
    mocks.balanceUpsert.mockResolvedValue({});
    mocks.balanceUpdate.mockResolvedValue({});
  });

  it('upserts a balance per policy row, setting totalDays from the policy', async () => {
    mocks.policyFindMany.mockResolvedValue([
      { leaveType: 'ANNUAL', totalDays: 15 },
      { leaveType: 'SICK', totalDays: 7 },
    ]);
    mocks.balanceFindMany.mockResolvedValue([]);

    await assignContractAndSyncBalances('profile-1', 'ct-1', 2026);

    expect(mocks.profileUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'profile-1' },
        data: { contractTypeId: 'ct-1' },
      }),
    );
    expect(mocks.balanceUpsert).toHaveBeenCalledTimes(2);
    expect(mocks.balanceUpsert).toHaveBeenCalledWith({
      where: {
        employeeProfileId_leaveType_leaveYear: {
          employeeProfileId: 'profile-1',
          leaveType: 'ANNUAL',
          leaveYear: 2026,
        },
      },
      create: {
        employeeProfileId: 'profile-1',
        leaveType: 'ANNUAL',
        totalDays: 15,
        leaveYear: 2026,
      },
      // Existing balances get the new entitlement but keep used/pending days —
      // a downgrade below already-used days must surface, not be clamped
      update: { totalDays: 15 },
    });
    expect(mocks.balanceUpdate).not.toHaveBeenCalled();
  });

  it('zeroes totalDays for existing balances not covered by the new policy', async () => {
    mocks.policyFindMany.mockResolvedValue([{ leaveType: 'ANNUAL', totalDays: 15 }]);
    mocks.balanceFindMany.mockResolvedValue([
      { leaveType: 'ANNUAL' },
      { leaveType: 'SICK' },
      { leaveType: 'UNPAID' },
    ]);

    await assignContractAndSyncBalances('profile-1', 'ct-1', 2026);

    expect(mocks.balanceUpdate).toHaveBeenCalledTimes(2);
    for (const leaveType of ['SICK', 'UNPAID']) {
      expect(mocks.balanceUpdate).toHaveBeenCalledWith({
        where: {
          employeeProfileId_leaveType_leaveYear: {
            employeeProfileId: 'profile-1',
            leaveType,
            leaveYear: 2026,
          },
        },
        data: { totalDays: 0 },
      });
    }
  });

  it('clears the contract without touching leave balances when contractTypeId is null', async () => {
    await assignContractAndSyncBalances('profile-1', null, 2026);

    expect(mocks.profileUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { contractTypeId: null } }),
    );
    expect(mocks.policyFindMany).not.toHaveBeenCalled();
    expect(mocks.balanceUpsert).not.toHaveBeenCalled();
    expect(mocks.balanceUpdate).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('seeds nothing when the contract has no leave policies', async () => {
    mocks.policyFindMany.mockResolvedValue([]);
    mocks.balanceFindMany.mockResolvedValue([]);

    await assignContractAndSyncBalances('profile-1', 'ct-1', 2026);

    expect(mocks.balanceUpsert).not.toHaveBeenCalled();
    expect(mocks.profileUpdate).toHaveBeenCalled();
  });
});
