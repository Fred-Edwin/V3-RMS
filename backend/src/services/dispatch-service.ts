import type { Request } from 'express';
import { Prisma } from '@prisma/client';
import {
  dispatchRepository,
  type DispatchWithDetail,
  type DispatchLineInput,
} from '../repositories/dispatch-repository';
import { requisitionRepository } from '../repositories/requisition-repository';
import { inventoryItemRepository } from '../repositories/inventory-item-repository';
import { inventoryTransactionRepository } from '../repositories/inventory-transaction-repository';
import { locationRepository } from '../repositories/location-repository';
import { branchRepository } from '../repositories/branch-repository';
import { fcmService } from './fcm-service';
import { ForbiddenError, NotFoundError, ValidationError, ConflictError } from '../utils/errors';
import { prisma } from '../config/database';

type Actor = NonNullable<Request['user']>;

const requireOrganization = (actor: Actor): string => {
  if (!actor.organizationId) {
    throw new ValidationError('Branch context missing for this user');
  }
  return actor.organizationId;
};

/** D-16/D-18: only Central Store roles fulfil/dispatch. */
const requireStoreAccess = (actor: Actor): void => {
  if (!['STORE_MANAGER', 'STORE_ATTENDANT', 'DIRECTOR', 'SYSTEM_ADMIN'].includes(actor.role)) {
    throw new ForbiddenError('Only Central Store staff may act on dispatches');
  }
};

const requireDepartmentHead = (actor: Actor) => {
  if (!actor.isDepartmentHead || !actor.departmentTag) {
    throw new ForbiddenError('Only a Department Head may receive a delivery');
  }
  return actor.departmentTag;
};

/** `DN-<yymmdd>-<4 random base36 chars>` — human-readable, mirrors PO number generation. */
const generateDeliveryNoteNumber = (): string => {
  const now = new Date();
  const y = String(now.getFullYear()).slice(2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `DN-${y}${m}${d}-${suffix}`;
};

export type CreateDispatchFromRequisitionInput = {
  lines: { inventoryItemId: string; dispatchedQty: Prisma.Decimal.Value }[];
};

export type UnsolicitedDispatchInput = {
  toLocationId: string;
  lines: { inventoryItemId: string; dispatchedQty: Prisma.Decimal.Value }[];
};

export type ReceiveDispatchInput = {
  lines: { lineId: string; receivedQty: Prisma.Decimal.Value }[];
};

export const dispatchService = {
  /**
   * Approved requisitions awaiting fulfilment, oldest first — the D-16
   * either-side exception surface, read directly here (not via
   * Dispatch.findVisibleTo, since a not-yet-dispatched requisition has no
   * Dispatch row yet). Requisition itself stays single-org per line, so this
   * is a plain cross-branch findMany by status, confined to this repository
   * call the same way findVisibleTo is confined to dispatch-repository.
   */
  queue: async (actor: Actor) => {
    requireStoreAccess(actor);
    return prisma.requisition.findMany({
      where: { status: 'APPROVED' },
      include: {
        location: { select: { id: true, name: true, departmentTag: true, organizationId: true } },
        organization: { select: { id: true, name: true } },
        requestedBy: { select: { id: true, name: true } },
        lines: { include: { inventoryItem: { select: { id: true, name: true, buyUnit: true } } } },
      },
      orderBy: { approvedAt: 'asc' },
    });
  },

  list: async (actor: Actor, status?: string) => {
    const organizationId = requireOrganization(actor);
    return dispatchRepository.listVisibleTo(organizationId, { status: status as never });
  },

  getById: async (actor: Actor, id: string): Promise<DispatchWithDetail> => {
    const organizationId = requireOrganization(actor);
    const dispatch = await dispatchRepository.findVisibleTo(id, organizationId);
    if (!dispatch) {
      throw new NotFoundError('Dispatch not found');
    }
    return dispatch;
  },

  /**
   * Fulfil an APPROVED requisition: creates a PICKING dispatch with
   * dispatchedQty per line (D-6, partial normal). unitCost is the Central
   * Store's current weighted-average, snapshotted now.
   */
  createFromRequisition: async (
    actor: Actor,
    requisitionId: string,
    input: CreateDispatchFromRequisitionInput,
  ): Promise<DispatchWithDetail> => {
    requireStoreAccess(actor);
    const hub = await branchRepository.findHub();
    if (!hub) {
      throw new NotFoundError('No hub organization configured');
    }
    const centralStore = await locationRepository.findCentralStore();
    if (!centralStore) {
      throw new NotFoundError('Central Store location not found');
    }

    const req = await prisma.requisition.findUnique({
      where: { id: requisitionId },
      include: {
        lines: { include: { inventoryItem: { select: { id: true, name: true, currentCost: true } } } },
        location: { select: { id: true, organizationId: true } },
      },
    });
    if (!req) {
      throw new NotFoundError('Requisition not found');
    }
    if (req.status !== 'APPROVED') {
      throw new ConflictError('Only an approved requisition can be fulfilled');
    }
    if (input.lines.length === 0) {
      throw new ValidationError('A dispatch must have at least one line');
    }

    const lineByItemId = new Map(req.lines.map((l) => [l.inventoryItemId, l]));
    const dispatchLines: DispatchLineInput[] = [];
    for (const line of input.lines) {
      const reqLine = lineByItemId.get(line.inventoryItemId);
      if (!reqLine) {
        throw new ValidationError(`Item ${line.inventoryItemId} is not on this requisition`);
      }
      const qty = new Prisma.Decimal(line.dispatchedQty);
      if (qty.lessThan(0)) {
        throw new ValidationError('Dispatched quantity cannot be negative');
      }
      dispatchLines.push({
        inventoryItemId: line.inventoryItemId,
        requestedQty: reqLine.approvedQty ?? reqLine.requestedQty,
        unitCost: reqLine.inventoryItem.currentCost,
      });
    }

    const dispatch = await prisma.$transaction(async (tx) => {
      const created = await dispatchRepository.create(
        {
          fromOrganizationId: hub.id,
          toOrganizationId: req.location.organizationId,
          requisitionId: req.id,
          fromLocationId: centralStore.id,
          toLocationId: req.locationId,
          lines: dispatchLines,
        },
        tx,
      );

      for (const inputLine of input.lines) {
        const createdLine = created.lines.find((l) => l.inventoryItemId === inputLine.inventoryItemId)!;
        await dispatchRepository.updateLineDispatchedQty(createdLine.id, created.id, inputLine.dispatchedQty, tx);
      }

      await requisitionRepository.transitionStatus(
        req.id,
        req.organizationId,
        ['APPROVED'],
        'PENDING_FULFILMENT',
        {},
        tx,
      );

      return created;
    });

    return (await dispatchRepository.findVisibleTo(dispatch.id, hub.id))!;
  },

  /** Q5: Store Manager may dispatch without a requisition (unsolicited, requisitionId null). */
  createUnsolicited: async (actor: Actor, input: UnsolicitedDispatchInput): Promise<DispatchWithDetail> => {
    requireStoreAccess(actor);
    const hub = await branchRepository.findHub();
    if (!hub) {
      throw new NotFoundError('No hub organization configured');
    }
    const centralStore = await locationRepository.findCentralStore();
    if (!centralStore) {
      throw new NotFoundError('Central Store location not found');
    }
    if (input.lines.length === 0) {
      throw new ValidationError('A dispatch must have at least one line');
    }

    const toLocation = await prisma.location.findUnique({ where: { id: input.toLocationId } });
    if (!toLocation || toLocation.type !== 'BRANCH_DEPARTMENT') {
      throw new ValidationError('toLocationId must reference a branch department location');
    }

    const dispatchLines: DispatchLineInput[] = [];
    for (const line of input.lines) {
      const item = await inventoryItemRepository.findById(line.inventoryItemId, hub.id);
      if (!item) {
        throw new ValidationError(`Line references unknown inventory item: ${line.inventoryItemId}`);
      }
      const qty = new Prisma.Decimal(line.dispatchedQty);
      if (qty.lessThanOrEqualTo(0)) {
        throw new ValidationError('Dispatched quantity must be greater than zero');
      }
      dispatchLines.push({
        inventoryItemId: line.inventoryItemId,
        requestedQty: qty,
        unitCost: item.currentCost,
      });
    }

    const dispatch = await prisma.$transaction(async (tx) => {
      const created = await dispatchRepository.create(
        {
          fromOrganizationId: hub.id,
          toOrganizationId: toLocation.organizationId,
          requisitionId: null,
          fromLocationId: centralStore.id,
          toLocationId: toLocation.id,
          lines: dispatchLines,
        },
        tx,
      );
      for (const inputLine of input.lines) {
        const createdLine = created.lines.find((l) => l.inventoryItemId === inputLine.inventoryItemId)!;
        await dispatchRepository.updateLineDispatchedQty(createdLine.id, created.id, inputLine.dispatchedQty, tx);
      }
      return created;
    });

    return (await dispatchRepository.findVisibleTo(dispatch.id, hub.id))!;
  },

  /**
   * Confirm dispatch: writes DISPATCH_OUT at the Central Store (hub org,
   * single-org, D-16) for every line, atomically with the status transition
   * to IN_TRANSIT and delivery note number generation.
   *
   * Note: the plan calls for the delivery note to print via the existing
   * thermal printing infra. The existing PrintJob model is order-shaped
   * (orderId FK, ReceiptType enum) and has no path for a document that isn't
   * tied to an Order — wiring it up is a real, separate piece of scope, not
   * a reuse. Deferred; logged in Deviations. deliveryNoteNumber is generated
   * and stored regardless, so nothing downstream is blocked by the missing
   * physical print.
   */
  confirmDispatch: async (actor: Actor, id: string): Promise<DispatchWithDetail> => {
    requireStoreAccess(actor);
    const hub = await branchRepository.findHub();
    if (!hub) {
      throw new NotFoundError('No hub organization configured');
    }
    const dispatch = await dispatchRepository.findVisibleTo(id, hub.id);
    if (!dispatch) {
      throw new NotFoundError('Dispatch not found');
    }
    if (dispatch.status !== 'PICKING') {
      throw new ConflictError('Only a dispatch still being picked can be confirmed');
    }
    const missingQty = dispatch.lines.some((l) => l.dispatchedQty === null);
    if (missingQty) {
      throw new ValidationError('Every line must have a dispatched quantity before confirming');
    }

    const deliveryNoteNumber = generateDeliveryNoteNumber();

    await prisma.$transaction(async (tx) => {
      const transitioned = await dispatchRepository.transitionStatus(
        id,
        hub.id,
        ['PICKING'],
        'IN_TRANSIT',
        { dispatchedById: actor.id, dispatchedAt: new Date(), deliveryNoteNumber },
        tx,
      );
      if (!transitioned) {
        throw new ConflictError('Dispatch was no longer being picked');
      }

      for (const line of dispatch.lines) {
        const dispatchedQty = line.dispatchedQty!;
        if (dispatchedQty.lessThanOrEqualTo(0)) continue;

        await inventoryTransactionRepository.create(
          {
            organizationId: hub.id,
            locationId: dispatch.fromLocationId,
            inventoryItemId: line.inventoryItemId,
            type: 'DISPATCH_OUT',
            quantity: dispatchedQty.neg(),
            unitCost: line.unitCost,
            userId: actor.id,
            dispatchLineId: line.id,
          },
          tx,
        );
      }
    });

    if (dispatch.requisition) {
      await fcmService.sendDispatchInTransitPush(dispatch.requisition.requestedById, {
        dispatchId: id,
        deliveryNoteNumber,
      });
    }

    return (await dispatchRepository.findVisibleTo(id, hub.id))!;
  },

  /** Store Manager reject path for a genuinely invalid requisition (D-18, expected rare). */
  rejectFulfilment: async (actor: Actor, requisitionId: string, reason: string): Promise<void> => {
    requireStoreAccess(actor);
    if (!reason || !reason.trim()) {
      throw new ValidationError('A rejection reason is required');
    }
    const req = await prisma.requisition.findUnique({ where: { id: requisitionId } });
    if (!req) {
      throw new NotFoundError('Requisition not found');
    }
    if (req.status !== 'APPROVED' && req.status !== 'PENDING_FULFILMENT') {
      throw new ConflictError('Only an approved requisition awaiting fulfilment can be rejected by the store');
    }
    const transitioned = await requisitionRepository.transitionStatus(
      requisitionId,
      req.organizationId,
      ['APPROVED', 'PENDING_FULFILMENT'],
      'REJECTED',
      { rejectionReason: reason },
    );
    if (!transitioned) {
      throw new ConflictError('Requisition state changed before the rejection could be applied');
    }
    await fcmService.sendRequisitionDecisionPush(req.requestedById, {
      requisitionId,
      decision: 'REJECTED',
      reason,
    });
  },

  /**
   * Receive: Department Head confirms/corrects quantities. Writes DISPATCH_IN
   * at the department location (branch org, single-org, D-16) and flags
   * variance = dispatched - received (Q2: receiving MORE than dispatched is
   * allowed and flagged too).
   *
   * Per-location weighted-average cost (D-8) is deliberately NOT stored back
   * onto InventoryItem.currentCost here: that field is a single scalar owned
   * by the hub-org catalog row (Central Store's own average), and there is
   * no per-(item, location) cost field in the schema for a branch department
   * to have its own average. Rather than writing to the wrong row (a no-op,
   * since no InventoryItem row has organizationId = the branch org) or adding
   * a new model mid-session, a department's weighted-average cost is left to
   * be computed on demand from its own InventoryTransaction history — same
   * formula as weightedAverageCost(), applied as a query instead of a stored
   * column. The ledger transaction itself (this method's actual job) already
   * carries the correct dispatched unitCost per line, so nothing here is lost;
   * only a *cached* per-location average is deferred. Flagged in Deviations
   * for whichever session first needs to read a department's average cost
   * (a report, or department-side consumption in a later phase).
   */
  receive: async (actor: Actor, id: string, input: ReceiveDispatchInput): Promise<DispatchWithDetail> => {
    const organizationId = requireOrganization(actor);
    requireDepartmentHead(actor);
    const dispatch = await dispatchRepository.findVisibleTo(id, organizationId);
    if (!dispatch) {
      throw new NotFoundError('Dispatch not found');
    }
    if (dispatch.toOrganizationId !== organizationId) {
      throw new ForbiddenError('Only the receiving branch may confirm this delivery');
    }
    if (dispatch.status !== 'IN_TRANSIT') {
      throw new ConflictError('Only a dispatch in transit can be received');
    }

    const lineIds = new Set(dispatch.lines.map((l) => l.id));
    for (const line of input.lines) {
      if (!lineIds.has(line.lineId)) {
        throw new ValidationError(`Line ${line.lineId} does not belong to this dispatch`);
      }
      const qty = new Prisma.Decimal(line.receivedQty);
      if (qty.lessThan(0)) {
        throw new ValidationError('Received quantity cannot be negative');
      }
    }

    let hasVariance = false;

    await prisma.$transaction(async (tx) => {
      for (const inputLine of input.lines) {
        const dispatchLine = dispatch.lines.find((l) => l.id === inputLine.lineId)!;
        const receivedQty = new Prisma.Decimal(inputLine.receivedQty);
        const dispatchedQty = dispatchLine.dispatchedQty ?? new Prisma.Decimal(0);

        if (!receivedQty.equals(dispatchedQty)) {
          hasVariance = true;
        }

        await dispatchRepository.updateLineReceivedQty(inputLine.lineId, dispatch.id, receivedQty, tx);

        if (receivedQty.lessThanOrEqualTo(0)) continue;

        await inventoryTransactionRepository.create(
          {
            organizationId,
            locationId: dispatch.toLocationId,
            inventoryItemId: dispatchLine.inventoryItemId,
            type: 'DISPATCH_IN',
            quantity: receivedQty,
            unitCost: dispatchLine.unitCost,
            userId: actor.id,
            dispatchLineId: dispatchLine.id,
          },
          tx,
        );
      }

      const transitioned = await dispatchRepository.transitionStatus(
        dispatch.id,
        organizationId,
        ['IN_TRANSIT'],
        'RECEIVED',
        { receivedById: actor.id, receivedAt: new Date() },
        tx,
      );
      if (!transitioned) {
        throw new ConflictError('Dispatch was no longer in transit');
      }
    });

    if (hasVariance) {
      await fcmService.sendReceiptVariancePush(dispatch.fromOrganizationId, {
        dispatchId: id,
        itemCount: input.lines.length,
      });
    }

    return (await dispatchRepository.findVisibleTo(id, organizationId))!;
  },
};
