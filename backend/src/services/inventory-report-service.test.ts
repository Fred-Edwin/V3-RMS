import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { inventoryReportRepository } from '../repositories/inventory-report-repository';
import { inventoryTransactionService } from './inventory-transaction-service';
import { inventoryReportService } from './inventory-report-service';

vi.mock('../repositories/inventory-report-repository', () => ({
  inventoryReportRepository: {
    findActiveItemsByOrganization: vi.fn(),
    sumQuantityByItemGrouped: vi.fn(),
    findReceivedLinesForItem: vi.fn(),
    findPrepRecordsForOutputItem: vi.fn(),
    findDistinctPrepOutputItems: vi.fn(),
    findCountLinesForOrganization: vi.fn(),
    findInvoicesForAging: vi.fn(),
  },
}));

vi.mock('./inventory-transaction-service', () => ({
  inventoryTransactionService: {
    getRollingAverageForOutputItem: vi.fn(),
  },
}));

const organizationId = '11111111-1111-4111-8111-111111111111';
const locationId = '22222222-2222-4222-8222-222222222222';
const itemId = '33333333-3333-4333-8333-333333333333';

const d = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const actor = { id: 'u1', role: 'STORE_MANAGER' as const, organizationId };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('inventoryReportService.getStockValuation', () => {
  it("derives on-hand qty from the ledger (sumQuantityByItemGrouped), never a second counter", async () => {
    vi.mocked(inventoryReportRepository.findActiveItemsByOrganization).mockResolvedValue([
      {
        id: itemId,
        name: 'Chicken Breast',
        type: 'RAW',
        buyUnit: 'kg',
        usageUnit: 'g',
        reorderLevel: d(1000),
        currentCost: d(2),
      },
    ] as never);
    vi.mocked(inventoryReportRepository.sumQuantityByItemGrouped).mockResolvedValue(
      new Map([[itemId, d(500)]]),
    );

    const result = await inventoryReportService.getStockValuation(actor, locationId);

    expect(inventoryReportRepository.sumQuantityByItemGrouped).toHaveBeenCalledWith(
      organizationId,
      locationId,
    );
    expect(result.lines).toEqual([
      expect.objectContaining({
        inventoryItemId: itemId,
        onHandQty: d(500),
        currentCost: d(2),
        value: d(1000),
      }),
    ]);
    expect(result.totalValue.toString()).toBe('1000');
  });

  it('values an item with no ledger activity yet as zero on-hand, not a crash', async () => {
    vi.mocked(inventoryReportRepository.findActiveItemsByOrganization).mockResolvedValue([
      {
        id: itemId,
        name: 'New Item',
        type: 'RAW',
        buyUnit: 'kg',
        usageUnit: 'g',
        reorderLevel: d(10),
        currentCost: d(5),
      },
    ] as never);
    vi.mocked(inventoryReportRepository.sumQuantityByItemGrouped).mockResolvedValue(new Map());

    const result = await inventoryReportService.getStockValuation(actor, locationId);

    expect(result.lines[0]?.onHandQty.toString()).toBe('0');
    expect(result.totalValue.toString()).toBe('0');
  });
});

describe('inventoryReportService.getLowStockAlerts', () => {
  it('flags items at/under reorderLevel using ledger-derived on-hand qty', async () => {
    vi.mocked(inventoryReportRepository.findActiveItemsByOrganization).mockResolvedValue([
      { id: 'a', name: 'Low Item', type: 'RAW', buyUnit: 'kg', usageUnit: 'g', reorderLevel: d(10), currentCost: d(1) },
      { id: 'b', name: 'OK Item', type: 'RAW', buyUnit: 'kg', usageUnit: 'g', reorderLevel: d(10), currentCost: d(1) },
    ] as never);
    vi.mocked(inventoryReportRepository.sumQuantityByItemGrouped).mockResolvedValue(
      new Map([
        ['a', d(5)],
        ['b', d(50)],
      ]),
    );

    const result = await inventoryReportService.getLowStockAlerts(actor, locationId);

    expect(result).toHaveLength(1);
    expect(result[0]?.inventoryItemId).toBe('a');
  });
});

describe('inventoryReportService.getPrepYield', () => {
  it("delegates the rolling average to Session 2's getRollingAverageForOutputItem, never recomputes it", async () => {
    vi.mocked(inventoryReportRepository.findDistinctPrepOutputItems).mockResolvedValue([
      { id: itemId, name: 'Marinated Chicken', usageUnit: 'g' },
    ] as never);
    vi.mocked(inventoryReportRepository.findPrepRecordsForOutputItem).mockResolvedValue([
      {
        id: 'rec1',
        actualYield: d(5.6),
        unitCost: d(250),
        recordedAt: new Date('2026-07-01'),
        recordedById: 'u2',
        lines: [{ inputItemId: 'raw1', quantity: d(6), unitCost: d(291.67) }],
      },
    ] as never);
    vi.mocked(inventoryTransactionService.getRollingAverageForOutputItem).mockResolvedValue({
      sampleCount: 3,
      avgTotalInputQty: d(6.1),
      avgActualYield: d(5.7),
    });

    const result = (await inventoryReportService.getPrepYield(actor)) as Array<{
      outputItemId: string;
      runs: Array<{ yieldRatio: Prisma.Decimal | null }>;
      rollingAverage: { sampleCount: number };
    }>;

    expect(inventoryTransactionService.getRollingAverageForOutputItem).toHaveBeenCalledWith(
      organizationId,
      itemId,
    );
    expect(result[0]?.rollingAverage.sampleCount).toBe(3);
    expect(result[0]?.runs[0]?.yieldRatio?.toString()).toBe('0.93333333333333333333');
  });
});

describe('inventoryReportService.getCountDiscrepancy', () => {
  it('values the gap in KES at the item current cost, sourced from StockCountLine rows', async () => {
    vi.mocked(inventoryReportRepository.findCountLinesForOrganization).mockResolvedValue([
      {
        id: 'line1',
        expectedQty: d(100),
        countedQty: d(94),
        gapQty: d(-6),
        inventoryItem: { id: itemId, name: 'Flour', usageUnit: 'kg', currentCost: d(150) },
        stockCount: {
          id: 'sc1',
          label: 'Weekly Count',
          status: 'APPROVED',
          scheduledDate: new Date('2026-07-20'),
          locationId,
        },
      },
    ] as never);

    const result = await inventoryReportService.getCountDiscrepancy(actor);

    expect(result[0]?.gapValue.toString()).toBe('-900');
  });
});

describe('inventoryReportService.getSupplierApAging', () => {
  it('buckets outstanding invoices by days-outstanding (0-7 / 8-30 / 31+)', async () => {
    const now = Date.now();
    const daysAgo = (n: number) => new Date(now - n * 24 * 60 * 60 * 1000);

    vi.mocked(inventoryReportRepository.findInvoicesForAging).mockResolvedValue([
      {
        id: 'inv1',
        referenceNumber: 'INV-1',
        amount: d(1000),
        amountPaid: d(0),
        status: 'UNPAID',
        invoiceDate: daysAgo(3),
        supplier: { id: 'sup1', name: 'Metro Supermarket' },
      },
      {
        id: 'inv2',
        referenceNumber: 'INV-2',
        amount: d(2000),
        amountPaid: d(500),
        status: 'PARTIALLY_PAID',
        invoiceDate: daysAgo(45),
        supplier: { id: 'sup1', name: 'Metro Supermarket' },
      },
    ] as never);

    const result = await inventoryReportService.getSupplierApAging(actor);

    expect(result.lines.find((l) => l.supplierInvoiceId === 'inv1')?.bucket).toBe('0-7');
    expect(result.lines.find((l) => l.supplierInvoiceId === 'inv2')?.bucket).toBe('31+');
    expect(result.bySupplier).toEqual([
      expect.objectContaining({ supplierId: 'sup1', totalOutstanding: d(2500) }),
    ]);
  });
});

describe('inventoryReportService.getPriceHistory', () => {
  it('maps a null purchaseOrder (ad-hoc ledger receive with no linked PO) to null poNumber/supplierId/supplierName instead of throwing', async () => {
    vi.mocked(inventoryReportRepository.findReceivedLinesForItem).mockResolvedValue([
      {
        id: 'tx1',
        unitPrice: d(330),
        invoicePrice: null,
        receivedQty: d(1),
        receivedAt: new Date('2026-07-07'),
        purchaseOrder: null,
      },
      {
        id: 'poline1',
        unitPrice: d(340),
        invoicePrice: d(340),
        receivedQty: d(2),
        receivedAt: new Date('2026-07-21'),
        purchaseOrder: { id: 'po1', poNumber: 'PO-0001', supplierId: 'sup1', supplier: { name: 'Samrat Supermarket' } },
      },
    ] as never);

    const result = await inventoryReportService.getPriceHistory(actor, itemId);

    expect(result[0]).toMatchObject({ poNumber: null, supplierId: null, supplierName: null });
    expect(result[1]).toMatchObject({ poNumber: 'PO-0001', supplierId: 'sup1', supplierName: 'Samrat Supermarket' });
  });
});
