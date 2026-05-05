import { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { corporateAccountRepository } from '../repositories/corporate-account-repository';
import { prisma } from '../config/database';
import { corporateAccountService } from './corporate-account-service';

vi.mock('../repositories/corporate-account-repository', () => ({
  corporateAccountRepository: {
    findAll: vi.fn(),
    findAllActive: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    findOrdersByAccountId: vi.fn(),
  },
}));

vi.mock('../config/database', () => ({
  prisma: { $transaction: vi.fn() },
}));

const orgId = '11111111-1111-4111-8111-111111111111';
const accountId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const directorId = '22222222-2222-4222-8222-222222222222';

type Actor = NonNullable<Request['user']>;

const directorActor: Actor = { id: directorId, role: 'DIRECTOR', organizationId: null } as Actor;
const accountantActor: Actor = { id: '33333333-3333-4333-8333-333333333333', role: 'ACCOUNTANT', organizationId: null } as Actor;
const managerActor: Actor = { id: '44444444-4444-4444-8444-444444444444', role: 'MANAGER', organizationId: orgId } as Actor;
const waiterActor: Actor = { id: '55555555-5555-4555-8555-555555555555', role: 'WAITER', organizationId: orgId } as Actor;

const buildAccount = (overrides = {}) => ({
  id: accountId,
  companyName: 'Acme Corp',
  contactName: 'Jane Doe',
  contactPhone: '+254700000001',
  contactEmail: null,
  billingCycleDay: 1,
  creditLimit: new Prisma.Decimal(50000),
  currentBalance: new Prisma.Decimal(10000),
  isActive: true,
  createdById: directorId,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: { id: directorId, name: 'Director' },
  ...overrides,
});

describe('corporateAccountService.list', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns full list for director', async () => {
    vi.mocked(corporateAccountRepository.findAll).mockResolvedValue([buildAccount()]);
    const result = await corporateAccountService.list(directorActor);
    expect(corporateAccountRepository.findAll).toHaveBeenCalled();
    expect(result).toHaveLength(1);
  });

  it('returns active dropdown list for manager', async () => {
    vi.mocked(corporateAccountRepository.findAllActive).mockResolvedValue([]);
    await corporateAccountService.list(managerActor);
    expect(corporateAccountRepository.findAllActive).toHaveBeenCalled();
  });

  it('returns active dropdown list for waiter', async () => {
    vi.mocked(corporateAccountRepository.findAllActive).mockResolvedValue([]);
    await corporateAccountService.list(waiterActor);
    expect(corporateAccountRepository.findAllActive).toHaveBeenCalled();
  });

  it('throws ForbiddenError for chef role', async () => {
    const chef = { ...waiterActor, role: 'CHEF' } as Actor;
    await expect(corporateAccountService.list(chef)).rejects.toThrow('Only Directors and System Admins');
  });
});

describe('corporateAccountService.createAccount', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('creates account for director', async () => {
    vi.mocked(corporateAccountRepository.create).mockResolvedValue(buildAccount());
    const input = { companyName: 'Acme', contactName: 'Jane', contactPhone: '+254700000001', billingCycleDay: 1, creditLimit: '50000' };
    const result = await corporateAccountService.createAccount(directorActor, input);
    expect(corporateAccountRepository.create).toHaveBeenCalledWith(input, directorId);
    expect(result.companyName).toBe('Acme Corp');
  });

  it('creates account for accountant', async () => {
    vi.mocked(corporateAccountRepository.create).mockResolvedValue(buildAccount());
    const input = { companyName: 'Acme', contactName: 'Jane', contactPhone: '+254700000001', billingCycleDay: 1, creditLimit: '50000' };
    await corporateAccountService.createAccount(accountantActor, input);
    expect(corporateAccountRepository.create).toHaveBeenCalled();
  });

  it('throws ForbiddenError for manager', async () => {
    await expect(
      corporateAccountService.createAccount(managerActor, {} as never),
    ).rejects.toThrow('Only Directors and System Admins');
  });
});

describe('corporateAccountService.updateAccount', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('updates account for director', async () => {
    vi.mocked(corporateAccountRepository.update).mockResolvedValue(buildAccount({ companyName: 'Updated' }));
    const result = await corporateAccountService.updateAccount(directorActor, accountId, { companyName: 'Updated' });
    expect(result.companyName).toBe('Updated');
  });

  it('throws NotFoundError when account not found', async () => {
    vi.mocked(corporateAccountRepository.update).mockResolvedValue(null);
    await expect(
      corporateAccountService.updateAccount(directorActor, accountId, {}),
    ).rejects.toThrow('Corporate account not found');
  });

  it('throws ForbiddenError for waiter', async () => {
    await expect(
      corporateAccountService.updateAccount(waiterActor, accountId, {}),
    ).rejects.toThrow('Only Directors and System Admins');
  });
});

describe('corporateAccountService.recordSettlement', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('records settlement when amount is valid', async () => {
    vi.mocked(corporateAccountRepository.findById).mockResolvedValue(buildAccount());
    vi.mocked(prisma.$transaction).mockImplementation((fn) => (fn as (tx: unknown) => Promise<unknown>)({ corporateAccountSettlement: { create: vi.fn() }, corporateAccount: { update: vi.fn() } }));
    await corporateAccountService.recordSettlement(directorActor, accountId, { amount: '5000', note: 'Cash' });
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('throws NotFoundError when account not found', async () => {
    vi.mocked(corporateAccountRepository.findById).mockResolvedValue(null);
    await expect(
      corporateAccountService.recordSettlement(directorActor, accountId, { amount: '5000' }),
    ).rejects.toThrow('Corporate account not found');
  });

  it('throws ValidationError when amount exceeds balance', async () => {
    vi.mocked(corporateAccountRepository.findById).mockResolvedValue(buildAccount({ currentBalance: new Prisma.Decimal(100) }));
    await expect(
      corporateAccountService.recordSettlement(directorActor, accountId, { amount: '5000' }),
    ).rejects.toThrow('Settlement amount exceeds');
  });

  it('throws ForbiddenError for manager', async () => {
    await expect(
      corporateAccountService.recordSettlement(managerActor, accountId, { amount: '100' }),
    ).rejects.toThrow('Only Directors and System Admins');
  });
});

describe('corporateAccountService.getOrderHistory', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns orders for director', async () => {
    vi.mocked(corporateAccountRepository.findById).mockResolvedValue(buildAccount());
    vi.mocked(corporateAccountRepository.findOrdersByAccountId).mockResolvedValue({ orders: [], total: 0 });
    await corporateAccountService.getOrderHistory(directorActor, accountId, 1, 20);
    expect(corporateAccountRepository.findOrdersByAccountId).toHaveBeenCalledWith(accountId, 1, 20);
  });

  it('throws NotFoundError when account not found', async () => {
    vi.mocked(corporateAccountRepository.findById).mockResolvedValue(null);
    await expect(
      corporateAccountService.getOrderHistory(directorActor, accountId, 1, 20),
    ).rejects.toThrow('Corporate account not found');
  });

  it('throws ForbiddenError for manager', async () => {
    await expect(
      corporateAccountService.getOrderHistory(managerActor, accountId, 1, 20),
    ).rejects.toThrow('Only Directors, Accountants, and System Admins');
  });
});
