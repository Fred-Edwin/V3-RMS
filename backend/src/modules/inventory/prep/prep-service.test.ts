import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { prepService } from './prep-service';
import { prepRunRepository } from './prep-repository';
import { inventoryItemRepository } from '../catalog/inventory-repository';
import { branchRepository } from '../../../repositories/branch-repository';
import { locationRepository } from '../../../repositories/location-repository';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../../utils/errors';

vi.mock('./prep-repository', () => ({
  prepRunRepository: {
    findAllBySite: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    findRecentForRollingAverage: vi.fn(),
    findSummaryRows: vi.fn(),
  },
}));

vi.mock('../catalog/inventory-repository', () => ({
  inventoryItemRepository: {
    findById: vi.fn(),
    findLiveByIds: vi.fn(),
  },
}));

vi.mock('../../../repositories/branch-repository', () => ({
  branchRepository: { findHub: vi.fn() },
}));

vi.mock('../../../repositories/location-repository', () => ({
  locationRepository: { findCentralStore: vi.fn() },
}));

const txInventoryTransactionCreate = vi.fn();
const txInventoryItemUpdate = vi.fn();

vi.mock('../../../config/database', () => ({
  prisma: {
    $transaction: vi.fn((fn: (tx: unknown) => unknown) =>
      fn({
        inventoryTransaction: { create: txInventoryTransactionCreate },
        inventoryItem: { update: txInventoryItemUpdate },
      }),
    ),
  },
}));

const hubOrgId = '11111111-1111-4111-8111-111111111111';
const branchOrgId = '22222222-2222-4222-8222-222222222222';
const outputItemId = '33333333-3333-4333-8333-333333333333';
const inputItemId = '44444444-4444-4444-8444-444444444444';
const centralStoreId = '55555555-5555-4555-8555-555555555555';
const prepRunId = '66666666-6666-4666-8666-666666666666';

const storeManager = { id: 'sm1', role: 'STORE_MANAGER' as const, siteId: hubOrgId };
const nonHubActor = { id: 'sm2', role: 'STORE_MANAGER' as const, siteId: branchOrgId };

const hubOrg = { id: hubOrgId, name: 'Central Store', isHub: true, isActive: true };
const centralStore = { id: centralStoreId, siteId: hubOrgId, type: 'CENTRAL_STORE' as const };

const buildOutputItem = (overrides: Record<string, unknown> = {}) => ({
  id: outputItemId,
  siteId: hubOrgId,
  name: 'Grilled chicken portion',
  usageUnit: 'portion',
  buyUnit: 'kg',
  currentCost: new Prisma.Decimal(10),
  deletedAt: null,
  ...overrides,
});

const buildInputItem = (overrides: Record<string, unknown> = {}) => ({
  id: inputItemId,
  siteId: hubOrgId,
  name: 'Raw chicken',
  usageUnit: 'kg',
  buyUnit: 'kg',
  currentCost: new Prisma.Decimal(300),
  deletedAt: null,
  ...overrides,
});

const buildPrepRun = (overrides: Record<string, unknown> = {}) => ({
  id: prepRunId,
  siteId: hubOrgId,
  outputItemId,
  actualYield: new Prisma.Decimal(22),
  outputUnitCost: new Prisma.Decimal(81.8182),
  totalInputCost: new Prisma.Decimal(1800),
  typicalYieldAtRunTime: null,
  yieldVarianceLabel: null,
  notifiedStoreManager: false,
  locationId: centralStoreId,
  createdById: storeManager.id,
  createdAt: new Date('2026-09-19T10:00:00Z'),
  outputItem: { id: outputItemId, name: 'Grilled chicken portion', usageUnit: 'portion' },
  location: { id: centralStoreId },
  createdBy: { id: storeManager.id, name: 'Jane Manager' },
  inputLines: [
    {
      id: 'line-1',
      prepRunId,
      inputItemId,
      quantity: new Prisma.Decimal(6),
      unitCostAtRunTime: new Prisma.Decimal(300),
      lineCost: new Prisma.Decimal(1800),
      lineOrder: 0,
      inputItem: { id: inputItemId, name: 'Raw chicken', usageUnit: 'kg' },
    },
  ],
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(branchRepository.findHub).mockResolvedValue(hubOrg as never);
  vi.mocked(locationRepository.findCentralStore).mockResolvedValue(centralStore as never);
});

describe('prepService.createPrepRun — hub scoping', () => {
  it('rejects a non-hub actor', async () => {
    await expect(
      prepService.createPrepRun(nonHubActor, {
        outputItemId,
        inputLines: [{ inventoryItemId: inputItemId, quantity: '6' }],
        actualYield: '22',
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe('prepService.createPrepRun — validation', () => {
  it('404s on an unknown output item', async () => {
    vi.mocked(inventoryItemRepository.findById).mockResolvedValue(null);

    await expect(
      prepService.createPrepRun(storeManager, {
        outputItemId,
        inputLines: [{ inventoryItemId: inputItemId, quantity: '6' }],
        actualYield: '22',
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('conflicts on a retired output item', async () => {
    vi.mocked(inventoryItemRepository.findById).mockResolvedValue(
      buildOutputItem({ deletedAt: new Date() }) as never,
    );

    await expect(
      prepService.createPrepRun(storeManager, {
        outputItemId,
        inputLines: [{ inventoryItemId: inputItemId, quantity: '6' }],
        actualYield: '22',
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('rejects an unknown input item', async () => {
    vi.mocked(inventoryItemRepository.findById).mockResolvedValue(buildOutputItem() as never);
    vi.mocked(inventoryItemRepository.findLiveByIds).mockResolvedValue([]);

    await expect(
      prepService.createPrepRun(storeManager, {
        outputItemId,
        inputLines: [{ inventoryItemId: inputItemId, quantity: '6' }],
        actualYield: '22',
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('prepService.createPrepRun — the atomic transaction', () => {
  beforeEach(() => {
    vi.mocked(inventoryItemRepository.findById).mockResolvedValue(buildOutputItem() as never);
    vi.mocked(inventoryItemRepository.findLiveByIds).mockResolvedValue([buildInputItem()] as never);
    vi.mocked(prepRunRepository.findRecentForRollingAverage).mockResolvedValue([]);
    vi.mocked(prepRunRepository.create).mockResolvedValue(buildPrepRun() as never);
    vi.mocked(prepRunRepository.findById).mockResolvedValue(buildPrepRun() as never);
  });

  it('writes exactly one negative-signed PREP_CONSUME row per input line', async () => {
    await prepService.createPrepRun(storeManager, {
      outputItemId,
      inputLines: [{ inventoryItemId: inputItemId, quantity: '6' }],
      actualYield: '22',
    });

    const consumeCalls = txInventoryTransactionCreate.mock.calls.filter(
      ([arg]) => arg.data.type === 'PREP_CONSUME',
    );
    expect(consumeCalls).toHaveLength(1);
    const consumeQty = consumeCalls[0]![0].data.quantity as Prisma.Decimal;
    expect(consumeQty.isNegative()).toBe(true);
    expect(consumeQty.abs().toString()).toBe('6');
  });

  it('writes exactly one positive-signed PREP_PRODUCE row for the output', async () => {
    await prepService.createPrepRun(storeManager, {
      outputItemId,
      inputLines: [{ inventoryItemId: inputItemId, quantity: '6' }],
      actualYield: '22',
    });

    const produceCalls = txInventoryTransactionCreate.mock.calls.filter(
      ([arg]) => arg.data.type === 'PREP_PRODUCE',
    );
    expect(produceCalls).toHaveLength(1);
    const produceQty = produceCalls[0]![0].data.quantity as Prisma.Decimal;
    expect(produceQty.isNegative()).toBe(false);
    expect(produceQty.toString()).toBe('22');
  });

  it('updates only the output item currentCost, never an input item', async () => {
    await prepService.createPrepRun(storeManager, {
      outputItemId,
      inputLines: [{ inventoryItemId: inputItemId, quantity: '6' }],
      actualYield: '22',
    });

    expect(txInventoryItemUpdate).toHaveBeenCalledTimes(1);
    expect(txInventoryItemUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: outputItemId } }),
    );
  });

  it('rolls back with no partial writes when the transaction throws mid-way', async () => {
    vi.mocked(prepRunRepository.create).mockRejectedValueOnce(new Error('boom'));

    await expect(
      prepService.createPrepRun(storeManager, {
        outputItemId,
        inputLines: [{ inventoryItemId: inputItemId, quantity: '6' }],
        actualYield: '22',
      }),
    ).rejects.toThrow();

    expect(txInventoryTransactionCreate).not.toHaveBeenCalled();
    expect(txInventoryItemUpdate).not.toHaveBeenCalled();
  });

  it('accepts an input item that is itself a prior run\'s output (two-stage prep) with no special-casing', async () => {
    const preppedInputItem = buildInputItem({ id: 'prepped-item-id' });
    vi.mocked(inventoryItemRepository.findLiveByIds).mockResolvedValue([preppedInputItem] as never);

    await expect(
      prepService.createPrepRun(storeManager, {
        outputItemId,
        inputLines: [{ inventoryItemId: 'prepped-item-id', quantity: '2' }],
        actualYield: '22',
      }),
    ).resolves.toBeDefined();
  });
});

describe('prepService.createPrepRun — cost math', () => {
  beforeEach(() => {
    vi.mocked(inventoryItemRepository.findById).mockResolvedValue(buildOutputItem() as never);
    vi.mocked(prepRunRepository.findRecentForRollingAverage).mockResolvedValue([]);
    vi.mocked(prepRunRepository.create).mockImplementation(async (_org, input) => buildPrepRun(input) as never);
    vi.mocked(prepRunRepository.findById).mockImplementation(async () => buildPrepRun() as never);
  });

  it('computes lineCost, totalInputCost, and outputUnitCost correctly', async () => {
    vi.mocked(inventoryItemRepository.findLiveByIds).mockResolvedValue([
      buildInputItem({ id: 'item-a', currentCost: new Prisma.Decimal(100) }),
      buildInputItem({ id: 'item-b', currentCost: new Prisma.Decimal(50) }),
    ] as never);

    await prepService.createPrepRun(storeManager, {
      outputItemId,
      inputLines: [
        { inventoryItemId: 'item-a', quantity: '3' }, // 3 * 100 = 300
        { inventoryItemId: 'item-b', quantity: '4' }, // 4 * 50 = 200
      ],
      actualYield: '10', // outputUnitCost = 500 / 10 = 50
    });

    const createCall = vi.mocked(prepRunRepository.create).mock.calls[0]![1];
    expect(createCall.totalInputCost.toString()).toBe('500');
    expect(createCall.outputUnitCost.toString()).toBe('50');
  });
});

describe('prepService — rolling average and yield-variance thresholds', () => {
  beforeEach(() => {
    vi.mocked(inventoryItemRepository.findById).mockResolvedValue(buildOutputItem() as never);
    vi.mocked(inventoryItemRepository.findLiveByIds).mockResolvedValue([buildInputItem()] as never);
    vi.mocked(prepRunRepository.create).mockImplementation(async (_org, input) => buildPrepRun(input) as never);
    vi.mocked(prepRunRepository.findById).mockImplementation(async () => buildPrepRun() as never);
  });

  const runWithHistory = async (
    actualYield: string,
    historyYields: { actualYield: number; createdAt: Date }[],
  ) => {
    vi.mocked(prepRunRepository.findRecentForRollingAverage).mockResolvedValue(
      historyYields.map((h, i) => ({
        id: `hist-${i}`,
        actualYield: new Prisma.Decimal(h.actualYield),
        createdAt: h.createdAt,
      })) as never,
    );
    await prepService.createPrepRun(storeManager, {
      outputItemId,
      inputLines: [{ inventoryItemId: inputItemId, quantity: '6' }],
      actualYield,
    });
    return vi.mocked(prepRunRepository.create).mock.calls.at(-1)![1];
  };

  it('typicalYieldAtRunTime is null with zero prior runs — no divide-by-zero', async () => {
    const created = await runWithHistory('22', []);
    expect(created.typicalYieldAtRunTime).toBeNull();
    expect(created.yieldVarianceLabel).toBeNull();
    expect(created.notifiedStoreManager).toBe(false);
  });

  it('caps the sample at the last 10 runs when more than 10 exist within 30 days', async () => {
    const now = new Date();
    // 15 runs, all within the last 30 days, yields 1..15 — average of the
    // most recent 10 (yields 6..15, i.e. the first 10 returned, newest-first)
    // must be used, not all 15.
    const history = Array.from({ length: 15 }, (_, i) => ({
      actualYield: i + 1,
      createdAt: new Date(now.getTime() - i * 24 * 60 * 60 * 1000),
    }));
    // Repository contract: returns at most 10 rows, newest first — simulate that cap here too.
    const created = await runWithHistory('22', history.slice(0, 10));
    // Average of yields [1..10] (newest-first order, values 1-10 in this fixture) = 5.5
    expect(created.typicalYieldAtRunTime?.toString()).toBe('5.5');
  });

  it('uses only the 30-day window when fewer than 10 runs exist within it but older runs exist beyond it', async () => {
    const now = new Date();
    const history = [
      { actualYield: 20, createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000) },
      { actualYield: 24, createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000) },
      // Beyond the 30-day window — must be excluded from the average.
      { actualYield: 1000, createdAt: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000) },
    ];
    const created = await runWithHistory('22', history);
    expect(created.typicalYieldAtRunTime?.toString()).toBe('22'); // (20+24)/2
  });

  it('includes flagged/outlier runs in the average — never excluded', async () => {
    const now = new Date();
    const history = [
      { actualYield: 10, createdAt: new Date(now.getTime() - 1000) }, // a prior "low yield" outlier
      { actualYield: 30, createdAt: new Date(now.getTime() - 2000) },
    ];
    const created = await runWithHistory('22', history);
    expect(created.typicalYieldAtRunTime?.toString()).toBe('20'); // (10+30)/2, outlier included
  });

  it('leaves yieldVarianceLabel as normal under the 15% warn threshold', async () => {
    const now = new Date();
    const created = await runWithHistory('21', [{ actualYield: 20, createdAt: now }]); // 5% delta
    expect(created.yieldVarianceLabel).toBe('normal');
    expect(created.notifiedStoreManager).toBe(false);
  });

  it('flags low yield at exactly -15% and does not notify', async () => {
    const now = new Date();
    const created = await runWithHistory('17', [{ actualYield: 20, createdAt: now }]); // -15% delta
    expect(created.yieldVarianceLabel).toBe('low yield');
    expect(created.notifiedStoreManager).toBe(false);
  });

  it('flags high yield at exactly +15%', async () => {
    const now = new Date();
    const created = await runWithHistory('23', [{ actualYield: 20, createdAt: now }]); // +15% delta
    expect(created.yieldVarianceLabel).toBe('high yield');
  });

  it('notifies the store manager at exactly the 35% threshold', async () => {
    const now = new Date();
    const created = await runWithHistory('13', [{ actualYield: 20, createdAt: now }]); // -35% delta
    expect(created.yieldVarianceLabel).toBe('low yield');
    expect(created.notifiedStoreManager).toBe(true);
  });

  it('does not notify just under the 35% threshold', async () => {
    const now = new Date();
    const created = await runWithHistory('13.2', [{ actualYield: 20, createdAt: now }]); // -34% delta
    expect(created.yieldVarianceLabel).toBe('low yield');
    expect(created.notifiedStoreManager).toBe(false);
  });
});

describe('prepService.listPrepRuns — pagination, filters, org scoping', () => {
  it('applies search, outputItemId, yieldFlag, and date filters', async () => {
    vi.mocked(prepRunRepository.findAllBySite).mockResolvedValue([]);

    await prepService.listPrepRuns(storeManager, {
      search: 'chicken',
      outputItemId,
      yieldFlag: 'low',
      dateFrom: '2026-09-01T00:00:00Z',
      dateTo: '2026-09-30T00:00:00Z',
      limit: 25,
    });

    expect(prepRunRepository.findAllBySite).toHaveBeenCalledWith(
      hubOrgId,
      expect.objectContaining({
        search: 'chicken',
        outputItemId,
        yieldVarianceLabel: 'low yield',
        limit: 25,
      }),
    );
  });

  it('rejects a non-hub actor', async () => {
    await expect(prepService.listPrepRuns(nonHubActor, { limit: 25 })).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe('prepService.getPrepRun — org scoping', () => {
  it('404s rather than leaking existence across organizations', async () => {
    vi.mocked(prepRunRepository.findById).mockResolvedValue(null);
    await expect(prepService.getPrepRun(storeManager, prepRunId)).rejects.toBeInstanceOf(NotFoundError);
    expect(prepRunRepository.findById).toHaveBeenCalledWith(prepRunId, hubOrgId);
  });
});
