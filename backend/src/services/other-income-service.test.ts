import type { Request } from 'express';
import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { otherIncomeRepository } from '../repositories/other-income-repository';
import { otherIncomeService } from './other-income-service';
import { ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';

vi.mock('../repositories/other-income-repository', () => ({
  otherIncomeRepository: {
    findEntryById: vi.fn(),
    findActiveCategories: vi.fn(),
    updateEntry: vi.fn(),
  },
}));

const repo = vi.mocked(otherIncomeRepository);

type Actor = NonNullable<Request['user']>;

const managerActor = { id: 'mgr-1', role: 'MANAGER', siteId: 'org-1' } as Actor;
const directorActor = { id: 'dir-1', role: 'DIRECTOR', siteId: null } as Actor;
const accountantActor = { id: 'acc-1', role: 'ACCOUNTANT', siteId: null } as Actor;
const waiterActor = { id: 'wtr-1', role: 'WAITER', siteId: 'org-1' } as Actor;

/** A recorded CASH entry, `daysAgo` old, for `org-1`. */
const makeEntry = (daysAgo: number, over: Partial<Record<string, unknown>> = {}) => {
  const entryDate = new Date();
  entryDate.setUTCHours(0, 0, 0, 0);
  entryDate.setUTCDate(entryDate.getUTCDate() - daysAgo);
  return {
    id: 'entry-1',
    siteId: 'org-1',
    branchId: 'org-1',
    categoryId: 'cat-1',
    amount: new Prisma.Decimal('33000'),
    paymentMethod: 'CASH' as const,
    mpesaCode: null,
    mpesaAmount: null,
    cashAmount: null,
    cardAmount: null,
    splitType: null,
    description: 'Kplc',
    entryDate,
    recordedById: 'wtr-1',
    recordedBy: { id: 'wtr-1', name: 'Mercy Kamau' },
    category: { id: 'cat-1', name: 'Utilities' },
    branch: { id: 'org-1', name: 'Kimathi Way' },
    edits: [],
    createdAt: entryDate,
    updatedAt: entryDate,
    ...over,
  };
};

beforeEach(() => {
  vi.clearAllMocks();
  repo.updateEntry.mockImplementation(async (_id, _org, _data, _audit) => makeEntry(2));
});

describe('otherIncomeService.updateEntry', () => {
  it('lets a manager correct the amount on a recent entry and records the change', async () => {
    repo.findEntryById.mockResolvedValue(makeEntry(2));

    await otherIncomeService.updateEntry(managerActor, 'entry-1', { amount: '30000' });

    expect(repo.updateEntry).toHaveBeenCalledTimes(1);
    const call = repo.updateEntry.mock.calls[0]!;
    const [id, orgId, data, audit] = call;
    expect(id).toBe('entry-1');
    expect(orgId).toBe('org-1');
    expect(data.amount).toBe('30000');
    expect(audit.editedById).toBe('mgr-1');
    expect(audit.changes).toEqual([
      { field: 'amount', from: '33000', to: '30000' },
    ]);
  });

  it('scopes a manager lookup to their own organization', async () => {
    repo.findEntryById.mockResolvedValue(makeEntry(2));
    await otherIncomeService.updateEntry(managerActor, 'entry-1', { amount: '30000' });
    expect(repo.findEntryById).toHaveBeenCalledWith('entry-1', 'org-1');
  });

  it('rejects a manager editing an entry older than 30 days', async () => {
    repo.findEntryById.mockResolvedValue(makeEntry(31));
    await expect(
      otherIncomeService.updateEntry(managerActor, 'entry-1', { amount: '30000' }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(repo.updateEntry).not.toHaveBeenCalled();
  });

  it('allows a director to edit an entry far older than 30 days (no window)', async () => {
    repo.findEntryById.mockResolvedValue(makeEntry(400));
    await otherIncomeService.updateEntry(directorActor, 'entry-1', { amount: '30000' });
    expect(repo.updateEntry).toHaveBeenCalledTimes(1);
  });

  it('looks a director up without an org scope', async () => {
    repo.findEntryById.mockResolvedValue(makeEntry(2));
    await otherIncomeService.updateEntry(directorActor, 'entry-1', { amount: '30000' });
    expect(repo.findEntryById).toHaveBeenCalledWith('entry-1', undefined);
  });

  it('forbids an accountant from editing', async () => {
    await expect(
      otherIncomeService.updateEntry(accountantActor, 'entry-1', { amount: '30000' }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(repo.findEntryById).not.toHaveBeenCalled();
  });

  it('forbids a waiter from editing', async () => {
    await expect(
      otherIncomeService.updateEntry(waiterActor, 'entry-1', { amount: '30000' }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('404s when the entry does not exist (or is outside the actor scope)', async () => {
    repo.findEntryById.mockResolvedValue(null);
    await expect(
      otherIncomeService.updateEntry(managerActor, 'missing', { amount: '30000' }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('validates a changed category is active for the branch', async () => {
    repo.findEntryById.mockResolvedValue(makeEntry(2));
    repo.findActiveCategories.mockResolvedValue([
      { id: 'cat-1', name: 'Utilities', branchId: null, branchName: null },
    ]);
    await expect(
      otherIncomeService.updateEntry(managerActor, 'entry-1', { categoryId: 'cat-99' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('accepts a changed category that is active for the branch', async () => {
    repo.findEntryById.mockResolvedValue(makeEntry(2));
    repo.findActiveCategories.mockResolvedValue([
      { id: 'cat-1', name: 'Utilities', branchId: null, branchName: null },
      { id: 'cat-2', name: 'Events', branchId: null, branchName: null },
    ]);
    await otherIncomeService.updateEntry(managerActor, 'entry-1', { categoryId: 'cat-2' });
    expect(repo.updateEntry).toHaveBeenCalledTimes(1);
    const audit = repo.updateEntry.mock.calls[0]![3];
    expect(audit.changes).toEqual([{ field: 'categoryId', from: 'cat-1', to: 'cat-2' }]);
  });

  it('does not treat a formatting-only amount change as a real change', async () => {
    repo.findEntryById.mockResolvedValue(makeEntry(2)); // amount 33000
    const result = await otherIncomeService.updateEntry(managerActor, 'entry-1', {
      amount: '33000.00',
      paymentMethod: 'CASH',
    });
    expect(repo.updateEntry).not.toHaveBeenCalled();
    expect(result.id).toBe('entry-1');
  });

  it('rejects a non-split amount of zero', async () => {
    repo.findEntryById.mockResolvedValue(makeEntry(2));
    await expect(
      otherIncomeService.updateEntry(managerActor, 'entry-1', { amount: '0' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects a split whose legs do not add up to the total', async () => {
    repo.findEntryById.mockResolvedValue(
      makeEntry(2, {
        paymentMethod: 'SPLIT',
        splitType: 'MPESA_CASH',
        amount: new Prisma.Decimal('33000'),
        mpesaAmount: new Prisma.Decimal('20000'),
        cashAmount: new Prisma.Decimal('13000'),
      }),
    );
    await expect(
      otherIncomeService.updateEntry(managerActor, 'entry-1', {
        paymentMethod: 'SPLIT',
        splitType: 'MPESA_CASH',
        amount: '30000',
        mpesaAmount: '20000',
        cashAmount: '13000',
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('clears split columns when switching a split entry to a single method', async () => {
    repo.findEntryById.mockResolvedValue(
      makeEntry(2, {
        paymentMethod: 'SPLIT',
        splitType: 'MPESA_CASH',
        amount: new Prisma.Decimal('33000'),
        mpesaAmount: new Prisma.Decimal('20000'),
        cashAmount: new Prisma.Decimal('13000'),
      }),
    );
    await otherIncomeService.updateEntry(managerActor, 'entry-1', {
      paymentMethod: 'CASH',
      amount: '33000',
    });
    const data = repo.updateEntry.mock.calls[0]![2];
    expect(data.paymentMethod).toBe('CASH');
    expect(data.splitType).toBeNull();
    expect(data.mpesaAmount).toBeNull();
    expect(data.cashAmount).toBeNull();
  });
});
