import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prepRecordRepository } from '../repositories/prep-record-repository';
import { inventoryTransactionService } from './inventory-transaction-service';
import { prepRecordService } from './prep-record-service';
import { NotFoundError } from '../utils/errors';

vi.mock('../repositories/prep-record-repository', () => ({
  prepRecordRepository: {
    findAllByOrganization: vi.fn(),
    findById: vi.fn(),
    findAllRecipesByOrganization: vi.fn(),
    findRecipeById: vi.fn(),
    createRecipeFromRecord: vi.fn(),
  },
}));

vi.mock('./inventory-transaction-service', () => ({
  inventoryTransactionService: {
    recordPrep: vi.fn(),
    getRollingAverageForOutputItem: vi.fn(),
  },
}));

const organizationId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';
const locationId = '33333333-3333-4333-8333-333333333333';
const outputItemId = '44444444-4444-4444-8444-444444444444';
const inputItemId = '55555555-5555-4555-8555-555555555555';
const recordId = '66666666-6666-4666-8666-666666666666';

const d = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);

const actor = { id: userId, role: 'STORE_ATTENDANT' as const, organizationId };

const buildRecord = (overrides: Record<string, unknown> = {}) => ({
  id: recordId,
  organizationId,
  locationId,
  outputItemId,
  actualYield: d(5.6),
  unitCost: d(250),
  recordedById: userId,
  recordedAt: new Date(),
  createdAt: new Date(),
  outputItem: { id: outputItemId, name: 'Marinated Chicken', usageUnit: 'g' },
  promotedTo: null,
  lines: [
    {
      id: '77777777-7777-4777-8777-777777777777',
      inputItemId,
      quantity: d(6),
      unitCost: d(291.67),
      inputItem: { id: inputItemId, name: 'Raw Chicken', usageUnit: 'kg' },
    },
  ],
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('prepRecordService.create', () => {
  it('delegates to Session 2\'s inventoryTransactionService.recordPrep (never reimplements prep costing)', async () => {
    vi.mocked(inventoryTransactionService.recordPrep).mockResolvedValue(buildRecord() as never);
    vi.mocked(prepRecordRepository.findById).mockResolvedValue(buildRecord({
      unitCost: d(250), // proves the output item's currentCost-driving unitCost came from recordPrep's own calc
    }) as never);

    const result = await prepRecordService.create(actor, {
      locationId,
      outputItemId,
      actualYield: '5.6',
      inputs: [{ inventoryItemId: inputItemId, quantity: '6' }],
    });

    expect(inventoryTransactionService.recordPrep).toHaveBeenCalledWith({
      organizationId,
      locationId,
      outputItemId,
      actualYield: '5.6',
      inputs: [{ inventoryItemId: inputItemId, quantity: '6' }],
      recordedById: userId,
    });
    // The service never touches inventoryItemRepository.updateCurrentCost or
    // recomputes unitCost itself — the returned record's unitCost/actualYield
    // is exactly what recordPrep (Session 2) produced and persisted.
    expect(result.unitCost.toString()).toBe('250');
    expect(result.actualYield.toString()).toBe('5.6');
  });

  it('propagates a NotFoundError from recordPrep for an unknown output item', async () => {
    vi.mocked(inventoryTransactionService.recordPrep).mockRejectedValue(
      new NotFoundError('Output inventory item not found'),
    );

    await expect(
      prepRecordService.create(actor, {
        locationId,
        outputItemId,
        actualYield: '5.6',
        inputs: [{ inventoryItemId: inputItemId, quantity: '6' }],
      }),
    ).rejects.toThrow(NotFoundError);
  });
});

describe('prepRecordService.promoteRecord', () => {
  it('copies the prep record\'s own input lines/output/yield onto the new PrepRecipe', async () => {
    vi.mocked(prepRecordRepository.findById).mockResolvedValue(buildRecord() as never);
    vi.mocked(prepRecordRepository.createRecipeFromRecord).mockResolvedValue({
      id: '88888888-8888-4888-8888-888888888888',
    } as never);

    const managerActor = { id: userId, role: 'STORE_MANAGER' as const, organizationId };
    await prepRecordService.promoteRecord(managerActor, recordId, { name: 'Standard Marinated Chicken' });

    expect(prepRecordRepository.createRecipeFromRecord).toHaveBeenCalledWith(organizationId, {
      promotedFromId: recordId,
      outputItemId,
      name: 'Standard Marinated Chicken',
      expectedYield: d(5.6),
      batchLabel: undefined,
      instructions: undefined,
      createdById: userId,
      lines: [{ inputItemId, quantity: d(6) }],
    });
  });

  it('throws NotFoundError when the prep record does not exist', async () => {
    vi.mocked(prepRecordRepository.findById).mockResolvedValue(null);

    await expect(
      prepRecordService.promoteRecord(actor, recordId, { name: 'X' }),
    ).rejects.toThrow(NotFoundError);
  });
});
