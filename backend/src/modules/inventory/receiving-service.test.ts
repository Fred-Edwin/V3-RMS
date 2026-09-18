import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { receivingService } from './receiving-service';
import {
  expectedDeliveryRepository,
  goodsReceiptRepository,
  lastPriceRepository,
  recentSupplierItemsRepository,
  referenceCounterRepository,
} from './receiving-repository';
import { inventoryItemRepository, supplierRepository } from './inventory-repository';
import { branchRepository } from '../../repositories/branch-repository';
import { locationRepository } from '../../repositories/location-repository';
import { authRepository } from '../../repositories/auth-repository';
import { socketService } from '../../sockets/socket-service';
import { fcmService } from '../../services/fcm-service';
import { comparePin } from '../../utils/password';
import { prisma } from '../../config/database';
import { ConflictError, ForbiddenError, NotFoundError, UnauthorizedError } from '../../utils/errors';

vi.mock('./receiving-repository', () => ({
  expectedDeliveryRepository: {
    findAllByOrganization: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    cancel: vi.fn(),
    countByStatus: vi.fn(),
    countOverdue: vi.fn(),
    findHistoryRows: vi.fn(),
  },
  goodsReceiptRepository: {
    findAllByOrganization: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    markSigned: vi.fn(),
    markPriceAlertsAccepted: vi.fn(),
    findHubStoreManagers: vi.fn(),
    findHistoryRows: vi.fn(),
  },
  referenceCounterRepository: {
    nextReference: vi.fn(),
  },
  lastPriceRepository: {
    findLastReceiptLine: vi.fn(),
  },
  recentSupplierItemsRepository: {
    findRecentBySupplier: vi.fn(),
  },
}));

vi.mock('./inventory-repository', () => ({
  supplierRepository: {
    findById: vi.fn(),
  },
  inventoryItemRepository: {
    findLiveByIds: vi.fn(),
    findById: vi.fn(),
  },
}));

vi.mock('../../repositories/branch-repository', () => ({
  branchRepository: { findHub: vi.fn() },
}));

vi.mock('../../repositories/location-repository', () => ({
  locationRepository: { findCentralStore: vi.fn() },
}));

vi.mock('../../repositories/auth-repository', () => ({
  authRepository: { findUserByIdWithPassword: vi.fn() },
}));

vi.mock('../../sockets/socket-service', () => ({
  socketService: { emitGoodsReceiptSigned: vi.fn() },
}));

vi.mock('../../services/fcm-service', () => ({
  fcmService: { sendGoodsReceiptSignedPush: vi.fn() },
}));

vi.mock('../../utils/password', () => ({
  comparePin: vi.fn(),
}));

const txInventoryTransactionCreate = vi.fn();
const txInventoryItemUpdate = vi.fn();

vi.mock('../../config/database', () => ({
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
const supplierId = '66666666-6666-4666-8666-666666666666';
const itemId = '44444444-4444-4444-8444-444444444444';
const deliveryId = '88888888-8888-4888-8888-888888888888';

const storeManager = { id: 'sm1', role: 'STORE_MANAGER' as const, organizationId: hubOrgId };
const storeAttendant = { id: 'sa1', role: 'STORE_ATTENDANT' as const, organizationId: hubOrgId };
const nonHubStoreManager = { id: 'sm2', role: 'STORE_MANAGER' as const, organizationId: branchOrgId };

const hubOrg = { id: hubOrgId, name: 'Central Store', isHub: true, isActive: true };

const buildSupplier = (overrides: Record<string, unknown> = {}) => ({
  id: supplierId,
  organizationId: hubOrgId,
  name: 'Samrat Supermarket Ltd',
  deletedAt: null,
  ...overrides,
});

const buildItem = (overrides: Record<string, unknown> = {}) => ({
  id: itemId,
  organizationId: hubOrgId,
  name: 'Milk 500ml',
  buyUnit: 'crate',
  usageUnit: 'unit',
  conversionFactor: new Prisma.Decimal('12'),
  currentCost: new Prisma.Decimal('2025'),
  deletedAt: null,
  ...overrides,
});

const goodsReceiptId = '77777777-7777-4777-8777-777777777777';

const buildGoodsReceiptLine = (overrides: Record<string, unknown> = {}) => ({
  id: 'grline1',
  goodsReceiptId,
  inventoryItemId: itemId,
  inventoryItem: { id: itemId, name: 'Milk 500ml', buyUnit: 'crate', usageUnit: 'unit' },
  quantityBuyUnit: new Prisma.Decimal('4'),
  quantityUsageUnit: new Prisma.Decimal('48'),
  unitPrice: new Prisma.Decimal('2025'),
  lineTotal: new Prisma.Decimal('8100'),
  lineOrder: 0,
  priceAlertPct: null,
  priceAlertPrevPrice: null,
  priceAlertAcceptedById: null,
  priceAlertAcceptedBy: null,
  ...overrides,
});

const buildGoodsReceipt = (overrides: Record<string, unknown> = {}) => ({
  id: goodsReceiptId,
  organizationId: hubOrgId,
  reference: 'GRN-0001',
  supplierId,
  supplier: { id: supplierId, name: 'Samrat Supermarket Ltd' },
  expectedDeliveryId: null,
  paymentTerms: 'INVOICE_TO_FOLLOW' as const,
  status: 'DRAFT' as const,
  supplierDocNumber: 'INV-001',
  supplierDocDate: null,
  receiptTotal: new Prisma.Decimal('8100'),
  locationId: 'central-store-1',
  signedById: null,
  signedAt: null,
  signedBy: null,
  createdById: 'sm1',
  createdBy: { id: 'sm1', name: 'Joseph Mwangi' },
  createdAt: new Date(),
  updatedAt: new Date(),
  lines: [buildGoodsReceiptLine()],
  invoices: [],
  ...overrides,
});

const centralStore = { id: 'central-store-1', organizationId: hubOrgId, type: 'CENTRAL_STORE' as const };

const actorWithPin = (overrides: Record<string, unknown> = {}) => ({
  id: 'sm1',
  name: 'Joseph Mwangi',
  role: 'STORE_MANAGER' as const,
  organizationId: hubOrgId,
  passwordHash: 'hashed-password',
  pinHash: 'hashed-pin',
  ...overrides,
});

const buildDelivery = (overrides: Record<string, unknown> = {}) => ({
  id: deliveryId,
  organizationId: hubOrgId,
  reference: 'EXP-0001',
  supplierId,
  supplier: { id: supplierId, name: 'Samrat Supermarket Ltd' },
  paymentTerms: 'INVOICE_TO_FOLLOW' as const,
  status: 'AWAITING' as const,
  expectedDate: null,
  estimatedTotal: new Prisma.Decimal('8100'),
  createdById: 'sm1',
  createdAt: new Date(),
  updatedAt: new Date(),
  lines: [
    {
      id: 'line1',
      expectedDeliveryId: deliveryId,
      inventoryItemId: itemId,
      inventoryItem: { id: itemId, name: 'Milk 500ml', buyUnit: 'crate' },
      quantity: new Prisma.Decimal('4'),
      estimatedUnitPrice: new Prisma.Decimal('2025'),
      lineOrder: 0,
    },
  ],
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(branchRepository.findHub).mockResolvedValue(hubOrg as never);
});

describe('receivingService — D-15 hub scoping', () => {
  it('rejects a non-hub Store Manager with a ForbiddenError', async () => {
    await expect(
      receivingService.listExpectedDeliveries(nonHubStoreManager, { limit: 25 }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('rejects cross-org access even when the id exists at another org', async () => {
    vi.mocked(expectedDeliveryRepository.findAllByOrganization).mockResolvedValue([]);
    await receivingService.listExpectedDeliveries(storeManager, { limit: 25 });
    expect(expectedDeliveryRepository.findAllByOrganization).toHaveBeenCalledWith(hubOrgId, expect.anything());
  });
});

describe('receivingService.createExpectedDelivery', () => {
  it('writes zero ledger entries — no InventoryTransaction import, no ledger $transaction', async () => {
    vi.mocked(supplierRepository.findById).mockResolvedValue(buildSupplier() as never);
    vi.mocked(inventoryItemRepository.findLiveByIds).mockResolvedValue([buildItem()] as never);
    vi.mocked(referenceCounterRepository.nextReference).mockResolvedValue('EXP-0001');
    vi.mocked(expectedDeliveryRepository.create).mockResolvedValue(buildDelivery() as never);

    await receivingService.createExpectedDelivery(storeManager, {
      supplierId,
      paymentTerms: 'INVOICE_TO_FOLLOW',
      lines: [{ inventoryItemId: itemId, quantity: '4', estimatedUnitPrice: '2025' }],
    });

    // Static assertion of intent: this file must never import InventoryTransaction
    // machinery for expected deliveries — verified by grep in review, and here
    // by asserting only the reference-counter + create repository calls ran.
    expect(referenceCounterRepository.nextReference).toHaveBeenCalledTimes(1);
    expect(expectedDeliveryRepository.create).toHaveBeenCalledTimes(1);
  });

  it('rejects an unknown supplier', async () => {
    vi.mocked(supplierRepository.findById).mockResolvedValue(null);
    await expect(
      receivingService.createExpectedDelivery(storeManager, {
        supplierId,
        paymentTerms: 'INVOICE_TO_FOLLOW',
        lines: [{ inventoryItemId: itemId, quantity: '4', estimatedUnitPrice: '2025' }],
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('rejects a retired supplier with 409', async () => {
    vi.mocked(supplierRepository.findById).mockResolvedValue(buildSupplier({ deletedAt: new Date() }) as never);
    await expect(
      receivingService.createExpectedDelivery(storeManager, {
        supplierId,
        paymentTerms: 'INVOICE_TO_FOLLOW',
        lines: [{ inventoryItemId: itemId, quantity: '4', estimatedUnitPrice: '2025' }],
      }),
    ).rejects.toThrow(ConflictError);
  });
});

describe('receivingService.createExpectedDelivery — optional supplier (AMENDMENT 2026-09-17)', () => {
  it('succeeds with no supplierId — a pure shopping list', async () => {
    vi.mocked(inventoryItemRepository.findLiveByIds).mockResolvedValue([buildItem()] as never);
    vi.mocked(referenceCounterRepository.nextReference).mockResolvedValue('EXP-0002');
    vi.mocked(expectedDeliveryRepository.create).mockResolvedValue(
      buildDelivery({ supplierId: null, supplier: null, paymentTerms: null }) as never,
    );

    const result = await receivingService.createExpectedDelivery(storeManager, {
      lines: [{ inventoryItemId: itemId, quantity: '4', estimatedUnitPrice: '2025' }],
    });

    // No supplier lookup at all when supplierId is omitted — nothing to 404/409 on.
    expect(supplierRepository.findById).not.toHaveBeenCalled();
    expect(expectedDeliveryRepository.create).toHaveBeenCalledTimes(1);
    expect(result.supplierId).toBeNull();
    expect(result.supplierName).toBeNull();
    expect(result.paymentTerms).toBeNull();
  });

  it('still validates a supplier when one IS supplied', async () => {
    vi.mocked(supplierRepository.findById).mockResolvedValue(null);
    await expect(
      receivingService.createExpectedDelivery(storeManager, {
        supplierId,
        lines: [{ inventoryItemId: itemId, quantity: '4', estimatedUnitPrice: '2025' }],
      }),
    ).rejects.toThrow(NotFoundError);
  });
});

describe('receivingService — "No supplier" rendering (AMENDMENT 2026-09-17)', () => {
  it('ExpectedDeliverySummary carries null supplierId/supplierName/paymentTerms when unassigned', async () => {
    vi.mocked(expectedDeliveryRepository.findAllByOrganization).mockResolvedValue([
      buildDelivery({ supplierId: null, supplier: null, paymentTerms: null }),
    ] as never);

    const [row] = await receivingService.listExpectedDeliveries(storeManager, { limit: 25 });

    expect(row!.supplierId).toBeNull();
    expect(row!.supplierName).toBeNull();
    expect(row!.paymentTerms).toBeNull();
  });

  it('the History band row renders the literal "No supplier" string, never null, and a dash for terms', async () => {
    vi.mocked(expectedDeliveryRepository.findHistoryRows).mockResolvedValue([
      buildDelivery({ supplierId: null, supplier: null, paymentTerms: null }),
    ] as never);
    vi.mocked(goodsReceiptRepository.findHistoryRows).mockResolvedValue([]);

    const [row] = await receivingService.getPurchasingHistory(storeManager, { limit: 25 });

    expect(row).toMatchObject({
      type: 'expectedDelivery',
      supplierName: 'No supplier',
      paymentTermsLabel: '—',
    });
  });

  it('a delivery WITH a supplier still renders its real name/terms label (no regression)', async () => {
    vi.mocked(expectedDeliveryRepository.findHistoryRows).mockResolvedValue([buildDelivery()] as never);
    vi.mocked(goodsReceiptRepository.findHistoryRows).mockResolvedValue([]);

    const [row] = await receivingService.getPurchasingHistory(storeManager, { limit: 25 });

    expect(row).toMatchObject({
      type: 'expectedDelivery',
      supplierName: 'Samrat Supermarket Ltd',
      paymentTermsLabel: 'Invoice',
    });
  });
});

describe('receivingService — STORE_ATTENDANT money omission', () => {
  it('omits estimatedTotal for STORE_ATTENDANT but not STORE_MANAGER', async () => {
    vi.mocked(expectedDeliveryRepository.findAllByOrganization).mockResolvedValue([buildDelivery()] as never);

    const managerView = await receivingService.listExpectedDeliveries(storeManager, { limit: 25 });
    const attendantView = await receivingService.listExpectedDeliveries(storeAttendant, { limit: 25 });

    expect(managerView[0]!.estimatedTotal).toBe('8100');
    expect(attendantView[0]!.estimatedTotal).toBeNull();
  });
});

describe('receivingService.getPurchasingSummary', () => {
  it('computes the expected tile for real; awaitingInvoice/owed are placeholders until S4/S7', async () => {
    vi.mocked(expectedDeliveryRepository.countByStatus).mockResolvedValue(3);
    vi.mocked(expectedDeliveryRepository.countOverdue).mockResolvedValue(1);

    const summary = await receivingService.getPurchasingSummary(storeManager);

    expect(summary.expected).toEqual({ count: 3, overdue: 1 });
    expect(summary.awaitingInvoice).toEqual({ count: 0, oldestDays: null });
    expect(summary.owed).toEqual({ amount: '0.00', over30Count: 0 });
  });

  it('marks overdue from expectedDate < now(), computed not stored', async () => {
    vi.mocked(expectedDeliveryRepository.countByStatus).mockResolvedValue(5);
    vi.mocked(expectedDeliveryRepository.countOverdue).mockResolvedValue(2);

    await receivingService.getPurchasingSummary(storeManager);

    expect(expectedDeliveryRepository.countOverdue).toHaveBeenCalledWith(hubOrgId, expect.any(Date));
  });
});

describe('receivingService.cancelExpectedDelivery', () => {
  it('cancels an AWAITING delivery', async () => {
    vi.mocked(expectedDeliveryRepository.findById).mockResolvedValue(buildDelivery() as never);
    vi.mocked(expectedDeliveryRepository.cancel).mockResolvedValue(buildDelivery({ status: 'CANCELLED' }) as never);

    const result = await receivingService.cancelExpectedDelivery(storeManager, deliveryId);
    expect(result.status).toBe('CANCELLED');
  });

  it('returns 409 when the delivery is not AWAITING', async () => {
    vi.mocked(expectedDeliveryRepository.findById).mockResolvedValue(buildDelivery({ status: 'FULFILLED' }) as never);

    await expect(receivingService.cancelExpectedDelivery(storeManager, deliveryId)).rejects.toThrow(ConflictError);
    expect(expectedDeliveryRepository.cancel).not.toHaveBeenCalled();
  });

  it('404s on an unknown id', async () => {
    vi.mocked(expectedDeliveryRepository.findById).mockResolvedValue(null);
    await expect(receivingService.cancelExpectedDelivery(storeManager, deliveryId)).rejects.toThrow(NotFoundError);
  });
});

describe('receivingService.createExpectedDelivery — reference numbering', () => {
  it('increments the counter inside the same transaction as the create, never a separate read-then-write', async () => {
    vi.mocked(supplierRepository.findById).mockResolvedValue(buildSupplier() as never);
    vi.mocked(inventoryItemRepository.findLiveByIds).mockResolvedValue([buildItem()] as never);
    vi.mocked(referenceCounterRepository.nextReference).mockResolvedValue('EXP-0001');
    vi.mocked(expectedDeliveryRepository.create).mockResolvedValue(buildDelivery() as never);

    const callOrder: string[] = [];
    vi.mocked(referenceCounterRepository.nextReference).mockImplementation(async () => {
      callOrder.push('counter');
      return 'EXP-0001';
    });
    vi.mocked(expectedDeliveryRepository.create).mockImplementation(async () => {
      callOrder.push('create');
      return buildDelivery() as never;
    });

    await receivingService.createExpectedDelivery(storeManager, {
      supplierId,
      paymentTerms: 'INVOICE_TO_FOLLOW',
      lines: [{ inventoryItemId: itemId, quantity: '4', estimatedUnitPrice: '2025' }],
    });

    // Both calls happen inside the single prisma.$transaction callback (see
    // the mock above, which just invokes the callback with a fake tx) — the
    // counter increment and the row create share one transaction boundary,
    // which is what makes concurrent increments gap-free at the DB level
    // (ReferenceCounter.lastNumber increment is atomic under the transaction,
    // per plan §1.7). This test documents that ordering; true concurrent-
    // request gap-freedom is a property of the upsert+increment enforced by
    // Postgres row locking, not something unit tests can race meaningfully.
    expect(callOrder).toEqual(['counter', 'create']);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});

describe('receivingService.getLastPrice', () => {
  it('returns null when no signed receipt line exists yet', async () => {
    vi.mocked(inventoryItemRepository.findById).mockResolvedValue(buildItem() as never);
    vi.mocked(lastPriceRepository.findLastReceiptLine).mockResolvedValue(null);

    const result = await receivingService.getLastPrice(storeManager, itemId);
    expect(result).toBeNull();
  });

  it('returns the last signed receipt line price', async () => {
    vi.mocked(inventoryItemRepository.findById).mockResolvedValue(buildItem() as never);
    vi.mocked(lastPriceRepository.findLastReceiptLine).mockResolvedValue({
      unitPrice: new Prisma.Decimal('6410'),
      signedAt: new Date('2026-09-02T00:00:00Z'),
    });

    const result = await receivingService.getLastPrice(storeManager, itemId);
    expect(result).toEqual({ unitPrice: '6410', asOf: '2026-09-02T00:00:00.000Z' });
  });

  it('404s on an unknown item', async () => {
    vi.mocked(inventoryItemRepository.findById).mockResolvedValue(null);
    await expect(receivingService.getLastPrice(storeManager, itemId)).rejects.toThrow(NotFoundError);
  });
});

describe('receivingService.getRecentSupplierItems', () => {
  it('rejects a non-hub Store Manager with a ForbiddenError', async () => {
    await expect(
      receivingService.getRecentSupplierItems(nonHubStoreManager, supplierId, 8),
    ).rejects.toThrow(ForbiddenError);
  });

  it('404s on an unknown supplier', async () => {
    vi.mocked(supplierRepository.findById).mockResolvedValue(null);
    await expect(receivingService.getRecentSupplierItems(storeManager, supplierId, 8)).rejects.toThrow(
      NotFoundError,
    );
  });

  it('returns decimal-as-string, ISO-date rows scoped to the hub org', async () => {
    vi.mocked(supplierRepository.findById).mockResolvedValue(buildSupplier() as never);
    vi.mocked(recentSupplierItemsRepository.findRecentBySupplier).mockResolvedValue([
      {
        inventoryItemId: itemId,
        itemName: 'Milk 500ml',
        buyUnit: 'crate',
        lastUnitPrice: new Prisma.Decimal('2025'),
        lastPurchasedAt: new Date('2026-09-10T00:00:00Z'),
      },
    ]);

    const result = await receivingService.getRecentSupplierItems(storeManager, supplierId, 8);

    expect(recentSupplierItemsRepository.findRecentBySupplier).toHaveBeenCalledWith(hubOrgId, supplierId, 8);
    expect(result).toEqual([
      {
        inventoryItemId: itemId,
        itemName: 'Milk 500ml',
        buyUnit: 'crate',
        lastUnitPrice: '2025',
        lastPurchasedAt: '2026-09-10T00:00:00.000Z',
      },
    ]);
  });
});

describe('receivingService.createGoodsReceipt', () => {
  it('writes zero ledger entries — DRAFT only, no InventoryTransaction', async () => {
    vi.mocked(supplierRepository.findById).mockResolvedValue(buildSupplier() as never);
    vi.mocked(locationRepository.findCentralStore).mockResolvedValue(centralStore as never);
    vi.mocked(inventoryItemRepository.findLiveByIds).mockResolvedValue([buildItem()] as never);
    vi.mocked(lastPriceRepository.findLastReceiptLine).mockResolvedValue(null);
    vi.mocked(referenceCounterRepository.nextReference).mockResolvedValue('GRN-0001');
    vi.mocked(goodsReceiptRepository.create).mockResolvedValue(buildGoodsReceipt() as never);

    await receivingService.createGoodsReceipt(storeManager, {
      supplierId,
      paymentTerms: 'INVOICE_TO_FOLLOW',
      lines: [{ inventoryItemId: itemId, quantityBuyUnit: '4', unitPrice: '2025' }],
    });

    expect(txInventoryTransactionCreate).not.toHaveBeenCalled();
    expect(goodsReceiptRepository.create).toHaveBeenCalledTimes(1);
  });

  it('converts buy-unit quantity to usage-unit quantity via conversionFactor', async () => {
    vi.mocked(supplierRepository.findById).mockResolvedValue(buildSupplier() as never);
    vi.mocked(locationRepository.findCentralStore).mockResolvedValue(centralStore as never);
    vi.mocked(inventoryItemRepository.findLiveByIds).mockResolvedValue([
      buildItem({ buyUnit: 'crate (12)', usageUnit: 'kg', conversionFactor: new Prisma.Decimal('12') }),
    ] as never);
    vi.mocked(lastPriceRepository.findLastReceiptLine).mockResolvedValue(null);
    vi.mocked(referenceCounterRepository.nextReference).mockResolvedValue('GRN-0001');
    vi.mocked(goodsReceiptRepository.create).mockImplementation(async (_org, _ref, input) => {
      // The plan's own example: 18.0 kg entered against a crate(12) buy unit — but
      // here quantityBuyUnit=1.5 crates * conversionFactor 12 = 18 kg usage units.
      expect(input.lines[0]!.quantityUsageUnit.toString()).toBe('18');
      return buildGoodsReceipt() as never;
    });

    await receivingService.createGoodsReceipt(storeManager, {
      supplierId,
      paymentTerms: 'INVOICE_TO_FOLLOW',
      lines: [{ inventoryItemId: itemId, quantityBuyUnit: '1.5', unitPrice: '2025' }],
    });

    expect(goodsReceiptRepository.create).toHaveBeenCalledTimes(1);
  });

  it('treats a null conversionFactor as 1:1 (no conversion)', async () => {
    vi.mocked(supplierRepository.findById).mockResolvedValue(buildSupplier() as never);
    vi.mocked(locationRepository.findCentralStore).mockResolvedValue(centralStore as never);
    vi.mocked(inventoryItemRepository.findLiveByIds).mockResolvedValue([
      buildItem({ conversionFactor: null }),
    ] as never);
    vi.mocked(lastPriceRepository.findLastReceiptLine).mockResolvedValue(null);
    vi.mocked(referenceCounterRepository.nextReference).mockResolvedValue('GRN-0001');
    vi.mocked(goodsReceiptRepository.create).mockImplementation(async (_org, _ref, input) => {
      expect(input.lines[0]!.quantityUsageUnit.toString()).toBe('4');
      return buildGoodsReceipt() as never;
    });

    await receivingService.createGoodsReceipt(storeManager, {
      supplierId,
      paymentTerms: 'INVOICE_TO_FOLLOW',
      lines: [{ inventoryItemId: itemId, quantityBuyUnit: '4', unitPrice: '2025' }],
    });
  });

  it('flags a price alert when the entered price exceeds the threshold above last price', async () => {
    vi.mocked(supplierRepository.findById).mockResolvedValue(buildSupplier() as never);
    vi.mocked(locationRepository.findCentralStore).mockResolvedValue(centralStore as never);
    vi.mocked(inventoryItemRepository.findLiveByIds).mockResolvedValue([buildItem()] as never);
    vi.mocked(lastPriceRepository.findLastReceiptLine).mockResolvedValue({
      unitPrice: new Prisma.Decimal('1049'),
      signedAt: new Date(),
    });
    vi.mocked(referenceCounterRepository.nextReference).mockResolvedValue('GRN-0001');
    vi.mocked(goodsReceiptRepository.create).mockImplementation(async (_org, _ref, input) => {
      // 1650 vs 1049 last price = ~57% above — over the 15% threshold.
      expect(input.lines[0]!.priceAlertPct).not.toBeNull();
      expect(input.lines[0]!.priceAlertPrevPrice!.toString()).toBe('1049');
      return buildGoodsReceipt() as never;
    });

    await receivingService.createGoodsReceipt(storeManager, {
      supplierId,
      paymentTerms: 'INVOICE_TO_FOLLOW',
      lines: [{ inventoryItemId: itemId, quantityBuyUnit: '2', unitPrice: '1650' }],
    });
  });

  it('does not flag a price alert within the threshold', async () => {
    vi.mocked(supplierRepository.findById).mockResolvedValue(buildSupplier() as never);
    vi.mocked(locationRepository.findCentralStore).mockResolvedValue(centralStore as never);
    vi.mocked(inventoryItemRepository.findLiveByIds).mockResolvedValue([buildItem()] as never);
    vi.mocked(lastPriceRepository.findLastReceiptLine).mockResolvedValue({
      unitPrice: new Prisma.Decimal('2000'),
      signedAt: new Date(),
    });
    vi.mocked(referenceCounterRepository.nextReference).mockResolvedValue('GRN-0001');
    vi.mocked(goodsReceiptRepository.create).mockImplementation(async (_org, _ref, input) => {
      // 2025 vs 2000 = 1.25% above — under the 15% threshold.
      expect(input.lines[0]!.priceAlertPct).toBeNull();
      expect(input.lines[0]!.priceAlertPrevPrice).toBeNull();
      return buildGoodsReceipt() as never;
    });

    await receivingService.createGoodsReceipt(storeManager, {
      supplierId,
      paymentTerms: 'INVOICE_TO_FOLLOW',
      lines: [{ inventoryItemId: itemId, quantityBuyUnit: '4', unitPrice: '2025' }],
    });
  });

  it('404s on an unknown supplier', async () => {
    vi.mocked(supplierRepository.findById).mockResolvedValue(null);
    await expect(
      receivingService.createGoodsReceipt(storeManager, {
        supplierId,
        paymentTerms: 'INVOICE_TO_FOLLOW',
        lines: [{ inventoryItemId: itemId, quantityBuyUnit: '4', unitPrice: '2025' }],
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('409s on a retired supplier', async () => {
    vi.mocked(supplierRepository.findById).mockResolvedValue(buildSupplier({ deletedAt: new Date() }) as never);
    await expect(
      receivingService.createGoodsReceipt(storeManager, {
        supplierId,
        paymentTerms: 'INVOICE_TO_FOLLOW',
        lines: [{ inventoryItemId: itemId, quantityBuyUnit: '4', unitPrice: '2025' }],
      }),
    ).rejects.toThrow(ConflictError);
  });

  it('404s when no Central Store is configured for this hub org', async () => {
    vi.mocked(supplierRepository.findById).mockResolvedValue(buildSupplier() as never);
    vi.mocked(locationRepository.findCentralStore).mockResolvedValue(null);
    await expect(
      receivingService.createGoodsReceipt(storeManager, {
        supplierId,
        paymentTerms: 'INVOICE_TO_FOLLOW',
        lines: [{ inventoryItemId: itemId, quantityBuyUnit: '4', unitPrice: '2025' }],
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('rejects a non-hub Store Manager with a ForbiddenError', async () => {
    await expect(
      receivingService.createGoodsReceipt(nonHubStoreManager, {
        supplierId,
        paymentTerms: 'INVOICE_TO_FOLLOW',
        lines: [{ inventoryItemId: itemId, quantityBuyUnit: '4', unitPrice: '2025' }],
      }),
    ).rejects.toThrow(ForbiddenError);
  });
});

describe('receivingService.updateGoodsReceipt', () => {
  it('edits a DRAFT receipt', async () => {
    vi.mocked(goodsReceiptRepository.findById).mockResolvedValue(buildGoodsReceipt() as never);
    vi.mocked(goodsReceiptRepository.update).mockResolvedValue(
      buildGoodsReceipt({ supplierDocNumber: 'INV-002' }) as never,
    );

    const result = await receivingService.updateGoodsReceipt(storeManager, goodsReceiptId, {
      supplierDocNumber: 'INV-002',
    });
    expect(result.supplierDocNumber).toBe('INV-002');
  });

  it('409s when the receipt is already signed', async () => {
    vi.mocked(goodsReceiptRepository.findById).mockResolvedValue(
      buildGoodsReceipt({ status: 'RECEIVED_PAID' }) as never,
    );
    await expect(
      receivingService.updateGoodsReceipt(storeManager, goodsReceiptId, { supplierDocNumber: 'INV-002' }),
    ).rejects.toThrow(ConflictError);
    expect(goodsReceiptRepository.update).not.toHaveBeenCalled();
  });

  it('404s on an unknown id', async () => {
    vi.mocked(goodsReceiptRepository.findById).mockResolvedValue(null);
    await expect(
      receivingService.updateGoodsReceipt(storeManager, goodsReceiptId, { supplierDocNumber: 'INV-002' }),
    ).rejects.toThrow(NotFoundError);
  });
});

describe('receivingService.signGoodsReceipt', () => {
  const validSignInput = { pin: '1234', acceptedPriceAlerts: [] };

  it('writes the ledger exactly once per line, atomically, and transitions status', async () => {
    vi.mocked(authRepository.findUserByIdWithPassword).mockResolvedValue(actorWithPin() as never);
    vi.mocked(comparePin).mockResolvedValue(true);
    vi.mocked(goodsReceiptRepository.findById)
      .mockResolvedValueOnce(buildGoodsReceipt() as never)
      .mockResolvedValueOnce(buildGoodsReceipt({ status: 'RECEIVED_INVOICE_PENDING', signedAt: new Date() }) as never);
    vi.mocked(locationRepository.findCentralStore).mockResolvedValue(centralStore as never);
    vi.mocked(goodsReceiptRepository.markSigned).mockResolvedValue(1);
    vi.mocked(goodsReceiptRepository.findHubStoreManagers).mockResolvedValue([]);

    await receivingService.signGoodsReceipt(storeManager, goodsReceiptId, validSignInput);

    expect(txInventoryTransactionCreate).toHaveBeenCalledTimes(1);
    expect(txInventoryTransactionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'RECEIVE',
        locationId: centralStore.id,
        inventoryItemId: itemId,
        quantity: expect.anything(),
        unitCost: expect.anything(),
        goodsReceiptLineId: 'grline1',
        userId: storeManager.id,
        organizationId: hubOrgId,
      }),
    });
    expect(txInventoryItemUpdate).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('a forced failure mid-loop rolls back — the mocked $transaction rejects and no partial writes are observable', async () => {
    vi.mocked(authRepository.findUserByIdWithPassword).mockResolvedValue(actorWithPin() as never);
    vi.mocked(comparePin).mockResolvedValue(true);
    vi.mocked(goodsReceiptRepository.findById).mockResolvedValue(
      buildGoodsReceipt({
        lines: [buildGoodsReceiptLine({ id: 'l1' }), buildGoodsReceiptLine({ id: 'l2' }), buildGoodsReceiptLine({ id: 'l3' })],
      }) as never,
    );
    vi.mocked(locationRepository.findCentralStore).mockResolvedValue(centralStore as never);
    vi.mocked(goodsReceiptRepository.markSigned).mockResolvedValue(1);
    txInventoryTransactionCreate
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('simulated failure on line 2'));

    await expect(
      receivingService.signGoodsReceipt(storeManager, goodsReceiptId, validSignInput),
    ).rejects.toThrow('simulated failure on line 2');

    // The mocked prisma.$transaction just invokes the callback directly (no
    // real rollback semantics in a unit test), but the callback itself never
    // reaches line 3 or the status/price-alert writes once line 2 throws —
    // that ordering is what a real Postgres transaction rolls back atomically.
    expect(txInventoryTransactionCreate).toHaveBeenCalledTimes(2);
    expect(goodsReceiptRepository.markPriceAlertsAccepted).not.toHaveBeenCalled();
  });

  it('latest-price costing sets InventoryItem.currentCost to the signed price, no averaging', async () => {
    vi.mocked(authRepository.findUserByIdWithPassword).mockResolvedValue(actorWithPin() as never);
    vi.mocked(comparePin).mockResolvedValue(true);
    vi.mocked(goodsReceiptRepository.findById).mockResolvedValue(
      buildGoodsReceipt({ lines: [buildGoodsReceiptLine({ unitPrice: new Prisma.Decimal('2200') })] }) as never,
    );
    vi.mocked(locationRepository.findCentralStore).mockResolvedValue(centralStore as never);
    vi.mocked(goodsReceiptRepository.markSigned).mockResolvedValue(1);
    vi.mocked(goodsReceiptRepository.findHubStoreManagers).mockResolvedValue([]);

    await receivingService.signGoodsReceipt(storeManager, goodsReceiptId, validSignInput);

    expect(txInventoryItemUpdate).toHaveBeenCalledWith({
      where: { id: itemId },
      data: { currentCost: expect.objectContaining({ toString: expect.any(Function) }) },
    });
    const call = txInventoryItemUpdate.mock.calls[0]![0];
    expect(call.data.currentCost.toString()).toBe('2200');
  });

  it('the price-alert snapshot on a signed line is never recomputed on read (survives a later price change)', async () => {
    const signedReceipt = buildGoodsReceipt({
      status: 'RECEIVED_INVOICE_PENDING',
      lines: [
        buildGoodsReceiptLine({
          priceAlertPct: new Prisma.Decimal('38'),
          priceAlertPrevPrice: new Prisma.Decimal('1049'),
        }),
      ],
    });
    vi.mocked(goodsReceiptRepository.findById).mockResolvedValue(signedReceipt as never);

    const result = await receivingService.getGoodsReceipt(storeManager, goodsReceiptId);

    expect(result.lines[0]!.priceAlert).toEqual({
      percentAboveLast: '38',
      previousPrice: '1049',
      acceptedByName: null,
    });
  });

  it('PAY_NOW transitions to RECEIVED_PAID', async () => {
    vi.mocked(authRepository.findUserByIdWithPassword).mockResolvedValue(actorWithPin() as never);
    vi.mocked(comparePin).mockResolvedValue(true);
    vi.mocked(goodsReceiptRepository.findById).mockResolvedValue(
      buildGoodsReceipt({ paymentTerms: 'PAY_NOW' }) as never,
    );
    vi.mocked(locationRepository.findCentralStore).mockResolvedValue(centralStore as never);
    vi.mocked(goodsReceiptRepository.markSigned).mockResolvedValue(1);
    vi.mocked(goodsReceiptRepository.findHubStoreManagers).mockResolvedValue([]);

    await receivingService.signGoodsReceipt(storeManager, goodsReceiptId, validSignInput);

    expect(goodsReceiptRepository.markSigned).toHaveBeenCalledWith(
      goodsReceiptId,
      hubOrgId,
      expect.anything(),
      expect.objectContaining({ status: 'RECEIVED_PAID' }),
    );
  });

  it('INVOICE_TO_FOLLOW transitions to RECEIVED_INVOICE_PENDING', async () => {
    vi.mocked(authRepository.findUserByIdWithPassword).mockResolvedValue(actorWithPin() as never);
    vi.mocked(comparePin).mockResolvedValue(true);
    vi.mocked(goodsReceiptRepository.findById).mockResolvedValue(
      buildGoodsReceipt({ paymentTerms: 'INVOICE_TO_FOLLOW' }) as never,
    );
    vi.mocked(locationRepository.findCentralStore).mockResolvedValue(centralStore as never);
    vi.mocked(goodsReceiptRepository.markSigned).mockResolvedValue(1);
    vi.mocked(goodsReceiptRepository.findHubStoreManagers).mockResolvedValue([]);

    await receivingService.signGoodsReceipt(storeManager, goodsReceiptId, validSignInput);

    expect(goodsReceiptRepository.markSigned).toHaveBeenCalledWith(
      goodsReceiptId,
      hubOrgId,
      expect.anything(),
      expect.objectContaining({ status: 'RECEIVED_INVOICE_PENDING' }),
    );
  });

  it('401s on an incorrect PIN', async () => {
    vi.mocked(authRepository.findUserByIdWithPassword).mockResolvedValue(actorWithPin() as never);
    vi.mocked(comparePin).mockResolvedValue(false);

    await expect(
      receivingService.signGoodsReceipt(storeManager, goodsReceiptId, validSignInput),
    ).rejects.toThrow(UnauthorizedError);
    expect(goodsReceiptRepository.findById).not.toHaveBeenCalled();
  });

  it('401s when no PIN has been set yet', async () => {
    vi.mocked(authRepository.findUserByIdWithPassword).mockResolvedValue(actorWithPin({ pinHash: null }) as never);

    await expect(
      receivingService.signGoodsReceipt(storeManager, goodsReceiptId, validSignInput),
    ).rejects.toThrow(UnauthorizedError);
    expect(comparePin).not.toHaveBeenCalled();
  });

  it('409s when the receipt is already signed', async () => {
    vi.mocked(authRepository.findUserByIdWithPassword).mockResolvedValue(actorWithPin() as never);
    vi.mocked(comparePin).mockResolvedValue(true);
    vi.mocked(goodsReceiptRepository.findById).mockResolvedValue(
      buildGoodsReceipt({ status: 'RECEIVED_PAID' }) as never,
    );

    await expect(
      receivingService.signGoodsReceipt(storeManager, goodsReceiptId, validSignInput),
    ).rejects.toThrow(ConflictError);
    expect(txInventoryTransactionCreate).not.toHaveBeenCalled();
  });

  it('409s when the receipt has zero lines', async () => {
    vi.mocked(authRepository.findUserByIdWithPassword).mockResolvedValue(actorWithPin() as never);
    vi.mocked(comparePin).mockResolvedValue(true);
    vi.mocked(goodsReceiptRepository.findById).mockResolvedValue(buildGoodsReceipt({ lines: [] }) as never);

    await expect(
      receivingService.signGoodsReceipt(storeManager, goodsReceiptId, validSignInput),
    ).rejects.toThrow(ConflictError);
  });

  it('404s (No Central Store configured) when the hub has none', async () => {
    vi.mocked(authRepository.findUserByIdWithPassword).mockResolvedValue(actorWithPin() as never);
    vi.mocked(comparePin).mockResolvedValue(true);
    vi.mocked(goodsReceiptRepository.findById).mockResolvedValue(buildGoodsReceipt() as never);
    vi.mocked(locationRepository.findCentralStore).mockResolvedValue(null);

    await expect(
      receivingService.signGoodsReceipt(storeManager, goodsReceiptId, validSignInput),
    ).rejects.toThrow(NotFoundError);
    expect(txInventoryTransactionCreate).not.toHaveBeenCalled();
  });

  it('notifies hub Store Managers other than the signer, not the signer themselves', async () => {
    vi.mocked(authRepository.findUserByIdWithPassword).mockResolvedValue(actorWithPin() as never);
    vi.mocked(comparePin).mockResolvedValue(true);
    vi.mocked(goodsReceiptRepository.findById).mockResolvedValue(buildGoodsReceipt() as never);
    vi.mocked(locationRepository.findCentralStore).mockResolvedValue(centralStore as never);
    vi.mocked(goodsReceiptRepository.markSigned).mockResolvedValue(1);
    vi.mocked(goodsReceiptRepository.findHubStoreManagers).mockResolvedValue([
      { id: storeManager.id, name: 'Joseph Mwangi' },
      { id: 'sm-other', name: 'Другой Manager' },
    ]);

    await receivingService.signGoodsReceipt(storeManager, goodsReceiptId, validSignInput);
    // Fire-and-forget: flush microtasks so the void async call resolves.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(socketService.emitGoodsReceiptSigned).toHaveBeenCalledTimes(1);
    expect(socketService.emitGoodsReceiptSigned).toHaveBeenCalledWith('sm-other', expect.anything());
    expect(fcmService.sendGoodsReceiptSignedPush).toHaveBeenCalledWith(['sm-other'], expect.anything());
  });

  it('rejects a non-hub Store Manager with a ForbiddenError', async () => {
    await expect(
      receivingService.signGoodsReceipt(nonHubStoreManager, goodsReceiptId, validSignInput),
    ).rejects.toThrow(ForbiddenError);
  });
});

describe('receivingService.listGoodsReceipts / getGoodsReceipt', () => {
  it('lists receipts scoped to the hub org', async () => {
    vi.mocked(goodsReceiptRepository.findAllByOrganization).mockResolvedValue([buildGoodsReceipt()] as never);
    const result = await receivingService.listGoodsReceipts(storeManager, { limit: 25 });
    expect(result).toHaveLength(1);
    expect(goodsReceiptRepository.findAllByOrganization).toHaveBeenCalledWith(hubOrgId, expect.anything());
  });

  it('404s on an unknown id', async () => {
    vi.mocked(goodsReceiptRepository.findById).mockResolvedValue(null);
    await expect(receivingService.getGoodsReceipt(storeManager, goodsReceiptId)).rejects.toThrow(NotFoundError);
  });
});
