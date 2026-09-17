import type { Request } from 'express';
import { Prisma } from '@prisma/client';
import {
  expectedDeliveryRepository,
  goodsReceiptRepository,
  lastPriceRepository,
  recentSupplierItemsRepository,
  referenceCounterRepository,
  type ExpectedDeliveryWithRelations,
  type GoodsReceiptLineInput,
  type GoodsReceiptWithRelations,
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
import type {
  CreateExpectedDeliveryInput as CreateExpectedDeliveryContractInput,
  CreateGoodsReceiptInput as CreateGoodsReceiptContractInput,
  ExpectedDeliverySummary,
  GoodsReceiptDetail,
  ListExpectedDeliveriesQuery,
  ListGoodsReceiptsQuery,
  PurchasingHistoryRow,
  PurchasingSummary,
  RecentSupplierItem,
  SignGoodsReceiptInput,
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
    const [expectedCount, overdueCount] = await Promise.all([
      expectedDeliveryRepository.countByStatus(organizationId, 'AWAITING'),
      expectedDeliveryRepository.countOverdue(organizationId, now),
    ]);

    return {
      expected: { count: expectedCount, overdue: overdueCount },
      // Filled in by S4 (goods receipts / RECEIVED_INVOICE_PENDING queue).
      awaitingInvoice: { count: 0, oldestDays: null },
      // Filled in by S7 (supplier invoices / payments read model).
      owed: { amount: '0.00', over30Count: 0 },
    };
  },

  /**
   * History band: a union of ExpectedDelivery and GoodsReceipt rows in one
   * table (plan §3.2). This session can only return the ExpectedDelivery half
   * — no GoodsReceipt rows exist yet — but the shape is the union shape now so
   * S4 only has to add the other branch, not restructure the endpoint.
   */
  getPurchasingHistory: async (
    actor: Actor,
    query: { search?: string; supplierId?: string; status?: string; from?: string; to?: string; limit: number },
  ): Promise<PurchasingHistoryRow[]> => {
    const organizationId = await requireHubActor(actor);
    const includeMoney = canSeeMoney(actor);
    const now = new Date();

    const deliveries = await expectedDeliveryRepository.findHistoryRows(organizationId, {
      search: query.search,
      supplierId: query.supplierId,
      status: query.status as never,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      limit: query.limit,
    });

    // TODO(S4): merge in `goodsReceipt` rows and re-sort the combined list by
    // date, once GoodsReceipt rows exist. `PurchasingHistoryRowSchema` already
    // declares that variant (API_CONTRACT.md §22.3).
    return deliveries.map((d) => toHistoryRow(d, includeMoney, now));
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
            unitCost: line.unitPrice,
            goodsReceiptLineId: line.id,
            userId: actor.id,
          },
        });
        // Latest-price costing (01-description.md §4): the new price wins
        // outright, no averaging. The prior value survives only in this
        // line's own priceAlertPrevPrice snapshot, taken at create/update
        // time — never recomputed from here.
        await tx.inventoryItem.update({
          where: { id: line.inventoryItemId },
          data: { currentCost: line.unitPrice },
        });
      }

      await goodsReceiptRepository.markPriceAlertsAccepted(input.acceptedPriceAlerts, actor.id, tx);
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
};
