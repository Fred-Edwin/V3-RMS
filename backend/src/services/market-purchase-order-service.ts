import type { Request } from 'express';
import { Prisma, type DepartmentTag } from '@prisma/client';
import {
  marketPurchaseOrderRepository,
  type MarketPurchaseOrderWithDetail,
} from '../repositories/market-purchase-order-repository';
import { locationRepository } from '../repositories/location-repository';
import { inventoryItemRepository } from '../repositories/inventory-item-repository';
import { inventoryTransactionRepository } from '../repositories/inventory-transaction-repository';
import { branchRepository } from '../repositories/branch-repository';
import { ForbiddenError, NotFoundError, ValidationError, ConflictError } from '../utils/errors';
import { prisma } from '../config/database';

type Actor = NonNullable<Request['user']>;

const requireOrganization = (actor: Actor): string => {
  if (!actor.organizationId) {
    throw new ValidationError('Branch context missing for this user');
  }
  return actor.organizationId;
};

/** D-22: a DEPARTMENT_HEAD requests market items only for their own department. */
const requireDepartmentHead = (actor: Actor): DepartmentTag => {
  if (actor.role !== 'DEPARTMENT_HEAD' || !actor.departmentTag) {
    throw new ForbiddenError('Only a Department Head may request market items');
  }
  return actor.departmentTag;
};

/** D-22: the Branch Manager is the approver and reconciler at their own branch — never the shopper. */
const requireManagerAccess = (actor: Actor, targetOrgId: string): void => {
  if (actor.role === 'DIRECTOR' || actor.role === 'SYSTEM_ADMIN') return;
  if (actor.role === 'MANAGER' && actor.organizationId === targetOrgId) return;
  throw new ForbiddenError('Only the Branch Manager of this branch, a Director, or a System Admin may act on this order');
};

export type RequestMarketItemsInput = {
  lines: { inventoryItemId: string; requestedQty: Prisma.Decimal.Value; notes?: string }[];
};

export type EditDraftLineInput = { lineId: string; requestedQty: Prisma.Decimal.Value };

export type ReconcileLineInput = {
  lineId: string;
  actualQty: Prisma.Decimal.Value;
  unitPrice: Prisma.Decimal.Value;
};

export const marketPurchaseOrderService = {
  list: async (actor: Actor, status?: string) => {
    const organizationId = requireOrganization(actor);
    return marketPurchaseOrderRepository.findAllByOrganization(organizationId, { status: status as never });
  },

  getById: async (actor: Actor, id: string): Promise<MarketPurchaseOrderWithDetail> => {
    const organizationId = requireOrganization(actor);
    const order = await marketPurchaseOrderRepository.findById(id, organizationId);
    if (!order) {
      throw new NotFoundError('Market Purchase Order not found');
    }
    return order;
  },

  /**
   * A Dept Head's own department's slice of one order — scoped server-side
   * so the mobile Receive screen can never see another department's lines,
   * per the approved design (each Dept Head confirms only their own portion).
   */
  getForDepartment: async (actor: Actor, id: string): Promise<MarketPurchaseOrderWithDetail> => {
    const organizationId = requireOrganization(actor);
    const departmentTag = requireDepartmentHead(actor);
    const order = await marketPurchaseOrderRepository.findByIdForDepartment(id, organizationId, departmentTag);
    if (!order || order.lines.length === 0) {
      throw new NotFoundError('Market Purchase Order not found for your department');
    }
    return order;
  },

  /**
   * D-22: exactly one active DRAFT order per branch. A Dept Head's requested
   * items land directly inside whichever draft is currently open — created
   * on demand if none exists — already grouped into that draft by department.
   */
  requestItems: async (actor: Actor, input: RequestMarketItemsInput): Promise<MarketPurchaseOrderWithDetail> => {
    const organizationId = requireOrganization(actor);
    const departmentTag = requireDepartmentHead(actor);

    if (input.lines.length === 0) {
      throw new ValidationError('A request must have at least one line');
    }

    const hub = await branchRepository.findHub();
    if (!hub) {
      throw new NotFoundError('No hub organization configured');
    }
    for (const line of input.lines) {
      const qty = new Prisma.Decimal(line.requestedQty);
      if (qty.lessThanOrEqualTo(0)) {
        throw new ValidationError('Requested quantity must be greater than zero');
      }
      const item = await inventoryItemRepository.findById(line.inventoryItemId, hub.id);
      if (!item) {
        throw new ValidationError(`Line references unknown inventory item: ${line.inventoryItemId}`);
      }
    }

    const order = await prisma.$transaction(async (tx) => {
      let draft = await marketPurchaseOrderRepository.findActiveDraft(organizationId, tx);
      if (!draft) {
        const orderNumber = await marketPurchaseOrderRepository.generateOrderNumber(organizationId);
        draft = await marketPurchaseOrderRepository.create(
          { organizationId, createdById: actor.id, orderNumber },
          tx,
        );
      }
      for (const line of input.lines) {
        await marketPurchaseOrderRepository.addLine(
          {
            marketPurchaseOrderId: draft.id,
            departmentTag,
            requestedById: actor.id,
            inventoryItemId: line.inventoryItemId,
            requestedQty: line.requestedQty,
            notes: line.notes,
          },
          tx,
        );
      }
      return draft;
    });

    return (await marketPurchaseOrderRepository.findById(order.id, organizationId))!;
  },

  /** Branch Manager's pre-send edit of the draft — any line, any department. */
  editDraftLines: async (
    actor: Actor,
    id: string,
    lines: EditDraftLineInput[],
  ): Promise<MarketPurchaseOrderWithDetail> => {
    const organizationId = requireOrganization(actor);
    const order = await marketPurchaseOrderRepository.findById(id, organizationId);
    if (!order) {
      throw new NotFoundError('Market Purchase Order not found');
    }
    requireManagerAccess(actor, order.organizationId);
    if (order.status !== 'DRAFT') {
      throw new ConflictError('Only a draft order can be edited');
    }

    const lineIds = new Set(order.lines.map((l) => l.id));
    for (const line of lines) {
      if (!lineIds.has(line.lineId)) {
        throw new ValidationError(`Line ${line.lineId} does not belong to this order`);
      }
      const qty = new Prisma.Decimal(line.requestedQty);
      if (qty.lessThanOrEqualTo(0)) {
        throw new ValidationError('Requested quantity must be greater than zero');
      }
    }

    await prisma.$transaction(async (tx) => {
      for (const line of lines) {
        await marketPurchaseOrderRepository.updateLineRequestedQty(line.lineId, id, line.requestedQty, tx);
      }
    });

    return (await marketPurchaseOrderRepository.findById(id, organizationId))!;
  },

  removeDraftLine: async (actor: Actor, id: string, lineId: string): Promise<MarketPurchaseOrderWithDetail> => {
    const organizationId = requireOrganization(actor);
    const order = await marketPurchaseOrderRepository.findById(id, organizationId);
    if (!order) {
      throw new NotFoundError('Market Purchase Order not found');
    }
    requireManagerAccess(actor, order.organizationId);
    if (order.status !== 'DRAFT') {
      throw new ConflictError('Only a draft order can be edited');
    }
    await marketPurchaseOrderRepository.removeLine(lineId, id);
    return (await marketPurchaseOrderRepository.findById(id, organizationId))!;
  },

  discardDraft: async (actor: Actor, id: string): Promise<void> => {
    const organizationId = requireOrganization(actor);
    const order = await marketPurchaseOrderRepository.findById(id, organizationId);
    if (!order) {
      throw new NotFoundError('Market Purchase Order not found');
    }
    requireManagerAccess(actor, order.organizationId);
    if (order.status !== 'DRAFT') {
      throw new ConflictError('Only a draft order can be discarded');
    }
    const transitioned = await marketPurchaseOrderRepository.transitionStatus(
      id,
      organizationId,
      ['DRAFT'],
      'REJECTED',
      { rejectionReason: 'Discarded by Branch Manager before send' },
    );
    if (!transitioned) {
      throw new ConflictError('Order was no longer a draft');
    }
  },

  /**
   * D-22: "Approve" locks the whole draft (pre-send checkpoint) — a
   * deliberately separate action from "send", so the order can be reviewed
   * as approved before it's actually sent to market.
   */
  approve: async (actor: Actor, id: string): Promise<MarketPurchaseOrderWithDetail> => {
    const organizationId = requireOrganization(actor);
    const order = await marketPurchaseOrderRepository.findById(id, organizationId);
    if (!order) {
      throw new NotFoundError('Market Purchase Order not found');
    }
    requireManagerAccess(actor, order.organizationId);
    if (order.status !== 'DRAFT') {
      throw new ConflictError('Only a draft order can be approved');
    }
    if (order.lines.length === 0) {
      throw new ValidationError('Cannot approve an empty order');
    }

    const transitioned = await marketPurchaseOrderRepository.transitionStatus(
      id,
      organizationId,
      ['DRAFT'],
      'APPROVED',
      { approvedById: actor.id, approvedAt: new Date() },
    );
    if (!transitioned) {
      throw new ConflictError('Order was no longer a draft');
    }

    return (await marketPurchaseOrderRepository.findById(id, organizationId))!;
  },

  /** Sends the approved order to market — a fresh empty draft can now start collecting the next round. */
  sendToMarket: async (actor: Actor, id: string): Promise<MarketPurchaseOrderWithDetail> => {
    const organizationId = requireOrganization(actor);
    const order = await marketPurchaseOrderRepository.findById(id, organizationId);
    if (!order) {
      throw new NotFoundError('Market Purchase Order not found');
    }
    requireManagerAccess(actor, order.organizationId);
    if (order.status !== 'APPROVED') {
      throw new ConflictError('Only an approved order can be sent to market');
    }

    const transitioned = await marketPurchaseOrderRepository.transitionStatus(
      id,
      organizationId,
      ['APPROVED'],
      'SENT_TO_MARKET',
    );
    if (!transitioned) {
      throw new ConflictError('Order was no longer approved');
    }

    return (await marketPurchaseOrderRepository.findById(id, organizationId))!;
  },

  /** Branch Manager begins entering actual qty/price per line, one at a time, before final signoff. */
  startReconciling: async (actor: Actor, id: string): Promise<MarketPurchaseOrderWithDetail> => {
    const organizationId = requireOrganization(actor);
    const order = await marketPurchaseOrderRepository.findById(id, organizationId);
    if (!order) {
      throw new NotFoundError('Market Purchase Order not found');
    }
    requireManagerAccess(actor, order.organizationId);
    if (order.status !== 'SENT_TO_MARKET') {
      throw new ConflictError('Only an order sent to market can begin reconciling');
    }

    const transitioned = await marketPurchaseOrderRepository.transitionStatus(
      id,
      organizationId,
      ['SENT_TO_MARKET'],
      'RECONCILING',
    );
    if (!transitioned) {
      throw new ConflictError('Order was no longer sent to market');
    }

    return (await marketPurchaseOrderRepository.findById(id, organizationId))!;
  },

  /** Sets actual qty + price paid per line while reconciling — may be called repeatedly before Complete. */
  reconcileLines: async (
    actor: Actor,
    id: string,
    lines: ReconcileLineInput[],
  ): Promise<MarketPurchaseOrderWithDetail> => {
    const organizationId = requireOrganization(actor);
    const order = await marketPurchaseOrderRepository.findById(id, organizationId);
    if (!order) {
      throw new NotFoundError('Market Purchase Order not found');
    }
    requireManagerAccess(actor, order.organizationId);
    if (order.status !== 'RECONCILING' && order.status !== 'SENT_TO_MARKET') {
      throw new ConflictError('Only an order sent to market or reconciling can be reconciled');
    }

    const lineIds = new Set(order.lines.map((l) => l.id));
    for (const line of lines) {
      if (!lineIds.has(line.lineId)) {
        throw new ValidationError(`Line ${line.lineId} does not belong to this order`);
      }
      const actualQty = new Prisma.Decimal(line.actualQty);
      const unitPrice = new Prisma.Decimal(line.unitPrice);
      if (actualQty.lessThan(0)) {
        throw new ValidationError('Actual quantity cannot be negative');
      }
      if (unitPrice.lessThan(0)) {
        throw new ValidationError('Price paid cannot be negative');
      }
    }

    await prisma.$transaction(async (tx) => {
      if (order.status === 'SENT_TO_MARKET') {
        const transitioned = await marketPurchaseOrderRepository.transitionStatus(
          id,
          organizationId,
          ['SENT_TO_MARKET'],
          'RECONCILING',
          {},
          tx,
        );
        if (!transitioned) {
          throw new ConflictError('Order was no longer sent to market');
        }
      }
      for (const line of lines) {
        await marketPurchaseOrderRepository.updateLineReconciliation(
          line.lineId,
          id,
          { actualQty: line.actualQty, unitPrice: line.unitPrice },
          tx,
        );
      }
    });

    return (await marketPurchaseOrderRepository.findById(id, organizationId))!;
  },

  /**
   * Final Branch Manager signoff (RECONCILING -> COMPLETED) — writes
   * MARKET_RECEIVE at the branch's own department locations, one per line's
   * department, using the reconciled actualQty/unitPrice. This is the single
   * finalization event for the whole order (mirrors the MPO document's one
   * "RECONCILED" stamp, not Dispatch's two independent stamps).
   */
  complete: async (actor: Actor, id: string): Promise<MarketPurchaseOrderWithDetail> => {
    const organizationId = requireOrganization(actor);
    const order = await marketPurchaseOrderRepository.findById(id, organizationId);
    if (!order) {
      throw new NotFoundError('Market Purchase Order not found');
    }
    requireManagerAccess(actor, order.organizationId);
    if (order.status !== 'RECONCILING') {
      throw new ConflictError('Only a reconciling order can be completed');
    }
    const missingReconciliation = order.lines.some((l) => l.actualQty === null || l.unitPrice === null);
    if (missingReconciliation) {
      throw new ValidationError('Every line must have an actual quantity and price paid before completing');
    }

    const locationCache = new Map<DepartmentTag, { id: string }>();
    const resolveLocation = async (tag: DepartmentTag) => {
      const cached = locationCache.get(tag);
      if (cached) return cached;
      const location = await locationRepository.findByOrganizationTypeDepartment(
        organizationId,
        'BRANCH_DEPARTMENT',
        tag,
      );
      if (!location) {
        throw new NotFoundError(`Department location not found for ${tag}`);
      }
      locationCache.set(tag, location);
      return location;
    };

    await prisma.$transaction(async (tx) => {
      const transitioned = await marketPurchaseOrderRepository.transitionStatus(
        id,
        organizationId,
        ['RECONCILING'],
        'COMPLETED',
        { reconciledById: actor.id, reconciledAt: new Date() },
        tx,
      );
      if (!transitioned) {
        throw new ConflictError('Order was no longer reconciling');
      }

      for (const line of order.lines) {
        const actualQty = line.actualQty!;
        if (actualQty.lessThanOrEqualTo(0)) continue;
        const location = await resolveLocation(line.departmentTag);

        await inventoryTransactionRepository.create(
          {
            organizationId,
            locationId: location.id,
            inventoryItemId: line.inventoryItemId,
            type: 'MARKET_RECEIVE',
            quantity: actualQty,
            unitCost: line.unitPrice!,
            userId: actor.id,
            marketPurchaseOrderLineId: line.id,
          },
          tx,
        );
      }
    });

    return (await marketPurchaseOrderRepository.findById(id, organizationId))!;
  },

  /**
   * A Dept Head's independent, per-department confirmation of receipt.
   * Per the approved mobile Receive screen (Requested -> Actual, read-only,
   * no quantity input), this is an acknowledgement stamp, not a new figure —
   * variance is already fixed by the Branch Manager's reconciliation.
   */
  confirmReceived: async (actor: Actor, id: string): Promise<MarketPurchaseOrderWithDetail> => {
    const organizationId = requireOrganization(actor);
    const departmentTag = requireDepartmentHead(actor);
    const order = await marketPurchaseOrderRepository.findByIdForDepartment(id, organizationId, departmentTag);
    if (!order || order.lines.length === 0) {
      throw new NotFoundError('Market Purchase Order not found for your department');
    }
    if (order.status !== 'COMPLETED' && order.status !== 'RECEIVED') {
      throw new ConflictError('Only a completed order can be received');
    }

    await prisma.$transaction(async (tx) => {
      await marketPurchaseOrderRepository.confirmLinesForDepartment(id, departmentTag, actor.id, tx);

      // Once every department's lines across the whole order are confirmed,
      // the order itself transitions COMPLETED -> RECEIVED.
      const fullOrder = await marketPurchaseOrderRepository.findById(id, organizationId, tx);
      const allConfirmed = fullOrder!.lines.every((l) => l.confirmedById !== null);
      if (allConfirmed && fullOrder!.status === 'COMPLETED') {
        await marketPurchaseOrderRepository.transitionStatus(id, organizationId, ['COMPLETED'], 'RECEIVED', {}, tx);
      }
    });

    return (await marketPurchaseOrderRepository.findByIdForDepartment(id, organizationId, departmentTag))!;
  },

  reject: async (actor: Actor, id: string, reason: string): Promise<void> => {
    const organizationId = requireOrganization(actor);
    if (!reason || !reason.trim()) {
      throw new ValidationError('A rejection reason is required');
    }
    const order = await marketPurchaseOrderRepository.findById(id, organizationId);
    if (!order) {
      throw new NotFoundError('Market Purchase Order not found');
    }
    requireManagerAccess(actor, order.organizationId);
    if (order.status !== 'DRAFT' && order.status !== 'APPROVED') {
      throw new ConflictError('Only a draft or approved order can be rejected');
    }

    const transitioned = await marketPurchaseOrderRepository.transitionStatus(
      id,
      organizationId,
      ['DRAFT', 'APPROVED'],
      'REJECTED',
      { rejectionReason: reason },
    );
    if (!transitioned) {
      throw new ConflictError('Order state changed before the rejection could be applied');
    }
  },
};
