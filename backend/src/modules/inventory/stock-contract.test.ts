/**
 * Contract drift guard (M2–M5 precedent): the stock service's serialized
 * output must satisfy the frozen response schemas in stock-validators.ts.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { stockService, formatCounterparty } from './stock-service';
import { stockRepository, type LedgerRawRow } from './stock-repository';
import { inventoryItemRepository } from './inventory-repository';
import { branchRepository } from '../../repositories/branch-repository';
import { locationRepository } from '../../repositories/location-repository';
import { AttendantStockSummarySchema, LedgerSchema, StockListSchema, StockSummarySchema } from './stock-validators';

vi.mock('./count-repository', () => ({
  countRepository: { todaysDaily: vi.fn().mockResolvedValue(null) },
}));

vi.mock('./stock-repository', () => ({
  stockRepository: {
    listForLocation: vi.fn(),
    totalsForLocation: vi.fn(),
    onHandForItem: vi.fn(),
    restockLevelForItem: vi.fn(),
    lastMovementAt: vi.fn(),
    currentCostSetAt: vi.fn(),
    ledgerForItem: vi.fn(),
  },
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

const hubOrgId = '11111111-1111-4111-8111-111111111111';
const itemId = '33333333-3333-4333-8333-333333333333';
const centralStoreId = '55555555-5555-4555-8555-555555555555';
const categoryId = '44444444-4444-4444-8444-444444444444';

const storeManager = { id: 'sm1', role: 'STORE_MANAGER' as const, organizationId: hubOrgId };
const attendant = { id: 'sa1', role: 'STORE_ATTENDANT' as const, organizationId: hubOrgId };
const centralStore = { id: centralStoreId, organizationId: hubOrgId, type: 'CENTRAL_STORE', departmentTag: null, name: 'Central Store' };

const rawLedgerRow = (overrides: Partial<LedgerRawRow> = {}): LedgerRawRow => ({
  id: '99999999-9999-4999-8999-999999999999',
  createdAt: new Date('2026-09-08T09:00:00Z'),
  type: 'RECEIVE',
  quantity: new Prisma.Decimal(25),
  runningOnHand: new Prisma.Decimal(37),
  reference: null,
  reason: null,
  supplierName: 'Samrat Suppliers Ltd',
  goodsReceiptReference: 'GRN-1042',
  wasteReason: null,
  prepOutputName: null,
  dispatchToOrgName: null,
  dispatchDepartmentTag: null,
  discrepancyReference: null,
  countKind: null,
  countVerifierName: null,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(branchRepository.findHub).mockResolvedValue({ id: hubOrgId } as never);
  vi.mocked(locationRepository.findCentralStore).mockResolvedValue(centralStore as never);
});

describe('Stock contract shapes', () => {
  it('listStock satisfies StockListSchema and derives value / flags', async () => {
    vi.mocked(stockRepository.listForLocation).mockResolvedValue({
      rows: [
        {
          itemId,
          name: 'Tomatoes',
          type: 'RAW_INGREDIENT',
          categoryId,
          categoryName: 'Produce',
          usageUnit: 'kg',
          currentCost: new Prisma.Decimal(90),
          onHand: new Prisma.Decimal(-4),
          restockLevel: new Prisma.Decimal(30),
        },
      ],
      total: 142,
    });

    const list = await stockService.listStock(storeManager, { page: 1, pageSize: 8 });

    expect(() => StockListSchema.parse(list)).not.toThrow();
    expect(list.pageCount).toBe(18);
    expect(list.rows[0]).toMatchObject({ value: '-360', isLow: true, isNegative: true });
  });

  it('getSummary (Store Manager) satisfies StockSummarySchema with a "no count yet" today', async () => {
    vi.mocked(stockRepository.totalsForLocation).mockResolvedValue({
      onHandValue: new Prisma.Decimal('486000.4567'),
      itemCount: 142,
      lowCount: 9,
      negativeCount: 2,
    });

    const summary = await stockService.getSummary(storeManager);

    expect(() => StockSummarySchema.parse(summary)).not.toThrow();
    expect(summary).toMatchObject({ onHandValue: '486000.46', todaysCount: { status: 'NOT_STARTED' } });
  });

  it('getSummary (Store Attendant) is exactly {todaysCount} and never reads totals', async () => {
    const summary = await stockService.getSummary(attendant);

    expect(AttendantStockSummarySchema.strict().parse(summary)).toEqual(summary);
    expect(Object.keys(summary)).toEqual(['todaysCount']);
    expect(stockRepository.totalsForLocation).not.toHaveBeenCalled();
  });

  it('getLedger satisfies LedgerSchema', async () => {
    vi.mocked(inventoryItemRepository.findById).mockResolvedValue({
      id: itemId,
      name: 'Coffee beans',
      usageUnit: 'kg',
      currentCost: new Prisma.Decimal(420),
      category: { id: categoryId, name: 'Dry goods' },
    } as never);
    vi.mocked(stockRepository.onHandForItem).mockResolvedValue(new Prisma.Decimal(12));
    vi.mocked(stockRepository.restockLevelForItem).mockResolvedValue(new Prisma.Decimal(25));
    vi.mocked(stockRepository.lastMovementAt).mockResolvedValue(new Date('2026-09-12T08:00:00Z'));
    vi.mocked(stockRepository.currentCostSetAt).mockResolvedValue(new Date('2026-09-08T09:00:00Z'));
    vi.mocked(stockRepository.ledgerForItem).mockResolvedValue({ rows: [rawLedgerRow()], total: 1 });

    const ledger = await stockService.getLedger(storeManager, itemId, { page: 1, pageSize: 25 });

    expect(() => LedgerSchema.parse(ledger)).not.toThrow();
    expect(ledger.summary).toMatchObject({ value: '5040', isLow: true, location: { name: 'Central Store', branchName: null } });
    expect(ledger.rows[0]).toMatchObject({ counterparty: 'Samrat Suppliers Ltd', reference: 'GRN-1042' });
  });
});

describe('formatCounterparty — derived from whichever FK is set', () => {
  it.each([
    [rawLedgerRow(), 'Samrat Suppliers Ltd'],
    [rawLedgerRow({ type: 'RECEIVE', supplierName: null }), 'Receipt'],
    [rawLedgerRow({ type: 'DISPATCH_OUT', dispatchToOrgName: 'Nyeri Town', dispatchDepartmentTag: 'BARISTA' }), 'Nyeri Town · Barista'],
    [rawLedgerRow({ type: 'DISPATCH_IN' }), 'Central Store'],
    [rawLedgerRow({ type: 'WASTE', wasteReason: 'SPOILAGE' }), 'Spoilage'],
    [rawLedgerRow({ type: 'WASTE', wasteReason: 'DAMAGE_IN_STORE' }), 'Damage in store'],
    [rawLedgerRow({ type: 'PREP_CONSUME', prepOutputName: 'Chicken stock' }), 'Prep · Chicken stock'],
    [rawLedgerRow({ type: 'ADJUSTMENT', discrepancyReference: 'DSC-0003' }), 'Transit discrepancy · DSC-0003'],
    [rawLedgerRow({ type: 'ADJUSTMENT' }), 'Adjustment'],
  ])('%#', (row, expected) => {
    expect(formatCounterparty(row)).toBe(expected);
  });
});
