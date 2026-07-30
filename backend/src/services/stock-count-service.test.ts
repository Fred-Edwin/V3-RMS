import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../config/database';
import { stockCountRepository } from '../repositories/stock-count-repository';
import { inventoryItemRepository } from '../repositories/inventory-item-repository';
import { inventoryTransactionRepository } from '../repositories/inventory-transaction-repository';
import { stockCountService } from './stock-count-service';
import { ConflictError } from '../utils/errors';

vi.mock('../config/database', () => ({
  prisma: { $transaction: vi.fn() },
}));

vi.mock('../repositories/stock-count-repository', () => ({
  stockCountRepository: {
    findAllByOrganization: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    transitionStatus: vi.fn(),
    updateLineCount: vi.fn(),
    findLineById: vi.fn(),
  },
}));

vi.mock('../repositories/inventory-item-repository', () => ({
  inventoryItemRepository: {
    findById: vi.fn(),
  },
}));

vi.mock('../repositories/inventory-transaction-repository', () => ({
  inventoryTransactionRepository: {
    create: vi.fn(),
    sumQuantityByItemAndLocation: vi.fn(),
  },
}));

const organizationId = '11111111-1111-4111-8111-111111111111';
const managerId = '22222222-2222-4222-8222-222222222222';
const attendantId = '99999999-9999-4999-8999-999999999999';
const locationId = '33333333-3333-4333-8333-333333333333';
const countId = '44444444-4444-4444-8444-444444444444';
const lineId1 = '55555555-5555-4555-8555-555555555555';
const lineId2 = '66666666-6666-4666-8666-666666666666';
const itemId1 = '77777777-7777-4777-8777-777777777777';
const itemId2 = '88888888-8888-4888-8888-888888888888';

const d = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);

const managerActor = { id: managerId, role: 'STORE_MANAGER' as const, organizationId };
const attendantActor = { id: attendantId, role: 'STORE_ATTENDANT' as const, organizationId };

const buildCount = (overrides: Record<string, unknown> = {}) => ({
  id: countId,
  organizationId,
  locationId,
  label: 'Weekly Count',
  status: 'SUBMITTED' as const,
  scheduledDate: new Date(),
  createdById: managerId,
  submittedById: attendantId,
  submittedAt: new Date(),
  approvedById: null,
  approvedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  lines: [
    {
      id: lineId1,
      organizationId,
      stockCountId: countId,
      inventoryItemId: itemId1,
      sequence: 1,
      expectedQty: d(10),
      countedQty: d(9.5),
      gapQty: d(-0.5),
      inventoryItem: { id: itemId1, name: 'Chicken Breast', usageUnit: 'kg' },
    },
    {
      id: lineId2,
      organizationId,
      stockCountId: countId,
      inventoryItemId: itemId2,
      sequence: 2,
      expectedQty: d(20),
      countedQty: d(20),
      gapQty: d(0),
      inventoryItem: { id: itemId2, name: 'Flour', usageUnit: 'kg' },
    },
  ],
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.$transaction).mockImplementation((fn) =>
    (fn as (tx: unknown) => Promise<unknown>)(prisma),
  );
});

describe('stockCountService D-14 blind counting', () => {
  it('strips expectedQty and gapQty (key absent, not null) from every line for an Attendant caller', async () => {
    vi.mocked(stockCountRepository.findById).mockResolvedValue(buildCount() as never);

    const result = await stockCountService.getById(attendantActor, countId);

    for (const line of result.lines) {
      expect(Object.prototype.hasOwnProperty.call(line, 'expectedQty')).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(line, 'gapQty')).toBe(false);
    }
  });

  it('keeps expectedQty and gapQty for a Manager caller', async () => {
    vi.mocked(stockCountRepository.findById).mockResolvedValue(buildCount() as never);

    const result = await stockCountService.getById(managerActor, countId);

    expect((result.lines[0] as { expectedQty: Prisma.Decimal }).expectedQty.toString()).toBe('10');
    expect((result.lines[0] as { gapQty: Prisma.Decimal }).gapQty.toString()).toBe('-0.5');
  });
});

describe('stockCountService.approve', () => {
  it('posts one ADJUSTMENT transaction per line with a non-zero gap, and skips zero-gap lines', async () => {
    vi.mocked(stockCountRepository.findById).mockResolvedValue(buildCount() as never);
    vi.mocked(inventoryItemRepository.findById).mockImplementation(
      (id) => Promise.resolve({ id, currentCost: d(300) }) as never,
    );
    vi.mocked(stockCountRepository.transitionStatus).mockResolvedValue(true);

    await stockCountService.approve(managerActor, countId);

    // Only lineId1 has a non-zero gap (-0.5); lineId2's gap is 0 and must be skipped.
    expect(inventoryTransactionRepository.create).toHaveBeenCalledTimes(1);
    expect(inventoryTransactionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId,
        locationId,
        inventoryItemId: itemId1,
        type: 'ADJUSTMENT',
        quantity: expect.any(Prisma.Decimal),
        unitCost: d(300),
        userId: managerId,
        stockCountLineId: lineId1,
      }),
      prisma,
    );

    expect(stockCountRepository.transitionStatus).toHaveBeenCalledWith(
      countId,
      organizationId,
      ['SUBMITTED'],
      'APPROVED',
      { approvedById: managerId, approvedAt: expect.any(Date) },
      prisma,
    );
  });

  it('rejects approving a count that is not SUBMITTED', async () => {
    vi.mocked(stockCountRepository.findById).mockResolvedValue(
      buildCount({ status: 'IN_PROGRESS' }) as never,
    );

    await expect(stockCountService.approve(managerActor, countId)).rejects.toThrow(ConflictError);
    expect(inventoryTransactionRepository.create).not.toHaveBeenCalled();
  });
});

describe('stockCountService.correctLines', () => {
  it('updates countedQty/gapQty for a SUBMITTED session without touching status', async () => {
    vi.mocked(stockCountRepository.findById).mockResolvedValue(buildCount() as never);
    vi.mocked(stockCountRepository.findLineById).mockResolvedValue(
      buildCount().lines[0] as never,
    );

    await stockCountService.correctLines(managerActor, countId, [{ lineId: lineId1, countedQty: '9.7' }]);

    expect(stockCountRepository.updateLineCount).toHaveBeenCalledWith(
      lineId1,
      organizationId,
      { countedQty: expect.any(Prisma.Decimal), gapQty: expect.any(Prisma.Decimal) },
      prisma,
    );
    expect(stockCountRepository.transitionStatus).not.toHaveBeenCalled();
  });

  it('rejects correcting a count that is not SUBMITTED', async () => {
    vi.mocked(stockCountRepository.findById).mockResolvedValue(
      buildCount({ status: 'APPROVED' }) as never,
    );

    await expect(
      stockCountService.correctLines(managerActor, countId, [{ lineId: lineId1, countedQty: '9.7' }]),
    ).rejects.toThrow(ConflictError);
    expect(stockCountRepository.updateLineCount).not.toHaveBeenCalled();
  });
});
