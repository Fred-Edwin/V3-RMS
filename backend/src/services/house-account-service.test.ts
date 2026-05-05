import { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { houseAccountRepository } from '../repositories/house-account-repository';
import { prisma } from '../config/database';
import { houseAccountService } from './house-account-service';

vi.mock('../repositories/house-account-repository', () => ({
  houseAccountRepository: {
    findAll: vi.fn(),
    findAllActive: vi.fn(),
    findById: vi.fn(),
    findByUserId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    findOrdersByAccountId: vi.fn(),
  },
}));

vi.mock('../config/database', () => ({
  prisma: {
    user: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
}));

const orgId = '11111111-1111-4111-8111-111111111111';
const accountId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const directorId = '22222222-2222-4222-8222-222222222222';
const managerId = '33333333-3333-4333-8333-333333333333';

type Actor = NonNullable<Request['user']>;

const directorActor: Actor = { id: directorId, role: 'DIRECTOR', organizationId: null } as Actor;
const managerActor: Actor = { id: managerId, role: 'MANAGER', organizationId: orgId } as Actor;
const accountantActor: Actor = { id: '44444444-4444-4444-8444-444444444444', role: 'ACCOUNTANT', organizationId: null } as Actor;
const waiterActor: Actor = { id: '55555555-5555-4555-8555-555555555555', role: 'WAITER', organizationId: orgId } as Actor;

const buildAccount = (overrides = {}) => ({
  id: accountId,
  userId: managerId,
  grantedById: directorId,
  creditLimit: new Prisma.Decimal(30000),
  currentBalance: new Prisma.Decimal(5000),
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  user: { id: managerId, name: 'Manager', role: 'MANAGER', email: 'mgr@wendo.co.ke' },
  grantedBy: { id: directorId, name: 'Director' },
  ...overrides,
});

describe('houseAccountService.list', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns all accounts for director', async () => {
    vi.mocked(houseAccountRepository.findAll).mockResolvedValue([buildAccount()]);
    const result = await houseAccountService.list(directorActor);
    expect(houseAccountRepository.findAll).toHaveBeenCalled();
    expect(result).toHaveLength(1);
  });

  it('throws ForbiddenError for waiter', async () => {
    await expect(houseAccountService.list(waiterActor)).rejects.toThrow('Only Directors and System Admins');
  });

  it('throws ForbiddenError for manager', async () => {
    await expect(houseAccountService.list(managerActor)).rejects.toThrow('Only Directors and System Admins');
  });
});

describe('houseAccountService.getOwn', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns own account for manager', async () => {
    vi.mocked(houseAccountRepository.findByUserId).mockResolvedValue(buildAccount());
    const result = await houseAccountService.getOwn(managerActor);
    expect(houseAccountRepository.findByUserId).toHaveBeenCalledWith(managerId);
    expect(result.userId).toBe(managerId);
  });

  it('throws NotFoundError when account not found', async () => {
    vi.mocked(houseAccountRepository.findByUserId).mockResolvedValue(null);
    await expect(houseAccountService.getOwn(managerActor)).rejects.toThrow('No active house account found');
  });

  it('throws ForbiddenError for waiter', async () => {
    await expect(houseAccountService.getOwn(waiterActor)).rejects.toThrow(
      'Only Managers, Directors, and System Admins can view a house account tab',
    );
  });
});

describe('houseAccountService.grantAccount', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('grants account to a manager', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: managerId, role: 'MANAGER' } as never);
    vi.mocked(houseAccountRepository.findByUserId).mockResolvedValue(null);
    vi.mocked(houseAccountRepository.create).mockResolvedValue(buildAccount());

    const result = await houseAccountService.grantAccount(directorActor, { userId: managerId, creditLimit: '30000' });
    expect(houseAccountRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: managerId, grantedById: directorId }),
    );
    expect(result.userId).toBe(managerId);
  });

  it('throws NotFoundError when target user not found', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
    await expect(
      houseAccountService.grantAccount(directorActor, { userId: managerId, creditLimit: '10000' }),
    ).rejects.toThrow('Target user not found or is inactive');
  });

  it('throws ValidationError when target user is a waiter', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: managerId, role: 'WAITER' } as never);
    await expect(
      houseAccountService.grantAccount(directorActor, { userId: managerId, creditLimit: '10000' }),
    ).rejects.toThrow('House accounts can only be granted to Managers and Directors');
  });

  it('throws ConflictError when account already exists', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: managerId, role: 'MANAGER' } as never);
    vi.mocked(houseAccountRepository.findByUserId).mockResolvedValue(buildAccount());
    await expect(
      houseAccountService.grantAccount(directorActor, { userId: managerId, creditLimit: '10000' }),
    ).rejects.toThrow('An active house account already exists');
  });

  it('throws ForbiddenError for manager', async () => {
    await expect(
      houseAccountService.grantAccount(managerActor, { userId: managerId, creditLimit: '10000' }),
    ).rejects.toThrow('Only Directors and System Admins');
  });
});

describe('houseAccountService.recordSettlement', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('records settlement for manager on own account', async () => {
    vi.mocked(houseAccountRepository.findById).mockResolvedValue(buildAccount({ userId: managerId }));
    vi.mocked(prisma.$transaction).mockImplementation((fn) => (fn as (tx: unknown) => Promise<unknown>)({ houseAccountSettlement: { create: vi.fn() }, houseAccount: { update: vi.fn() } }));

    await houseAccountService.recordSettlement(managerActor, accountId, { amount: '1000' });
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('throws ForbiddenError when manager tries to settle another user account', async () => {
    vi.mocked(houseAccountRepository.findById).mockResolvedValue(buildAccount({ userId: 'other-user-id' }));
    await expect(
      houseAccountService.recordSettlement(managerActor, accountId, { amount: '1000' }),
    ).rejects.toThrow('Managers can only record settlements on their own house account');
  });

  it('throws NotFoundError when account not found', async () => {
    vi.mocked(houseAccountRepository.findById).mockResolvedValue(null);
    await expect(
      houseAccountService.recordSettlement(directorActor, accountId, { amount: '1000' }),
    ).rejects.toThrow('House account not found or inactive');
  });

  it('throws ValidationError when amount exceeds balance', async () => {
    vi.mocked(houseAccountRepository.findById).mockResolvedValue(buildAccount({ currentBalance: new Prisma.Decimal(100) }));
    await expect(
      houseAccountService.recordSettlement(directorActor, accountId, { amount: '5000' }),
    ).rejects.toThrow('Settlement amount exceeds the outstanding balance');
  });

  it('throws ForbiddenError for waiter', async () => {
    await expect(
      houseAccountService.recordSettlement(waiterActor, accountId, { amount: '100' }),
    ).rejects.toThrow('Only Managers, Directors, Accountants, and System Admins');
  });
});

describe('houseAccountService.getOrderHistory', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns orders for director', async () => {
    vi.mocked(houseAccountRepository.findById).mockResolvedValue(buildAccount());
    vi.mocked(houseAccountRepository.findOrdersByAccountId).mockResolvedValue({ orders: [], total: 0 });
    await houseAccountService.getOrderHistory(directorActor, accountId, 1, 20);
    expect(houseAccountRepository.findOrdersByAccountId).toHaveBeenCalledWith(accountId, 1, 20, undefined);
  });

  it('throws NotFoundError when account not found', async () => {
    vi.mocked(houseAccountRepository.findById).mockResolvedValue(null);
    await expect(
      houseAccountService.getOrderHistory(directorActor, accountId, 1, 20),
    ).rejects.toThrow('House account not found');
  });

  it('throws ForbiddenError for manager', async () => {
    await expect(
      houseAccountService.getOrderHistory(managerActor, accountId, 1, 20),
    ).rejects.toThrow('Only Directors and System Admins');
  });
});
