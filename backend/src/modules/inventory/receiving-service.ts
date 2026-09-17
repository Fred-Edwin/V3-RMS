import type { Request } from 'express';
import { Prisma } from '@prisma/client';
import {
  expectedDeliveryRepository,
  lastPriceRepository,
  recentSupplierItemsRepository,
  referenceCounterRepository,
  type ExpectedDeliveryWithRelations,
} from './receiving-repository';
import { supplierRepository } from './inventory-repository';
import { inventoryItemRepository } from './inventory-repository';
import { branchRepository } from '../../repositories/branch-repository';
import { prisma } from '../../config/database';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../utils/errors';
import { mapPrismaError } from '../../utils/prisma-errors';
import type {
  CreateExpectedDeliveryInput as CreateExpectedDeliveryContractInput,
  ExpectedDeliverySummary,
  ListExpectedDeliveriesQuery,
  PurchasingHistoryRow,
  PurchasingSummary,
  RecentSupplierItem,
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
    supplierId: delivery.supplierId,
    supplierName: delivery.supplier.name,
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

const paymentTermsLabel = (terms: 'INVOICE_TO_FOLLOW' | 'PAY_NOW'): string =>
  terms === 'PAY_NOW' ? 'Paid on delivery' : 'Invoice';

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
    supplierName: summary.supplierName,
    paymentTermsLabel: paymentTermsLabel(delivery.paymentTerms),
    detailLabel,
    ageLabel: summary.ageLabel,
    statusLabel,
    statusTone,
    actions: [{ label: 'View' }, { label: 'Cancel', emphasized: false }],
  };
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

    const supplier = await supplierRepository.findById(input.supplierId, organizationId);
    if (!supplier) throw new NotFoundError('Supplier not found');
    if (supplier.deletedAt) throw new ConflictError('This supplier is retired');

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
};
