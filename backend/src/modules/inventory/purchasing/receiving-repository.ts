import {
  Prisma,
  type DisputeStatus,
  type ExpectedDelivery,
  type ExpectedDeliveryLine,
  type ExpectedDeliveryStatus,
  type GoodsReceipt,
  type GoodsReceiptLine,
  type GoodsReceiptStatus,
  type SupplierInvoiceStatus,
  type SupplierPaymentMethod,
} from '@prisma/client';
import { prisma } from '../../../config/database';

type TxClient = Prisma.TransactionClient;
type Client = typeof prisma | TxClient;

// ---------------------------------------------------------------------------
// Reference numbers — gap-free per (organization, prefix), incremented inside
// the same transaction as the document it numbers (plan §1.7).
// ---------------------------------------------------------------------------

export const referenceCounterRepository = {
  /** Must run inside the same `$transaction` as the create it numbers. */
  nextReference: async (tx: TxClient, siteId: string, prefix: string, pad = 4): Promise<string> => {
    const counter = await tx.referenceCounter.upsert({
      where: { siteId_prefix: { siteId, prefix } },
      update: { lastNumber: { increment: 1 } },
      create: { siteId, prefix, lastNumber: 1 },
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
  findAllBySite: async (
    siteId: string,
    filters: ListExpectedDeliveriesFilters,
  ): Promise<ExpectedDeliveryWithRelations[]> => {
    const where: Prisma.ExpectedDeliveryWhereInput = {
      siteId,
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
    siteId: string,
    client: Client = prisma,
  ): Promise<ExpectedDeliveryWithRelations | null> => {
    return client.expectedDelivery.findFirst({ where: { id, siteId }, include: expectedDeliveryInclude });
  },

  create: async (
    siteId: string,
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
        siteId,
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

  cancel: async (id: string, siteId: string): Promise<ExpectedDeliveryWithRelations | null> => {
    const updated = await prisma.expectedDelivery.updateMany({
      where: { id, siteId, status: 'AWAITING' },
      data: { status: 'CANCELLED' },
    });
    if (updated.count === 0) return null;
    return expectedDeliveryRepository.findById(id, siteId);
  },

  /**
   * Called from inside `signGoodsReceipt`'s transaction when the receipt
   * being signed is linked to an expected delivery — the moment stock
   * actually lands is the moment the estimate it was expected against is
   * done. `where: { status: 'AWAITING' }` makes this a no-op (0 rows) if the
   * delivery was already fulfilled/cancelled by some other path; the caller
   * doesn't need the result, this never blocks or fails the sign.
   */
  markFulfilled: async (id: string, siteId: string, tx: TxClient): Promise<void> => {
    await tx.expectedDelivery.updateMany({
      where: { id, siteId, status: 'AWAITING' },
      data: { status: 'FULFILLED' },
    });
  },

  // ── Purchasing hub summary + history ────────────────────────────────────

  countByStatus: async (siteId: string, status: ExpectedDeliveryStatus): Promise<number> => {
    return prisma.expectedDelivery.count({ where: { siteId, status } });
  },

  countOverdue: async (siteId: string, now: Date): Promise<number> => {
    return prisma.expectedDelivery.count({
      where: { siteId, status: 'AWAITING', expectedDate: { lt: now } },
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
    siteId: string,
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
      siteId,
      ...(filters.supplierId ? { supplierId: filters.supplierId } : {}),
      // A FULFILLED delivery's story is already told by its resulting
      // GoodsReceipt row (the other half of this union) — showing the
      // expected-delivery row too is redundant, and toHistoryRow's status
      // mapping doesn't handle FULFILLED, so it rendered "Awaiting delivery"
      // for a receipt that had already arrived. Excluded by default; an
      // explicit status filter (e.g. the "Cancelled" filter chip) overrides this.
      ...(filters.status ? { status: filters.status } : { status: { not: 'FULFILLED' } }),
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
    siteId: string,
    supplierId: string,
    limit: number,
  ): Promise<{ inventoryItemId: string; itemName: string; buyUnit: string; lastUnitPrice: Prisma.Decimal; lastPurchasedAt: Date }[]> => {
    const lines = await prisma.expectedDeliveryLine.findMany({
      where: { expectedDelivery: { siteId, supplierId } },
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
    siteId: string,
  ): Promise<{ unitPrice: Prisma.Decimal; signedAt: Date } | null> => {
    const line = await prisma.goodsReceiptLine.findFirst({
      where: {
        inventoryItemId,
        goodsReceipt: { siteId, signedAt: { not: null } },
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
  /** What the goods were bought in; null = not stated. */
  packBuyUnit: string | null;
  packSize: Prisma.Decimal.Value | null;
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
  findAllBySite: async (
    siteId: string,
    filters: ListGoodsReceiptsFilters,
  ): Promise<GoodsReceiptWithRelations[]> => {
    const where: Prisma.GoodsReceiptWhereInput = {
      siteId,
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

  findById: async (id: string, siteId: string): Promise<GoodsReceiptWithRelations | null> => {
    return prisma.goodsReceipt.findFirst({ where: { id, siteId }, include: goodsReceiptInclude });
  },

  create: async (
    siteId: string,
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
        siteId,
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
              packBuyUnit: line.packBuyUnit,
              packSize: line.packSize !== null ? new Prisma.Decimal(line.packSize) : null,
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
    siteId: string,
    input: Partial<Omit<CreateGoodsReceiptInput, 'supplierId' | 'createdById' | 'locationId'>>,
  ): Promise<GoodsReceiptWithRelations | null> => {
    const updated = await prisma.goodsReceipt.updateMany({
      where: { id, siteId, status: 'DRAFT' },
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
          packBuyUnit: line.packBuyUnit,
          packSize: line.packSize !== null ? new Prisma.Decimal(line.packSize) : null,
          lineOrder: index,
        })),
      });
    }

    return goodsReceiptRepository.findById(id, siteId);
  },

  /**
   * Runs inside the caller's `$transaction` (the ledger-writing one). Guards
   * DRAFT → * the same way every other status transition in this module
   * does: `updateMany` with the current status in the `where`, zero count
   * means someone already signed/cancelled it concurrently.
   */
  markSigned: async (
    id: string,
    siteId: string,
    tx: TxClient,
    data: { status: GoodsReceiptStatus; signedById: string; signedAt: Date },
  ): Promise<number> => {
    const updated = await tx.goodsReceipt.updateMany({
      where: { id, siteId, status: 'DRAFT' },
      data,
    });
    return updated.count;
  },

  /** "Pack not on file": no catalog line matched, so no price was written. Inside the sign transaction. */
  markPackNotOnFile: async (lineId: string, tx: TxClient): Promise<void> => {
    await tx.goodsReceiptLine.updateMany({ where: { id: lineId }, data: { packNotOnFile: true } });
  },

  /** Signed (non-cancelled) receipt lines of one supplier stamped "Pack not on file", newest receipt first. */
  findPackNotOnFileLines: async (supplierId: string, siteId: string) =>
    prisma.goodsReceiptLine.findMany({
      where: {
        packNotOnFile: true,
        goodsReceipt: { supplierId, siteId, signedAt: { not: null }, status: { not: 'CANCELLED' } },
      },
      include: {
        goodsReceipt: { select: { id: true, reference: true, signedAt: true } },
        inventoryItem: { select: { name: true } },
      },
      orderBy: { goodsReceipt: { signedAt: 'desc' } },
    }),

  /** Signed (non-cancelled) receipts of one supplier signed at exactly these moments, with the items on each (the Catalog tab's "from receipt"). */
  findReceiptsSignedAt: async (supplierId: string, siteId: string, signedAt: Date[]) => {
    if (signedAt.length === 0) return [];
    const receipts = await prisma.goodsReceipt.findMany({
      where: { supplierId, siteId, status: { not: 'CANCELLED' }, signedAt: { in: signedAt } },
      select: { id: true, reference: true, signedAt: true, lines: { select: { inventoryItemId: true } } },
    });
    return receipts.map((r) => ({ id: r.id, reference: r.reference, signedAt: r.signedAt as Date, itemIds: r.lines.map((l) => l.inventoryItemId) }));
  },

  /** Signed receipt lines of one supplier that fired a price alert since `since`, newest receipt first. */
  findPriceAlertLines: async (supplierId: string, siteId: string, since: Date) => {
    const lines = await prisma.goodsReceiptLine.findMany({
      where: {
        priceAlertPct: { not: null },
        goodsReceipt: { supplierId, siteId, status: { not: 'CANCELLED' }, signedAt: { gte: since } },
      },
      select: {
        inventoryItemId: true,
        packBuyUnit: true,
        packSize: true,
        priceAlertPct: true,
        priceAlertPrevPrice: true,
        goodsReceipt: { select: { signedAt: true } },
      },
      orderBy: { goodsReceipt: { signedAt: 'desc' } },
    });
    return lines.map((l) => ({
      inventoryItemId: l.inventoryItemId,
      packBuyUnit: l.packBuyUnit,
      packSize: l.packSize,
      priceAlertPct: l.priceAlertPct as NonNullable<typeof l.priceAlertPct>,
      priceAlertPrevPrice: l.priceAlertPrevPrice,
      signedAt: l.goodsReceipt.signedAt as Date,
    }));
  },

  /** When the supplier last sold this item before `before` (the date the alert compares against), if ever. */
  findPreviousSignedAt: async (supplierId: string, siteId: string, inventoryItemId: string, before: Date): Promise<Date | null> => {
    const previous = await prisma.goodsReceipt.findFirst({
      where: { supplierId, siteId, status: { not: 'CANCELLED' }, signedAt: { lt: before }, lines: { some: { inventoryItemId } } },
      orderBy: { signedAt: 'desc' },
      select: { signedAt: true },
    });
    return previous?.signedAt ?? null;
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
  findHubStoreManagers: async (hubSiteId: string): Promise<{ id: string; name: string }[]> => {
    return prisma.user.findMany({
      where: { siteId: hubSiteId, role: 'STORE_MANAGER', isActive: true, deletedAt: null },
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
    siteId: string,
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
      siteId,
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

// ---------------------------------------------------------------------------
// Supplier invoices, payments, what-we-owe reads (S7 — Stage 10, Flows 14/15).
// Every "what we owe" figure is derived at query time, never stored (plan
// §1.5): outstanding = amountBilled + Σ adjustments − Σ allocations; a
// supplier's credit = Σ payments.amount − Σ allocations.amount. This
// repository fetches the raw rows the service derives those figures from —
// it never precomputes or caches a balance itself.
// ---------------------------------------------------------------------------

export type SupplierInvoiceWithRelations = Prisma.SupplierInvoiceGetPayload<{
  include: typeof supplierInvoiceInclude;
}>;

const supplierInvoiceInclude = {
  supplier: { select: { id: true, name: true } },
  receipts: { select: { goodsReceiptId: true } },
  adjustments: true,
  allocations: {
    include: { supplierPayment: { select: { id: true, method: true, paidAt: true, reversalOfId: true } } },
  },
} satisfies Prisma.SupplierInvoiceInclude;

export type CreateSupplierInvoiceInput = {
  supplierId: string;
  goodsReceiptIds: string[];
  invoiceNumber: string;
  invoiceDate: Date;
  dueDate: Date;
  amountBilled: Prisma.Decimal.Value;
  dispute?: { ourFigure: Prisma.Decimal.Value; reason: string };
  recordedById: string;
};

export const supplierInvoiceRepository = {
  findById: async (
    id: string,
    siteId: string,
    client: Client = prisma,
  ): Promise<SupplierInvoiceWithRelations | null> => {
    return client.supplierInvoice.findFirst({ where: { id, siteId }, include: supplierInvoiceInclude });
  },

  /** Which of these receipts (if any) is already bundled into some invoice — used for the 409 check. */
  findInvoicedReceiptIds: async (goodsReceiptIds: string[], client: Client = prisma): Promise<Set<string>> => {
    const rows = await client.supplierInvoiceReceipt.findMany({
      where: { goodsReceiptId: { in: goodsReceiptIds } },
      select: { goodsReceiptId: true },
    });
    return new Set(rows.map((r) => r.goodsReceiptId));
  },

  create: async (siteId: string, input: CreateSupplierInvoiceInput, tx: TxClient): Promise<SupplierInvoiceWithRelations> => {
    return tx.supplierInvoice.create({
      data: {
        siteId,
        supplierId: input.supplierId,
        invoiceNumber: input.invoiceNumber,
        invoiceDate: input.invoiceDate,
        dueDate: input.dueDate,
        amountBilled: new Prisma.Decimal(input.amountBilled),
        disputeStatus: input.dispute ? 'OPEN' : null,
        disputeOurFigure: input.dispute ? new Prisma.Decimal(input.dispute.ourFigure) : null,
        disputeReason: input.dispute ? input.dispute.reason : null,
        recordedById: input.recordedById,
        receipts: { createMany: { data: input.goodsReceiptIds.map((goodsReceiptId) => ({ goodsReceiptId })) } },
      },
      include: supplierInvoiceInclude,
    });
  },

  /** Marks every receipt this invoice bundles as INVOICE_RECORDED (History band status). */
  markReceiptsInvoiceRecorded: async (goodsReceiptIds: string[], tx: TxClient): Promise<void> => {
    await tx.goodsReceipt.updateMany({
      where: { id: { in: goodsReceiptIds } },
      data: { status: 'INVOICE_RECORDED' },
    });
  },

  createAdjustment: async (
    supplierInvoiceId: string,
    input: { amount: Prisma.Decimal.Value; reason: string; recordedById: string },
    tx: TxClient,
  ): Promise<void> => {
    await tx.supplierInvoiceAdjustment.create({
      data: {
        supplierInvoiceId,
        amount: new Prisma.Decimal(input.amount),
        reason: input.reason,
        recordedById: input.recordedById,
      },
    });
  },

  /** Recomputes and persists `status` (UNPAID/PARTIALLY_PAID/PAID) from the derived outstanding figure. */
  updateStatus: async (id: string, status: SupplierInvoiceStatus, tx: TxClient): Promise<void> => {
    await tx.supplierInvoice.update({ where: { id }, data: { status } });
  },

  /** All invoices for one supplier, for the aging/outstanding derivation and the Supplier detail panel. */
  findAllBySupplier: async (supplierId: string, siteId: string): Promise<SupplierInvoiceWithRelations[]> => {
    return prisma.supplierInvoice.findMany({
      where: { siteId, supplierId },
      include: supplierInvoiceInclude,
      orderBy: { invoiceDate: 'desc' },
    });
  },

  /** All invoices in the org, for the `/ap/suppliers` table's per-supplier aggregation. */
  findAllBySite: async (siteId: string): Promise<SupplierInvoiceWithRelations[]> => {
    return prisma.supplierInvoice.findMany({
      where: { siteId },
      include: supplierInvoiceInclude,
    });
  },
};

export type SupplierPaymentWithRelations = Prisma.SupplierPaymentGetPayload<{
  include: typeof supplierPaymentInclude;
}>;

const supplierPaymentInclude = {
  recordedBy: { select: { id: true, name: true } },
  allocations: { include: { supplierInvoice: { select: { id: true, invoiceNumber: true } } } },
} satisfies Prisma.SupplierPaymentInclude;

export type CreateSupplierPaymentInput = {
  supplierId: string;
  amount: Prisma.Decimal.Value;
  paidAt: Date;
  method: SupplierPaymentMethod;
  reference: string | null;
  allocations: { supplierInvoiceId: string; amount: Prisma.Decimal.Value }[];
  recordedById: string;
};

export const supplierPaymentRepository = {
  findById: async (
    id: string,
    siteId: string,
    client: Client = prisma,
  ): Promise<SupplierPaymentWithRelations | null> => {
    return client.supplierPayment.findFirst({ where: { id, siteId }, include: supplierPaymentInclude });
  },

  /**
   * Another CHEQUE payment (not a reversal) to this supplier with the same number, trimmed and
   * case-insensitive. Run before the new payment is written.
   */
  countChequeNumber: async (supplierId: string, siteId: string, chequeNumber: string): Promise<number> =>
    prisma.supplierPayment.count({
      where: {
        siteId,
        supplierId,
        method: 'CHEQUE',
        reversalOfId: null,
        reference: { equals: chequeNumber.trim(), mode: 'insensitive' },
      },
    }),

  create: async (siteId: string, input: CreateSupplierPaymentInput, tx: TxClient): Promise<SupplierPaymentWithRelations> => {
    return tx.supplierPayment.create({
      data: {
        siteId,
        supplierId: input.supplierId,
        amount: new Prisma.Decimal(input.amount),
        paidAt: input.paidAt,
        method: input.method,
        reference: input.reference,
        recordedById: input.recordedById,
        allocations: {
          createMany: {
            data: input.allocations.map((a) => ({
              supplierInvoiceId: a.supplierInvoiceId,
              amount: new Prisma.Decimal(a.amount),
            })),
          },
        },
      },
      include: supplierPaymentInclude,
    });
  },

  /**
   * A reversal is a brand-new payment row — the original is never mutated
   * (Flow 15). `allocations` here take positive magnitudes (how much of each
   * invoice's prior allocation to undo); this repository is the one place
   * that negates them into the stored, allowed-negative allocation amounts.
   */
  createReversal: async (
    siteId: string,
    input: {
      supplierId: string;
      reversalOfId: string;
      reversalReason: string;
      recordedById: string;
      allocations: { supplierInvoiceId: string; amount: Prisma.Decimal.Value }[];
    },
    tx: TxClient,
  ): Promise<SupplierPaymentWithRelations> => {
    const totalReversed = input.allocations.reduce(
      (sum, a) => sum.plus(new Prisma.Decimal(a.amount)),
      new Prisma.Decimal(0),
    );
    return tx.supplierPayment.create({
      data: {
        siteId,
        supplierId: input.supplierId,
        amount: totalReversed.negated(),
        paidAt: new Date(),
        method: 'BANK', // reversal has no real payment method of its own; not shown for reversal rows in the UI
        reversalOfId: input.reversalOfId,
        reversalReason: input.reversalReason,
        recordedById: input.recordedById,
        allocations: {
          createMany: {
            data: input.allocations.map((a) => ({
              supplierInvoiceId: a.supplierInvoiceId,
              amount: new Prisma.Decimal(a.amount).negated(),
            })),
          },
        },
      },
      include: supplierPaymentInclude,
    });
  },

  findAllBySupplier: async (supplierId: string, siteId: string): Promise<SupplierPaymentWithRelations[]> => {
    return prisma.supplierPayment.findMany({
      where: { siteId, supplierId },
      include: supplierPaymentInclude,
      orderBy: { paidAt: 'desc' },
    });
  },
};

// ---------------------------------------------------------------------------
// What-we-owe / aging reads — computed at query time (plan §1.5). Fetches the
// per-supplier invoice set the service aggregates into AgingBuckets/
// SupplierApRow; no bucket math or balance lives in this repository.
// ---------------------------------------------------------------------------

export type SupplierForAp = {
  id: string;
  name: string;
  paymentTerms: 'INVOICE_TO_FOLLOW' | 'PAY_NOW';
};

export const supplierApRepository = {
  /**
   * Every live supplier in the org — the `/ap/suppliers` table's row set,
   * before the derived `hasBalance`/`agingBucket` filters (those need each
   * supplier's aggregated row, so the service applies them after
   * `buildSupplierApRow`). `search`/`terms` are pushed into the query here
   * since neither needs derivation.
   *
   * AMENDMENT 2026-09-18 (owner feedback during S8 manual walkthrough): no
   * longer filtered to `supplierInvoices: { some: {} }`. That filter meant a
   * brand-new supplier (created via "New supplier" on this same screen)
   * never appeared here — not a bug, but confusing: the button that creates
   * a supplier lives on the exact screen where the result was invisible,
   * and there is no other screen left to browse the full roster (Milestone
   * One's profile-only Suppliers screen was retired when this AP-aware one
   * replaced its route). A supplier with no invoices now shows a genuinely
   * empty row (all buckets "–", outstanding 0), which is correct — it's
   * derived from real (empty) data, not faked.
   */
  findSuppliersWithInvoices: async (
    siteId: string,
    filters: { search?: string; terms?: 'INVOICE_TO_FOLLOW' | 'PAY_NOW' } = {},
  ): Promise<SupplierForAp[]> => {
    const suppliers = await prisma.supplier.findMany({
      where: {
        siteId,
        deletedAt: null,
        ...(filters.search ? { name: { contains: filters.search, mode: 'insensitive' } } : {}),
        ...(filters.terms ? { defaultPaymentTerms: filters.terms } : {}),
      },
      select: { id: true, name: true, defaultPaymentTerms: true },
      orderBy: { name: 'asc' },
    });
    return suppliers.map((s) => ({ id: s.id, name: s.name, paymentTerms: s.defaultPaymentTerms }));
  },

  findSupplierForAp: async (id: string, siteId: string): Promise<SupplierForAp | null> => {
    const supplier = await prisma.supplier.findFirst({
      where: { id, siteId },
      select: { id: true, name: true, defaultPaymentTerms: true },
    });
    if (!supplier) return null;
    return { id: supplier.id, name: supplier.name, paymentTerms: supplier.defaultPaymentTerms };
  },
};

export type { DisputeStatus, SupplierInvoiceStatus, SupplierPaymentMethod };
