import { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { discountRepository } from '../repositories/discount-repository';
import { discountService } from './discount-service';

vi.mock('../repositories/discount-repository', () => ({
  discountRepository: {
    create: vi.fn(),
    findById: vi.fn(),
    findByBranch: vi.fn(),
    update: vi.fn(),
    deactivate: vi.fn(),
  },
}));

const siteId = '11111111-1111-4111-8111-111111111111';
const discountId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const directorId = '22222222-2222-4222-8222-222222222222';

const directorActor = {
  id: directorId,
  role: 'DIRECTOR',
  siteId,
} as NonNullable<Request['user']>;

const waiterActor = {
  id: '33333333-3333-4333-8333-333333333333',
  role: 'WAITER',
  siteId,
} as NonNullable<Request['user']>;

type DiscountRecordFixture = {
  id: string; siteId: string | null; name: string;
  type: 'PERCENTAGE' | 'FIXED_AMOUNT'; value: Prisma.Decimal;
  requiresApproval: boolean; isActive: boolean; createdById: string;
  createdAt: Date; updatedAt: Date; createdBy: { id: string; name: string };
};

const buildDiscountRecord = (overrides: Partial<DiscountRecordFixture> = {}): DiscountRecordFixture => ({
  id: discountId,
  siteId,
  name: 'Happy Hour',
  type: 'PERCENTAGE' as const,
  value: new Prisma.Decimal('10.00'),
  requiresApproval: false,
  isActive: true,
  createdById: directorId,
  createdAt: new Date('2026-04-10T08:00:00.000Z'),
  updatedAt: new Date('2026-04-10T08:00:00.000Z'),
  createdBy: { id: directorId, name: 'Director One' },
  ...overrides,
});

describe('discountService.list', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns active discounts for a waiter', async () => {
    vi.mocked(discountRepository.findByBranch).mockResolvedValue([buildDiscountRecord()]);
    const result = await discountService.list(waiterActor);
    expect(discountRepository.findByBranch).toHaveBeenCalledWith(siteId, true);
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('Happy Hour');
  });

  it('returns all discounts (including inactive) for a manager', async () => {
    const managerActor = { ...directorActor, role: 'MANAGER' as const };
    vi.mocked(discountRepository.findByBranch).mockResolvedValue([buildDiscountRecord()]);
    await discountService.list(managerActor);
    expect(discountRepository.findByBranch).toHaveBeenCalledWith(siteId, false);
  });

  it('returns empty array when actor has no organizationId', async () => {
    const actorNoOrg = { ...waiterActor, siteId: null };
    const result = await discountService.list(actorNoOrg as NonNullable<Request['user']>);
    expect(result).toEqual([]);
    expect(discountRepository.findByBranch).not.toHaveBeenCalled();
  });
});

describe('discountService.create', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('creates a discount when actor is a director', async () => {
    vi.mocked(discountRepository.create).mockResolvedValue(buildDiscountRecord());
    const result = await discountService.create(
      { siteId, name: 'Happy Hour', type: 'PERCENTAGE', value: 10, requiresApproval: false },
      directorActor,
    );
    expect(discountRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Happy Hour', value: '10', type: 'PERCENTAGE' }),
    );
    expect(result.name).toBe('Happy Hour');
    expect(result.value).toBe('10');
  });

  it('throws ForbiddenError when actor is not a director', async () => {
    await expect(
      discountService.create(
        { siteId, name: 'Happy Hour', type: 'PERCENTAGE', value: 10, requiresApproval: false },
        waiterActor,
      ),
    ).rejects.toThrow('Only directors can create discounts');
  });

  it('creates an all-branch discount when organizationId is null', async () => {
    const allBranchDiscount = buildDiscountRecord({ siteId: null });
    vi.mocked(discountRepository.create).mockResolvedValue(allBranchDiscount);
    const result = await discountService.create(
      { siteId: null, name: 'All Branches', type: 'FIXED_AMOUNT', value: 100, requiresApproval: true },
      directorActor,
    );
    expect(discountRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ siteId: null }),
    );
    expect(result.siteId).toBeNull();
  });
});

describe('discountService.deactivate', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('deactivates a discount', async () => {
    vi.mocked(discountRepository.findById).mockResolvedValue(buildDiscountRecord());
    vi.mocked(discountRepository.deactivate).mockResolvedValue(
      buildDiscountRecord({ isActive: false }),
    );
    const result = await discountService.deactivate(discountId, directorActor);
    expect(discountRepository.deactivate).toHaveBeenCalledWith(discountId, directorActor.siteId);
    expect(result.isActive).toBe(false);
  });

  it('throws ForbiddenError when actor is not a director', async () => {
    await expect(discountService.deactivate(discountId, waiterActor)).rejects.toThrow(
      'Only directors can delete discounts',
    );
  });

  it('throws NotFoundError when discount does not exist', async () => {
    vi.mocked(discountRepository.findById).mockResolvedValue(null);
    await expect(discountService.deactivate(discountId, directorActor)).rejects.toThrow(
      'Discount not found',
    );
  });
});
