import type { Request } from 'express';
import { Prisma } from '@prisma/client';
import {
  expectedDeliveryRepository,
  goodsReceiptRepository,
  lastPriceRepository,
  recentSupplierItemsRepository,
  referenceCounterRepository,
  supplierApRepository,
  supplierInvoiceRepository,
  supplierPaymentRepository,
  type ExpectedDeliveryWithRelations,
  type GoodsReceiptHistoryRow,
  type GoodsReceiptLineInput,
  type GoodsReceiptWithRelations,
  type SupplierForAp,
  type SupplierInvoiceWithRelations,
  type SupplierPaymentWithRelations,
} from './receiving-repository';
import { supplierRepository } from './inventory-repository';
import { inventoryItemRepository } from './inventory-repository';
import { branchRepository } from '../../repositories/branch-repository';
import { locationRepository } from '../../repositories/location-repository';
import { authRepository } from '../../repositories/auth-repository';
import { prisma } from '../../config/database';
import { socketService } from '../../sockets/socket-service';
import { fcmService } from '../../services/fcm-service';
import { comparePin } from '../../utils/password';
import { ConflictError, ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from '../../utils/errors';
import { mapPrismaError } from '../../utils/prisma-errors';
import { costPerUsageUnit } from './receiving-cost';
import type {
  AgingBuckets,
  ApSummary,
  CreateExpectedDeliveryInput as CreateExpectedDeliveryContractInput,
  CreateGoodsReceiptInput as CreateGoodsReceiptContractInput,
  CreateInvoiceAdjustmentInput,
  CreateSupplierInvoiceInput as CreateSupplierInvoiceContractInput,
  CreateSupplierPaymentInput as CreateSupplierPaymentContractInput,
  ExpectedDeliveryDetail,
  ExpectedDeliverySummary,
  GoodsReceiptDetail,
  ListExpectedDeliveriesQuery,
  ListGoodsReceiptsQuery,
  ListSupplierApQuery,
  PurchasingHistoryRow,
  PurchasingSummary,
  ReverseSupplierPaymentInput,
  RecentSupplierItem,
  SignGoodsReceiptInput,
  SupplierApDetail,
  SupplierApRow,
  SupplierInvoice,
  SupplierPayment,
  UpdateGoodsReceiptInput,
} from './receiving.types';

type Actor = NonNullable<Request['user']>;

/** Same D-15 hub-org guard Milestone One's service uses — Central Store data lives only on the hub org. */
const requireHubActor = async (actor: Actor): Promise<string> => {
  const hub = await branchRepository.findHub();
  if (!hub) {
    throw new ValidationError('No hub organization is configured');
  }
  if (actor.organizationId !== hub.id) {
    throw new ForbiddenError('Only the hub organization may access Central Store inventory data');
  }
  return hub.id;
};

const toDecimalString = (value: Prisma.Decimal): string => value.toString();

/**
 * A line's entered unit price this many percent above the item's last signed
 * price triggers a price alert (01-description.md §4 says "a set %" but
 * defines no number). 15% is a starting default, not owner-researched —
 * flag for review once real supplier pricing history exists, same treatment
 * as Supplier.paymentDays's 30-day default (plan §2).
 */
const PRICE_ALERT_THRESHOLD_PCT = 15;

const formatAgeLabel = (createdAt: Date): string => {
  const days = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return 'Today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
};

/**
 * `STORE_ATTENDANT` gets `estimatedTotal: null` — a serializer-level rule, not
 * a client-side hide. Plan §3.1 / API_CONTRACT §22.
 */
const serializeExpectedDelivery = (
  delivery: ExpectedDeliveryWithRelations,
  includeMoney: boolean,
  now: Date,
): ExpectedDeliverySummary => {
  const itemNames = delivery.lines.map((l) => l.inventoryItem.name);
  const itemSummary =
    itemNames.length <= 2 ? itemNames.join(', ') : `${itemNames.slice(0, 2).join(', ')} · ${itemNames.length} lines`;

  return {
    id: delivery.id,
    reference: delivery.reference,
    // Nullable in lockstep (AMENDMENT 2026-09-17, receiving-validators.ts header).
    supplierId: delivery.supplierId,
    supplierName: delivery.supplier ? delivery.supplier.name : null,
    paymentTerms: delivery.paymentTerms,
    status: delivery.status,
    itemSummary,
    lineCount: delivery.lines.length,
    expectedDate: delivery.expectedDate ? delivery.expectedDate.toISOString() : null,
    estimatedTotal: includeMoney ? toDecimalString(delivery.estimatedTotal) : null,
    isOverdue: delivery.status === 'AWAITING' && !!delivery.expectedDate && delivery.expectedDate < now,
    ageLabel: formatAgeLabel(delivery.createdAt),
    createdAt: delivery.createdAt.toISOString(),
  };
};

/** Detail variant of `serializeExpectedDelivery` — adds the full line array for the New Goods Receipt prefill. */
const serializeExpectedDeliveryDetail = (
  delivery: ExpectedDeliveryWithRelations,
  includeMoney: boolean,
  now: Date,
): ExpectedDeliveryDetail => ({
  ...serializeExpectedDelivery(delivery, includeMoney, now),
  lines: delivery.lines.map((line) => ({
    id: line.id,
    inventoryItemId: line.inventoryItemId,
    itemName: line.inventoryItem.name,
    quantity: toDecimalString(line.quantity),
    buyUnit: line.inventoryItem.buyUnit,
    usageUnit: line.inventoryItem.usageUnit,
    estimatedUnitPrice: toDecimalString(line.estimatedUnitPrice),
  })),
});

const canSeeMoney = (actor: Actor): boolean => actor.role !== 'STORE_ATTENDANT';

/** Null (no supplier chosen yet, AMENDMENT 2026-09-17) renders as a dash, never a guessed default. */
const paymentTermsLabel = (terms: 'INVOICE_TO_FOLLOW' | 'PAY_NOW' | null): string => {
  if (terms === null) return '—';
  return terms === 'PAY_NOW' ? 'Paid on delivery' : 'Invoice';
};

/**
 * Maps an ExpectedDelivery into the History band's pre-formatted row shape
 * (`PurchasingHistoryRowSchema`'s `expectedDelivery` variant) — the service
 * owns display copy here, not the component, per the 2026-09-16 amendment
 * (API_CONTRACT.md §22.3).
 */
const toHistoryRow = (
  delivery: ExpectedDeliveryWithRelations,
  includeMoney: boolean,
  now: Date,
): PurchasingHistoryRow => {
  const summary = serializeExpectedDelivery(delivery, includeMoney, now);
  const isCancelled = summary.status === 'CANCELLED';
  const statusLabel = isCancelled ? 'Cancelled' : summary.isOverdue ? 'Overdue' : 'Awaiting delivery';
  const statusTone: 'neutral' | 'error' | 'info' = isCancelled ? 'neutral' : summary.isOverdue ? 'error' : 'info';
  const detailLabel = includeMoney && summary.estimatedTotal ? `~KES ${summary.estimatedTotal}` : summary.itemSummary;

  return {
    type: 'expectedDelivery',
    id: summary.id,
    // "No supplier" literal (AMENDMENT 2026-09-17) — never null on this
    // pre-formatted row shape; PurchasingHistoryRowSchema's supplierName
    // stays a plain (non-nullable) string.
    supplierName: summary.supplierName ?? 'No supplier',
    paymentTermsLabel: paymentTermsLabel(delivery.paymentTerms),
    detailLabel,
    ageLabel: summary.ageLabel,
    statusLabel,
    statusTone,
    actions: [{ label: 'View' }, { label: 'Cancel', emphasized: false }],
  };
};

/**
 * Maps a GoodsReceipt into the History union's `goodsReceipt` row (2026-09-18
 * amendment — see receiving-validators.ts header). `includeMoney` gates two
 * separate things, not one: the KES `detailLabel` (existing convention, same
 * as `toHistoryRow`) AND the AP/invoice status itself — an Attendant must not
 * learn a receipt is "Disputed" or "Paid" (those are money-adjacent facts),
 * so `includeMoney: false` collapses every non-cancelled status down to the
 * single neutral "Received" rather than picking a narrower-but-still-AP-
 * flavoured label.
 */
const toGoodsReceiptHistoryRow = (
  receipt: GoodsReceiptHistoryRow,
  includeMoney: boolean,
  now: Date,
): PurchasingHistoryRow => {
  const itemNames = receipt.lines.map((l) => l.inventoryItem.name);
  const itemSummary =
    itemNames.length <= 2 ? itemNames.join(', ') : `${itemNames.slice(0, 2).join(', ')} · ${itemNames.length} lines`;
  const linkedInvoice = receipt.invoices[0]?.supplierInvoice ?? null;

  let statusLabel: string;
  let statusTone: 'neutral' | 'error' | 'info';
  if (!includeMoney) {
    statusLabel = receipt.status === 'CANCELLED' ? 'Cancelled' : 'Received';
    statusTone = receipt.status === 'CANCELLED' ? 'neutral' : 'info';
  } else if (receipt.status === 'CANCELLED') {
    statusLabel = 'Cancelled';
    statusTone = 'neutral';
  } else if (linkedInvoice?.disputeStatus === 'OPEN') {
    statusLabel = 'Disputed';
    statusTone = 'error';
  } else if (linkedInvoice?.status === 'PAID') {
    statusLabel = 'Paid';
    statusTone = 'neutral';
  } else if (linkedInvoice) {
    statusLabel = 'Invoice recorded';
    statusTone = 'neutral';
  } else if (receipt.status === 'RECEIVED_INVOICE_PENDING') {
    statusLabel = 'Received — invoice pending';
    statusTone = 'info';
  } else if (receipt.status === 'RECEIVED_PAID') {
    statusLabel = 'Paid';
    statusTone = 'neutral';
  } else {
    statusLabel = 'Received';
    statusTone = 'info';
  }

  return {
    type: 'goodsReceipt',
    id: receipt.id,
    title: `${receipt.reference} · ${receipt.supplier.name}`,
    subtitleLabel: `Received ${receipt.createdAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`,
    detailLabel: includeMoney ? `KES ${toDecimalString(receipt.receiptTotal)}` : itemSummary,
    ageLabel: formatAgeLabel(receipt.createdAt),
    statusLabel,
    statusTone,
    actions: [{ label: 'View' }, { label: 'Print', emphasized: false }],
  };
};

/**
 * Merges the two History sub-queries by `createdAt desc` and maps each to
 * its wire row, taking the top `limit`. Both sub-queries are fetched with
 * the same `limit`/date bound, so the merged+sliced result is correct as
 * long as neither side's true "next `limit` rows" run out before the merge
 * point — true here because each side already independently fetched up to
 * `limit` rows newer than the cursor bound.
 */
const mergeHistoryRows = (
  deliveries: ExpectedDeliveryWithRelations[],
  receipts: GoodsReceiptHistoryRow[],
  includeMoney: boolean,
  now: Date,
  limit: number,
): PurchasingHistoryRow[] => {
  const combined: { createdAt: Date; row: PurchasingHistoryRow }[] = [
    ...deliveries.map((d) => ({ createdAt: d.createdAt, row: toHistoryRow(d, includeMoney, now) })),
    ...receipts.map((r) => ({ createdAt: r.createdAt, row: toGoodsReceiptHistoryRow(r, includeMoney, now) })),
  ];
  combined.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return combined.slice(0, limit).map((c) => c.row);
};

/** Resolves a History row's `id` (either table) to its `createdAt`, for cursor pagination across the merged union. */
const findHistoryCursorDate = async (organizationId: string, id: string): Promise<Date | undefined> => {
  const [delivery, receipt] = await Promise.all([
    prisma.expectedDelivery.findFirst({ where: { id, organizationId }, select: { createdAt: true } }),
    prisma.goodsReceipt.findFirst({ where: { id, organizationId }, select: { createdAt: true } }),
  ]);
  return delivery?.createdAt ?? receipt?.createdAt ?? undefined;
};

/**
 * Maps a signed or draft GoodsReceipt to the wire shape. Price-alert fields
 * come straight off the stored line columns — never recomputed against
 * current `InventoryItem.currentCost` (contract behaviour #2, API_CONTRACT.md
 * §22.4): by the time this is read back, signing has already moved the
 * item's cost on to this receipt's own price.
 */
const serializeGoodsReceipt = (receipt: GoodsReceiptWithRelations): GoodsReceiptDetail => {
  const linkedInvoiceRow = receipt.invoices[0];
  return {
    id: receipt.id,
    reference: receipt.reference,
    supplierId: receipt.supplierId,
    supplierName: receipt.supplier.name,
    expectedDeliveryId: receipt.expectedDeliveryId,
    paymentTerms: receipt.paymentTerms,
    status: receipt.status,
    supplierDocNumber: receipt.supplierDocNumber,
    supplierDocDate: receipt.supplierDocDate ? receipt.supplierDocDate.toISOString() : null,
    receiptTotal: toDecimalString(receipt.receiptTotal),
    lines: receipt.lines.map((line) => ({
      id: line.id,
      inventoryItemId: line.inventoryItemId,
      itemName: line.inventoryItem.name,
      quantityBuyUnit: toDecimalString(line.quantityBuyUnit),
      buyUnit: line.inventoryItem.buyUnit,
      quantityUsageUnit: toDecimalString(line.quantityUsageUnit),
      usageUnit: line.inventoryItem.usageUnit,
      unitPrice: toDecimalString(line.unitPrice),
      lineTotal: toDecimalString(line.lineTotal),
      priceAlert:
        line.priceAlertPct !== null && line.priceAlertPrevPrice !== null
          ? {
              percentAboveLast: toDecimalString(line.priceAlertPct),
              previousPrice: toDecimalString(line.priceAlertPrevPrice),
              acceptedByName: line.priceAlertAcceptedBy ? line.priceAlertAcceptedBy.name : null,
            }
          : null,
    })),
    signature:
      receipt.signedBy && receipt.signedAt
        ? {
            signedByName: receipt.signedBy.name,
            signedByRole: receipt.signedBy.role,
            signedAt: receipt.signedAt.toISOString(),
          }
        : null,
    linkedInvoice: linkedInvoiceRow
      ? { id: linkedInvoiceRow.supplierInvoice.id, invoiceNumber: linkedInvoiceRow.supplierInvoice.invoiceNumber }
      : null,
    createdAt: receipt.createdAt.toISOString(),
  };
};

/**
 * Buy→usage unit conversion (plan §1.6) and per-line total. `conversionFactor`
 * null means 1:1 (buy unit === usage unit, e.g. "unit" items) — `packSize` is
 * an unrelated display-only field (Milestone One, "12 per pack" caption) and
 * is never used in this calculation, confirmed by grep: no existing code
 * multiplies against it.
 */
const buildLineInput = (
  line: { inventoryItemId: string; quantityBuyUnit: string; unitPrice: string },
  item: { conversionFactor: Prisma.Decimal | null },
  lastPrice: Prisma.Decimal | null,
): GoodsReceiptLineInput => {
  const quantityBuyUnit = new Prisma.Decimal(line.quantityBuyUnit);
  const unitPrice = new Prisma.Decimal(line.unitPrice);
  const conversionFactor = item.conversionFactor ?? new Prisma.Decimal(1);
  const quantityUsageUnit = quantityBuyUnit.times(conversionFactor);
  const lineTotal = quantityBuyUnit.times(unitPrice);

  let priceAlertPct: Prisma.Decimal | null = null;
  let priceAlertPrevPrice: Prisma.Decimal | null = null;
  if (lastPrice && lastPrice.greaterThan(0)) {
    const percentAbove = unitPrice.minus(lastPrice).dividedBy(lastPrice).times(100);
    if (percentAbove.greaterThan(PRICE_ALERT_THRESHOLD_PCT)) {
      priceAlertPct = percentAbove;
      priceAlertPrevPrice = lastPrice;
    }
  }

  return {
    inventoryItemId: line.inventoryItemId,
    quantityBuyUnit,
    quantityUsageUnit,
    unitPrice,
    lineTotal,
    priceAlertPct,
    priceAlertPrevPrice,
  };
};

/**
 * Fire-and-forget: never blocks or fails the sign response (called with
 * `void` from `signGoodsReceipt`). Composed inline from the existing
 * socket/FCM primitives — no generic `notifyRole()` helper exists in this
 * codebase; every service wires its own call site the same way.
 */
const notifyHubStoreManagersOfSignedReceipt = async (
  hubOrganizationId: string,
  receipt: GoodsReceiptWithRelations,
  signerId: string,
  signerName: string,
): Promise<void> => {
  const managers = await goodsReceiptRepository.findHubStoreManagers(hubOrganizationId);
  const recipientIds = managers.map((m) => m.id).filter((recipientId) => recipientId !== signerId);
  if (recipientIds.length === 0) return;

  const payload = {
    goodsReceiptId: receipt.id,
    reference: receipt.reference,
    supplierName: receipt.supplier.name,
    signedByName: signerName,
  };
  recipientIds.forEach((recipientId) => socketService.emitGoodsReceiptSigned(recipientId, payload));
  await fcmService.sendGoodsReceiptSignedPush(recipientIds, payload);
};

// ---------------------------------------------------------------------------
// Supplier invoices, payments, what-we-owe reads (S7). Every figure below is
// derived at call time from the raw invoice/payment/adjustment rows — never
// cached or stored (plan §1.5): outstanding = amountBilled + Σ adjustments −
// Σ allocations; a supplier's credit = Σ payments.amount − Σ allocations.
// amount. The three read models (`/ap/summary`, `/ap/suppliers`,
// `/ap/suppliers/:id`) all call these same helpers so they can never disagree
// (the reconciliation invariant this session's tests exist to prove).
// ---------------------------------------------------------------------------

/** Sum of this invoice's adjustments (can be negative — a correction either way). */
const sumAdjustments = (invoice: SupplierInvoiceWithRelations): Prisma.Decimal =>
  invoice.adjustments.reduce((sum, a) => sum.plus(a.amount), new Prisma.Decimal(0));

/** Sum of this invoice's payment allocations (reversal allocations are already negative). */
const sumAllocations = (invoice: SupplierInvoiceWithRelations): Prisma.Decimal =>
  invoice.allocations.reduce((sum, a) => sum.plus(a.amount), new Prisma.Decimal(0));

/** Plan §1.5: `outstanding = amountBilled + Σ adjustments − Σ allocations`. */
const computeOutstanding = (invoice: SupplierInvoiceWithRelations): Prisma.Decimal =>
  invoice.amountBilled.plus(sumAdjustments(invoice)).minus(sumAllocations(invoice));

/** Derives the invoice's UNPAID/PARTIALLY_PAID/PAID status from its outstanding figure. */
const deriveInvoiceStatus = (invoice: SupplierInvoiceWithRelations): 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' => {
  const outstanding = computeOutstanding(invoice);
  if (outstanding.lessThanOrEqualTo(0)) return 'PAID';
  if (sumAllocations(invoice).greaterThan(0)) return 'PARTIALLY_PAID';
  return 'UNPAID';
};

/**
 * Days overdue is measured from `dueDate`, not `invoiceDate` (`VGE-0`'s
 * "— DAYS OVERDUE —" columns, plan §1.5). Bucketed CURRENT (≤0) / 1–30 /
 * 31–60 / 61–90 / 90+ — always these five, never merged here (contract
 * behaviour #9); a screen that wants four buckets merges for display only.
 */
const bucketForDaysOverdue = (daysOverdue: number): keyof AgingBuckets => {
  if (daysOverdue <= 0) return 'current';
  if (daysOverdue <= 30) return 'days1To30';
  if (daysOverdue <= 60) return 'days31To60';
  if (daysOverdue <= 90) return 'days61To90';
  return 'days90Plus';
};

const emptyBuckets = (): Record<keyof AgingBuckets, Prisma.Decimal> => ({
  current: new Prisma.Decimal(0),
  days1To30: new Prisma.Decimal(0),
  days31To60: new Prisma.Decimal(0),
  days61To90: new Prisma.Decimal(0),
  days90Plus: new Prisma.Decimal(0),
});

const bucketsToWire = (buckets: Record<keyof AgingBuckets, Prisma.Decimal>): AgingBuckets => ({
  current: toDecimalString(buckets.current),
  days1To30: toDecimalString(buckets.days1To30),
  days31To60: toDecimalString(buckets.days31To60),
  days61To90: toDecimalString(buckets.days61To90),
  days90Plus: toDecimalString(buckets.days90Plus),
});

/**
 * Aggregates one supplier's invoices into the row shape shared by
 * `/ap/suppliers` and `/ap/suppliers/:id` — the single derivation both
 * endpoints call, so they can never disagree (plan §1.5's reconciliation
 * invariant). Only invoices with `outstanding > 0` land in a bucket; a fully
 * paid invoice contributes to `invoiced`/`paid` but not to any aging bucket.
 */
const buildSupplierApRow = (supplier: SupplierForAp, invoices: SupplierInvoiceWithRelations[], now: Date): SupplierApRow => {
  const buckets = emptyBuckets();
  let invoiced = new Prisma.Decimal(0);
  let paid = new Prisma.Decimal(0);
  let outstanding = new Prisma.Decimal(0);
  let disputedCount = 0;
  let lastInvoiceDate: Date | null = null;

  for (const invoice of invoices) {
    invoiced = invoiced.plus(invoice.amountBilled).plus(sumAdjustments(invoice));
    const allocated = sumAllocations(invoice);
    paid = paid.plus(allocated);
    const invoiceOutstanding = computeOutstanding(invoice);
    outstanding = outstanding.plus(invoiceOutstanding);
    if (invoice.disputeStatus === 'OPEN') disputedCount += 1;
    if (!lastInvoiceDate || invoice.invoiceDate > lastInvoiceDate) lastInvoiceDate = invoice.invoiceDate;

    if (invoiceOutstanding.greaterThan(0)) {
      const daysOverdue = Math.floor((now.getTime() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24));
      const bucket = bucketForDaysOverdue(daysOverdue);
      buckets[bucket] = buckets[bucket].plus(invoiceOutstanding);
    }
  }

  return {
    supplierId: supplier.id,
    supplierName: supplier.name,
    paymentTerms: supplier.paymentTerms,
    lastInvoiceDate: lastInvoiceDate ? lastInvoiceDate.toISOString() : null,
    invoiced: toDecimalString(invoiced),
    paid: toDecimalString(paid),
    outstanding: toDecimalString(outstanding),
    buckets: bucketsToWire(buckets),
    disputedCount,
  };
};

const serializeSupplierInvoice = (invoice: SupplierInvoiceWithRelations): SupplierInvoice => ({
  id: invoice.id,
  supplierId: invoice.supplierId,
  supplierName: invoice.supplier.name,
  invoiceNumber: invoice.invoiceNumber,
  invoiceDate: invoice.invoiceDate.toISOString(),
  dueDate: invoice.dueDate.toISOString(),
  amountBilled: toDecimalString(invoice.amountBilled),
  outstanding: toDecimalString(computeOutstanding(invoice)),
  status: deriveInvoiceStatus(invoice),
  dispute:
    invoice.disputeStatus !== null
      ? {
          status: invoice.disputeStatus,
          ourFigure: toDecimalString(invoice.disputeOurFigure ?? new Prisma.Decimal(0)),
          reason: invoice.disputeReason ?? '',
        }
      : null,
  goodsReceiptIds: invoice.receipts.map((r) => r.goodsReceiptId),
  createdAt: invoice.createdAt.toISOString(),
});

const serializeSupplierPayment = (payment: SupplierPaymentWithRelations): SupplierPayment => ({
  id: payment.id,
  supplierId: payment.supplierId,
  amount: toDecimalString(payment.amount),
  paidAt: payment.paidAt.toISOString(),
  method: payment.method,
  reference: payment.reference,
  allocations: payment.allocations.map((a) => ({
    supplierInvoiceId: a.supplierInvoiceId,
    invoiceNumber: a.supplierInvoice.invoiceNumber,
    amount: toDecimalString(a.amount),
  })),
  reversalOfId: payment.reversalOfId,
  recordedByName: payment.recordedBy.name,
  createdAt: payment.createdAt.toISOString(),
});

export const receivingService = {
  // ── Expected deliveries ──────────────────────────────────────────────────

  listExpectedDeliveries: async (
    actor: Actor,
    query: ListExpectedDeliveriesQuery,
  ): Promise<ExpectedDeliverySummary[]> => {
    const organizationId = await requireHubActor(actor);
    const deliveries = await expectedDeliveryRepository.findAllByOrganization(organizationId, {
      status: query.status,
      supplierId: query.supplierId,
      search: query.search,
      limit: query.limit,
      cursor: query.cursor,
    });
    const includeMoney = canSeeMoney(actor);
    const now = new Date();
    return deliveries.map((d) => serializeExpectedDelivery(d, includeMoney, now));
  },

  getExpectedDelivery: async (actor: Actor, id: string): Promise<ExpectedDeliveryDetail> => {
    const organizationId = await requireHubActor(actor);
    const delivery = await expectedDeliveryRepository.findById(id, organizationId);
    if (!delivery) throw new NotFoundError('Expected delivery not found');
    return serializeExpectedDeliveryDetail(delivery, canSeeMoney(actor), new Date());
  },

  createExpectedDelivery: async (
    actor: Actor,
    input: CreateExpectedDeliveryContractInput,
  ): Promise<ExpectedDeliverySummary> => {
    const organizationId = await requireHubActor(actor);

    // AMENDMENT 2026-09-17: supplierId is optional — a pure shopping list has
    // no supplier to validate against. Only look one up (and 404/409 on it)
    // when the caller actually supplied one.
    if (input.supplierId) {
      const supplier = await supplierRepository.findById(input.supplierId, organizationId);
      if (!supplier) throw new NotFoundError('Supplier not found');
      if (supplier.deletedAt) throw new ConflictError('This supplier is retired');
    }

    const itemIds = input.lines.map((l) => l.inventoryItemId);
    const liveItems = await inventoryItemRepository.findLiveByIds(itemIds, organizationId);
    const liveItemIds = new Set(liveItems.map((i) => i.id));
    for (const line of input.lines) {
      if (!liveItemIds.has(line.inventoryItemId)) {
        throw new ValidationError('One or more items were not found');
      }
    }

    // No ledger entry is ever written here — this is Stage 1's whole point
    // (plan §1.1): an estimate, not a purchase order. No InventoryTransaction
    // import, no $transaction touching the ledger — only the reference
    // counter and the ExpectedDelivery/-Line rows themselves are written.
    const created = await prisma
      .$transaction(async (tx) => {
        const reference = await referenceCounterRepository.nextReference(tx, organizationId, 'EXP');
        return expectedDeliveryRepository.create(
          organizationId,
          reference,
          {
            supplierId: input.supplierId,
            paymentTerms: input.paymentTerms,
            expectedDate: input.expectedDate ? new Date(input.expectedDate) : null,
            createdById: actor.id,
            lines: input.lines.map((l) => ({
              inventoryItemId: l.inventoryItemId,
              quantity: l.quantity,
              estimatedUnitPrice: l.estimatedUnitPrice,
            })),
          },
          tx,
        );
      })
      .catch((error: unknown) => mapPrismaError(error));

    return serializeExpectedDelivery(created, canSeeMoney(actor), new Date());
  },

  cancelExpectedDelivery: async (actor: Actor, id: string): Promise<ExpectedDeliverySummary> => {
    const organizationId = await requireHubActor(actor);
    const existing = await expectedDeliveryRepository.findById(id, organizationId);
    if (!existing) throw new NotFoundError('Expected delivery not found');
    if (existing.status !== 'AWAITING') {
      throw new ConflictError('Only an awaiting delivery can be cancelled');
    }
    const cancelled = await expectedDeliveryRepository.cancel(id, organizationId);
    if (!cancelled) throw new ConflictError('Only an awaiting delivery can be cancelled');
    return serializeExpectedDelivery(cancelled, canSeeMoney(actor), new Date());
  },

  // ── Purchasing hub ───────────────────────────────────────────────────────

  /**
   * Three tiles (plan §7 Q1 — `IN TRANSIT` dropped). Only `expected` is real
   * this session: `awaitingInvoice`/`owed` depend on GoodsReceipt/
   * SupplierInvoice data that doesn't exist until S4/S7. Returning 0/null for
   * those fields does not violate the frozen contract — `PurchasingSummarySchema`
   * allows `oldestDays: number | null` and zero counts are valid — but is
   * called out explicitly here per this session's own scope note.
   */
  getPurchasingSummary: async (actor: Actor): Promise<PurchasingSummary> => {
    const organizationId = await requireHubActor(actor);
    const now = new Date();
    const [expectedCount, overdueCount, awaitingInvoiceReceipts, invoices] = await Promise.all([
      expectedDeliveryRepository.countByStatus(organizationId, 'AWAITING'),
      expectedDeliveryRepository.countOverdue(organizationId, now),
      goodsReceiptRepository.findAllByOrganization(organizationId, {
        status: 'RECEIVED_INVOICE_PENDING',
        limit: 100,
      }),
      supplierInvoiceRepository.findAllByOrganization(organizationId),
    ]);

    const oldestAwaitingInvoiceDays =
      awaitingInvoiceReceipts.length === 0
        ? null
        : Math.max(
            ...awaitingInvoiceReceipts.map((r) =>
              Math.floor((now.getTime() - new Date(r.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
            ),
          );

    let owedAmount = new Prisma.Decimal(0);
    let over30Count = 0;
    for (const invoice of invoices) {
      const outstanding = computeOutstanding(invoice);
      if (outstanding.lessThanOrEqualTo(0)) continue;
      owedAmount = owedAmount.plus(outstanding);
      const daysOverdue = Math.floor((now.getTime() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysOverdue > 30) over30Count += 1;
    }

    return {
      expected: { count: expectedCount, overdue: overdueCount },
      awaitingInvoice: { count: awaitingInvoiceReceipts.length, oldestDays: oldestAwaitingInvoiceDays },
      owed: { amount: toDecimalString(owedAmount), over30Count },
    };
  },

  /**
   * History band: a union of ExpectedDelivery and GoodsReceipt rows in one
   * table (plan §3.2). Both halves are queried and merged by `createdAt desc`
   * (2026-09-18 amendment resolves the `TODO(S4)` this comment used to carry
   * — see `mergeHistoryRows` below for the merge/pagination approach). No
   * `cursor` support on this endpoint (unchanged from S3) — the Purchasing
   * hub's own `usePurchasingHistoryList` still uses limit-bump; only the new
   * `getReceivingHistory` below takes a real cursor.
   */
  getPurchasingHistory: async (
    actor: Actor,
    query: { search?: string; supplierId?: string; status?: string; from?: string; to?: string; limit: number },
  ): Promise<PurchasingHistoryRow[]> => {
    const organizationId = await requireHubActor(actor);
    const includeMoney = canSeeMoney(actor);
    const now = new Date();

    const [deliveries, receipts] = await Promise.all([
      expectedDeliveryRepository.findHistoryRows(organizationId, {
        search: query.search,
        supplierId: query.supplierId,
        status: query.status as never,
        from: query.from ? new Date(query.from) : undefined,
        to: query.to ? new Date(query.to) : undefined,
        limit: query.limit,
      }),
      goodsReceiptRepository.findHistoryRows(organizationId, {
        search: query.search,
        supplierId: query.supplierId,
        status: query.status as never,
        from: query.from ? new Date(query.from) : undefined,
        to: query.to ? new Date(query.to) : undefined,
        limit: query.limit,
      }),
    ]);

    return mergeHistoryRows(deliveries, receipts, includeMoney, now, query.limit);
  },

  /**
   * `GET /inventory/receiving/history` (2026-09-18 amendment) — the
   * Attendant-safe sibling of `getPurchasingHistory` above. Same merge, same
   * `canSeeMoney` gate, but reachable by `STORE_ATTENDANT` (route-level, see
   * receiving-routes.ts) and with real cursor pagination: `cursor` is the
   * last row's `id` from the *merged* page, resolved back to a `createdAt`
   * boundary via `findCreatedAtCursor` so both sub-queries can independently
   * fetch "everything older than this row" before being re-merged.
   */
  getReceivingHistory: async (
    actor: Actor,
    query: {
      search?: string;
      supplierId?: string;
      status?: string;
      from?: string;
      to?: string;
      limit: number;
      cursor?: string;
    },
  ): Promise<PurchasingHistoryRow[]> => {
    const organizationId = await requireHubActor(actor);
    const includeMoney = canSeeMoney(actor);
    const now = new Date();

    let to = query.to ? new Date(query.to) : undefined;
    if (query.cursor) {
      const cursorDate = await findHistoryCursorDate(organizationId, query.cursor);
      if (cursorDate) {
        to = to && to < cursorDate ? to : cursorDate;
      }
    }

    const [deliveries, receipts] = await Promise.all([
      expectedDeliveryRepository.findHistoryRows(organizationId, {
        search: query.search,
        supplierId: query.supplierId,
        status: query.status as never,
        from: query.from ? new Date(query.from) : undefined,
        to,
        limit: query.limit,
      }),
      goodsReceiptRepository.findHistoryRows(organizationId, {
        search: query.search,
        supplierId: query.supplierId,
        status: query.status as never,
        from: query.from ? new Date(query.from) : undefined,
        to,
        limit: query.limit,
      }),
    ]);

    // Cursor row itself is excluded (it was already sent on a previous page)
    // — `to` above is an inclusive upper bound, so drop an exact re-match.
    const withoutCursorRow = query.cursor
      ? {
          deliveries: deliveries.filter((d) => d.id !== query.cursor),
          receipts: receipts.filter((r) => r.id !== query.cursor),
        }
      : { deliveries, receipts };

    return mergeHistoryRows(withoutCursorRow.deliveries, withoutCursorRow.receipts, includeMoney, now, query.limit);
  },

  // ── Recent items by supplier ─────────────────────────────────────────────

  getRecentSupplierItems: async (actor: Actor, supplierId: string, limit: number): Promise<RecentSupplierItem[]> => {
    const organizationId = await requireHubActor(actor);
    const supplier = await supplierRepository.findById(supplierId, organizationId);
    if (!supplier) throw new NotFoundError('Supplier not found');

    const rows = await recentSupplierItemsRepository.findRecentBySupplier(organizationId, supplierId, limit);
    return rows.map((row) => ({
      inventoryItemId: row.inventoryItemId,
      itemName: row.itemName,
      buyUnit: row.buyUnit,
      lastUnitPrice: toDecimalString(row.lastUnitPrice),
      lastPurchasedAt: row.lastPurchasedAt.toISOString(),
    }));
  },

  // ── Last price ───────────────────────────────────────────────────────────

  getLastPrice: async (
    actor: Actor,
    itemId: string,
  ): Promise<{ unitPrice: string; asOf: string } | null> => {
    const organizationId = await requireHubActor(actor);
    const item = await inventoryItemRepository.findById(itemId, organizationId);
    if (!item) throw new NotFoundError('Inventory item not found');

    const lastLine = await lastPriceRepository.findLastReceiptLine(itemId, organizationId);
    if (!lastLine) return null;
    return { unitPrice: toDecimalString(lastLine.unitPrice), asOf: lastLine.signedAt.toISOString() };
  },

  // ── Goods receipts (S4) ──────────────────────────────────────────────────

  listGoodsReceipts: async (actor: Actor, query: ListGoodsReceiptsQuery): Promise<GoodsReceiptDetail[]> => {
    const organizationId = await requireHubActor(actor);
    const receipts = await goodsReceiptRepository.findAllByOrganization(organizationId, {
      status: query.status,
      supplierId: query.supplierId,
      limit: query.limit,
      cursor: query.cursor,
    });
    return receipts.map(serializeGoodsReceipt);
  },

  getGoodsReceipt: async (actor: Actor, id: string): Promise<GoodsReceiptDetail> => {
    const organizationId = await requireHubActor(actor);
    const receipt = await goodsReceiptRepository.findById(id, organizationId);
    if (!receipt) throw new NotFoundError('Goods receipt not found');
    return serializeGoodsReceipt(receipt);
  },

  createGoodsReceipt: async (actor: Actor, input: CreateGoodsReceiptContractInput): Promise<GoodsReceiptDetail> => {
    const organizationId = await requireHubActor(actor);

    const supplier = await supplierRepository.findById(input.supplierId, organizationId);
    if (!supplier) throw new NotFoundError('Supplier not found');
    if (supplier.deletedAt) throw new ConflictError('This supplier is retired');

    const centralStore = await locationRepository.findCentralStore();
    if (!centralStore || centralStore.organizationId !== organizationId) {
      throw new NotFoundError('No Central Store is configured for this organization');
    }

    const itemIds = input.lines.map((l) => l.inventoryItemId);
    const liveItems = await inventoryItemRepository.findLiveByIds(itemIds, organizationId);
    const itemsById = new Map(liveItems.map((i) => [i.id, i]));
    for (const line of input.lines) {
      if (!itemsById.has(line.inventoryItemId)) {
        throw new ValidationError('One or more items were not found');
      }
    }

    // Price-alert comparison price per line, fetched before the transaction
    // — read-only, same lastPriceRepository the GET /items/:id/last-price
    // endpoint uses (S3), not a live join against InventoryItem.currentCost.
    const lastPrices = await Promise.all(
      input.lines.map((l) => lastPriceRepository.findLastReceiptLine(l.inventoryItemId, organizationId)),
    );

    const lines: GoodsReceiptLineInput[] = input.lines.map((line, index) => {
      const item = itemsById.get(line.inventoryItemId)!;
      const lastPrice = lastPrices[index] ? lastPrices[index]!.unitPrice : null;
      return buildLineInput(line, item, lastPrice);
    });

    // No ledger entry is ever written here (contract behaviour #1,
    // API_CONTRACT.md §22.4) — DRAFT only. No InventoryTransaction import,
    // no ledger $transaction; only the reference counter and the
    // GoodsReceipt/-Line rows themselves are written.
    const created = await prisma
      .$transaction(async (tx) => {
        const reference = await referenceCounterRepository.nextReference(tx, organizationId, 'GRN');
        return goodsReceiptRepository.create(
          organizationId,
          reference,
          {
            supplierId: input.supplierId,
            expectedDeliveryId: input.expectedDeliveryId ?? null,
            paymentTerms: input.paymentTerms,
            supplierDocNumber: input.supplierDocNumber ?? null,
            supplierDocDate: input.supplierDocDate ? new Date(input.supplierDocDate) : null,
            locationId: centralStore.id,
            createdById: actor.id,
            lines,
          },
          tx,
        );
      })
      .catch((error: unknown) => mapPrismaError(error));

    return serializeGoodsReceipt(created);
  },

  updateGoodsReceipt: async (
    actor: Actor,
    id: string,
    input: UpdateGoodsReceiptInput,
  ): Promise<GoodsReceiptDetail> => {
    const organizationId = await requireHubActor(actor);
    const existing = await goodsReceiptRepository.findById(id, organizationId);
    if (!existing) throw new NotFoundError('Goods receipt not found');
    if (existing.status !== 'DRAFT') throw new ConflictError('Only a draft receipt can be edited');

    let lines: GoodsReceiptLineInput[] | undefined;
    if (input.lines) {
      const itemIds = input.lines.map((l) => l.inventoryItemId);
      const liveItems = await inventoryItemRepository.findLiveByIds(itemIds, organizationId);
      const itemsById = new Map(liveItems.map((i) => [i.id, i]));
      for (const line of input.lines) {
        if (!itemsById.has(line.inventoryItemId)) {
          throw new ValidationError('One or more items were not found');
        }
      }
      const lastPrices = await Promise.all(
        input.lines.map((l) => lastPriceRepository.findLastReceiptLine(l.inventoryItemId, organizationId)),
      );
      lines = input.lines.map((line, index) => {
        const item = itemsById.get(line.inventoryItemId)!;
        const lastPrice = lastPrices[index] ? lastPrices[index]!.unitPrice : null;
        return buildLineInput(line, item, lastPrice);
      });
    }

    const updated = await goodsReceiptRepository.update(id, organizationId, {
      expectedDeliveryId: input.expectedDeliveryId,
      paymentTerms: input.paymentTerms,
      supplierDocNumber: input.supplierDocNumber,
      supplierDocDate: input.supplierDocDate ? new Date(input.supplierDocDate) : undefined,
      lines,
    });
    // Race-safety re-check (same pattern as cancelExpectedDelivery): the
    // findById above confirmed DRAFT, but update's own status-guarded
    // updateMany is the actual source of truth if a concurrent sign happened
    // in between.
    if (!updated) throw new ConflictError('Only a draft receipt can be edited');

    return serializeGoodsReceipt(updated);
  },

  /**
   * The ledger-writing endpoint (plan §1.6, API_CONTRACT.md §22.4 #1). The
   * ledger write and the DRAFT→* status transition happen in the same
   * `prisma.$transaction`, and nowhere else.
   */
  signGoodsReceipt: async (
    actor: Actor,
    id: string,
    input: SignGoodsReceiptInput,
  ): Promise<GoodsReceiptDetail> => {
    const organizationId = await requireHubActor(actor);

    const actorWithPin = await authRepository.findUserByIdWithPassword(actor.id);
    if (!actorWithPin || !actorWithPin.pinHash) {
      throw new UnauthorizedError('No PIN is set for this account');
    }
    const pinValid = await comparePin(input.pin, actorWithPin.pinHash);
    if (!pinValid) throw new UnauthorizedError('Incorrect PIN');

    const receipt = await goodsReceiptRepository.findById(id, organizationId);
    if (!receipt) throw new NotFoundError('Goods receipt not found');
    if (receipt.status !== 'DRAFT') throw new ConflictError('This receipt has already been signed');
    if (receipt.lines.length === 0) throw new ConflictError('A receipt with no lines cannot be signed');

    const centralStore = await locationRepository.findCentralStore();
    if (!centralStore || centralStore.organizationId !== organizationId) {
      throw new NotFoundError('No Central Store is configured for this organization');
    }

    const signedAt = new Date();
    const newStatus = receipt.paymentTerms === 'PAY_NOW' ? 'RECEIVED_PAID' : 'RECEIVED_INVOICE_PENDING';

    await prisma.$transaction(async (tx) => {
      const signedCount = await goodsReceiptRepository.markSigned(id, organizationId, tx, {
        status: newStatus,
        signedById: actor.id,
        signedAt,
      });
      if (signedCount === 0) {
        // Someone else signed/cancelled it between the findById above and
        // this update — the whole transaction rolls back, no ledger rows,
        // no partial state (plan §1.6's "no partial-signed state" rule).
        throw new ConflictError('This receipt has already been signed');
      }

      for (const line of receipt.lines) {
        await tx.inventoryTransaction.create({
          data: {
            organizationId,
            locationId: centralStore.id,
            inventoryItemId: line.inventoryItemId,
            type: 'RECEIVE',
            quantity: line.quantityUsageUnit,
            unitCost: costPerUsageUnit(line.unitPrice, line.quantityBuyUnit, line.quantityUsageUnit),
            goodsReceiptLineId: line.id,
            userId: actor.id,
          },
        });
        // Latest-price costing (01-description.md §4): the new price wins
        // outright, no averaging. The prior value survives only in this
        // line's own priceAlertPrevPrice snapshot, taken at create/update
        // time — never recomputed from here. Stored PER USAGE UNIT (the
        // receipt line's price is per buy unit) — see receiving-cost.ts.
        await tx.inventoryItem.update({
          where: { id: line.inventoryItemId },
          data: { currentCost: costPerUsageUnit(line.unitPrice, line.quantityBuyUnit, line.quantityUsageUnit) },
        });
      }

      await goodsReceiptRepository.markPriceAlertsAccepted(input.acceptedPriceAlerts, actor.id, tx);

      if (receipt.expectedDeliveryId) {
        await expectedDeliveryRepository.markFulfilled(receipt.expectedDeliveryId, organizationId, tx);
      }
    });

    const signed = await goodsReceiptRepository.findById(id, organizationId);
    if (!signed) throw new NotFoundError('Goods receipt not found');

    // Fire-and-forget notification (plan §3.3) — composed inline from the
    // existing socket/FCM primitives (no generic notifyRole() helper exists
    // in this codebase; every service wires its own call site the same way).
    // Never blocks or fails the sign response.
    void notifyHubStoreManagersOfSignedReceipt(organizationId, signed, actor.id, actorWithPin.name);

    return serializeGoodsReceipt(signed);
  },

  // ── What we owe (Supplier AP) — S7 ───────────────────────────────────────

  getApSummary: async (actor: Actor): Promise<ApSummary> => {
    const organizationId = await requireHubActor(actor);
    const invoices = await supplierInvoiceRepository.findAllByOrganization(organizationId);
    const supplierIds = new Set(invoices.map((i) => i.supplierId));

    let totalInvoiced = new Prisma.Decimal(0);
    let totalPaid = new Prisma.Decimal(0);
    let totalOutstanding = new Prisma.Decimal(0);
    const suppliersWithBalance = new Set<string>();

    for (const invoice of invoices) {
      totalInvoiced = totalInvoiced.plus(invoice.amountBilled).plus(sumAdjustments(invoice));
      totalPaid = totalPaid.plus(sumAllocations(invoice));
      const outstanding = computeOutstanding(invoice);
      totalOutstanding = totalOutstanding.plus(outstanding);
      if (outstanding.greaterThan(0)) suppliersWithBalance.add(invoice.supplierId);
    }

    return {
      totalInvoiced: toDecimalString(totalInvoiced),
      totalPaid: toDecimalString(totalPaid),
      totalOutstanding: toDecimalString(totalOutstanding),
      supplierCount: supplierIds.size,
      suppliersWithBalance: suppliersWithBalance.size,
    };
  },

  /**
   * The how-overdue table. Computed at query time, never cached (plan §1.5) —
   * every request re-derives every supplier's row from its live invoice set.
   *
   * AMENDMENT 2026-09-18 (S8): `limit`/`cursor` were accepted by
   * `ListSupplierApQuerySchema` but never applied — every request derived
   * every supplier-with-invoices in the org, unbounded. `search`/`terms`
   * (cheap, no derivation needed) are now pushed into the DB query;
   * `hasBalance`/`agingBucket` stay as post-derivation filters (they depend
   * on each supplier's computed row); the final filtered set is sorted by
   * name (matching the repository's `orderBy`) and paginated by
   * `supplierId` cursor. The frontend infers `hasMore` from
   * `data.length === limit`, same convention as this module's other
   * bare-array list endpoints (`use-purchasing-history-list.ts`).
   */
  listSupplierAp: async (actor: Actor, query: ListSupplierApQuery): Promise<SupplierApRow[]> => {
    const organizationId = await requireHubActor(actor);
    const now = new Date();

    const suppliers = await supplierApRepository.findSuppliersWithInvoices(organizationId, {
      search: query.search,
      terms: query.terms,
    });

    const rows = await Promise.all(
      suppliers.map(async (supplier) => {
        const invoices = await supplierInvoiceRepository.findAllBySupplier(supplier.id, organizationId);
        return buildSupplierApRow(supplier, invoices, now);
      }),
    );

    let filteredRows = rows;
    if (query.hasBalance !== undefined) {
      filteredRows = filteredRows.filter((r) => (Number(r.outstanding) > 0) === query.hasBalance);
    }
    if (query.agingBucket) {
      filteredRows = filteredRows.filter((r) => Number(r.buckets[query.agingBucket!]) > 0);
    }

    filteredRows.sort((a, b) => a.supplierName.localeCompare(b.supplierName));

    const startIndex = query.cursor ? filteredRows.findIndex((r) => r.supplierId === query.cursor) + 1 : 0;
    return filteredRows.slice(startIndex, startIndex + query.limit);
  },

  /**
   * Supplier detail: profile, bucket panel, invoices, payments, purchase
   * history. Calls the exact same `buildSupplierApRow` derivation as
   * `listSupplierAp` so the two views can never disagree — the plan §1.5
   * invariant this session's reconciliation test asserts.
   *
   * AMENDMENT 2026-09-18 (S8): `supplier` (profile fields) and
   * `purchaseHistory` added — both named in-scope for `VND-0` by plan §0 but
   * missing from the original response. Profile now comes from
   * `supplierRepository.findById` (Milestone One's full-row query, now
   * carrying `paymentDays`) instead of `supplierApRepository.findSupplierForAp`
   * (id/name/terms only) — the latter is kept for `listSupplierAp`, which
   * only needs those three fields per row. Purchase history reuses
   * `goodsReceiptRepository.findAllByOrganization` filtered by `supplierId`
   * — no new query.
   */
  getSupplierApDetail: async (actor: Actor, supplierId: string): Promise<SupplierApDetail> => {
    const organizationId = await requireHubActor(actor);
    const supplierRow = await supplierRepository.findById(supplierId, organizationId);
    if (!supplierRow) throw new NotFoundError('Supplier not found');
    const supplierForAp: SupplierForAp = {
      id: supplierRow.id,
      name: supplierRow.name,
      paymentTerms: supplierRow.defaultPaymentTerms,
    };

    const [invoices, payments, purchaseHistory] = await Promise.all([
      supplierInvoiceRepository.findAllBySupplier(supplierId, organizationId),
      supplierPaymentRepository.findAllBySupplier(supplierId, organizationId),
      goodsReceiptRepository.findAllByOrganization(organizationId, {
        supplierId,
        limit: 100,
      }),
    ]);

    return {
      supplier: {
        id: supplierRow.id,
        name: supplierRow.name,
        contactName: supplierRow.contactName,
        category: supplierRow.category,
        phone: supplierRow.phone,
        email: supplierRow.email,
        location: supplierRow.location,
        defaultPaymentTerms: supplierRow.defaultPaymentTerms,
        paymentDays: supplierRow.paymentDays,
        retiredAt: supplierRow.deletedAt?.toISOString() ?? null,
        createdAt: supplierRow.createdAt.toISOString(),
        updatedAt: supplierRow.updatedAt.toISOString(),
      },
      row: buildSupplierApRow(supplierForAp, invoices, new Date()),
      invoices: invoices.map(serializeSupplierInvoice),
      payments: payments.map(serializeSupplierPayment),
      purchaseHistory: purchaseHistory.map(serializeGoodsReceipt),
    };
  },

  /**
   * One endpoint for "Save invoice", "Record at billed — open dispute", AND
   * "Hold" (Hold never calls this at all — it's the client-side no-write
   * branch). Plan §3.2, API_CONTRACT.md §22.4 #4.
   */
  createSupplierInvoice: async (
    actor: Actor,
    input: CreateSupplierInvoiceContractInput,
  ): Promise<SupplierInvoice> => {
    const organizationId = await requireHubActor(actor);

    const supplier = await supplierRepository.findById(input.supplierId, organizationId);
    if (!supplier) throw new NotFoundError('Supplier not found');
    if (supplier.deletedAt) throw new ConflictError('This supplier is retired');

    const receipts = await Promise.all(
      input.goodsReceiptIds.map((id) => goodsReceiptRepository.findById(id, organizationId)),
    );
    for (const [index, receipt] of receipts.entries()) {
      if (!receipt) throw new NotFoundError(`Goods receipt ${input.goodsReceiptIds[index]} not found`);
    }
    const foundReceipts = receipts as GoodsReceiptWithRelations[];

    const distinctSuppliers = new Set(foundReceipts.map((r) => r.supplierId));
    if (distinctSuppliers.size > 1 || (distinctSuppliers.size === 1 && !distinctSuppliers.has(input.supplierId))) {
      throw new ValidationError('All receipts on one invoice must belong to the same supplier');
    }

    const alreadyInvoiced = await supplierInvoiceRepository.findInvoicedReceiptIds(input.goodsReceiptIds);
    if (alreadyInvoiced.size > 0) {
      throw new ConflictError('One or more receipts are already invoiced');
    }

    const invoiceDate = new Date(input.invoiceDate);
    // Computed once, at creation, and stored — never recomputed from a later
    // change to Supplier.paymentDays (plan §1.3, contract behaviour #8).
    const dueDate = new Date(invoiceDate);
    dueDate.setDate(dueDate.getDate() + supplier.paymentDays);

    const created = await prisma
      .$transaction(async (tx) => {
        const invoice = await supplierInvoiceRepository.create(
          organizationId,
          {
            supplierId: input.supplierId,
            goodsReceiptIds: input.goodsReceiptIds,
            invoiceNumber: input.invoiceNumber,
            invoiceDate,
            dueDate,
            amountBilled: input.amountBilled,
            dispute: input.dispute,
            recordedById: actor.id,
          },
          tx,
        );
        await supplierInvoiceRepository.markReceiptsInvoiceRecorded(input.goodsReceiptIds, tx);
        return invoice;
      })
      .catch((error: unknown) =>
        mapPrismaError(error, { conflict: 'An invoice with this number already exists for this supplier' }),
      );

    return serializeSupplierInvoice(created);
  },

  /**
   * The Accountant's reconciliation adjustment (Flow 17 step 3) — mandatory
   * reason (enforced at the Zod layer), never touches InventoryTransaction
   * (the Accountant cannot move stock, 01-description.md §2).
   */
  createInvoiceAdjustment: async (
    actor: Actor,
    invoiceId: string,
    input: CreateInvoiceAdjustmentInput,
  ): Promise<SupplierInvoice> => {
    const organizationId = await requireHubActor(actor);
    const invoice = await supplierInvoiceRepository.findById(invoiceId, organizationId);
    if (!invoice) throw new NotFoundError('Supplier invoice not found');

    const updated = await prisma.$transaction(async (tx) => {
      await supplierInvoiceRepository.createAdjustment(
        invoiceId,
        { amount: input.amount, reason: input.reason, recordedById: actor.id },
        tx,
      );
      const refreshed = await supplierInvoiceRepository.findById(invoiceId, organizationId, tx);
      if (!refreshed) throw new NotFoundError('Supplier invoice not found');
      await supplierInvoiceRepository.updateStatus(invoiceId, deriveInvoiceStatus(refreshed), tx);
      return supplierInvoiceRepository.findById(invoiceId, organizationId, tx);
    });
    if (!updated) throw new NotFoundError('Supplier invoice not found');

    return serializeSupplierInvoice(updated);
  },

  /**
   * Overpayment (Σ allocations < amount) is allowed, not an error — the
   * excess is never written to a stored balance; it's derived at read time
   * (plan §1.4, §1.5, contract behaviour #6).
   */
  createSupplierPayment: async (
    actor: Actor,
    input: CreateSupplierPaymentContractInput,
  ): Promise<SupplierPayment> => {
    const organizationId = await requireHubActor(actor);

    const supplier = await supplierRepository.findById(input.supplierId, organizationId);
    if (!supplier) throw new NotFoundError('Supplier not found');

    const invoices = await Promise.all(
      input.allocations.map((a) => supplierInvoiceRepository.findById(a.supplierInvoiceId, organizationId)),
    );
    for (const [index, invoice] of invoices.entries()) {
      if (!invoice) throw new NotFoundError(`Invoice ${input.allocations[index]!.supplierInvoiceId} not found`);
    }
    const foundInvoices = invoices as SupplierInvoiceWithRelations[];

    for (const [index, invoice] of foundInvoices.entries()) {
      const status = deriveInvoiceStatus(invoice);
      if (status === 'PAID') {
        throw new ConflictError(`Invoice ${invoice.invoiceNumber} is already fully paid`);
      }
      const outstanding = computeOutstanding(invoice);
      const allocationAmount = new Prisma.Decimal(input.allocations[index]!.amount);
      if (allocationAmount.greaterThan(outstanding)) {
        throw new ValidationError(`Allocation exceeds invoice ${invoice.invoiceNumber}'s outstanding balance`);
      }
    }

    const created = await prisma
      .$transaction(async (tx) => {
        const payment = await supplierPaymentRepository.create(
          organizationId,
          {
            supplierId: input.supplierId,
            amount: input.amount,
            paidAt: new Date(input.paidAt),
            method: input.method,
            reference: input.reference ?? null,
            allocations: input.allocations.map((a) => ({ supplierInvoiceId: a.supplierInvoiceId, amount: a.amount })),
            recordedById: actor.id,
          },
          tx,
        );
        for (const invoice of foundInvoices) {
          const refreshed = await supplierInvoiceRepository.findById(invoice.id, organizationId, tx);
          if (refreshed) {
            await supplierInvoiceRepository.updateStatus(invoice.id, deriveInvoiceStatus(refreshed), tx);
          }
        }
        return payment;
      })
      .catch((error: unknown) => mapPrismaError(error));

    return serializeSupplierPayment(created);
  },

  /**
   * Payments are immutable — a correction is a reversal, never an edit
   * (contract behaviour #7). Creates a new payment row with `reversalOfId`
   * set and negative allocations; the original is never mutated or deleted.
   */
  reverseSupplierPayment: async (
    actor: Actor,
    paymentId: string,
    input: ReverseSupplierPaymentInput,
  ): Promise<SupplierPayment> => {
    const organizationId = await requireHubActor(actor);
    const payment = await supplierPaymentRepository.findById(paymentId, organizationId);
    if (!payment) throw new NotFoundError('Supplier payment not found');
    if (payment.reversalOfId !== null) {
      throw new ConflictError('A reversal payment cannot itself be reversed');
    }

    const reversal = await prisma.$transaction(async (tx) => {
      const created = await supplierPaymentRepository.createReversal(
        organizationId,
        {
          supplierId: payment.supplierId,
          reversalOfId: payment.id,
          reversalReason: input.reason,
          recordedById: actor.id,
          allocations: payment.allocations.map((a) => ({ supplierInvoiceId: a.supplierInvoiceId, amount: a.amount })),
        },
        tx,
      );
      for (const allocation of payment.allocations) {
        const refreshed = await supplierInvoiceRepository.findById(allocation.supplierInvoiceId, organizationId, tx);
        if (refreshed) {
          await supplierInvoiceRepository.updateStatus(
            allocation.supplierInvoiceId,
            deriveInvoiceStatus(refreshed),
            tx,
          );
        }
      }
      return created;
    });

    return serializeSupplierPayment(reversal);
  },
};
