import { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { customerCreditRepository } from '../repositories/customer-credit-repository';
import { prisma } from '../config/database';
import { customerCreditService } from './customer-credit-service';

vi.mock('../repositories/customer-credit-repository', () => ({
  customerCreditRepository: {
    findAllByOrganization: vi.fn(),
    findActiveByOrganization: vi.fn(),
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
const managerId = '22222222-2222-4222-8222-222222222222';

type Actor = NonNullable<Request['user']>;

const managerActor: Actor = { id: managerId, role: 'MANAGER', organizationId: orgId } as Actor;
const waiterActor: Actor = { id: '33333333-3333-4333-8333-333333333333', role: 'WAITER', organizationId: orgId } as Actor;
const accountantActor: Actor = { id: '44444444-4444-4444-8444-444444444444', role: 'ACCOUNTANT', organizationId: null } as Actor;
const chefActor: Actor = { id: '55555555-5555-4555-8555-555555555555', role: 'CHEF', organizationId: orgId } as Actor;

const buildAccount = (overrides = {}) => ({
  id: accountId,
  organizationId: orgId,
  customerName: 'John Doe',
  customerPhone: '+254700000001',
  creditLimit: new Prisma.Decimal(10000),
  currentBalance: new Prisma.Decimal(3000),
  isActive: true,
  notes: null,
  createdById: managerId,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: { id: managerId, name: 'Manager' },
  organization: { name: 'Wendo Kingz' },
  ...overrides,
});

describe('customerCreditService.list', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns full list for manager', async () => {
    vi.mocked(customerCreditRepository.findAllByOrganization).mockResolvedValue([buildAccount()]);
    const result = await customerCreditService.list(managerActor);
    expect(customerCreditRepository.findAllByOrganization).toHaveBeenCalledWith(orgId);
    expect(result).toHaveLength(1);
  });

  it('returns active list for waiter', async () => {
    vi.mocked(customerCreditRepository.findActiveByOrganization).mockResolvedValue([]);
    await customerCreditService.list(waiterActor);
    expect(customerCreditRepository.findActiveByOrganization).toHaveBeenCalledWith(orgId);
  });

  it('throws ForbiddenError for accountant missing branchId', async () => {
    await expect(customerCreditService.list(accountantActor)).rejects.toThrow('branchId query param is required');
  });

  it('uses requestedOrgId for accountant', async () => {
    vi.mocked(customerCreditRepository.findAllByOrganization).mockResolvedValue([]);
    await customerCreditService.list(accountantActor, orgId);
    expect(customerCreditRepository.findAllByOrganization).toHaveBeenCalledWith(orgId);
  });
});

describe('customerCreditService.createAccount', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('creates account for manager', async () => {
    vi.mocked(customerCreditRepository.create).mockResolvedValue(buildAccount());
    const input = { customerName: 'John', customerPhone: '+254700000001', creditLimit: '10000' };
    const result = await customerCreditService.createAccount(managerActor, input);
    expect(customerCreditRepository.create).toHaveBeenCalledWith(orgId, input, managerId);
    expect(result.customerName).toBe('John Doe');
  });

  it('creates account for waiter', async () => {
    vi.mocked(customerCreditRepository.create).mockResolvedValue(buildAccount());
    const input = { customerName: 'John', customerPhone: '+254700000001', creditLimit: '10000' };
    await customerCreditService.createAccount(waiterActor, input);
    expect(customerCreditRepository.create).toHaveBeenCalled();
  });

  it('throws ForbiddenError for chef', async () => {
    await expect(
      customerCreditService.createAccount(chefActor, {} as never),
    ).rejects.toThrow('Only Waiters and Managers can create');
  });
});

describe('customerCreditService.updateAccount', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('updates account for manager', async () => {
    vi.mocked(customerCreditRepository.update).mockResolvedValue(buildAccount({ customerName: 'Updated' }));
    const result = await customerCreditService.updateAccount(managerActor, accountId, { customerName: 'Updated' });
    expect(result.customerName).toBe('Updated');
  });

  it('throws NotFoundError when account not found', async () => {
    vi.mocked(customerCreditRepository.update).mockResolvedValue(null);
    await expect(
      customerCreditService.updateAccount(managerActor, accountId, {}),
    ).rejects.toThrow('Customer credit account not found');
  });

  it('throws ForbiddenError for waiter', async () => {
    await expect(
      customerCreditService.updateAccount(waiterActor, accountId, {}),
    ).rejects.toThrow('Only Managers and Accountants');
  });
});

describe('customerCreditService.recordSettlement', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('records settlement when amount is valid', async () => {
    vi.mocked(customerCreditRepository.findById).mockResolvedValue(buildAccount());
    vi.mocked(prisma.$transaction).mockImplementation((fn) => (fn as (tx: unknown) => Promise<unknown>)({ customerCreditSettlement: { create: vi.fn() }, customerCreditAccount: { update: vi.fn() } }));
    await customerCreditService.recordSettlement(managerActor, accountId, { amount: '1000', note: 'Cash' });
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('throws NotFoundError when account not found', async () => {
    vi.mocked(customerCreditRepository.findById).mockResolvedValue(null);
    await expect(
      customerCreditService.recordSettlement(managerActor, accountId, { amount: '100' }),
    ).rejects.toThrow('Customer credit account not found');
  });

  it('throws ValidationError when amount exceeds balance', async () => {
    vi.mocked(customerCreditRepository.findById).mockResolvedValue(buildAccount({ currentBalance: new Prisma.Decimal(50) }));
    await expect(
      customerCreditService.recordSettlement(managerActor, accountId, { amount: '1000' }),
    ).rejects.toThrow('Settlement amount exceeds');
  });

  it('throws ForbiddenError for waiter', async () => {
    await expect(
      customerCreditService.recordSettlement(waiterActor, accountId, { amount: '100' }),
    ).rejects.toThrow('Only Managers and Accountants');
  });
});

describe('customerCreditService.getOrderHistory', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns orders for manager', async () => {
    vi.mocked(customerCreditRepository.findById).mockResolvedValue(buildAccount());
    vi.mocked(customerCreditRepository.findOrdersByAccountId).mockResolvedValue({ orders: [], total: 0 });
    await customerCreditService.getOrderHistory(managerActor, accountId, 1, 20);
    expect(customerCreditRepository.findOrdersByAccountId).toHaveBeenCalledWith(accountId, orgId, 1, 20);
  });

  it('throws NotFoundError when account not found', async () => {
    vi.mocked(customerCreditRepository.findById).mockResolvedValue(null);
    await expect(
      customerCreditService.getOrderHistory(managerActor, accountId, 1, 20),
    ).rejects.toThrow('Customer credit account not found');
  });

  it('throws ForbiddenError when no organizationId', async () => {
    const noOrgActor = { ...managerActor, organizationId: null } as Actor;
    await expect(
      customerCreditService.getOrderHistory(noOrgActor, accountId, 1, 20),
    ).rejects.toThrow('Branch context missing');
  });
});
