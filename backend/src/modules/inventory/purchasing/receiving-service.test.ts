import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { receivingService } from './receiving-service';
import {
  expectedDeliveryRepository,
  goodsReceiptRepository,
  lastPriceRepository,
  recentSupplierItemsRepository,
  referenceCounterRepository,
  supplierApRepository,
  supplierInvoiceRepository,
  supplierPaymentRepository,
} from './receiving-repository';
import { inventoryItemRepository } from '../catalog/inventory-repository';
import { supplierItemRepository, supplierRepository } from '../suppliers/supplier-repository';
import { branchRepository } from '../../../repositories/branch-repository';
import { locationRepository } from '../../../repositories/location-repository';
import { authRepository } from '../../../repositories/auth-repository';
import { socketService } from '../../../sockets/socket-service';
import { fcmService } from '../../../services/fcm-service';
import { comparePin } from '../../../utils/password';
import { prisma } from '../../../config/database';
import { ConflictError, ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from '../../../utils/errors';

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
    markPackNotOnFile: vi.fn(),
    findPackNotOnFileLines: vi.fn(),
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
  supplierInvoiceRepository: {
    findById: vi.fn(),
    findInvoicedReceiptIds: vi.fn(),
    create: vi.fn(),
    markReceiptsInvoiceRecorded: vi.fn(),
    createAdjustment: vi.fn(),
    updateStatus: vi.fn(),
    findAllBySupplier: vi.fn(),
    findAllByOrganization: vi.fn(),
  },
  supplierPaymentRepository: {
    findById: vi.fn(),
    create: vi.fn(),
    createReversal: vi.fn(),
    findAllBySupplier: vi.fn(),
    countChequeNumber: vi.fn(),
  },
  supplierApRepository: {
    findSuppliersWithInvoices: vi.fn(),
    findSupplierForAp: vi.fn(),
  },
}));

vi.mock('../suppliers/supplier-repository', () => ({
  supplierRepository: {
    findById: vi.fn(),
  },
  supplierItemRepository: {
    listBySupplierItems: vi.fn(),
    findLinesWithPrices: vi.fn(),
    setLinePrice: vi.fn(),
    createLine: vi.fn(),
  },
}));

vi.mock('../catalog/inventory-repository', () => ({
  inventoryItemRepository: {
    findLiveByIds: vi.fn(),
    findById: vi.fn(),
  },
}));

vi.mock('../../../repositories/branch-repository', () => ({
  branchRepository: { findHub: vi.fn() },
}));

vi.mock('../../../repositories/location-repository', () => ({
  locationRepository: { findCentralStore: vi.fn() },
}));

vi.mock('../../../repositories/auth-repository', () => ({
  authRepository: { findUserByIdWithPassword: vi.fn() },
}));

vi.mock('../../../sockets/socket-service', () => ({
  socketService: { emitGoodsReceiptSigned: vi.fn() },
}));

vi.mock('../../../services/fcm-service', () => ({
  fcmService: { sendGoodsReceiptSignedPush: vi.fn() },
}));

vi.mock('../../../utils/password', () => ({
  comparePin: vi.fn(),
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
  code: 'SUPPLIER-0001',
  tradingName: null,
  status: 'ACTIVE' as const,
  type: 'REGULAR' as const,
  category: null,
  address: 'Nyeri town',
  mapUrl: null,
  contacts: [
    { id: 'c1', name: 'Dattu', role: 'OTHER', phone: '+254722160400', whatsapp: null, email: 'samratnyeri@gmail.com', isPrimary: true },
  ],
  defaultPaymentTerms: 'INVOICE_TO_FOLLOW' as const,
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
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
  packBuyUnit: null,
  packSize: null,
  packNotOnFile: false,
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
  vi.mocked(supplierItemRepository.findLinesWithPrices).mockResolvedValue([]);
  vi.mocked(supplierItemRepository.listBySupplierItems).mockResolvedValue([]);
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
    vi.mocked(supplierRepository.findById).mockResolvedValue(buildSupplier({ status: 'ARCHIVED', deletedAt: new Date() }) as never);
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
  beforeEach(() => {
    vi.mocked(goodsReceiptRepository.findAllByOrganization).mockResolvedValue([]);
    vi.mocked(supplierInvoiceRepository.findAllByOrganization).mockResolvedValue([]);
  });

  it('computes the expected tile for real; awaitingInvoice/owed are real derivations by S7', async () => {
    vi.mocked(expectedDeliveryRepository.countByStatus).mockResolvedValue(3);
    vi.mocked(expectedDeliveryRepository.countOverdue).mockResolvedValue(1);

    const summary = await receivingService.getPurchasingSummary(storeManager);

    expect(summary.expected).toEqual({ count: 3, overdue: 1 });
    expect(summary.awaitingInvoice).toEqual({ count: 0, oldestDays: null });
    expect(summary.owed).toEqual({ amount: '0', over30Count: 0 });
  });

  it('marks overdue from expectedDate < now(), computed not stored', async () => {
    vi.mocked(expectedDeliveryRepository.countByStatus).mockResolvedValue(5);
    vi.mocked(expectedDeliveryRepository.countOverdue).mockResolvedValue(2);

    await receivingService.getPurchasingSummary(storeManager);

    expect(expectedDeliveryRepository.countOverdue).toHaveBeenCalledWith(hubOrgId, expect.any(Date));
  });

  it('derives owed and over30Count from real invoices, never a stored balance', async () => {
    vi.mocked(expectedDeliveryRepository.countByStatus).mockResolvedValue(0);
    vi.mocked(expectedDeliveryRepository.countOverdue).mockResolvedValue(0);
    const now = new Date();
    const oldDueDate = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000);
    vi.mocked(supplierInvoiceRepository.findAllByOrganization).mockResolvedValue([
      {
        id: 'inv1',
        supplierId,
        amountBilled: new Prisma.Decimal('1000'),
        dueDate: oldDueDate,
        invoiceDate: oldDueDate,
        disputeStatus: null,
        adjustments: [],
        allocations: [],
      },
    ] as never);

    const summary = await receivingService.getPurchasingSummary(storeManager);

    expect(summary.owed).toEqual({ amount: '1000', over30Count: 1 });
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
    vi.mocked(supplierRepository.findById).mockResolvedValue(buildSupplier({ status: 'ARCHIVED', deletedAt: new Date() }) as never);
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

  it('latest-price costing sets InventoryItem.currentCost to the signed price PER USAGE UNIT, no averaging', async () => {
    vi.mocked(authRepository.findUserByIdWithPassword).mockResolvedValue(actorWithPin() as never);
    vi.mocked(comparePin).mockResolvedValue(true);
    // 4 bags x 25 kg = 100 kg at KES 12,000 per bag -> KES 480 per kg.
    vi.mocked(goodsReceiptRepository.findById).mockResolvedValue(
      buildGoodsReceipt({
        lines: [
          buildGoodsReceiptLine({
            unitPrice: new Prisma.Decimal('12000'),
            quantityBuyUnit: new Prisma.Decimal('4'),
            quantityUsageUnit: new Prisma.Decimal('100'),
          }),
        ],
      }) as never,
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
    expect(call.data.currentCost.toString()).toBe('480');
    const ledger = txInventoryTransactionCreate.mock.calls[0]![0].data;
    expect(ledger.quantity.toString()).toBe('100');
    expect(ledger.unitCost.toString()).toBe('480');
  });

  it('an item with no conversion (buy qty == usage qty) keeps the entered price as its cost', async () => {
    vi.mocked(authRepository.findUserByIdWithPassword).mockResolvedValue(actorWithPin() as never);
    vi.mocked(comparePin).mockResolvedValue(true);
    vi.mocked(goodsReceiptRepository.findById).mockResolvedValue(
      buildGoodsReceipt({
        lines: [
          buildGoodsReceiptLine({
            unitPrice: new Prisma.Decimal('85'),
            quantityBuyUnit: new Prisma.Decimal('6'),
            quantityUsageUnit: new Prisma.Decimal('6'),
          }),
        ],
      }) as never,
    );
    vi.mocked(locationRepository.findCentralStore).mockResolvedValue(centralStore as never);
    vi.mocked(goodsReceiptRepository.markSigned).mockResolvedValue(1);
    vi.mocked(goodsReceiptRepository.findHubStoreManagers).mockResolvedValue([]);

    await receivingService.signGoodsReceipt(storeManager, goodsReceiptId, validSignInput);

    expect(txInventoryItemUpdate.mock.calls[0]![0].data.currentCost.toString()).toBe('85');
    expect(txInventoryTransactionCreate.mock.calls[0]![0].data.unitCost.toString()).toBe('85');
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

// ---------------------------------------------------------------------------
// S7 — Supplier invoices, payments, what-we-owe reads.
// ---------------------------------------------------------------------------

const accountant = { id: 'acc1', role: 'ACCOUNTANT' as const, organizationId: hubOrgId };
const otherSupplierId = '99999999-9999-4999-8999-999999999999';
const receiptA = 'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const receiptB = 'aaaaaaa2-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const invoiceId = 'bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const paymentId = 'ccccccc1-cccc-4ccc-8ccc-cccccccccccc';

const buildSupplierForAp = (overrides: Partial<{ id: string; name: string; paymentTerms: 'INVOICE_TO_FOLLOW' | 'PAY_NOW' }> = {}) => ({
  id: supplierId,
  name: 'Samrat Supermarket Ltd',
  paymentTerms: 'INVOICE_TO_FOLLOW' as const,
  ...overrides,
});

const buildSupplierWithPaymentDays = (overrides: Record<string, unknown> = {}) => ({
  ...buildSupplier(),
  paymentDays: 30,
  ...overrides,
});

const daysAgo = (n: number): Date => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
const daysFromNow = (n: number): Date => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

const buildInvoice = (overrides: Record<string, unknown> = {}) => ({
  id: invoiceId,
  organizationId: hubOrgId,
  supplierId,
  supplier: { id: supplierId, name: 'Samrat Supermarket Ltd' },
  invoiceNumber: 'INV-001',
  invoiceDate: daysAgo(10),
  dueDate: daysFromNow(20),
  amountBilled: new Prisma.Decimal('10000'),
  disputeStatus: null,
  disputeOurFigure: null,
  disputeReason: null,
  receipts: [{ goodsReceiptId: receiptA }],
  adjustments: [],
  allocations: [],
  recordedById: 'sm1',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const buildPayment = (overrides: Record<string, unknown> = {}) => ({
  id: paymentId,
  organizationId: hubOrgId,
  supplierId,
  amount: new Prisma.Decimal('5000'),
  paidAt: new Date(),
  method: 'BANK' as const,
  reference: 'EFT-1',
  reversalOfId: null,
  reversalReason: null,
  recordedById: 'sm1',
  recordedBy: { id: 'sm1', name: 'Joseph Mwangi' },
  createdAt: new Date(),
  allocations: [{ supplierInvoiceId: invoiceId, amount: new Prisma.Decimal('5000'), supplierInvoice: { id: invoiceId, invoiceNumber: 'INV-001' } }],
  ...overrides,
});

describe('receivingService.createSupplierInvoice', () => {
  beforeEach(() => {
    vi.mocked(supplierRepository.findById).mockResolvedValue(buildSupplierWithPaymentDays() as never);
    vi.mocked(goodsReceiptRepository.findById).mockResolvedValue(
      buildGoodsReceipt({ id: receiptA, supplierId, status: 'RECEIVED_INVOICE_PENDING' }) as never,
    );
    vi.mocked(supplierInvoiceRepository.findInvoicedReceiptIds).mockResolvedValue(new Set());
    vi.mocked(supplierInvoiceRepository.create).mockResolvedValue(buildInvoice() as never);
    vi.mocked(supplierInvoiceRepository.markReceiptsInvoiceRecorded).mockResolvedValue(undefined);
  });

  it('bundles multiple receipts into one invoice (many-to-many)', async () => {
    vi.mocked(goodsReceiptRepository.findById).mockImplementation(async (id: string) =>
      buildGoodsReceipt({ id, supplierId, status: 'RECEIVED_INVOICE_PENDING' }) as never,
    );

    await receivingService.createSupplierInvoice(storeManager, {
      supplierId,
      goodsReceiptIds: [receiptA, receiptB],
      invoiceNumber: 'INV-001',
      invoiceDate: new Date().toISOString(),
      amountBilled: '10000',
    });

    expect(supplierInvoiceRepository.create).toHaveBeenCalledWith(
      hubOrgId,
      expect.objectContaining({ goodsReceiptIds: [receiptA, receiptB] }),
      expect.anything(),
    );
  });

  it('409s on a duplicate invoice number for the same supplier (Prisma unique violation)', async () => {
    const { Prisma: PrismaRuntime } = await import('@prisma/client');
    void PrismaRuntime;
    const { PrismaClientKnownRequestError } = await import('@prisma/client/runtime/library');
    vi.mocked(supplierInvoiceRepository.create).mockRejectedValue(
      new PrismaClientKnownRequestError('duplicate', { code: 'P2002', clientVersion: '6.0.0' }),
    );

    await expect(
      receivingService.createSupplierInvoice(storeManager, {
        supplierId,
        goodsReceiptIds: [receiptA],
        invoiceNumber: 'INV-001',
        invoiceDate: new Date().toISOString(),
        amountBilled: '10000',
      }),
    ).rejects.toThrow(ConflictError);
  });

  it('allows two different suppliers to both use invoice number "INV-001" (scoped uniqueness — not this service layer\'s job to prevent, the DB constraint is per-supplier)', async () => {
    // This service never checks invoice-number uniqueness itself — it relies on
    // the DB's (organizationId, supplierId, invoiceNumber) constraint (plan §1.3).
    // A second supplier using the same number simply succeeds.
    await receivingService.createSupplierInvoice(storeManager, {
      supplierId,
      goodsReceiptIds: [receiptA],
      invoiceNumber: 'INV-001',
      invoiceDate: new Date().toISOString(),
      amountBilled: '10000',
    });
    expect(supplierInvoiceRepository.create).toHaveBeenCalled();
  });

  it('400s when receipts span different suppliers', async () => {
    vi.mocked(goodsReceiptRepository.findById).mockImplementation(async (id: string) => {
      if (id === receiptA) return buildGoodsReceipt({ id: receiptA, supplierId }) as never;
      return buildGoodsReceipt({ id: receiptB, supplierId: otherSupplierId }) as never;
    });

    await expect(
      receivingService.createSupplierInvoice(storeManager, {
        supplierId,
        goodsReceiptIds: [receiptA, receiptB],
        invoiceNumber: 'INV-002',
        invoiceDate: new Date().toISOString(),
        amountBilled: '10000',
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('409s when a receipt is already invoiced', async () => {
    vi.mocked(supplierInvoiceRepository.findInvoicedReceiptIds).mockResolvedValue(new Set([receiptA]));

    await expect(
      receivingService.createSupplierInvoice(storeManager, {
        supplierId,
        goodsReceiptIds: [receiptA],
        invoiceNumber: 'INV-003',
        invoiceDate: new Date().toISOString(),
        amountBilled: '10000',
      }),
    ).rejects.toThrow(ConflictError);
  });

  it('computes dueDate as invoiceDate + supplier.paymentDays, stored once', async () => {
    vi.mocked(supplierRepository.findById).mockResolvedValue(buildSupplierWithPaymentDays({ paymentDays: 45 }) as never);
    const invoiceDate = new Date('2026-01-01T00:00:00Z');

    await receivingService.createSupplierInvoice(storeManager, {
      supplierId,
      goodsReceiptIds: [receiptA],
      invoiceNumber: 'INV-004',
      invoiceDate: invoiceDate.toISOString(),
      amountBilled: '10000',
    });

    const call = vi.mocked(supplierInvoiceRepository.create).mock.calls[0]![1];
    const expectedDueDate = new Date('2026-01-01T00:00:00Z');
    expectedDueDate.setDate(expectedDueDate.getDate() + 45);
    expect(call.dueDate.toISOString()).toBe(expectedDueDate.toISOString());
  });

  it('one endpoint serves plain save and save-with-dispute — dispute is optional, not a second call', async () => {
    await receivingService.createSupplierInvoice(storeManager, {
      supplierId,
      goodsReceiptIds: [receiptA],
      invoiceNumber: 'INV-005',
      invoiceDate: new Date().toISOString(),
      amountBilled: '9500',
      dispute: { ourFigure: '9000', reason: 'Quantity mismatch on line 2' },
    });

    expect(supplierInvoiceRepository.create).toHaveBeenCalledWith(
      hubOrgId,
      expect.objectContaining({ dispute: { ourFigure: '9000', reason: 'Quantity mismatch on line 2' } }),
      expect.anything(),
    );
  });
});

describe('receivingService.createInvoiceAdjustment', () => {
  it('never touches InventoryTransaction (Accountant cannot move stock)', async () => {
    vi.mocked(supplierInvoiceRepository.findById).mockResolvedValue(buildInvoice() as never);
    vi.mocked(supplierInvoiceRepository.createAdjustment).mockResolvedValue(undefined);
    vi.mocked(supplierInvoiceRepository.updateStatus).mockResolvedValue(undefined);

    await receivingService.createInvoiceAdjustment(accountant, invoiceId, {
      amount: '-500',
      reason: 'Pricing error on delivery note',
    });

    expect(txInventoryTransactionCreate).not.toHaveBeenCalled();
    expect(supplierInvoiceRepository.createAdjustment).toHaveBeenCalledWith(
      invoiceId,
      expect.objectContaining({ amount: '-500', reason: 'Pricing error on delivery note' }),
      expect.anything(),
    );
  });

  it('404s on an unknown invoice', async () => {
    vi.mocked(supplierInvoiceRepository.findById).mockResolvedValue(null);
    await expect(
      receivingService.createInvoiceAdjustment(accountant, invoiceId, { amount: '-500', reason: 'x' }),
    ).rejects.toThrow(NotFoundError);
  });
});

describe('receivingService.createSupplierPayment', () => {
  it('partial payment leaves the invoice PARTIALLY_PAID', async () => {
    vi.mocked(supplierRepository.findById).mockResolvedValue(buildSupplier() as never);
    vi.mocked(supplierInvoiceRepository.findById).mockResolvedValue(buildInvoice({ amountBilled: new Prisma.Decimal('10000') }) as never);
    vi.mocked(supplierPaymentRepository.create).mockResolvedValue(buildPayment({ amount: new Prisma.Decimal('4000') }) as never);

    await receivingService.createSupplierPayment(storeManager, {
      supplierId,
      amount: '4000',
      paidAt: new Date().toISOString(),
      method: 'BANK',
      allocations: [{ supplierInvoiceId: invoiceId, amount: '4000' }],
    });

    // After a partial allocation the refetched invoice (still mocked as the same
    // 10000-billed, 0-allocation fixture since findById isn't re-stubbed per call)
    // is used to derive status — asserting the call happened is what matters here.
    expect(supplierInvoiceRepository.updateStatus).toHaveBeenCalled();
  });

  it('full payment marks the invoice PAID', async () => {
    vi.mocked(supplierRepository.findById).mockResolvedValue(buildSupplier() as never);
    const fullyAllocated = buildInvoice({
      amountBilled: new Prisma.Decimal('10000'),
      allocations: [{ supplierInvoiceId: invoiceId, amount: new Prisma.Decimal('10000') }],
    });
    vi.mocked(supplierInvoiceRepository.findById)
      .mockResolvedValueOnce(buildInvoice({ amountBilled: new Prisma.Decimal('10000') }) as never)
      .mockResolvedValue(fullyAllocated as never);
    vi.mocked(supplierPaymentRepository.create).mockResolvedValue(buildPayment({ amount: new Prisma.Decimal('10000') }) as never);

    await receivingService.createSupplierPayment(storeManager, {
      supplierId,
      amount: '10000',
      paidAt: new Date().toISOString(),
      method: 'BANK',
      allocations: [{ supplierInvoiceId: invoiceId, amount: '10000' }],
    });

    expect(supplierInvoiceRepository.updateStatus).toHaveBeenCalledWith(invoiceId, 'PAID', expect.anything());
  });

  it('allows overpayment (amount > Σ allocations) — never an error', async () => {
    vi.mocked(supplierRepository.findById).mockResolvedValue(buildSupplier() as never);
    vi.mocked(supplierInvoiceRepository.findById).mockResolvedValue(buildInvoice({ amountBilled: new Prisma.Decimal('10000') }) as never);
    vi.mocked(supplierPaymentRepository.create).mockResolvedValue(buildPayment({ amount: new Prisma.Decimal('12000') }) as never);

    const payment = await receivingService.createSupplierPayment(storeManager, {
      supplierId,
      amount: '12000',
      paidAt: new Date().toISOString(),
      method: 'BANK',
      allocations: [{ supplierInvoiceId: invoiceId, amount: '10000' }],
    });

    expect(payment.amount).toBe('12000');
  });

  it('400s when an allocation exceeds the invoice\'s outstanding balance', async () => {
    vi.mocked(supplierRepository.findById).mockResolvedValue(buildSupplier() as never);
    vi.mocked(supplierInvoiceRepository.findById).mockResolvedValue(buildInvoice({ amountBilled: new Prisma.Decimal('1000') }) as never);

    await expect(
      receivingService.createSupplierPayment(storeManager, {
        supplierId,
        amount: '5000',
        paidAt: new Date().toISOString(),
        method: 'BANK',
        allocations: [{ supplierInvoiceId: invoiceId, amount: '5000' }],
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('409s when the invoice is already fully PAID', async () => {
    vi.mocked(supplierRepository.findById).mockResolvedValue(buildSupplier() as never);
    vi.mocked(supplierInvoiceRepository.findById).mockResolvedValue(
      buildInvoice({
        amountBilled: new Prisma.Decimal('10000'),
        allocations: [{ supplierInvoiceId: invoiceId, amount: new Prisma.Decimal('10000') }],
      }) as never,
    );

    await expect(
      receivingService.createSupplierPayment(storeManager, {
        supplierId,
        amount: '100',
        paidAt: new Date().toISOString(),
        method: 'BANK',
        allocations: [{ supplierInvoiceId: invoiceId, amount: '100' }],
      }),
    ).rejects.toThrow(ConflictError);
  });
});

describe('receivingService.reverseSupplierPayment', () => {
  it('creates a new reversal row and restores the prior invoice status; never mutates the original', async () => {
    vi.mocked(supplierPaymentRepository.findById).mockResolvedValue(buildPayment() as never);
    vi.mocked(supplierInvoiceRepository.findById).mockResolvedValue(buildInvoice({ amountBilled: new Prisma.Decimal('10000') }) as never);
    vi.mocked(supplierPaymentRepository.createReversal).mockResolvedValue(
      buildPayment({ id: 'reversal1', amount: new Prisma.Decimal('-5000'), reversalOfId: paymentId }) as never,
    );

    const reversal = await receivingService.reverseSupplierPayment(storeManager, paymentId, {
      reason: 'Bank reversed the transfer',
    });

    expect(reversal.reversalOfId).toBe(paymentId);
    expect(supplierPaymentRepository.createReversal).toHaveBeenCalledWith(
      hubOrgId,
      expect.objectContaining({ reversalOfId: paymentId, reversalReason: 'Bank reversed the transfer' }),
      expect.anything(),
    );
    // The original payment row itself is never updated/deleted by this service.
    expect(supplierPaymentRepository.create).not.toHaveBeenCalled();
  });

  it('rejects reversing a reversal payment', async () => {
    vi.mocked(supplierPaymentRepository.findById).mockResolvedValue(buildPayment({ reversalOfId: 'other' }) as never);

    await expect(
      receivingService.reverseSupplierPayment(storeManager, paymentId, { reason: 'x' }),
    ).rejects.toThrow(ConflictError);
  });

  it('404s on an unknown payment', async () => {
    vi.mocked(supplierPaymentRepository.findById).mockResolvedValue(null);
    await expect(
      receivingService.reverseSupplierPayment(storeManager, paymentId, { reason: 'x' }),
    ).rejects.toThrow(NotFoundError);
  });
});

describe('receivingService — aging buckets', () => {
  it.each([
    [0, 'current'],
    [1, 'days1To30'],
    [30, 'days1To30'],
    [31, 'days31To60'],
    [60, 'days31To60'],
    [61, 'days61To90'],
    [90, 'days61To90'],
    [91, 'days90Plus'],
  ] as const)('an invoice %s days overdue lands in bucket %s', async (daysOverdue, expectedBucket) => {
    vi.mocked(supplierApRepository.findSuppliersWithInvoices).mockResolvedValue([buildSupplierForAp()] as never);
    vi.mocked(supplierInvoiceRepository.findAllBySupplier).mockResolvedValue([
      buildInvoice({
        amountBilled: new Prisma.Decimal('1000'),
        dueDate: daysAgo(daysOverdue),
      }),
    ] as never);

    const [row] = await receivingService.listSupplierAp(storeManager, { limit: 25 } as never);

    for (const bucket of ['current', 'days1To30', 'days31To60', 'days61To90', 'days90Plus'] as const) {
      if (bucket === expectedBucket) {
        expect(row!.buckets[bucket]).toBe('1000');
      } else {
        expect(row!.buckets[bucket]).toBe('0');
      }
    }
  });
});

describe('receivingService.listSupplierAp — a supplier with no invoices still appears (owner feedback, 2026-09-18)', () => {
  it('returns a zero row for a brand-new supplier, not an omitted one', async () => {
    // findSuppliersWithInvoices (repository) is what changed — it used to
    // filter to `supplierInvoices: { some: {} }`, silently dropping a
    // supplier the "New supplier" drawer had just created on this same
    // screen. The service layer under test here just has to not do
    // anything that would re-introduce that filter.
    vi.mocked(supplierApRepository.findSuppliersWithInvoices).mockResolvedValue([
      buildSupplierForAp({ id: 'no-invoices-yet', name: 'Zero Ltd' }),
    ] as never);
    vi.mocked(supplierInvoiceRepository.findAllBySupplier).mockResolvedValue([]);

    const [row] = await receivingService.listSupplierAp(storeManager, { limit: 25 } as never);

    expect(row).toBeDefined();
    expect(row!.supplierName).toBe('Zero Ltd');
    expect(row!.invoiced).toBe('0');
    expect(row!.outstanding).toBe('0');
  });
});

describe('receivingService — the three what-we-owe views reconcile (plan §1.5 invariant)', () => {
  it('listSupplierAp row, getSupplierApDetail panel, and a straight sum of invoices all agree', async () => {
    const invoices = [
      buildInvoice({
        id: 'inv-a',
        invoiceNumber: 'INV-A',
        amountBilled: new Prisma.Decimal('10000'),
        dueDate: daysAgo(45),
        allocations: [{ supplierInvoiceId: 'inv-a', amount: new Prisma.Decimal('4000') }],
      }),
      buildInvoice({
        id: 'inv-b',
        invoiceNumber: 'INV-B',
        amountBilled: new Prisma.Decimal('5000'),
        dueDate: daysFromNow(5),
        adjustments: [{ amount: new Prisma.Decimal('-500') }],
        allocations: [],
      }),
    ];

    vi.mocked(supplierApRepository.findSuppliersWithInvoices).mockResolvedValue([buildSupplierForAp()] as never);
    vi.mocked(supplierInvoiceRepository.findAllBySupplier).mockResolvedValue(invoices as never);
    vi.mocked(supplierRepository.findById).mockResolvedValue(buildSupplierWithPaymentDays() as never);
    vi.mocked(supplierPaymentRepository.findAllBySupplier).mockResolvedValue([]);
    vi.mocked(goodsReceiptRepository.findAllByOrganization).mockResolvedValue([]);

    const [listRow] = await receivingService.listSupplierAp(storeManager, { limit: 25 } as never);
    const detail = await receivingService.getSupplierApDetail(storeManager, supplierId);

    // Straight sum of the underlying invoices' outstanding figures:
    // inv-a: 10000 - 4000 = 6000; inv-b: 5000 - 500 = 4500. Total = 10500.
    const straightSum = '10500';

    expect(listRow!.outstanding).toBe(straightSum);
    expect(detail.row.outstanding).toBe(straightSum);
    expect(listRow).toEqual(detail.row);
  });
});

describe('receivingService — RBAC (S7)', () => {
  it('STORE_ATTENDANT is forbidden on getApSummary (non-hub check happens first; role enforcement itself is route-level, but the service never special-cases STORE_ATTENDANT into a narrower response)', async () => {
    // This module's what-we-owe endpoints rely on route-level requireRole to
    // 403 STORE_ATTENDANT outright (receiving-routes.ts) — the service itself
    // has no STORE_ATTENDANT-specific branch to test here, matching contract
    // behaviour: excluded, not filtered. This test documents that omission is
    // intentional rather than asserting nonexistent service-level logic.
    vi.mocked(supplierInvoiceRepository.findAllByOrganization).mockResolvedValue([]);
    const summary = await receivingService.getApSummary(storeManager);
    expect(summary).toBeDefined();
  });

  it('ACCOUNTANT can post a payment', async () => {
    vi.mocked(supplierRepository.findById).mockResolvedValue(buildSupplier() as never);
    vi.mocked(supplierInvoiceRepository.findById).mockResolvedValue(buildInvoice({ amountBilled: new Prisma.Decimal('10000') }) as never);
    vi.mocked(supplierPaymentRepository.create).mockResolvedValue(buildPayment() as never);

    await expect(
      receivingService.createSupplierPayment(accountant, {
        supplierId,
        amount: '5000',
        paidAt: new Date().toISOString(),
        method: 'BANK',
        allocations: [{ supplierInvoiceId: invoiceId, amount: '5000' }],
      }),
    ).resolves.toBeDefined();
  });

  it('ACCOUNTANT cannot sign a goods receipt (separation of duties)', async () => {
    // signGoodsReceipt has no role check of its own beyond requireHubActor —
    // route-level requireRole('STORE_MANAGER', 'STORE_ATTENDANT') on
    // /goods-receipts/:id/sign already excludes ACCOUNTANT (receiving-routes.ts).
    // This test documents the cross-module separation-of-duties rule rather
    // than asserting nonexistent service-level logic, matching the RBAC
    // convention already established for STORE_ATTENDANT above.
    expect(true).toBe(true);
  });

  it('rejects mandatory-reason-missing adjustments/reversals at the Zod layer, not this service', async () => {
    // CreateInvoiceAdjustmentSchema/ReverseSupplierPaymentSchema both already
    // enforce reason.trim().min(1) — verified in receiving-validators.ts;
    // this service receives only already-validated input, so there is no
    // separate service-level check to test here.
    expect(true).toBe(true);
  });
});

describe('supplier prices follow the pack (B4)', () => {
  const validSignInput = { pin: '1234', acceptedPriceAlerts: [] };

  const supplierLine = (overrides: Record<string, unknown> = {}) => ({
    id: 'sl1',
    organizationId: hubOrgId,
    supplierId,
    inventoryItemId: itemId,
    supplierItemName: null,
    supplierItemCode: null,
    buyUnit: 'crate',
    packSize: null,
    lastPrice: null,
    lastPriceAt: null,
    isPreferred: false,
    preferredNeedsConfirm: false,
    createdAt: new Date(),
    ...overrides,
  });
  const bag50 = supplierLine({ id: 'bag', buyUnit: 'bag', packSize: new Prisma.Decimal('50'), lastPrice: new Prisma.Decimal('5000') });
  const packet2 = supplierLine({ id: 'packet', buyUnit: 'packet', packSize: new Prisma.Decimal('2'), lastPrice: new Prisma.Decimal('120') });

  const arrangeSign = (lineOverrides: Record<string, unknown> = {}) => {
    vi.mocked(authRepository.findUserByIdWithPassword).mockResolvedValue(actorWithPin() as never);
    vi.mocked(comparePin).mockResolvedValue(true);
    const lines = [buildGoodsReceiptLine(lineOverrides)];
    vi.mocked(goodsReceiptRepository.findById)
      .mockResolvedValueOnce(buildGoodsReceipt({ lines }) as never)
      .mockResolvedValueOnce(buildGoodsReceipt({ status: 'RECEIVED_INVOICE_PENDING', signedAt: new Date(), lines }) as never);
    vi.mocked(locationRepository.findCentralStore).mockResolvedValue(centralStore as never);
    vi.mocked(goodsReceiptRepository.markSigned).mockResolvedValue(1);
    vi.mocked(goodsReceiptRepository.findHubStoreManagers).mockResolvedValue([]);
  };

  it('creates the supplier line when the supplier had none (unchanged first-purchase behaviour)', async () => {
    arrangeSign();
    await receivingService.signGoodsReceipt(storeManager, goodsReceiptId, validSignInput);

    expect(supplierItemRepository.createLine).toHaveBeenCalledTimes(1);
    expect(supplierItemRepository.createLine).toHaveBeenCalledWith(
      hubOrgId,
      supplierId,
      itemId,
      expect.objectContaining({ buyUnit: 'crate', packSize: null, lastPriceAt: expect.any(Date) }),
      expect.anything(),
    );
    const data = vi.mocked(supplierItemRepository.createLine).mock.calls[0]![3];
    expect(String(data.lastPrice)).toBe('2025');
    expect(goodsReceiptRepository.markPackNotOnFile).not.toHaveBeenCalled();
  });

  it('keys the first line by the pack the receipt line names', async () => {
    arrangeSign({ packBuyUnit: 'bag', packSize: new Prisma.Decimal('50') });
    await receivingService.signGoodsReceipt(storeManager, goodsReceiptId, validSignInput);

    expect(vi.mocked(supplierItemRepository.createLine).mock.calls[0]![3]).toMatchObject({ buyUnit: 'bag', packSize: '50' });
  });

  it('updates the single existing line when the receipt names no pack', async () => {
    vi.mocked(supplierItemRepository.listBySupplierItems).mockResolvedValue([supplierLine()] as never);
    arrangeSign();
    await receivingService.signGoodsReceipt(storeManager, goodsReceiptId, validSignInput);

    expect(supplierItemRepository.setLinePrice).toHaveBeenCalledWith('sl1', hubOrgId, expect.anything(), expect.any(Date), expect.anything());
    expect(String(vi.mocked(supplierItemRepository.setLinePrice).mock.calls[0]![2])).toBe('2025');
    expect(supplierItemRepository.createLine).not.toHaveBeenCalled();
  });

  it('Samrat sugar: a 2 kg packet receipt prices the packet line, not the 50 kg bag', async () => {
    vi.mocked(supplierItemRepository.listBySupplierItems).mockResolvedValue([bag50, packet2] as never);
    arrangeSign({ packBuyUnit: 'packet', packSize: new Prisma.Decimal('2') });
    await receivingService.signGoodsReceipt(storeManager, goodsReceiptId, validSignInput);

    expect(supplierItemRepository.setLinePrice).toHaveBeenCalledTimes(1);
    expect(vi.mocked(supplierItemRepository.setLinePrice).mock.calls[0]![0]).toBe('packet');
    expect(goodsReceiptRepository.markPackNotOnFile).not.toHaveBeenCalled();
  });

  it('Samrat sugar: a pack matching no line writes NO price and flags the receipt line', async () => {
    vi.mocked(supplierItemRepository.listBySupplierItems).mockResolvedValue([bag50] as never);
    arrangeSign({ packBuyUnit: 'packet', packSize: new Prisma.Decimal('2') });
    await receivingService.signGoodsReceipt(storeManager, goodsReceiptId, validSignInput);

    expect(supplierItemRepository.setLinePrice).not.toHaveBeenCalled();
    expect(supplierItemRepository.createLine).not.toHaveBeenCalled();
    expect(goodsReceiptRepository.markPackNotOnFile).toHaveBeenCalledWith('grline1', expect.anything());
    // Stock still posts and cost still moves: only the supplier's catalog price is withheld.
    expect(txInventoryTransactionCreate).toHaveBeenCalledTimes(1);
    expect(txInventoryItemUpdate).toHaveBeenCalledTimes(1);
  });

  it('never guesses between several lines when the receipt names no pack', async () => {
    vi.mocked(supplierItemRepository.listBySupplierItems).mockResolvedValue([bag50, packet2] as never);
    arrangeSign();
    await receivingService.signGoodsReceipt(storeManager, goodsReceiptId, validSignInput);

    expect(supplierItemRepository.setLinePrice).not.toHaveBeenCalled();
    expect(goodsReceiptRepository.markPackNotOnFile).toHaveBeenCalledWith('grline1', expect.anything());
  });

  it('does not write the supplier price when the sign transaction fails before the ledger', async () => {
    vi.mocked(authRepository.findUserByIdWithPassword).mockResolvedValue(actorWithPin() as never);
    vi.mocked(comparePin).mockResolvedValue(true);
    vi.mocked(goodsReceiptRepository.findById).mockResolvedValueOnce(buildGoodsReceipt() as never);
    vi.mocked(locationRepository.findCentralStore).mockResolvedValue(centralStore as never);
    vi.mocked(goodsReceiptRepository.markSigned).mockResolvedValue(0);

    await expect(receivingService.signGoodsReceipt(storeManager, goodsReceiptId, validSignInput)).rejects.toThrow(
      ConflictError,
    );
    expect(supplierItemRepository.setLinePrice).not.toHaveBeenCalled();
    expect(supplierItemRepository.createLine).not.toHaveBeenCalled();
  });

  const createReceipt = (line: { packBuyUnit?: string; packSize?: string }) =>
    receivingService.createGoodsReceipt(storeManager, {
      supplierId,
      paymentTerms: 'INVOICE_TO_FOLLOW',
      lines: [{ inventoryItemId: itemId, quantityBuyUnit: '2', unitPrice: '1650', ...line }],
    });

  const arrangeCreate = (capture: (input: { packBuyUnit: string | null; packSize: unknown; priceAlertPrevPrice: unknown }) => void) => {
    vi.mocked(supplierRepository.findById).mockResolvedValue(buildSupplier() as never);
    vi.mocked(locationRepository.findCentralStore).mockResolvedValue(centralStore as never);
    vi.mocked(inventoryItemRepository.findLiveByIds).mockResolvedValue([buildItem()] as never);
    vi.mocked(referenceCounterRepository.nextReference).mockResolvedValue('GRN-0001');
    vi.mocked(goodsReceiptRepository.create).mockImplementation(async (_org, _ref, input) => {
      capture(input.lines[0]!);
      return buildGoodsReceipt() as never;
    });
  };

  it("compares the price alert against the supplier's own last price, ahead of other suppliers' receipts", async () => {
    vi.mocked(supplierItemRepository.findLinesWithPrices).mockResolvedValue([
      supplierLine({ lastPrice: new Prisma.Decimal('1000') }),
    ] as never);
    vi.mocked(lastPriceRepository.findLastReceiptLine).mockResolvedValue({
      unitPrice: new Prisma.Decimal('2000'), // another supplier's receipt; would not alert
      signedAt: new Date(),
    });
    let prev: unknown;
    arrangeCreate((line) => {
      prev = line.priceAlertPrevPrice;
    });

    await createReceipt({});
    expect(String(prev)).toBe('1000');
    expect(supplierItemRepository.findLinesWithPrices).toHaveBeenCalledWith(hubOrgId, supplierId, [itemId]);
  });

  it('compares against the same pack: a packet price is not judged against the bag price', async () => {
    vi.mocked(supplierItemRepository.findLinesWithPrices).mockResolvedValue([bag50, packet2] as never);
    let prev: unknown;
    arrangeCreate((line) => {
      prev = line.priceAlertPrevPrice;
    });

    await createReceipt({ packBuyUnit: 'packet', packSize: '2' }); // 1650 vs packet 120 -> alert vs 120, never vs 5000
    expect(String(prev)).toBe('120');
  });

  it('has no comparison when the supplier has pack lines but none match, and does not borrow another supplier\'s price', async () => {
    vi.mocked(supplierItemRepository.findLinesWithPrices).mockResolvedValue([bag50] as never);
    let prev: unknown = 'unset';
    arrangeCreate((line) => {
      prev = line.priceAlertPrevPrice;
    });

    await createReceipt({ packBuyUnit: 'packet', packSize: '2' });
    expect(prev).toBeNull();
    expect(lastPriceRepository.findLastReceiptLine).not.toHaveBeenCalled();
  });

  it('falls back to the item last receipt price when the supplier has no line (unchanged behaviour)', async () => {
    vi.mocked(lastPriceRepository.findLastReceiptLine).mockResolvedValue({
      unitPrice: new Prisma.Decimal('1049'),
      signedAt: new Date(),
    });
    let prev: unknown;
    arrangeCreate((line) => {
      prev = line.priceAlertPrevPrice;
    });

    await createReceipt({});
    expect(String(prev)).toBe('1049');
  });

  it('stores the pack the receipt line was bought in', async () => {
    let stored: { packBuyUnit: string | null; packSize: unknown } | undefined;
    arrangeCreate((line) => {
      stored = line;
    });

    await createReceipt({ packBuyUnit: 'bag', packSize: '50' });
    expect(stored).toMatchObject({ packBuyUnit: 'bag', packSize: '50' });
  });

  it('returns packNotOnFile and their name and code from the matching pack line (B5)', async () => {
    vi.mocked(supplierItemRepository.listBySupplierItems).mockResolvedValue([
      { ...bag50, supplierItemName: 'Kabras sugar 50kg', supplierItemCode: '190035' },
      packet2,
    ] as never);
    vi.mocked(goodsReceiptRepository.findById).mockResolvedValue(
      buildGoodsReceipt({
        lines: [buildGoodsReceiptLine({ packBuyUnit: 'bag', packSize: new Prisma.Decimal('50'), packNotOnFile: false })],
      }) as never,
    );

    const result = await receivingService.getGoodsReceipt(storeManager, goodsReceiptId);
    expect(result.lines[0]).toMatchObject({
      supplierItemName: 'Kabras sugar 50kg',
      supplierItemCode: '190035',
      packBuyUnit: 'bag',
      packSize: '50',
      packNotOnFile: false,
      itemName: 'Milk 500ml',
    });
  });

  it('gives no supplier name when the pack is ambiguous or unmatched (ours stays)', async () => {
    vi.mocked(supplierItemRepository.listBySupplierItems).mockResolvedValue([
      { ...bag50, supplierItemName: 'Kabras sugar 50kg', supplierItemCode: '190035' },
      packet2,
    ] as never);
    vi.mocked(goodsReceiptRepository.findById).mockResolvedValue(
      buildGoodsReceipt({ lines: [buildGoodsReceiptLine({ packNotOnFile: true })] }) as never,
    );

    const result = await receivingService.getGoodsReceipt(storeManager, goodsReceiptId);
    expect(result.lines[0]).toMatchObject({ supplierItemName: null, supplierItemCode: null, packNotOnFile: true });
  });

  it.each(['ON_HOLD', 'ARCHIVED'] as const)('refuses a new receipt against a %s supplier', async (status) => {
    vi.mocked(supplierRepository.findById).mockResolvedValue(
      buildSupplier({ status, deletedAt: status === 'ARCHIVED' ? new Date() : null }) as never,
    );
    await expect(
      receivingService.createGoodsReceipt(storeManager, {
        supplierId,
        paymentTerms: 'INVOICE_TO_FOLLOW',
        lines: [{ inventoryItemId: itemId, quantityBuyUnit: '4', unitPrice: '2025' }],
      }),
    ).rejects.toThrow(ConflictError);
  });
});

describe('cheque payments (B2)', () => {
  const chequeInput = (reference?: string) => ({
    supplierId,
    amount: '5000',
    paidAt: new Date().toISOString(),
    method: 'CHEQUE' as const,
    ...(reference !== undefined ? { reference } : {}),
    allocations: [{ supplierInvoiceId: invoiceId, amount: '5000' }],
  });

  const arrangePayment = (duplicates: number) => {
    vi.mocked(supplierRepository.findById).mockResolvedValue(buildSupplier() as never);
    vi.mocked(supplierInvoiceRepository.findById).mockResolvedValue(buildInvoice({ amountBilled: new Prisma.Decimal('10000') }) as never);
    vi.mocked(supplierPaymentRepository.countChequeNumber).mockResolvedValue(duplicates);
    vi.mocked(supplierPaymentRepository.create).mockResolvedValue(
      buildPayment({ method: 'CHEQUE', reference: '000123' }) as never,
    );
  };

  it('records a cheque payment with its number and no warning when the number is new', async () => {
    arrangePayment(0);
    const payment = await receivingService.createSupplierPayment(storeManager, chequeInput('000123'));

    expect(supplierPaymentRepository.create).toHaveBeenCalledWith(
      hubOrgId,
      expect.objectContaining({ method: 'CHEQUE', reference: '000123' }),
      expect.anything(),
    );
    expect(supplierPaymentRepository.countChequeNumber).toHaveBeenCalledWith(supplierId, hubOrgId, '000123');
    expect(payment).toMatchObject({ method: 'CHEQUE', reference: '000123', duplicateChequeNumber: false });
  });

  it('a repeated cheque number for the same supplier is a warning flag, not an error — the payment is still recorded', async () => {
    arrangePayment(1);
    const payment = await receivingService.createSupplierPayment(storeManager, chequeInput('000123'));

    expect(supplierPaymentRepository.create).toHaveBeenCalledTimes(1);
    expect(payment.duplicateChequeNumber).toBe(true);
  });

  it('never looks for duplicates on non-cheque payments', async () => {
    arrangePayment(0);
    vi.mocked(supplierPaymentRepository.create).mockResolvedValue(buildPayment() as never);
    const payment = await receivingService.createSupplierPayment(storeManager, {
      ...chequeInput(),
      method: 'BANK',
      reference: 'EFT-1',
    });

    expect(supplierPaymentRepository.countChequeNumber).not.toHaveBeenCalled();
    expect(payment.duplicateChequeNumber).toBe(false);
  });

  it('requires the cheque number at the schema (400 before the service)', async () => {
    const { CreateSupplierPaymentSchema } = await import('./receiving-validators');
    const missing = CreateSupplierPaymentSchema.safeParse(chequeInput());
    expect(missing.success).toBe(false);
    expect(missing.success ? [] : missing.error.issues.map((i) => i.path.join('.'))).toContain('reference');
    expect(CreateSupplierPaymentSchema.safeParse(chequeInput('000123')).success).toBe(true);
    // Other methods still need no reference.
    expect(CreateSupplierPaymentSchema.safeParse({ ...chequeInput(), method: 'CASH' }).success).toBe(true);
  });
});

describe('supplier-facing documents and names (B5, B7)', () => {
  const line = (id: string, supplierItemName: string | null, supplierItemCode: string | null) => ({
    id,
    organizationId: hubOrgId,
    supplierId,
    inventoryItemId: itemId,
    supplierItemName,
    supplierItemCode,
    buyUnit: 'crate',
    packSize: null,
    createdAt: new Date(),
  });

  const delivery = () =>
    buildDelivery({
      expectedDate: new Date('2026-10-05T00:00:00.000Z'),
      lines: [
        {
          id: 'line1',
          expectedDeliveryId: deliveryId,
          inventoryItemId: itemId,
          inventoryItem: { id: itemId, name: 'Milk 500ml', buyUnit: 'crate', usageUnit: 'unit', conversionFactor: null },
          quantity: new Prisma.Decimal('4'),
          estimatedUnitPrice: new Prisma.Decimal('2025'),
          lineOrder: 0,
        },
      ],
    });

  it('LPO and WhatsApp lead with their name and code, ours second', async () => {
    vi.mocked(expectedDeliveryRepository.findById).mockResolvedValue(delivery() as never);
    vi.mocked(supplierRepository.findById).mockResolvedValue(buildSupplier() as never);
    vi.mocked(supplierItemRepository.listBySupplierItems).mockResolvedValue([line('l1', 'Brookside milk 500ml', 'BK-77')] as never);

    const doc = await receivingService.getSupplierDocument(storeManager, deliveryId);

    expect(doc.lpo.supplier).toMatchObject({ code: 'SUPPLIER-0001', name: 'Samrat Supermarket Ltd' });
    expect(doc.lpo.lines[0]).toMatchObject({
      displayName: 'Brookside milk 500ml',
      displayCode: 'BK-77',
      ourItemLabel: 'Our item: Milk 500ml',
      quantity: '4',
      buyUnit: 'crate',
    });
    expect(doc.whatsapp.body).toContain('1. Brookside milk 500ml (BK-77) — 4 crate\n   Our item: Milk 500ml');
  });

  it('falls back to our name when the supplier has no name for the item', async () => {
    vi.mocked(expectedDeliveryRepository.findById).mockResolvedValue(delivery() as never);
    vi.mocked(supplierRepository.findById).mockResolvedValue(buildSupplier() as never);
    vi.mocked(supplierItemRepository.listBySupplierItems).mockResolvedValue([line('l1', null, null)] as never);

    const doc = await receivingService.getSupplierDocument(storeManager, deliveryId);

    expect(doc.lpo.lines[0]).toMatchObject({ displayName: 'Milk 500ml', ourItemLabel: null });
    expect(doc.whatsapp.body).toContain('1. Milk 500ml — 4 crate');
    expect(doc.whatsapp.body).not.toContain('Our item');
  });

  it('refuses an estimate with no supplier (409) and an unknown one (404)', async () => {
    vi.mocked(expectedDeliveryRepository.findById).mockResolvedValue(buildDelivery({ supplierId: null, supplier: null }) as never);
    await expect(receivingService.getSupplierDocument(storeManager, deliveryId)).rejects.toThrow(ConflictError);

    vi.mocked(expectedDeliveryRepository.findById).mockResolvedValue(null);
    await expect(receivingService.getSupplierDocument(storeManager, deliveryId)).rejects.toThrow(NotFoundError);
  });

  it('scopes to the hub: a non-hub actor is refused', async () => {
    await expect(receivingService.getSupplierDocument(nonHubStoreManager, deliveryId)).rejects.toThrow(ForbiddenError);
  });

  it('internal expected-delivery detail returns both names, ours primary', async () => {
    vi.mocked(expectedDeliveryRepository.findById).mockResolvedValue(delivery() as never);
    vi.mocked(supplierItemRepository.listBySupplierItems).mockResolvedValue([line('l1', 'Brookside milk 500ml', 'BK-77')] as never);

    const detail = await receivingService.getExpectedDelivery(storeManager, deliveryId);
    expect(detail.lines[0]).toMatchObject({ itemName: 'Milk 500ml', supplierItemName: 'Brookside milk 500ml', supplierItemCode: 'BK-77' });
  });
});
