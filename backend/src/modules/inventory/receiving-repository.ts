import { Prisma, type ExpectedDelivery, type ExpectedDeliveryLine, type ExpectedDeliveryStatus } from '@prisma/client';
import { prisma } from '../../config/database';

type TxClient = Prisma.TransactionClient;
type Client = typeof prisma | TxClient;

// ---------------------------------------------------------------------------
// Reference numbers — gap-free per (organization, prefix), incremented inside
// the same transaction as the document it numbers (plan §1.7).
// ---------------------------------------------------------------------------

export const referenceCounterRepository = {
  /** Must run inside the same `$transaction` as the create it numbers. */
  nextReference: async (tx: TxClient, organizationId: string, prefix: string, pad = 4): Promise<string> => {
    const counter = await tx.referenceCounter.upsert({
      where: { organizationId_prefix: { organizationId, prefix } },
      update: { lastNumber: { increment: 1 } },
      create: { organizationId, prefix, lastNumber: 1 },
      select: { lastNumber: true },
    });
    return `${prefix}-${String(counter.lastNumber).padStart(pad, '0')}`;
  },
};

// ---------------------------------------------------------------------------
// Expected deliveries (Stage 1 — estimates)
// ---------------------------------------------------------------------------

export type ExpectedDeliveryWithRelations = ExpectedDelivery & {
  supplier: { id: string; name: string };
  lines: (ExpectedDeliveryLine & { inventoryItem: { id: string; name: string; buyUnit: string } })[];
};

export type CreateExpectedDeliveryInput = {
  supplierId: string;
  paymentTerms: 'INVOICE_TO_FOLLOW' | 'PAY_NOW';
  expectedDate: Date | null;
  createdById: string;
  lines: { inventoryItemId: string; quantity: Prisma.Decimal.Value; estimatedUnitPrice: Prisma.Decimal.Value }[];
};

export type ListExpectedDeliveriesFilters = {
  status?: ExpectedDeliveryStatus;
  supplierId?: string;
  search?: string;
  limit: number;
  cursor?: string;
};

const expectedDeliveryInclude = {
  supplier: { select: { id: true, name: true } },
  lines: {
    include: { inventoryItem: { select: { id: true, name: true, buyUnit: true } } },
    orderBy: { lineOrder: 'asc' },
  },
} satisfies Prisma.ExpectedDeliveryInclude;

export const expectedDeliveryRepository = {
  findAllByOrganization: async (
    organizationId: string,
    filters: ListExpectedDeliveriesFilters,
  ): Promise<ExpectedDeliveryWithRelations[]> => {
    const where: Prisma.ExpectedDeliveryWhereInput = {
      organizationId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.supplierId ? { supplierId: filters.supplierId } : {}),
      ...(filters.search ? { supplier: { name: { contains: filters.search, mode: 'insensitive' } } } : {}),
    };

    return prisma.expectedDelivery.findMany({
      where,
      include: expectedDeliveryInclude,
      orderBy: { createdAt: 'desc' },
      take: filters.limit,
      ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
    });
  },

  findById: async (
    id: string,
    organizationId: string,
    client: Client = prisma,
  ): Promise<ExpectedDeliveryWithRelations | null> => {
    return client.expectedDelivery.findFirst({ where: { id, organizationId }, include: expectedDeliveryInclude });
  },

  create: async (
    organizationId: string,
    reference: string,
    input: CreateExpectedDeliveryInput,
    tx: TxClient,
  ): Promise<ExpectedDeliveryWithRelations> => {
    const estimatedTotal = input.lines.reduce(
      (sum, line) => sum.plus(new Prisma.Decimal(line.quantity).times(new Prisma.Decimal(line.estimatedUnitPrice))),
      new Prisma.Decimal(0),
    );

    return tx.expectedDelivery.create({
      data: {
        organizationId,
        reference,
        supplierId: input.supplierId,
        paymentTerms: input.paymentTerms,
        expectedDate: input.expectedDate,
        estimatedTotal,
        createdById: input.createdById,
        lines: {
          createMany: {
            data: input.lines.map((line, index) => ({
              inventoryItemId: line.inventoryItemId,
              quantity: new Prisma.Decimal(line.quantity),
              estimatedUnitPrice: new Prisma.Decimal(line.estimatedUnitPrice),
              lineOrder: index,
            })),
          },
        },
      },
      include: expectedDeliveryInclude,
    });
  },

  cancel: async (id: string, organizationId: string): Promise<ExpectedDeliveryWithRelations | null> => {
    const updated = await prisma.expectedDelivery.updateMany({
      where: { id, organizationId, status: 'AWAITING' },
      data: { status: 'CANCELLED' },
    });
    if (updated.count === 0) return null;
    return expectedDeliveryRepository.findById(id, organizationId);
  },

  // ── Purchasing hub summary + history ────────────────────────────────────

  countByStatus: async (organizationId: string, status: ExpectedDeliveryStatus): Promise<number> => {
    return prisma.expectedDelivery.count({ where: { organizationId, status } });
  },

  countOverdue: async (organizationId: string, now: Date): Promise<number> => {
    return prisma.expectedDelivery.count({
      where: { organizationId, status: 'AWAITING', expectedDate: { lt: now } },
    });
  },

  /** History band's ExpectedDelivery half of the union query (plan §3.2 — the GoodsReceipt half lands in S4). */
  findHistoryRows: async (
    organizationId: string,
    filters: { search?: string; supplierId?: string; status?: ExpectedDeliveryStatus; from?: Date; to?: Date; limit: number },
  ): Promise<ExpectedDeliveryWithRelations[]> => {
    const where: Prisma.ExpectedDeliveryWhereInput = {
      organizationId,
      ...(filters.supplierId ? { supplierId: filters.supplierId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.search ? { supplier: { name: { contains: filters.search, mode: 'insensitive' } } } : {}),
      ...(filters.from || filters.to
        ? { createdAt: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } }
        : {}),
    };

    return prisma.expectedDelivery.findMany({
      where,
      include: expectedDeliveryInclude,
      orderBy: { createdAt: 'desc' },
      take: filters.limit,
    });
  },
};

// ---------------------------------------------------------------------------
// Recent items by supplier — feeds the New-purchase item combobox's
// "Recently purchased from this supplier" section (2026-09-17 UI refinement,
// see receiving-validators.ts's AMENDMENT comment on RecentSupplierItemsQuerySchema).
// Sourced from ExpectedDeliveryLine, not GoodsReceiptLine: GoodsReceipt has no
// real signed data yet (S4 hasn't shipped), while ExpectedDeliveryLine already
// has real seeded rows this milestone owns.
// ---------------------------------------------------------------------------

export const recentSupplierItemsRepository = {
  /**
   * Most-recently-purchased distinct items for a supplier, newest first.
   * Dedup is done in application code rather than a Prisma `groupBy` (which
   * can't also return "the most recent row's price/date per group" without
   * a second query) — per-supplier line counts are small enough (tens of
   * rows) that fetching a generous window and deduping in memory is simpler
   * than a raw SQL window-function query, and cheap at this data volume.
   */
  findRecentBySupplier: async (
    organizationId: string,
    supplierId: string,
    limit: number,
  ): Promise<{ inventoryItemId: string; itemName: string; buyUnit: string; lastUnitPrice: Prisma.Decimal; lastPurchasedAt: Date }[]> => {
    const lines = await prisma.expectedDeliveryLine.findMany({
      where: { expectedDelivery: { organizationId, supplierId } },
      include: {
        inventoryItem: { select: { id: true, name: true, buyUnit: true } },
        expectedDelivery: { select: { createdAt: true } },
      },
      orderBy: { expectedDelivery: { createdAt: 'desc' } },
      take: limit * 5, // generous window to dedupe from — a supplier with few distinct items exhausts this fast
    });

    const seen = new Set<string>();
    const result: { inventoryItemId: string; itemName: string; buyUnit: string; lastUnitPrice: Prisma.Decimal; lastPurchasedAt: Date }[] = [];
    for (const line of lines) {
      if (seen.has(line.inventoryItemId)) continue;
      seen.add(line.inventoryItemId);
      result.push({
        inventoryItemId: line.inventoryItemId,
        itemName: line.inventoryItem.name,
        buyUnit: line.inventoryItem.buyUnit,
        lastUnitPrice: line.estimatedUnitPrice,
        lastPurchasedAt: line.expectedDelivery.createdAt,
      });
      if (result.length === limit) break;
    }
    return result;
  },
};

// ---------------------------------------------------------------------------
// Last-price lookup — feeds the price-alert comparison and the New-purchase
// drawer's "Last purchase 2 Sep · KES 6,410" reference (plan §3.2). Reads only
// InventoryItem + GoodsReceiptLine (no new-model dependency): the receipt
// line's buy-unit `unitPrice` is the invoiced figure a new estimate/receipt
// compares against, not the ledger's usage-unit `unitCost`.
// ---------------------------------------------------------------------------

export const lastPriceRepository = {
  /** Most recent signed goods-receipt line for this item, if any. */
  findLastReceiptLine: async (
    inventoryItemId: string,
    organizationId: string,
  ): Promise<{ unitPrice: Prisma.Decimal; signedAt: Date } | null> => {
    const line = await prisma.goodsReceiptLine.findFirst({
      where: {
        inventoryItemId,
        goodsReceipt: { organizationId, signedAt: { not: null } },
      },
      orderBy: { goodsReceipt: { signedAt: 'desc' } },
      select: { unitPrice: true, goodsReceipt: { select: { signedAt: true } } },
    });
    if (!line || !line.goodsReceipt.signedAt) return null;
    return { unitPrice: line.unitPrice, signedAt: line.goodsReceipt.signedAt };
  },
};
