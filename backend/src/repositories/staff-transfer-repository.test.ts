import { beforeEach, describe, expect, it, vi } from 'vitest';
import { staffTransferRepository } from './staff-transfer-repository';

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  transferCreate: vi.fn(),
  userFindUniqueOrThrow: vi.fn(),
  userUpdate: vi.fn(),
}));

vi.mock('../config/database', () => ({
  prisma: {
    $transaction: mocks.transaction,
    staffTransfer: { create: mocks.transferCreate },
    user: { findUniqueOrThrow: mocks.userFindUniqueOrThrow, update: mocks.userUpdate },
  },
}));

describe('staffTransferRepository.create — Q4 (department head transferred between branches)', () => {
  const tx = {
    staffTransfer: { create: mocks.transferCreate },
    user: { findUniqueOrThrow: mocks.userFindUniqueOrThrow, update: mocks.userUpdate },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation(async (arg: unknown) =>
      typeof arg === 'function' ? (arg as (t: typeof tx) => Promise<unknown>)(tx) : Promise.all(arg as Array<Promise<unknown>>),
    );
    mocks.transferCreate.mockResolvedValue({ id: 'transfer-1' });
    mocks.userUpdate.mockResolvedValue({});
  });

  it('clears the head marker and departmentTag when transferring a department head, keeping their real role', async () => {
    mocks.userFindUniqueOrThrow.mockResolvedValue({
      id: 'user-1',
      role: 'CHEF',
      isDepartmentHead: true,
      departmentTag: 'KITCHEN',
    });

    await staffTransferRepository.create({
      userId: 'user-1',
      fromSiteId: 'org-a',
      toSiteId: 'org-b',
      authorizedById: 'director-1',
    });

    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        siteId: 'org-b',
        isDepartmentHead: false,
        departmentTag: null,
        departmentId: null,
      },
    });
  });

  it('leaves role and marker untouched for a non-head transfer', async () => {
    mocks.userFindUniqueOrThrow.mockResolvedValue({
      id: 'user-2',
      role: 'WAITER',
      isDepartmentHead: false,
      departmentTag: null,
    });

    await staffTransferRepository.create({
      userId: 'user-2',
      fromSiteId: 'org-a',
      toSiteId: 'org-b',
      authorizedById: 'director-1',
    });

    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: 'user-2' },
      data: { siteId: 'org-b' },
    });
  });
});
