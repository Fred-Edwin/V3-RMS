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

describe('staffTransferRepository.create — Q4 (DEPARTMENT_HEAD transferred between branches)', () => {
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

  it('clears role, departmentTag, and previousRole when transferring a DEPARTMENT_HEAD', async () => {
    mocks.userFindUniqueOrThrow.mockResolvedValue({
      id: 'user-1',
      role: 'DEPARTMENT_HEAD',
      previousRole: 'CHEF',
      departmentTag: 'KITCHEN',
    });

    await staffTransferRepository.create({
      userId: 'user-1',
      fromOrganizationId: 'org-a',
      toOrganizationId: 'org-b',
      authorizedById: 'director-1',
    });

    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        organizationId: 'org-b',
        role: 'CHEF',
        previousRole: null,
        departmentTag: null,
      },
    });
  });

  it('falls back to WAITER if a DEPARTMENT_HEAD somehow has no previousRole', async () => {
    mocks.userFindUniqueOrThrow.mockResolvedValue({
      id: 'user-1',
      role: 'DEPARTMENT_HEAD',
      previousRole: null,
      departmentTag: 'BARISTA',
    });

    await staffTransferRepository.create({
      userId: 'user-1',
      fromOrganizationId: 'org-a',
      toOrganizationId: 'org-b',
      authorizedById: 'director-1',
    });

    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        organizationId: 'org-b',
        role: 'WAITER',
        previousRole: null,
        departmentTag: null,
      },
    });
  });

  it('leaves role untouched for a non-DEPARTMENT_HEAD transfer', async () => {
    mocks.userFindUniqueOrThrow.mockResolvedValue({
      id: 'user-2',
      role: 'WAITER',
      previousRole: null,
      departmentTag: null,
    });

    await staffTransferRepository.create({
      userId: 'user-2',
      fromOrganizationId: 'org-a',
      toOrganizationId: 'org-b',
      authorizedById: 'director-1',
    });

    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: 'user-2' },
      data: { organizationId: 'org-b' },
    });
  });
});
