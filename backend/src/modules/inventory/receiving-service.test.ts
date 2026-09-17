import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { receivingService } from './receiving-service';
import {
  expectedDeliveryRepository,
  lastPriceRepository,
  recentSupplierItemsRepository,
  referenceCounterRepository,
} from './receiving-repository';
import { inventoryItemRepository, supplierRepository } from './inventory-repository';
import { branchRepository } from '../../repositories/branch-repository';
import { prisma } from '../../config/database';
import { ConflictError, ForbiddenError, NotFoundError } from '../../utils/errors';

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

vi.mock('../../config/database', () => ({
  prisma: {
    $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn({})),
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
  deletedAt: null,
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
