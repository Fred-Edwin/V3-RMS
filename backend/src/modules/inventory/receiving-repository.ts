import {
  Prisma,
  type ExpectedDelivery,
  type ExpectedDeliveryLine,
  type ExpectedDeliveryStatus,
  type GoodsReceipt,
  type GoodsReceiptLine,
  type GoodsReceiptStatus,
} from '@prisma/client';
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
  // Nullable in lockstep with the FK (AMENDMENT 2026-09-17 — supplier is optional).
  supplier: { id: string; name: string } | null;
  lines: (ExpectedDeliveryLine & {
    inventoryItem: { id: string; name: string; buyUnit: string; usageUnit: string; conversionFactor: Prisma.Decimal | null };
  })[];
};

export type CreateExpectedDeliveryInput = {
  /** Optional (AMENDMENT 2026-09-17) — see receiving-validators.ts header. */
  supplierId?: string;
  paymentTerms?: 'INVOICE_TO_FOLLOW' | 'PAY_NOW';
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
    include: {
      inventoryItem: { select: { id: true, name: true, buyUnit: true, usageUnit: true, conversionFactor: true } },
    },
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
        supplierId: input.supplierId ?? null,
        paymentTerms: input.paymentTerms ?? null,
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

  /**
   * Called from inside `signGoodsReceipt`'s transaction when the receipt
   * being signed is linked to an expected delivery — the moment stock
   * actually lands is the moment the estimate it was expected against is
   * done. `where: { status: 'AWAITING' }` makes this a no-op (0 rows) if the
   * delivery was already fulfilled/cancelled by some other path; the caller
   * doesn't need the result, this never blocks or fails the sign.
   */
  markFulfilled: async (id: string, organizationId: string, tx: TxClient): Promise<void> => {
    await tx.expectedDelivery.updateMany({
      where: { id, organizationId, status: 'AWAITING' },
      data: { status: 'FULFILLED' },
    });
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

  /**
   * History band's ExpectedDelivery half of the union query (plan §3.2). The
   * GoodsReceipt half is `goodsReceiptRepository.findHistoryRows` (2026-09-18
   * amendment). `cursor` added alongside that amendment — the Purchasing
   * hub's own `getPurchasingHistory` still uses this without a cursor
   * (limit-bump, a known gap noted on `use-purchasing-history-list.ts`); the
   * new `getReceivingHistory` service method is what actually passes one.
   */
  findHistoryRows: async (
    organizationId: string,
    filters: {
      search?: string;
      supplierId?: string;
      status?: ExpectedDeliveryStatus;
      from?: Date;
      to?: Date;
      limit: number;
      cursor?: string;
    },
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
      ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
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

// ---------------------------------------------------------------------------
// Goods receipts (Stage 2 — S4). The ledger write itself (InventoryTransaction
// rows + InventoryItem.currentCost) happens in the service's sign transaction,
// not here — this repository only owns the GoodsReceipt/-Line rows.
// ---------------------------------------------------------------------------

export type GoodsReceiptWithRelations = GoodsReceipt & {
  supplier: { id: string; name: string };
  signedBy: { id: string; name: string; role: string } | null;
  createdBy: { id: string; name: string };
  lines: (GoodsReceiptLine & {
    inventoryItem: { id: string; name: string; buyUnit: string; usageUnit: string };
    priceAlertAcceptedBy: { id: string; name: string } | null;
  })[];
  invoices: { supplierInvoice: { id: string; invoiceNumber: string } }[];
};

export type GoodsReceiptLineInput = {
  inventoryItemId: string;
  quantityBuyUnit: Prisma.Decimal.Value;
  quantityUsageUnit: Prisma.Decimal.Value;
  unitPrice: Prisma.Decimal.Value;
  lineTotal: Prisma.Decimal.Value;
  priceAlertPct: Prisma.Decimal.Value | null;
  priceAlertPrevPrice: Prisma.Decimal.Value | null;
};

export type CreateGoodsReceiptInput = {
  supplierId: string;
  expectedDeliveryId: string | null;
  paymentTerms: 'INVOICE_TO_FOLLOW' | 'PAY_NOW';
  supplierDocNumber: string | null;
  supplierDocDate: Date | null;
  locationId: string;
  createdById: string;
  lines: GoodsReceiptLineInput[];
};

export type ListGoodsReceiptsFilters = {
  status?: GoodsReceiptStatus;
  supplierId?: string;
  limit: number;
  cursor?: string;
};

const goodsReceiptInclude = {
  supplier: { select: { id: true, name: true } },
  signedBy: { select: { id: true, name: true, role: true } },
  createdBy: { select: { id: true, name: true } },
  lines: {
    include: {
      inventoryItem: { select: { id: true, name: true, buyUnit: true, usageUnit: true } },
      priceAlertAcceptedBy: { select: { id: true, name: true } },
    },
    orderBy: { lineOrder: 'asc' },
  },
  invoices: { include: { supplierInvoice: { select: { id: true, invoiceNumber: true } } }, take: 1 },
} satisfies Prisma.GoodsReceiptInclude;

/**
 * Lighter than `goodsReceiptInclude` — a history row needs the linked
 * invoice's AP status/dispute state (for "Invoice recorded" / "Paid" /
 * "Disputed" tone), not the full line array a detail screen needs. Selecting
 * `status`/`disputeStatus` here is new: `goodsReceiptInclude` above only ever
 * fetched `id`/`invoiceNumber` because no caller before this needed AP state
 * off a receipt (2026-09-18 amendment, receiving-validators.ts header).
 */
const goodsReceiptHistoryInclude = {
  supplier: { select: { id: true, name: true } },
  lines: { select: { inventoryItem: { select: { name: true } } } },
  invoices: {
    include: { supplierInvoice: { select: { id: true, invoiceNumber: true, status: true, disputeStatus: true } } },
    take: 1,
  },
} satisfies Prisma.GoodsReceiptInclude;

export type GoodsReceiptHistoryRow = GoodsReceipt & {
  supplier: { id: string; name: string };
  lines: { inventoryItem: { name: string } }[];
  invoices: {
    supplierInvoice: { id: string; invoiceNumber: string; status: string; disputeStatus: string | null };
  }[];
};

const computeLineTotal = (
  quantityBuyUnit: Prisma.Decimal.Value,
  unitPrice: Prisma.Decimal.Value,
): Prisma.Decimal => new Prisma.Decimal(quantityBuyUnit).times(new Prisma.Decimal(unitPrice));

export const goodsReceiptRepository = {
  findAllByOrganization: async (
    organizationId: string,
    filters: ListGoodsReceiptsFilters,
  ): Promise<GoodsReceiptWithRelations[]> => {
    const where: Prisma.GoodsReceiptWhereInput = {
      organizationId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.supplierId ? { supplierId: filters.supplierId } : {}),
    };

    return prisma.goodsReceipt.findMany({
      where,
      include: goodsReceiptInclude,
      orderBy: { createdAt: 'desc' },
      take: filters.limit,
      ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
    });
  },

  findById: async (id: string, organizationId: string): Promise<GoodsReceiptWithRelations | null> => {
    return prisma.goodsReceipt.findFirst({ where: { id, organizationId }, include: goodsReceiptInclude });
  },

  create: async (
    organizationId: string,
    reference: string,
    input: CreateGoodsReceiptInput,
    tx: TxClient,
  ): Promise<GoodsReceiptWithRelations> => {
    const receiptTotal = input.lines.reduce(
      (sum, line) => sum.plus(computeLineTotal(line.quantityBuyUnit, line.unitPrice)),
      new Prisma.Decimal(0),
    );

    return tx.goodsReceipt.create({
      data: {
        organizationId,
        reference,
        supplierId: input.supplierId,
        expectedDeliveryId: input.expectedDeliveryId,
        paymentTerms: input.paymentTerms,
        supplierDocNumber: input.supplierDocNumber,
        supplierDocDate: input.supplierDocDate,
        receiptTotal,
        locationId: input.locationId,
        createdById: input.createdById,
        lines: {
          createMany: {
            data: input.lines.map((line, index) => ({
              inventoryItemId: line.inventoryItemId,
              quantityBuyUnit: new Prisma.Decimal(line.quantityBuyUnit),
              quantityUsageUnit: new Prisma.Decimal(line.quantityUsageUnit),
              unitPrice: new Prisma.Decimal(line.unitPrice),
              lineTotal: new Prisma.Decimal(line.lineTotal),
              priceAlertPct: line.priceAlertPct !== null ? new Prisma.Decimal(line.priceAlertPct) : null,
              priceAlertPrevPrice:
                line.priceAlertPrevPrice !== null ? new Prisma.Decimal(line.priceAlertPrevPrice) : null,
              lineOrder: index,
            })),
          },
        },
      },
      include: goodsReceiptInclude,
    });
  },

  /** Status-guarded like `expectedDeliveryRepository.cancel` — DRAFT only, replaces all lines. */
  update: async (
    id: string,
    organizationId: string,
    input: Partial<Omit<CreateGoodsReceiptInput, 'supplierId' | 'createdById' | 'locationId'>>,
  ): Promise<GoodsReceiptWithRelations | null> => {
    const updated = await prisma.goodsReceipt.updateMany({
      where: { id, organizationId, status: 'DRAFT' },
      data: {
        ...(input.expectedDeliveryId !== undefined ? { expectedDeliveryId: input.expectedDeliveryId } : {}),
        ...(input.paymentTerms !== undefined ? { paymentTerms: input.paymentTerms } : {}),
        ...(input.supplierDocNumber !== undefined ? { supplierDocNumber: input.supplierDocNumber } : {}),
        ...(input.supplierDocDate !== undefined ? { supplierDocDate: input.supplierDocDate } : {}),
        ...(input.lines !== undefined
          ? {
              receiptTotal: input.lines.reduce(
                (sum, line) => sum.plus(computeLineTotal(line.quantityBuyUnit, line.unitPrice)),
                new Prisma.Decimal(0),
              ),
            }
          : {}),
      },
    });
    if (updated.count === 0) return null;

    if (input.lines !== undefined) {
      // Replace-all: simplest correct approach for a draft-only edit — no
      // partial-line-update semantics are exposed by the contract (plan §3.2
      // just says "edit a draft"), and drafts have no ledger rows yet, so
      // there is nothing else keyed to the old line ids to preserve.
      await prisma.goodsReceiptLine.deleteMany({ where: { goodsReceiptId: id } });
      await prisma.goodsReceiptLine.createMany({
        data: input.lines.map((line, index) => ({
          goodsReceiptId: id,
          inventoryItemId: line.inventoryItemId,
          quantityBuyUnit: new Prisma.Decimal(line.quantityBuyUnit),
          quantityUsageUnit: new Prisma.Decimal(line.quantityUsageUnit),
          unitPrice: new Prisma.Decimal(line.unitPrice),
          lineTotal: new Prisma.Decimal(line.lineTotal),
          priceAlertPct: line.priceAlertPct !== null ? new Prisma.Decimal(line.priceAlertPct) : null,
          priceAlertPrevPrice: line.priceAlertPrevPrice !== null ? new Prisma.Decimal(line.priceAlertPrevPrice) : null,
          lineOrder: index,
        })),
      });
    }

    return goodsReceiptRepository.findById(id, organizationId);
  },

  /**
   * Runs inside the caller's `$transaction` (the ledger-writing one). Guards
   * DRAFT → * the same way every other status transition in this module
   * does: `updateMany` with the current status in the `where`, zero count
   * means someone already signed/cancelled it concurrently.
   */
  markSigned: async (
    id: string,
    organizationId: string,
    tx: TxClient,
    data: { status: GoodsReceiptStatus; signedById: string; signedAt: Date },
  ): Promise<number> => {
    const updated = await tx.goodsReceipt.updateMany({
      where: { id, organizationId, status: 'DRAFT' },
      data,
    });
    return updated.count;
  },

  /** Stamps acceptance on the alerted lines, inside the same sign transaction. */
  markPriceAlertsAccepted: async (lineIds: string[], acceptedById: string, tx: TxClient): Promise<void> => {
    if (lineIds.length === 0) return;
    await tx.goodsReceiptLine.updateMany({
      where: { id: { in: lineIds } },
      data: { priceAlertAcceptedById: acceptedById },
    });
  },

  /** Recipients for the post-sign notification (plan §3.3) — every active Store Manager on the hub org. */
  findHubStoreManagers: async (hubOrganizationId: string): Promise<{ id: string; name: string }[]> => {
    return prisma.user.findMany({
      where: { organizationId: hubOrganizationId, role: 'STORE_MANAGER', isActive: true, deletedAt: null },
      select: { id: true, name: true },
    });
  },

  /**
   * The GoodsReceipt half of the Receiving History union (2026-09-18
   * amendment, receiving-validators.ts header) — the `TODO(S4)` in
   * `receiving-service.ts` this finally resolves. Filters on `createdAt`
   * like `expectedDeliveryRepository.findHistoryRows`, not `signedAt`: a
   * still-DRAFT receipt has no `signedAt` yet but is still a real row a
   * Manager searching history by date range should find.
   */
  findHistoryRows: async (
    organizationId: string,
    filters: {
      search?: string;
      supplierId?: string;
      status?: GoodsReceiptStatus;
      from?: Date;
      to?: Date;
      limit: number;
      cursor?: string;
    },
  ): Promise<GoodsReceiptHistoryRow[]> => {
    const where: Prisma.GoodsReceiptWhereInput = {
      organizationId,
      ...(filters.supplierId ? { supplierId: filters.supplierId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.search ? { supplier: { name: { contains: filters.search, mode: 'insensitive' } } } : {}),
      ...(filters.from || filters.to
        ? { createdAt: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } }
        : {}),
    };

    return prisma.goodsReceipt.findMany({
      where,
      include: goodsReceiptHistoryInclude,
      orderBy: { createdAt: 'desc' },
      take: filters.limit,
      ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
    });
  },
};
