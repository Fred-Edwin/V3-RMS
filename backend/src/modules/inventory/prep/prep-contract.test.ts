/**
 * Contract drift guard (Milestone Two precedent: receiving-contract.test.ts):
 * asserts the service's actual serialized output satisfies the response
 * schemas declared in prep-validators.ts. A shape mismatch here fails CI
 * instead of surfacing as a runtime bug against the hand-mirrored frontend
 * types.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { prepService } from './prep-service';
import { prepRunRepository } from './prep-repository';
import { inventoryItemRepository } from '../catalog/inventory-repository';
import { branchRepository } from '../../../repositories/branch-repository';
import { locationRepository } from '../../../repositories/location-repository';
import {
  PrepRunDetailSchema,
  PrepRunSummarySchema,
  PrepSummarySchema,
  TypicalYieldSchema,
} from './prep-validators';

vi.mock('./prep-repository', () => ({
  prepRunRepository: {
    findAllByOrganization: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    findRecentForRollingAverage: vi.fn(),
    findSummaryRows: vi.fn(),
  },
}));

vi.mock('../catalog/inventory-repository', () => ({
  inventoryItemRepository: { findById: vi.fn(), findLiveByIds: vi.fn() },
}));

vi.mock('../../../repositories/branch-repository', () => ({
  branchRepository: { findHub: vi.fn() },
}));

vi.mock('../../../repositories/location-repository', () => ({
  locationRepository: { findCentralStore: vi.fn() },
}));

vi.mock('../../../config/database', () => ({
  prisma: {
    $transaction: vi.fn((fn: (tx: unknown) => unknown) =>
      fn({ inventoryTransaction: { create: vi.fn() }, inventoryItem: { update: vi.fn() } }),
    ),
  },
}));

const hubOrgId = '11111111-1111-4111-8111-111111111111';
const outputItemId = '33333333-3333-4333-8333-333333333333';
const inputItemId = '44444444-4444-4444-8444-444444444444';
const centralStoreId = '55555555-5555-4555-8555-555555555555';
const prepRunId = '66666666-6666-4666-8666-666666666666';

const storeManager = { id: 'sm1', role: 'STORE_MANAGER' as const, organizationId: hubOrgId };
const hubOrg = { id: hubOrgId, name: 'Central Store', isHub: true, isActive: true };
const centralStore = { id: centralStoreId, organizationId: hubOrgId, type: 'CENTRAL_STORE' as const };

const buildPrepRun = (overrides: Record<string, unknown> = {}) => ({
  id: prepRunId,
  organizationId: hubOrgId,
  outputItemId,
  actualYield: new Prisma.Decimal(22),
  outputUnitCost: new Prisma.Decimal(81.8182),
  totalInputCost: new Prisma.Decimal(1800),
  typicalYieldAtRunTime: new Prisma.Decimal(20),
  yieldVarianceLabel: 'normal',
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

describe('Prep contract shapes', () => {
  it('listPrepRuns output satisfies PrepRunSummarySchema', async () => {
    vi.mocked(prepRunRepository.findAllByOrganization).mockResolvedValue([buildPrepRun()] as never);

    const rows = await prepService.listPrepRuns(storeManager, { limit: 25 });
    for (const row of rows) {
      expect(() => PrepRunSummarySchema.parse(row)).not.toThrow();
    }
  });

  it('getPrepRun output satisfies PrepRunDetailSchema', async () => {
    vi.mocked(prepRunRepository.findById).mockResolvedValue(buildPrepRun() as never);

    const detail = await prepService.getPrepRun(storeManager, prepRunId);
    expect(() => PrepRunDetailSchema.parse(detail)).not.toThrow();
  });

  it('getPrepSummary output satisfies PrepSummarySchema', async () => {
    vi.mocked(prepRunRepository.findSummaryRows).mockResolvedValue([
      { totalInputCost: new Prisma.Decimal(1800), yieldVarianceLabel: 'normal' },
      { totalInputCost: new Prisma.Decimal(900), yieldVarianceLabel: 'low yield' },
    ] as never);

    const summary = await prepService.getPrepSummary(storeManager, {});
    expect(() => PrepSummarySchema.parse(summary)).not.toThrow();
  });

  it('getTypicalYield output satisfies TypicalYieldSchema — with data', async () => {
    vi.mocked(inventoryItemRepository.findById).mockResolvedValue({
      id: outputItemId,
      usageUnit: 'portion',
    } as never);
    vi.mocked(prepRunRepository.findRecentForRollingAverage).mockResolvedValue([
      { id: prepRunId, actualYield: new Prisma.Decimal(22), createdAt: new Date() },
    ] as never);
    vi.mocked(prepRunRepository.findById).mockResolvedValue(buildPrepRun() as never);

    const typicalYield = await prepService.getTypicalYield(storeManager, outputItemId);
    expect(() => TypicalYieldSchema.parse(typicalYield)).not.toThrow();
  });

  it('getTypicalYield output satisfies TypicalYieldSchema — never-prepped item (sampleSize 0)', async () => {
    vi.mocked(inventoryItemRepository.findById).mockResolvedValue({
      id: outputItemId,
      usageUnit: 'portion',
    } as never);
    vi.mocked(prepRunRepository.findRecentForRollingAverage).mockResolvedValue([]);

    const typicalYield = await prepService.getTypicalYield(storeManager, outputItemId);
    expect(typicalYield.sampleSize).toBe(0);
    expect(typicalYield.typicalYield).toBeNull();
    expect(typicalYield.typicalInputSummary).toBeNull();
    expect(() => TypicalYieldSchema.parse(typicalYield)).not.toThrow();
  });

  it('createPrepRun output satisfies PrepRunDetailSchema', async () => {
    vi.mocked(inventoryItemRepository.findById).mockResolvedValue({
      id: outputItemId,
      name: 'Grilled chicken portion',
      usageUnit: 'portion',
      currentCost: new Prisma.Decimal(80),
      deletedAt: null,
    } as never);
    vi.mocked(inventoryItemRepository.findLiveByIds).mockResolvedValue([
      { id: inputItemId, name: 'Raw chicken', usageUnit: 'kg', currentCost: new Prisma.Decimal(300), deletedAt: null },
    ] as never);
    vi.mocked(prepRunRepository.findRecentForRollingAverage).mockResolvedValue([]);
    vi.mocked(prepRunRepository.create).mockResolvedValue(buildPrepRun() as never);
    vi.mocked(prepRunRepository.findById).mockResolvedValue(buildPrepRun() as never);

    const created = await prepService.createPrepRun(storeManager, {
      outputItemId,
      inputLines: [{ inventoryItemId: inputItemId, quantity: '6' }],
      actualYield: '22',
    });
    expect(() => PrepRunDetailSchema.parse(created)).not.toThrow();
  });
});
