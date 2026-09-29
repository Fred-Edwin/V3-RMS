/**
 * Waste contract drift guard + the Session 1 **blindness test** (plan §4.5,
 * §7 Q-A): every STORE_ATTENDANT-facing response in this session — stock
 * summary, waste list, waste item picker, waste create — is serialized to
 * JSON and searched for any on-hand / expected / variance key. Asserted on
 * the wire JSON, not the TS type, so a field that sneaks in through a spread
 * or a shared serializer still fails.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { wasteService } from './waste-service';
import { stockService } from './stock-service';
import { wasteRepository } from './waste-repository';
import { stockRepository } from './stock-repository';
import { inventoryItemRepository } from './inventory-repository';
import { branchRepository } from '../../repositories/branch-repository';
import { locationRepository } from '../../repositories/location-repository';
import {
  AttendantCreateWasteResultSchema,
  AttendantWasteItemOptionListSchema,
  CreateWasteResultSchema,
  WasteItemOptionListSchema,
  WasteListSchema,
} from './waste-validators';

vi.mock('./waste-repository', () => ({
  wasteRepository: {
    create: vi.fn(),
    findRecentForLocation: vi.fn(),
    latestDispatchInCost: vi.fn(),
    findItemOptions: vi.fn(),
  },
}));

vi.mock('./stock-repository', () => ({
  stockRepository: { onHandForItem: vi.fn(), totalsForLocation: vi.fn() },
}));

vi.mock('./inventory-repository', () => ({
  inventoryItemRepository: { findById: vi.fn() },
}));

vi.mock('../../repositories/branch-repository', () => ({
  branchRepository: { findHub: vi.fn(), findById: vi.fn() },
}));

vi.mock('../../repositories/location-repository', () => ({
  locationRepository: { findCentralStore: vi.fn(), findByOrganizationTypeDepartment: vi.fn(), findById: vi.fn() },
}));

vi.mock('../../config/database', () => ({
  prisma: {
    $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn({ inventoryTransaction: { create: vi.fn() } })),
  },
}));

const hubOrgId = '11111111-1111-4111-8111-111111111111';
const itemId = '33333333-3333-4333-8333-333333333333';
const centralStoreId = '55555555-5555-4555-8555-555555555555';
const wasteLogId = '77777777-7777-4777-8777-777777777777';

const storeManager = { id: 'sm1', role: 'STORE_MANAGER' as const, organizationId: hubOrgId };
const attendant = { id: 'sa1', role: 'STORE_ATTENDANT' as const, organizationId: hubOrgId };

const log = {
  id: wasteLogId,
  organizationId: hubOrgId,
  locationId: centralStoreId,
  inventoryItemId: itemId,
  quantity: new Prisma.Decimal(3),
  reason: 'SPOILAGE',
  note: 'Left in cold room overnight',
  unitCost: new Prisma.Decimal(90),
  loggedById: attendant.id,
  createdAt: new Date('2026-09-25T08:00:00Z'),
  inventoryItem: { id: itemId, name: 'Tomatoes', usageUnit: 'kg' },
  loggedBy: { id: attendant.id, name: 'Sarah Achieng' },
};

const pickerRow = {
  itemId,
  name: 'Tomatoes',
  usageUnit: 'kg',
  currentCost: new Prisma.Decimal(90),
  onHand: new Prisma.Decimal(-4),
  lastDispatchInCost: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(branchRepository.findHub).mockResolvedValue({ id: hubOrgId } as never);
  vi.mocked(locationRepository.findCentralStore).mockResolvedValue({
    id: centralStoreId,
    organizationId: hubOrgId,
    type: 'CENTRAL_STORE',
    departmentTag: null,
    name: 'Central Store',
  } as never);
  vi.mocked(inventoryItemRepository.findById).mockResolvedValue({
    id: itemId,
    currentCost: new Prisma.Decimal(90),
    departmentTags: [],
    deletedAt: null,
  } as never);
  vi.mocked(wasteRepository.create).mockResolvedValue(log as never);
  vi.mocked(wasteRepository.findRecentForLocation).mockResolvedValue([log] as never);
  vi.mocked(wasteRepository.findItemOptions).mockResolvedValue([pickerRow]);
  vi.mocked(stockRepository.onHandForItem).mockResolvedValue(new Prisma.Decimal(-4));
});

describe('Waste contract shapes', () => {
  it('createWaste (Store Manager) satisfies CreateWasteResultSchema', async () => {
    const result = await wasteService.createWaste(storeManager, { inventoryItemId: itemId, quantity: '3', reason: 'SPOILAGE' });
    expect(() => CreateWasteResultSchema.parse(result)).not.toThrow();
    expect(result).toMatchObject({ entry: { value: '270' }, wentNegative: true });
  });

  it('createWaste (Store Attendant) satisfies the attendant schema exactly', async () => {
    const result = await wasteService.createWaste(attendant, { inventoryItemId: itemId, quantity: '3', reason: 'SPOILAGE' });
    expect(AttendantCreateWasteResultSchema.strict().parse(result)).toEqual(result);
  });

  it('listWaste satisfies WasteListSchema', async () => {
    const list = await wasteService.listWaste(storeManager, { days: 7 });
    expect(() => WasteListSchema.parse(list)).not.toThrow();
    expect(list.totalValue).toBe('270');
  });

  it('item picker (Store Manager) carries on-hand + cost', async () => {
    const list = await wasteService.listItemOptions(storeManager, { limit: 20 });
    expect(() => WasteItemOptionListSchema.parse(list)).not.toThrow();
    expect(list.items[0]).toMatchObject({ onHand: '-4', unitCost: '90' });
  });

  it('item picker (Store Attendant) satisfies the cost-only schema', async () => {
    const list = await wasteService.listItemOptions(attendant, { limit: 20 });
    expect(() => AttendantWasteItemOptionListSchema.parse(list)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Blindness — on the serialized JSON.
// ---------------------------------------------------------------------------

const FORBIDDEN_KEY = /onhand|expected|variance|wentnegative|lowcount|negativecount|onhandvalue/i;

const collectKeys = (value: unknown, keys: string[] = []): string[] => {
  if (Array.isArray(value)) {
    value.forEach((v) => collectKeys(v, keys));
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      keys.push(k);
      collectKeys(v, keys);
    }
  }
  return keys;
};

const wireKeys = (response: unknown): string[] => collectKeys(JSON.parse(JSON.stringify(response)));

describe('Blind count — no attendant-facing response reveals on-hand', () => {
  it.each([
    ['stock summary', () => stockService.getSummary(attendant)],
    ['waste list', () => wasteService.listWaste(attendant, { days: 7 })],
    ['waste item picker', () => wasteService.listItemOptions(attendant, { limit: 20 })],
    ['waste create', () => wasteService.createWaste(attendant, { inventoryItemId: itemId, quantity: '3', reason: 'SPOILAGE' })],
  ])('%s', async (_name, call) => {
    const keys = wireKeys(await call());
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.filter((k) => FORBIDDEN_KEY.test(k))).toEqual([]);
  });

  it('the same calls as Store Manager do carry on-hand (the test can see it when present)', async () => {
    const keys = wireKeys(await wasteService.listItemOptions(storeManager, { limit: 20 }));
    expect(keys).toContain('onHand');
  });
});
