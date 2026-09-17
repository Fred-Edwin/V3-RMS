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
import { expectedDeliveryRepository, recentSupplierItemsRepository, referenceCounterRepository } from './receiving-repository';
import { inventoryItemRepository, supplierRepository } from './inventory-repository';
import { branchRepository } from '../../repositories/branch-repository';
import {
  ExpectedDeliverySummarySchema,
  PurchasingHistoryRowSchema,
  PurchasingSummarySchema,
  RecentSupplierItemSchema,
} from './receiving-validators';

vi.mock('./receiving-repository', () => ({
  expectedDeliveryRepository: {
    findAllByOrganization: vi.fn(),
    create: vi.fn(),
    countByStatus: vi.fn(),
    countOverdue: vi.fn(),
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

    const [row] = await receivingService.getPurchasingHistory(storeManager, { limit: 25 });
    expect(() => PurchasingHistoryRowSchema.parse(row)).not.toThrow();
    expect(row!.type).toBe('expectedDelivery');
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
