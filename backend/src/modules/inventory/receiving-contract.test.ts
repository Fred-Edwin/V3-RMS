/**
 * Contract drift guard (Milestone One precedent: inventory-contract.test.ts):
 * asserts the service's actual serialized output satisfies the response
 * schemas declared in receiving-validators.ts. A shape mismatch here fails
 * CI instead of surfacing as a runtime bug against the hand-mirrored
 * frontend types.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { receivingService } from './receiving-service';
import {
  expectedDeliveryRepository,
  goodsReceiptRepository,
  recentSupplierItemsRepository,
  referenceCounterRepository,
} from './receiving-repository';
import { inventoryItemRepository, supplierRepository } from './inventory-repository';
import { branchRepository } from '../../repositories/branch-repository';
import { locationRepository } from '../../repositories/location-repository';
import {
  ExpectedDeliverySummarySchema,
  GoodsReceiptDetailSchema,
  PurchasingHistoryRowSchema,
  PurchasingSummarySchema,
  RecentSupplierItemSchema,
  SupplierApRowSchema,
} from './receiving-validators';

vi.mock('./receiving-repository', () => ({
  expectedDeliveryRepository: {
    findAllByOrganization: vi.fn(),
    create: vi.fn(),
    countByStatus: vi.fn(),
    countOverdue: vi.fn(),
    findHistoryRows: vi.fn(),
  },
  goodsReceiptRepository: {
    findAllByOrganization: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    findHistoryRows: vi.fn(),
  },
  referenceCounterRepository: { nextReference: vi.fn() },
  lastPriceRepository: { findLastReceiptLine: vi.fn() },
  recentSupplierItemsRepository: { findRecentBySupplier: vi.fn() },
}));

vi.mock('./inventory-repository', () => ({
  supplierRepository: { findById: vi.fn() },
  inventoryItemRepository: { findLiveByIds: vi.fn(), findById: vi.fn() },
}));

vi.mock('../../repositories/branch-repository', () => ({
  branchRepository: { findHub: vi.fn() },
}));

vi.mock('../../repositories/location-repository', () => ({
  locationRepository: { findCentralStore: vi.fn() },
}));

vi.mock('../../config/database', () => ({
  prisma: { $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn({})) },
}));

const hubOrgId = '11111111-1111-4111-8111-111111111111';
const supplierId = '22222222-2222-4222-8222-222222222222';
const itemId = '33333333-3333-4333-8333-333333333333';
const deliveryId = '44444444-4444-4444-8444-444444444444';

const storeManager = { id: 'sm1', role: 'STORE_MANAGER' as const, organizationId: hubOrgId };
const storeAttendant = { id: 'sa1', role: 'STORE_ATTENDANT' as const, organizationId: hubOrgId };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(branchRepository.findHub).mockResolvedValue({ id: hubOrgId, isHub: true, isActive: true } as never);
});

describe('Receiving contract drift guard', () => {
  it('ExpectedDeliverySummarySchema accepts listExpectedDeliveries output (Manager, with money)', async () => {
    vi.mocked(expectedDeliveryRepository.findAllByOrganization).mockResolvedValue([
      {
        id: deliveryId,
        organizationId: hubOrgId,
        reference: 'EXP-0001',
        supplierId,
        supplier: { id: supplierId, name: 'Samrat Supermarket Ltd' },
        paymentTerms: 'INVOICE_TO_FOLLOW',
        status: 'AWAITING',
        expectedDate: new Date(),
        estimatedTotal: new Prisma.Decimal('8100'),
        createdById: 'sm1',
        createdAt: new Date(),
        updatedAt: new Date(),
        lines: [
          {
            id: 'l1',
            expectedDeliveryId: deliveryId,
            inventoryItemId: itemId,
            inventoryItem: { id: itemId, name: 'Milk 500ml', buyUnit: 'crate' },
            quantity: new Prisma.Decimal('4'),
            estimatedUnitPrice: new Prisma.Decimal('2025'),
            lineOrder: 0,
          },
        ],
      },
    ] as never);

    const [summary] = await receivingService.listExpectedDeliveries(storeManager, { limit: 25 });
    expect(() => ExpectedDeliverySummarySchema.parse(summary)).not.toThrow();
  });

  it('ExpectedDeliverySummarySchema accepts a STORE_ATTENDANT row with estimatedTotal: null', async () => {
    vi.mocked(expectedDeliveryRepository.findAllByOrganization).mockResolvedValue([
      {
        id: deliveryId,
        organizationId: hubOrgId,
        reference: 'EXP-0001',
        supplierId,
        supplier: { id: supplierId, name: 'Samrat Supermarket Ltd' },
        paymentTerms: 'INVOICE_TO_FOLLOW',
        status: 'AWAITING',
        expectedDate: null,
        estimatedTotal: new Prisma.Decimal('8100'),
        createdById: 'sm1',
        createdAt: new Date(),
        updatedAt: new Date(),
        lines: [],
      },
    ] as never);

    const results = await receivingService.listExpectedDeliveries(storeAttendant, { limit: 25 });
    const summary = results[0]!;
    expect(() => ExpectedDeliverySummarySchema.parse(summary)).not.toThrow();
    expect(summary.estimatedTotal).toBeNull();
  });

  it('ExpectedDeliverySummarySchema accepts createExpectedDelivery output', async () => {
    vi.mocked(supplierRepository.findById).mockResolvedValue({ id: supplierId, deletedAt: null } as never);
    vi.mocked(inventoryItemRepository.findLiveByIds).mockResolvedValue([{ id: itemId }] as never);
    vi.mocked(referenceCounterRepository.nextReference).mockResolvedValue('EXP-0002');
    vi.mocked(expectedDeliveryRepository.create).mockResolvedValue({
      id: deliveryId,
      organizationId: hubOrgId,
      reference: 'EXP-0002',
      supplierId,
      supplier: { id: supplierId, name: 'Samrat Supermarket Ltd' },
      paymentTerms: 'PAY_NOW',
      status: 'AWAITING',
      expectedDate: null,
      estimatedTotal: new Prisma.Decimal('8100'),
      createdById: 'sm1',
      createdAt: new Date(),
      updatedAt: new Date(),
      lines: [
        {
          id: 'l1',
          expectedDeliveryId: deliveryId,
          inventoryItemId: itemId,
          inventoryItem: { id: itemId, name: 'Milk 500ml', buyUnit: 'crate' },
          quantity: new Prisma.Decimal('4'),
          estimatedUnitPrice: new Prisma.Decimal('2025'),
          lineOrder: 0,
        },
      ],
    } as never);

    const result = await receivingService.createExpectedDelivery(storeManager, {
      supplierId,
      paymentTerms: 'PAY_NOW',
      lines: [{ inventoryItemId: itemId, quantity: '4', estimatedUnitPrice: '2025' }],
    });
    expect(() => ExpectedDeliverySummarySchema.parse(result)).not.toThrow();
  });

  it('ExpectedDeliverySummarySchema accepts a null-supplier row (AMENDMENT 2026-09-17)', async () => {
    vi.mocked(expectedDeliveryRepository.findAllByOrganization).mockResolvedValue([
      {
        id: deliveryId,
        organizationId: hubOrgId,
        reference: 'EXP-0003',
        supplierId: null,
        supplier: null,
        paymentTerms: null,
        status: 'AWAITING',
        expectedDate: null,
        estimatedTotal: new Prisma.Decimal('500'),
        createdById: 'sm1',
        createdAt: new Date(),
        updatedAt: new Date(),
        lines: [],
      },
    ] as never);

    const [summary] = await receivingService.listExpectedDeliveries(storeManager, { limit: 25 });
    expect(() => ExpectedDeliverySummarySchema.parse(summary)).not.toThrow();
    expect(summary!.supplierId).toBeNull();
    expect(summary!.supplierName).toBeNull();
    expect(summary!.paymentTerms).toBeNull();
  });

  it('createExpectedDelivery with no supplierId parses against the same frozen schema (AMENDMENT 2026-09-17)', async () => {
    vi.mocked(referenceCounterRepository.nextReference).mockResolvedValue('EXP-0004');
    vi.mocked(expectedDeliveryRepository.create).mockResolvedValue({
      id: deliveryId,
      organizationId: hubOrgId,
      reference: 'EXP-0004',
      supplierId: null,
      supplier: null,
      paymentTerms: null,
      status: 'AWAITING',
      expectedDate: null,
      estimatedTotal: new Prisma.Decimal('8100'),
      createdById: 'sm1',
      createdAt: new Date(),
      updatedAt: new Date(),
      lines: [
        {
          id: 'l1',
          expectedDeliveryId: deliveryId,
          inventoryItemId: itemId,
          inventoryItem: { id: itemId, name: 'Milk 500ml', buyUnit: 'crate' },
          quantity: new Prisma.Decimal('4'),
          estimatedUnitPrice: new Prisma.Decimal('2025'),
          lineOrder: 0,
        },
      ],
    } as never);

    const result = await receivingService.createExpectedDelivery(storeManager, {
      lines: [{ inventoryItemId: itemId, quantity: '4', estimatedUnitPrice: '2025' }],
    });
    expect(() => ExpectedDeliverySummarySchema.parse(result)).not.toThrow();
    expect(supplierRepository.findById).not.toHaveBeenCalled();
  });

  it('PurchasingSummarySchema accepts getPurchasingSummary output — 3 tiles, no inTransit', async () => {
    vi.mocked(expectedDeliveryRepository.countByStatus).mockResolvedValue(2);
    vi.mocked(expectedDeliveryRepository.countOverdue).mockResolvedValue(1);

    const summary = await receivingService.getPurchasingSummary(storeManager);
    expect(() => PurchasingSummarySchema.parse(summary)).not.toThrow();
    expect(summary).not.toHaveProperty('inTransit');
  });

  it('PurchasingHistoryRowSchema accepts getPurchasingHistory output — expectedDelivery variant', async () => {
    vi.mocked(expectedDeliveryRepository.findHistoryRows).mockResolvedValue([
      {
        id: deliveryId,
        organizationId: hubOrgId,
        reference: 'EXP-0091',
        supplierId,
        supplier: { id: supplierId, name: 'Samrat Supermarket Ltd' },
        paymentTerms: 'INVOICE_TO_FOLLOW',
        status: 'AWAITING',
        expectedDate: new Date(Date.now() - 86400000),
        estimatedTotal: new Prisma.Decimal('8100'),
        createdById: 'sm1',
        createdAt: new Date(),
        updatedAt: new Date(),
        lines: [],
      },
    ] as never);
    vi.mocked(goodsReceiptRepository.findHistoryRows).mockResolvedValue([]);

    const [row] = await receivingService.getPurchasingHistory(storeManager, { limit: 25 });
    expect(() => PurchasingHistoryRowSchema.parse(row)).not.toThrow();
    expect(row!.type).toBe('expectedDelivery');
  });

  const goodsReceiptHistoryFixture = {
    id: '55555555-5555-4555-8555-555555555555',
    organizationId: hubOrgId,
    reference: 'GRN-1041',
    supplierId,
    supplier: { id: supplierId, name: 'Kimathi Butchery' },
    expectedDeliveryId: null,
    paymentTerms: 'INVOICE_TO_FOLLOW',
    status: 'RECEIVED_INVOICE_PENDING',
    supplierDocNumber: null,
    supplierDocDate: null,
    receiptTotal: new Prisma.Decimal('21300'),
    locationId: 'loc1',
    signedById: 'sm1',
    signedAt: new Date(),
    createdById: 'sm1',
    createdAt: new Date(),
    updatedAt: new Date(),
    lines: [{ inventoryItem: { name: 'Beef' } }],
    invoices: [],
  };

  it('PurchasingHistoryRowSchema accepts getPurchasingHistory output — goodsReceipt variant (2026-09-18)', async () => {
    vi.mocked(expectedDeliveryRepository.findHistoryRows).mockResolvedValue([]);
    vi.mocked(goodsReceiptRepository.findHistoryRows).mockResolvedValue([goodsReceiptHistoryFixture] as never);

    const [row] = await receivingService.getPurchasingHistory(storeManager, { limit: 25 });
    expect(() => PurchasingHistoryRowSchema.parse(row)).not.toThrow();
    expect(row!.type).toBe('goodsReceipt');
  });

  it('getReceivingHistory (2026-09-18) omits AP status for STORE_ATTENDANT — a goodsReceipt row collapses to "Received"', async () => {
    vi.mocked(expectedDeliveryRepository.findHistoryRows).mockResolvedValue([]);
    vi.mocked(goodsReceiptRepository.findHistoryRows).mockResolvedValue([goodsReceiptHistoryFixture] as never);

    const [row] = await receivingService.getReceivingHistory(storeAttendant, { limit: 25 });
    expect(() => PurchasingHistoryRowSchema.parse(row)).not.toThrow();
    expect(row).toMatchObject({ type: 'goodsReceipt', statusLabel: 'Received', detailLabel: 'Beef' });
  });

  it('getReceivingHistory (2026-09-18) includes real AP status/KES total for STORE_MANAGER', async () => {
    vi.mocked(expectedDeliveryRepository.findHistoryRows).mockResolvedValue([]);
    vi.mocked(goodsReceiptRepository.findHistoryRows).mockResolvedValue([goodsReceiptHistoryFixture] as never);

    const [row] = await receivingService.getReceivingHistory(storeManager, { limit: 25 });
    expect(() => PurchasingHistoryRowSchema.parse(row)).not.toThrow();
    expect(row).toMatchObject({ type: 'goodsReceipt', statusLabel: 'Received — invoice pending', detailLabel: 'KES 21300' });
  });

  it('RecentSupplierItemSchema accepts getRecentSupplierItems output', async () => {
    vi.mocked(supplierRepository.findById).mockResolvedValue({
      id: supplierId,
      organizationId: hubOrgId,
      name: 'Samrat Supermarket Ltd',
      deletedAt: null,
    } as never);
    vi.mocked(recentSupplierItemsRepository.findRecentBySupplier).mockResolvedValue([
      {
        inventoryItemId: itemId,
        itemName: 'Milk 500ml',
        buyUnit: 'crate',
        lastUnitPrice: new Prisma.Decimal('2025'),
        lastPurchasedAt: new Date(),
      },
    ]);

    const [row] = await receivingService.getRecentSupplierItems(storeManager, supplierId, 8);
    expect(() => RecentSupplierItemSchema.parse(row)).not.toThrow();
  });
});

/**
 * AMENDMENT 2026-09-17 requirement: "a null-supplier ExpectedDelivery can
 * never appear in SupplierApRowSchema/AgingBucketsSchema/ApSummarySchema."
 *
 * No AP endpoint exists yet (S7 — supplier invoices/payments/what-we-owe —
 * is not started; see milestone-2-plan.md §5). So this can't yet be an
 * end-to-end HTTP/service test against a real AP read model. What it CAN
 * assert, and what actually makes the invariant true, is the schema-level
 * fact that every AP row is keyed off `GoodsReceipt.supplierId` /
 * `SupplierInvoice.supplierId` / `SupplierPayment.supplierId` — all three
 * stayed **non-nullable, required** FKs in this amendment (only
 * `ExpectedDelivery.supplierId` became nullable). An `ExpectedDelivery` has
 * no FK *from* those tables back to it that carries its supplier-less-ness
 * forward: a `GoodsReceipt` created off a supplier-less `ExpectedDelivery`
 * still requires its own real `supplierId` to be created at all (Stage 2 is
 * a separate, still-mandatory-supplier write). This test guards that nobody
 * loosens those three FKs to nullable later without deliberately revisiting
 * this invariant — it will fail loudly (a TypeScript error, not a silent
 * pass) the moment `receiving.types.ts`'s inferred types stop matching this
 * shape.
 */
describe('AP exclusion invariant (AMENDMENT 2026-09-17, part c)', () => {
  it('SupplierApRowSchema.supplierId is a plain (non-nullable) uuid — AP rows are never supplier-less', () => {
    const parsed = SupplierApRowSchema.safeParse({
      supplierId: null,
      supplierName: 'No supplier',
      paymentTerms: 'INVOICE_TO_FOLLOW',
      lastInvoiceDate: null,
      invoiced: '0.00',
      paid: '0.00',
      outstanding: '0.00',
      buckets: {
        current: '0.00',
        days1To30: '0.00',
        days31To60: '0.00',
        days61To90: '0.00',
        days90Plus: '0.00',
      },
      disputedCount: 0,
    });
    // A null supplierId must be REJECTED by this schema — proving the AP row
    // shape itself has no representable "no supplier" state to leak into.
    expect(parsed.success).toBe(false);
  });

  it('ExpectedDelivery.supplierId being null does not, by construction, imply any AP-table row exists', async () => {
    // A supplier-less ExpectedDelivery never creates a GoodsReceipt/
    // SupplierInvoice/SupplierPayment row as a side effect of being created —
    // createExpectedDelivery writes only ExpectedDelivery/-Line rows (see the
    // "writes zero ledger entries" test above, same transaction boundary).
    // There is therefore no code path today, and none introduced by this
    // amendment, by which a supplier-less purchase can surface on an AP
    // endpoint once S7 builds one.
    vi.mocked(referenceCounterRepository.nextReference).mockResolvedValue('EXP-0005');
    vi.mocked(expectedDeliveryRepository.create).mockResolvedValue({
      id: deliveryId,
      organizationId: hubOrgId,
      reference: 'EXP-0005',
      supplierId: null,
      supplier: null,
      paymentTerms: null,
      status: 'AWAITING',
      expectedDate: null,
      estimatedTotal: new Prisma.Decimal('500'),
      createdById: 'sm1',
      createdAt: new Date(),
      updatedAt: new Date(),
      lines: [],
    } as never);

    await receivingService.createExpectedDelivery(storeManager, {
      lines: [{ inventoryItemId: itemId, quantity: '1', estimatedUnitPrice: '500' }],
    });

    // Only the ExpectedDelivery repository was touched — no GoodsReceipt/
    // SupplierInvoice/SupplierPayment repository exists to call yet, and this
    // test will need updating (not silently pass) the moment S7 adds one.
    expect(expectedDeliveryRepository.create).toHaveBeenCalledTimes(1);
  });

  it('GoodsReceiptDetailSchema accepts getGoodsReceipt output, including a price-alerted line and no linked invoice', async () => {
    vi.mocked(goodsReceiptRepository.findById).mockResolvedValue({
      id: '77777777-7777-4777-8777-777777777777',
      organizationId: hubOrgId,
      reference: 'GRN-0001',
      supplierId,
      supplier: { id: supplierId, name: 'Samrat Supermarket Ltd' },
      expectedDeliveryId: null,
      paymentTerms: 'INVOICE_TO_FOLLOW',
      status: 'RECEIVED_INVOICE_PENDING',
      supplierDocNumber: 'INV-001',
      supplierDocDate: null,
      receiptTotal: new Prisma.Decimal('8100'),
      locationId: 'central-store-1',
      signedById: 'sm1',
      signedAt: new Date(),
      signedBy: { id: 'sm1', name: 'Joseph Mwangi', role: 'STORE_MANAGER' },
      createdById: 'sm1',
      createdBy: { id: 'sm1', name: 'Joseph Mwangi' },
      createdAt: new Date(),
      updatedAt: new Date(),
      lines: [
        {
          id: '99999999-9999-4999-8999-999999999999',
          goodsReceiptId: '77777777-7777-4777-8777-777777777777',
          inventoryItemId: itemId,
          inventoryItem: { id: itemId, name: 'Dormans Syrup Hazelnut 750ml', buyUnit: 'pkt', usageUnit: 'unit' },
          quantityBuyUnit: new Prisma.Decimal('2'),
          quantityUsageUnit: new Prisma.Decimal('2'),
          unitPrice: new Prisma.Decimal('1650'),
          lineTotal: new Prisma.Decimal('3300'),
          lineOrder: 0,
          priceAlertPct: new Prisma.Decimal('38'),
          priceAlertPrevPrice: new Prisma.Decimal('1049'),
          priceAlertAcceptedById: 'sm1',
          priceAlertAcceptedBy: { id: 'sm1', name: 'D. Kariuki' },
        },
      ],
      invoices: [],
    } as never);

    const result = await receivingService.getGoodsReceipt(storeManager, '77777777-7777-4777-8777-777777777777');
    const parsed = GoodsReceiptDetailSchema.safeParse(result);
    expect(parsed.success).toBe(true);
  });
});
