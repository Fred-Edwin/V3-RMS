import type { Request } from 'express';
import { Prisma, type PurchaseOrderStatus } from '@prisma/client';
import { prisma } from '../config/database';
import {
  purchaseOrderRepository,
  type PurchaseOrderWithLines,
} from '../repositories/purchase-order-repository';
import { inventoryItemRepository } from '../repositories/inventory-item-repository';
import { supplierRepository } from '../repositories/supplier-repository';
import { inventoryTransactionRepository } from '../repositories/inventory-transaction-repository';
import { inventoryTransactionService } from './inventory-transaction-service';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors';
import type {
  CreatePurchaseOrderInput,
  ReceivePurchaseOrderLineInput,
  UpdatePurchaseOrderLinesInput,
} from '../validators/purchase-order-schemas';

type Actor = NonNullable<Request['user']>;

const requireOrganization = (actor: Actor): string => {
  if (!actor.organizationId) {
    throw new ValidationError('Branch context missing for this user');
  }
  return actor.organizationId;
};

/** `PO-<yymmdd>-<4 random base36 chars>` — human-readable, not a hot concurrent path like orders, so no counter table. */
const generatePoNumber = (): string => {
  const now = new Date();
  const y = String(now.getFullYear()).slice(2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `PO-${y}${m}${d}-${suffix}`;
};

export const purchaseOrderService = {
  list: async (actor: Actor, status?: PurchaseOrderStatus) => {
    const organizationId = requireOrganization(actor);
    return purchaseOrderRepository.findAllByOrganization(organizationId, { status });
  },

  getById: async (actor: Actor, id: string): Promise<PurchaseOrderWithLines> => {
    const organizationId = requireOrganization(actor);
    const po = await purchaseOrderRepository.findById(id, organizationId);
    if (!po) {
      throw new NotFoundError('Purchase order not found');
    }
    return po;
  },

  /** Create (draft) — both roles per §8.3. */
  create: async (actor: Actor, input: CreatePurchaseOrderInput): Promise<PurchaseOrderWithLines> => {
    const organizationId = requireOrganization(actor);

    const supplier = await supplierRepository.findById(input.supplierId, organizationId);
    if (!supplier) {
      throw new ValidationError('supplierId does not reference a known supplier');
    }

    for (const line of input.lines) {
      const item = await inventoryItemRepository.findById(line.inventoryItemId, organizationId);
      if (!item) {
        throw new ValidationError(`Line references unknown inventory item: ${line.inventoryItemId}`);
      }
    }

    return purchaseOrderRepository.create(organizationId, {
      supplierId: input.supplierId,
      locationId: input.locationId,
      poNumber: generatePoNumber(),
      createdById: actor.id,
      lines: input.lines,
    });
  },

  /**
   * Edit lines — Manager-only, DRAFT only. A mis-keyed draft (wrong item,
   * qty, or price) previously had no fix short of cancel-and-recreate; this
   * lets the Manager correct it in place before sending.
   */
  updateLines: async (
    actor: Actor,
    id: string,
    input: UpdatePurchaseOrderLinesInput,
  ): Promise<PurchaseOrderWithLines> => {
    const organizationId = requireOrganization(actor);
    const po = await purchaseOrderRepository.findById(id, organizationId);
    if (!po) {
      throw new NotFoundError('Purchase order not found');
    }
    if (po.status !== 'DRAFT') {
      throw new ConflictError('Only a DRAFT purchase order can have its lines edited');
    }

    for (const line of input.lines) {
      const item = await inventoryItemRepository.findById(line.inventoryItemId, organizationId);
      if (!item) {
        throw new ValidationError(`Line references unknown inventory item: ${line.inventoryItemId}`);
      }
    }

    await prisma.$transaction(async (tx) => {
      await purchaseOrderRepository.replaceLines(id, organizationId, input.lines, tx);
    });

    return purchaseOrderService.getById(actor, id);
  },

  /**
   * Unsend — Manager-only. SENT -> DRAFT, so a Manager who sent a PO too
   * early (before double-checking a line) can pull it back for editing.
   * Blocked once any line has been received — reversing a ledger write is
   * a different, riskier operation than reversing a status flag (see
   * reverseLineReceipt), so a PO that's PARTIALLY_RECEIVED cannot be
   * unsent in one step; each received line must be reversed first.
   */
  unsend: async (actor: Actor, id: string): Promise<PurchaseOrderWithLines> => {
    const organizationId = requireOrganization(actor);
    const transitioned = await purchaseOrderRepository.transitionStatus(
      id,
      organizationId,
      ['SENT'],
      'DRAFT',
      { sentAt: null },
    );
    if (!transitioned) {
      const existing = await purchaseOrderRepository.findById(id, organizationId);
      if (!existing) throw new NotFoundError('Purchase order not found');
      throw new ConflictError(
        existing.status === 'PARTIALLY_RECEIVED'
          ? 'This order already has received lines — reverse those receipts before unsending'
          : 'Purchase order must be SENT to unsend',
      );
    }
    return purchaseOrderService.getById(actor, id);
  },

  /**
   * Reverse a line's most recent receipt — for a mis-tapped Confirm during
   * receiving. Posts an offsetting ADJUSTMENT transaction at the reversed
   * receipt's own recorded price (not current cost) so on-hand qty ends up
   * correct; matches the Stock Count adjustment precedent
   * (inventoryTransactionService is the only writer of currentCost, and its
   * weighted-average formula is not cleanly invertible once later receipts
   * may have landed — see the design note this was scoped against). The
   * item's currentCost is therefore not rolled back to its exact
   * pre-receipt value; this is the same accepted trade-off the Stock Count
   * adjustment path already lives with, not a new limitation.
   */
  reverseLineReceipt: async (actor: Actor, purchaseOrderId: string, lineId: string): Promise<PurchaseOrderWithLines> => {
    const organizationId = requireOrganization(actor);
    const po = await purchaseOrderRepository.findById(purchaseOrderId, organizationId);
    if (!po) {
      throw new NotFoundError('Purchase order not found');
    }
    if (po.status !== 'SENT' && po.status !== 'PARTIALLY_RECEIVED' && po.status !== 'CLOSED') {
      throw new ConflictError('This order has no receipt to reverse');
    }

    const line = po.lines.find((l) => l.id === lineId);
    if (!line) {
      throw new NotFoundError('Purchase order line not found on this purchase order');
    }
    if (line.receivedQty.lessThanOrEqualTo(0)) {
      throw new ConflictError('This line has not been received yet');
    }

    const lastReceive = await inventoryTransactionRepository.findLatestReceiveByPurchaseOrderLine(
      organizationId,
      lineId,
    );
    if (!lastReceive) {
      throw new ConflictError('No receiving record found for this line to reverse');
    }

    await prisma.$transaction(async (tx) => {
      await inventoryTransactionRepository.create(
        {
          organizationId,
          locationId: po.locationId,
          inventoryItemId: line.inventoryItemId,
          type: 'ADJUSTMENT',
          quantity: lastReceive.quantity.neg(),
          unitCost: lastReceive.unitCost,
          userId: actor.id,
          reason: 'Receiving correction — reversed a mistaken confirm',
          purchaseOrderLineId: lineId,
        },
        tx,
      );

      await purchaseOrderRepository.resetLineReceipt(lineId, organizationId, tx);

      const refreshedPo = await purchaseOrderRepository.findById(purchaseOrderId, organizationId, tx);
      const anyLineReceived = refreshedPo!.lines.some((l) => l.receivedQty.greaterThan(0));

      await purchaseOrderRepository.transitionStatus(
        purchaseOrderId,
        organizationId,
        ['SENT', 'PARTIALLY_RECEIVED', 'CLOSED'],
        anyLineReceived ? 'PARTIALLY_RECEIVED' : 'SENT',
        {},
        tx,
      );
    });

    return purchaseOrderService.getById(actor, purchaseOrderId);
  },

  /** Send — Manager-only per §8.3. DRAFT -> SENT. */
  send: async (actor: Actor, id: string): Promise<PurchaseOrderWithLines> => {
    const organizationId = requireOrganization(actor);
    const transitioned = await purchaseOrderRepository.transitionStatus(
      id,
      organizationId,
      ['DRAFT'],
      'SENT',
      { sentAt: new Date() },
    );
    if (!transitioned) {
      const existing = await purchaseOrderRepository.findById(id, organizationId);
      if (!existing) throw new NotFoundError('Purchase order not found');
      throw new ConflictError('Purchase order must be in DRAFT status to send');
    }
    return purchaseOrderService.getById(actor, id);
  },

  /** Cancel — Manager-only per §8.3. DRAFT or SENT -> CANCELLED. */
  cancel: async (actor: Actor, id: string): Promise<PurchaseOrderWithLines> => {
    const organizationId = requireOrganization(actor);
    const transitioned = await purchaseOrderRepository.transitionStatus(
      id,
      organizationId,
      ['DRAFT', 'SENT'],
      'CANCELLED',
      { cancelledAt: new Date() },
    );
    if (!transitioned) {
      const existing = await purchaseOrderRepository.findById(id, organizationId);
      if (!existing) throw new NotFoundError('Purchase order not found');
      throw new ConflictError('Only a DRAFT or SENT purchase order can be cancelled');
    }
    return purchaseOrderService.getById(actor, id);
  },

  /**
   * Low-stock "suggest order" prefill: for every active item at/under its
   * reorderLevel at the given location, suggest ordering back up to 2x the
   * reorder level (a simple, explainable default — not a forecasting model).
   * On-hand is derived from the ledger (Session 2's
   * sumQuantityByItemAndLocation) — never a second stock counter.
   */
  suggestOrderLines: async (
    actor: Actor,
    locationId: string,
  ): Promise<{ inventoryItemId: string; name: string; onHandQty: string; suggestedQty: string }[]> => {
    const organizationId = requireOrganization(actor);
    const items = await inventoryItemRepository.findAllByOrganization(organizationId, { isActive: true });

    const suggestions: { inventoryItemId: string; name: string; onHandQty: string; suggestedQty: string }[] = [];
    for (const item of items) {
      const onHand = await inventoryTransactionRepository.sumQuantityByItemAndLocation(
        organizationId,
        item.id,
        locationId,
      );
      if (onHand.lessThanOrEqualTo(item.reorderLevel)) {
        const target = item.reorderLevel.mul(2);
        const suggestedQty = target.sub(onHand).lessThanOrEqualTo(0) ? item.reorderLevel : target.sub(onHand);
        suggestions.push({
          inventoryItemId: item.id,
          name: item.name,
          onHandQty: onHand.toString(),
          suggestedQty: suggestedQty.toString(),
        });
      }
    }
    return suggestions;
  },

  /**
   * Receiving: records actual qty + invoice price per PO line via Session 2's
   * recordReceive (never reimplements weighted-average costing/UOM
   * conversion), then updates the line's receivedQty/invoicePrice and the
   * PO's overall status. Partial receipt -> PARTIALLY_RECEIVED; full receipt
   * (every line's receivedQty >= orderedQty) -> CLOSED.
   */
  receiveLine: async (
    actor: Actor,
    purchaseOrderId: string,
    lineId: string,
    input: ReceivePurchaseOrderLineInput,
  ): Promise<PurchaseOrderWithLines> => {
    const organizationId = requireOrganization(actor);

    const po = await purchaseOrderRepository.findById(purchaseOrderId, organizationId);
    if (!po) {
      throw new NotFoundError('Purchase order not found');
    }
    if (po.status !== 'SENT' && po.status !== 'PARTIALLY_RECEIVED') {
      throw new ConflictError('Purchase order must be SENT or PARTIALLY_RECEIVED to record a receipt');
    }

    const line = po.lines.find((l) => l.id === lineId);
    if (!line) {
      throw new NotFoundError('Purchase order line not found on this purchase order');
    }

    const receivedQty = new Prisma.Decimal(input.receivedQty);
    if (receivedQty.lessThanOrEqualTo(0)) {
      throw new ValidationError('Received quantity must be greater than zero');
    }

    // Session 2's recordReceive owns its own $transaction (the ledger write +
    // currentCost update must be atomic together). It's called as its own
    // unit here rather than nested inside a second $transaction below —
    // Prisma's interactive transactions don't compose across separate
    // `prisma.$transaction` calls on the same client.
    await inventoryTransactionService.recordReceive({
      organizationId,
      locationId: po.locationId,
      userId: actor.id,
      inventoryItemId: line.inventoryItemId,
      buyQty: receivedQty,
      unitPrice: input.invoicePrice,
      purchaseOrderLineId: line.id,
    });

    await prisma.$transaction(async (tx) => {
      await purchaseOrderRepository.updateLineReceipt(
        lineId,
        organizationId,
        { receivedQty, invoicePrice: input.invoicePrice, receivedAt: new Date() },
        tx,
      );

      const refreshedPo = await purchaseOrderRepository.findById(purchaseOrderId, organizationId, tx);
      const allLinesFullyReceived = refreshedPo!.lines.every((l) => l.receivedQty.greaterThanOrEqualTo(l.orderedQty));

      await purchaseOrderRepository.transitionStatus(
        purchaseOrderId,
        organizationId,
        ['SENT', 'PARTIALLY_RECEIVED'],
        allLinesFullyReceived ? 'CLOSED' : 'PARTIALLY_RECEIVED',
        allLinesFullyReceived ? { closedAt: new Date() } : {},
        tx,
      );
    });

    return purchaseOrderService.getById(actor, purchaseOrderId);
  },
};
