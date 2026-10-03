import type { Request } from 'express';
import { Prisma, type DepartmentTag, type DispatchStatus } from '@prisma/client';
import {
  dispatchRepository,
  type DispatchQueueRequisition,
  type DispatchWithLines,
  type RequisitionSectionForFulfil,
} from './dispatch-repository';
import { discrepancyRepository } from './discrepancy-repository';
import { referenceCounterRepository } from '../purchasing/receiving-repository';
import { branchRepository } from '../../../repositories/branch-repository';
import { locationRepository } from '../../../repositories/location-repository';
import { restockLevelRepository } from '../catalog/inventory-repository';
import { authRepository } from '../../../repositories/auth-repository';
import { prisma } from '../../../config/database';
import { fcmService } from '../../../services/fcm-service';
import { comparePin } from '../../../utils/password';
import { ConflictError, ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from '../../../utils/errors';
import type {
  ConfirmDeliveryInput,
  DeliveryNote,
  DeliveryRow,
  DispatchQueueRow,
  FulfilDepartmentInput,
  FulfilDetail,
  ListDeliveriesQuery,
  ListDispatchQueueQuery,
} from './dispatch.types';

type Actor = NonNullable<Request['user']>;

const toDecimalString = (value: Prisma.Decimal | null): string | null => (value === null ? null : value.toString());

/**
 * Store-side actions require the actor's org to be the hub — same shape as
 * `receiving-service.ts`'s `requireHubActor` / `requisitions-service.ts`'s
 * `requireHubOrganization`, duplicated locally per this codebase's
 * own-repository convention.
 */
const requireHubActor = async (actor: Actor): Promise<string> => {
  const hub = await branchRepository.findHub();
  if (!hub) {
    throw new ValidationError('No hub organization is configured');
  }
  if (actor.organizationId !== hub.id) {
    throw new ForbiddenError('Only the hub organization may access Central Store dispatch data');
  }
  return hub.id;
};

/** Branch-side actions require a non-null org — mirrors `requisitions-service.ts`'s `requireBranchOrg`. */
const requireBranchOrg = (actor: Actor): string => {
  if (!actor.organizationId) {
    throw new ValidationError('Branch context missing for this user');
  }
  return actor.organizationId;
};

/** `approvedQty ?? requestedQty` — the frozen quantity a requisition section carries after Milestone Four's approve-time freeze. */
const effectiveQty = (line: { approvedQty: Prisma.Decimal | null; requestedQty: Prisma.Decimal | null }): Prisma.Decimal =>
  line.approvedQty ?? line.requestedQty ?? new Prisma.Decimal(0);

const sumUnits = (lines: { requestedQty: Prisma.Decimal | null; approvedQty: Prisma.Decimal | null }[]): string =>
  lines.reduce((sum, l) => sum.add(effectiveQty(l)), new Prisma.Decimal(0)).toString();

const serializeQueueRow = (row: DispatchQueueRequisition): DispatchQueueRow => {
  const dispatchByDept = new Map(row.dispatches.map((d) => [d.departmentTag, d]));
  return {
    requisitionId: row.id,
    toOrganizationId: row.organizationId,
    branchName: row.toOrganization.name,
    requisitionType: row.type as DispatchQueueRow['requisitionType'],
    openedAt: row.openedAt.toISOString(),
    departments: row.sections
      .filter((s) => s.lines.length > 0) // an empty section (nothing requested/approved) has nothing to dispatch
      .map((s) => {
        const dispatch = dispatchByDept.get(s.departmentTag);
        return {
          departmentTag: s.departmentTag,
          status: (dispatch?.status ?? null) as DispatchStatus | null,
          totalUnits: sumUnits(s.lines),
          dispatchId: null, // queue row doesn't carry the dispatch id — fulfil-detail read resolves it
        };
      }),
  };
};

/**
 * Pre-fill rule (session-a-plan.md §1.3): `min(requested, available)`. A
 * short dispatch is not a validation error, just a lower pre-filled number —
 * the store attendant can still edit it up (though there is no more stock)
 * or down.
 */
const buildFulfilLine = (
  line: RequisitionSectionForFulfil['lines'][number],
  onHandByItemId: Map<string, Prisma.Decimal>,
): FulfilDetail['sections'][number]['lines'][number] => {
  const requestedQty = effectiveQty(line);
  const onHandQty = onHandByItemId.get(line.inventoryItemId) ?? new Prisma.Decimal(0);
  const dispatchQty = requestedQty.lessThan(onHandQty) ? requestedQty : onHandQty;
  return {
    requisitionLineId: line.id,
    inventoryItemId: line.inventoryItemId,
    itemName: line.item.name,
    usageUnit: line.item.usageUnit,
    requestedQty: requestedQty.toString(),
    onHandQty: onHandQty.toString(),
    dispatchQty: dispatchQty.toString(),
    isSubstitute: false,
    substituteNote: null,
  };
};

/** Builds the daily per-branch sequence label — "Dispatch 4 · Nyeri Town · 17 Sep" — computed at write time, not a stored counter. */
const buildSequenceLabel = (ordinal: number, branchName: string, dispatchedAt: Date): string => {
  const day = dispatchedAt.toLocaleDateString('en-KE', { day: '2-digit', month: 'short', timeZone: 'Africa/Nairobi' });
  return `Dispatch ${ordinal} · ${branchName} · ${day}`;
};

/**
 * Branch-side actor resolution — mirrors `requisitions-service.ts`'s
 * `assertOwnDepartment`: a Department Head may only see their own
 * department, a Branch Manager (bare `requireRole('MANAGER')`, same
 * distinction requisitions-routes.ts draws) sees every department.
 * Returns the department filter to pass to the repository — `null` means
 * "no filter" (Branch Manager, all departments).
 */
const resolveBranchDepartmentFilter = (actor: Actor): DepartmentTag | null => {
  if (actor.role === 'MANAGER') return null;
  if (!actor.departmentTag) {
    throw new ValidationError('This user has no department assigned');
  }
  return actor.departmentTag as DepartmentTag;
};

const serializeDeliveryRow = (dispatch: DispatchWithLines): DeliveryRow => ({
  id: dispatch.id,
  sequenceLabel: dispatch.sequenceLabel,
  status: dispatch.status,
  departmentTag: dispatch.departmentTag,
  branchName: dispatch.toOrganization.name,
  dispatchedByName: dispatch.dispatchedBy?.name ?? null,
  dispatchedAt: dispatch.dispatchedAt ? dispatch.dispatchedAt.toISOString() : null,
  confirmedByName: dispatch.confirmedBy?.name ?? null,
  confirmedAt: dispatch.confirmedAt ? dispatch.confirmedAt.toISOString() : null,
  confirmedOnBehalf: dispatch.confirmedOnBehalf,
  lines: dispatch.lines.map((line) => ({
    dispatchLineId: line.id,
    inventoryItemId: line.inventoryItemId,
    itemName: line.item.name,
    usageUnit: line.item.usageUnit,
    requestedQty: toDecimalString(line.requestedQty),
    dispatchedQty: line.dispatchedQty.toString(),
    confirmedQty: toDecimalString(line.confirmedQty),
    isSubstitute: line.isSubstitute,
    substituteNote: line.substituteNote,
  })),
});

/**
 * Sign + PIN, writes DISPATCH_IN transactions at the confirmed qty,
 * transitions status, and — if any line's confirmedQty != dispatchedQty —
 * creates an OPEN Discrepancy per mismatched line (session-b-plan.md
 * decision #2). Shared by confirmDelivery and confirmDeliveryOnBehalf; the
 * only difference between them is who confirmedById/confirmedOnBehalf end
 * up being.
 */
const confirmDispatch = async (
  actor: Actor,
  dispatchId: string,
  input: ConfirmDeliveryInput,
  confirmedOnBehalf: boolean,
): Promise<DeliveryNote> => {
  const organizationId = requireBranchOrg(actor);

  const actorWithPin = await authRepository.findUserByIdWithPassword(actor.id);
  if (!actorWithPin || !actorWithPin.pinHash) {
    throw new UnauthorizedError('No PIN is set for this account');
  }
  const pinValid = await comparePin(input.pin, actorWithPin.pinHash);
  if (!pinValid) throw new UnauthorizedError('Incorrect PIN');

  const dispatch = await dispatchRepository.findByIdWithLinesForBranch(dispatchId, organizationId);
  if (!dispatch) throw new NotFoundError('Dispatch not found');
  if (dispatch.status !== 'IN_TRANSIT') {
    throw new ConflictError('This dispatch has already been confirmed');
  }

  const confirmedQtyByLineId = new Map(input.lines.map((l) => [l.dispatchLineId, new Prisma.Decimal(l.confirmedQty)]));
  for (const line of dispatch.lines) {
    if (!confirmedQtyByLineId.has(line.id)) {
      throw new ValidationError('Every dispatched line must be confirmed');
    }
  }

  const centralStore = await locationRepository.findCentralStore();
  if (!centralStore) throw new ValidationError('No Central Store is configured');
  const departmentLocation = await locationRepository.findByOrganizationTypeDepartment(
    organizationId,
    'BRANCH_DEPARTMENT',
    dispatch.departmentTag,
  );
  if (!departmentLocation) {
    throw new ValidationError('No branch department location is configured for this department');
  }

  const confirmedAt = new Date();
  let hasMismatch = false;

  await prisma.$transaction(async (tx) => {
    const count = await dispatchRepository.markConfirmed(dispatchId, organizationId, tx, {
      status: 'CONFIRMED', // corrected to DISCREPANCY_OPEN below if any line mismatches
      confirmedById: actor.id,
      confirmedAt,
      confirmedOnBehalf,
    });
    if (count === 0) {
      throw new ConflictError('This dispatch has already been confirmed');
    }

    for (const line of dispatch.lines) {
      const confirmedQty = confirmedQtyByLineId.get(line.id)!;
      await tx.dispatchLine.update({ where: { id: line.id }, data: { confirmedQty } });

      if (confirmedQty.greaterThan(0)) {
        await tx.inventoryTransaction.create({
          data: {
            organizationId,
            locationId: departmentLocation.id,
            inventoryItemId: line.inventoryItemId,
            type: 'DISPATCH_IN',
            quantity: confirmedQty, // arriving at the branch — positive-signed, unlike DISPATCH_OUT
            unitCost: line.costAtDispatch,
            dispatchLineId: line.id,
            userId: actor.id,
          },
        });
      }

      if (!confirmedQty.equals(line.dispatchedQty)) {
        hasMismatch = true;
        const gapQty = confirmedQty.minus(line.dispatchedQty);
        const reference = await referenceCounterRepository.nextReference(tx, centralStore.organizationId, 'DSC');
        await discrepancyRepository.createForLine({ dispatchLineId: line.id, referenceNumber: reference, gapQty }, tx);
      }
    }

    if (hasMismatch) {
      await tx.dispatch.update({ where: { id: dispatchId }, data: { status: 'DISCREPANCY_OPEN' } });
    }
  });

  if (hasMismatch) {
    void fcmService.sendReceiptVariancePush(dispatch.organizationId, { dispatchId, itemCount: dispatch.lines.length });
  }

  return dispatchService.getDeliveryNoteForBranch(actor, dispatchId);
};

const notifyDepartmentHeadsOfDispatch = async (
  toOrganizationId: string,
  departmentTag: DepartmentTag,
  dispatchId: string,
  sequenceLabel: string,
  actorId: string,
): Promise<void> => {
  const heads = await dispatchRepository.findDepartmentHeads(toOrganizationId, departmentTag);
  for (const head of heads) {
    if (head.id === actorId) continue;
    void fcmService.sendDispatchInTransitPush(head.id, { dispatchId, deliveryNoteNumber: sequenceLabel });
  }
};

export const dispatchService = {
  /** Central Store queue: approved requisitions across every active branch org, explicitly enumerated. */
  listQueue: async (actor: Actor, query: ListDispatchQueueQuery): Promise<DispatchQueueRow[]> => {
    await requireHubActor(actor);
    const branchOrgIds = await branchRepository.findActiveBranchIds();
    const rows = await dispatchRepository.findQueueByBranchOrgIds(branchOrgIds, query.limit);
    return rows.map(serializeQueueRow);
  },

  /** Per-department fulfil detail for one branch's requisition — pre-filled dispatch quantities. */
  getFulfilDetail: async (actor: Actor, requisitionId: string): Promise<FulfilDetail> => {
    await requireHubActor(actor);
    const branchOrgIds = await branchRepository.findActiveBranchIds();
    const requisition = await dispatchRepository.findRequisitionForFulfil(requisitionId, branchOrgIds);
    if (!requisition) throw new NotFoundError('Requisition not found');

    const centralStore = await locationRepository.findCentralStore();
    if (!centralStore) throw new ValidationError('No Central Store is configured');

    const allItemIds = [...new Set(requisition.sections.flatMap((s) => s.lines.map((l) => l.inventoryItemId)))];
    const onHandByItemId =
      allItemIds.length > 0
        ? await restockLevelRepository.sumOnHandByItemForLocation(centralStore.organizationId, centralStore.id)
        : new Map<string, Prisma.Decimal>();

    const existingDispatches = await Promise.all(
      requisition.sections.map((s) => dispatchRepository.findByRequisitionAndDepartment(requisitionId, s.departmentTag, centralStore.organizationId)),
    );
    const dispatchByDept = new Map(requisition.sections.map((s, i) => [s.departmentTag, existingDispatches[i]]));

    return {
      requisitionId: requisition.id,
      toOrganizationId: requisition.organizationId,
      branchName: requisition.toOrganizationName,
      requisitionType: requisition.type as FulfilDetail['requisitionType'],
      openedAt: requisition.openedAt.toISOString(),
      sections: requisition.sections
        .filter((s) => s.lines.length > 0)
        .map((s) => {
          const dispatch = dispatchByDept.get(s.departmentTag) ?? null;
          return {
            departmentTag: s.departmentTag,
            status: s.status as FulfilDetail['sections'][number]['status'],
            dispatchStatus: (dispatch?.status ?? null) as DispatchStatus | null,
            dispatchId: dispatch?.id ?? null,
            lines: s.lines.map((l) => buildFulfilLine(l, onHandByItemId)),
          };
        }),
    };
  },

  /**
   * Sign + PIN, writes DISPATCH_OUT transactions, creates Dispatch +
   * DispatchLine rows, status -> IN_TRANSIT. One Dispatch per department per
   * requisition (Flow 9 step 4) — rejected if this department was already
   * dispatched (no double-dispatch).
   */
  fulfilDepartment: async (
    actor: Actor,
    requisitionId: string,
    departmentTag: DepartmentTag,
    input: FulfilDepartmentInput,
  ): Promise<DeliveryNote> => {
    const hubOrgId = await requireHubActor(actor);

    const actorWithPin = await authRepository.findUserByIdWithPassword(actor.id);
    if (!actorWithPin || !actorWithPin.pinHash) {
      throw new UnauthorizedError('No PIN is set for this account');
    }
    const pinValid = await comparePin(input.pin, actorWithPin.pinHash);
    if (!pinValid) throw new UnauthorizedError('Incorrect PIN');

    const branchOrgIds = await branchRepository.findActiveBranchIds();
    const requisition = await dispatchRepository.findRequisitionForFulfil(requisitionId, branchOrgIds);
    if (!requisition) throw new NotFoundError('Requisition not found');
    if (requisition.status !== 'APPROVED') {
      throw new ConflictError('Only an approved requisition can be dispatched');
    }

    const section = requisition.sections.find((s) => s.departmentTag === departmentTag);
    if (!section) throw new NotFoundError('Requisition section not found');

    const existing = await dispatchRepository.findByRequisitionAndDepartment(requisitionId, departmentTag, hubOrgId);
    if (existing) {
      throw new ConflictError('This department has already been dispatched for this requisition');
    }

    if (input.lines.length === 0) {
      throw new ValidationError('At least one line is required to dispatch');
    }

    const centralStore = await locationRepository.findCentralStore();
    if (!centralStore) throw new ValidationError('No Central Store is configured');

    const requisitionLineById = new Map(section.lines.map((l) => [l.id, l]));
    const itemById = new Map(section.lines.map((l) => [l.inventoryItemId, l.item]));

    // Substitute lines carry an inventoryItemId not necessarily present on
    // the requisition — validate those against the live catalog directly.
    const substituteItemIds = input.lines.filter((l) => l.isSubstitute).map((l) => l.inventoryItemId);
    const substituteItems =
      substituteItemIds.length > 0
        ? await prisma.inventoryItem.findMany({
            where: { id: { in: substituteItemIds }, organizationId: hubOrgId, deletedAt: null },
            select: { id: true, name: true, usageUnit: true, currentCost: true },
          })
        : [];
    const substituteItemById = new Map(substituteItems.map((i) => [i.id, i]));

    for (const line of input.lines) {
      if (line.isSubstitute) {
        if (!substituteItemById.has(line.inventoryItemId)) {
          throw new NotFoundError('One or more substitute items were not found');
        }
      } else if (!itemById.has(line.inventoryItemId)) {
        throw new NotFoundError('One or more items were not found on this requisition');
      }
    }

    const dispatchedAt = new Date();

    const dispatch = await prisma.$transaction(async (tx) => {
      const todayCount = await dispatchRepository.countDispatchesTodayForBranch(requisition.organizationId, tx);
      const sequenceLabel = buildSequenceLabel(todayCount + 1, requisition.toOrganizationName, dispatchedAt);

      const created = await dispatchRepository.create(
        {
          organizationId: hubOrgId,
          toOrganizationId: requisition.organizationId,
          requisitionId,
          departmentTag,
          sequenceLabel,
          dispatchedById: actor.id,
          dispatchedAt,
          lines: input.lines.map((line) => {
            const item = line.isSubstitute ? substituteItemById.get(line.inventoryItemId)! : itemById.get(line.inventoryItemId)!;
            const requisitionLine = line.requisitionLineId ? requisitionLineById.get(line.requisitionLineId) : undefined;
            return {
              requisitionLineId: line.isSubstitute ? null : (requisitionLine?.id ?? null),
              inventoryItemId: line.inventoryItemId,
              requestedQty: requisitionLine ? effectiveQty(requisitionLine) : null,
              dispatchedQty: new Prisma.Decimal(line.dispatchQty),
              costAtDispatch: item.currentCost,
              isSubstitute: Boolean(line.isSubstitute),
              substituteNote: line.isSubstitute ? (line.substituteNote ?? null) : null,
            };
          }),
        },
        tx,
      );

      const fullDispatch = await tx.dispatch.findUniqueOrThrow({
        where: { id: created.id },
        include: { lines: true },
      });

      for (const dispatchLine of fullDispatch.lines) {
        if (dispatchLine.dispatchedQty.lessThanOrEqualTo(0)) continue; // a zeroed line (short dispatch to nothing) writes no ledger row
        await tx.inventoryTransaction.create({
          data: {
            organizationId: hubOrgId,
            locationId: centralStore.id,
            inventoryItemId: dispatchLine.inventoryItemId,
            type: 'DISPATCH_OUT',
            quantity: dispatchLine.dispatchedQty.negated(), // outbound from the store — negative-signed ledger writer
            unitCost: dispatchLine.costAtDispatch,
            dispatchLineId: dispatchLine.id,
            userId: actor.id,
          },
        });
      }

      return fullDispatch;
    });

    void notifyDepartmentHeadsOfDispatch(requisition.organizationId, departmentTag, dispatch.id, dispatch.sequenceLabel, actor.id);

    return dispatchService.getDeliveryNoteForHub(actor, dispatch.id);
  },

  /** Shared by the print and on-screen renderers — one Dispatch record, two views. Store-side (hub-scoped) read. */
  getDeliveryNoteForHub: async (actor: Actor, dispatchId: string): Promise<DeliveryNote> => {
    const hubOrgId = await requireHubActor(actor);
    const dispatch = await dispatchRepository.findByIdWithLinesForHub(dispatchId, hubOrgId);
    if (!dispatch) throw new NotFoundError('Dispatch not found');
    return serializeDeliveryNote(dispatch);
  },

  /** Branch-side (toOrganizationId-scoped) delivery-note read — same shared renderer, never hub-scoped. */
  getDeliveryNoteForBranch: async (actor: Actor, dispatchId: string): Promise<DeliveryNote> => {
    const organizationId = requireBranchOrg(actor);
    const dispatch = await dispatchRepository.findByIdWithLinesForBranch(dispatchId, organizationId);
    if (!dispatch) throw new NotFoundError('Dispatch not found');
    return serializeDeliveryNote(dispatch);
  },

  // ── Milestone Five, Session B — branch-side receiving ─────────────────────

  /** Branch's own dispatches, all departments (Branch Manager) or own department only (Department Head), per C4's scoping. */
  listDeliveries: async (actor: Actor, query: ListDeliveriesQuery): Promise<DeliveryRow[]> => {
    const organizationId = requireBranchOrg(actor);
    const departmentFilter = resolveBranchDepartmentFilter(actor);
    const rows = await dispatchRepository.findDispatchesForBranch(organizationId, departmentFilter, query.limit);
    return rows.map(serializeDeliveryRow);
  },

  getDeliveryDetail: async (actor: Actor, dispatchId: string): Promise<DeliveryRow> => {
    const organizationId = requireBranchOrg(actor);
    const departmentFilter = resolveBranchDepartmentFilter(actor);
    const dispatch = await dispatchRepository.findByIdWithLinesForBranch(dispatchId, organizationId);
    if (!dispatch) throw new NotFoundError('Dispatch not found');
    if (departmentFilter && dispatch.departmentTag !== departmentFilter) {
      throw new ForbiddenError('You may only access your own department');
    }
    return serializeDeliveryRow(dispatch);
  },

  /** Department Head's own confirm — the real signer is the department head themselves. */
  confirmDelivery: async (actor: Actor, dispatchId: string, input: ConfirmDeliveryInput): Promise<DeliveryNote> => {
    const organizationId = requireBranchOrg(actor);
    const departmentFilter = resolveBranchDepartmentFilter(actor);
    if (!departmentFilter) {
      throw new ForbiddenError('A Branch Manager must use confirm-on-behalf');
    }
    const dispatch = await dispatchRepository.findByIdWithLinesForBranch(dispatchId, organizationId);
    if (!dispatch) throw new NotFoundError('Dispatch not found');
    if (dispatch.departmentTag !== departmentFilter) {
      throw new ForbiddenError('You may only access your own department');
    }
    return confirmDispatch(actor, dispatchId, input, false);
  },

  /** Branch Manager confirm-on-behalf (Flow 10b) — separate endpoint, not a flag, per session-b-plan.md decision #5. */
  confirmDeliveryOnBehalf: async (actor: Actor, dispatchId: string, input: ConfirmDeliveryInput): Promise<DeliveryNote> => {
    if (actor.role !== 'MANAGER') {
      throw new ForbiddenError('Only a Branch Manager may confirm on behalf of a department');
    }
    return confirmDispatch(actor, dispatchId, input, true);
  },
};

const serializeDeliveryNote = (dispatch: DispatchWithLines): DeliveryNote => ({
  id: dispatch.id,
  sequenceLabel: dispatch.sequenceLabel,
  status: dispatch.status,
  departmentTag: dispatch.departmentTag,
  branchName: dispatch.toOrganization.name,
  dispatchedByName: dispatch.dispatchedBy?.name ?? null,
  dispatchedAt: dispatch.dispatchedAt ? dispatch.dispatchedAt.toISOString() : null,
  confirmedByName: dispatch.confirmedBy?.name ?? null,
  confirmedAt: dispatch.confirmedAt ? dispatch.confirmedAt.toISOString() : null,
  confirmedOnBehalf: dispatch.confirmedOnBehalf,
  lines: dispatch.lines.map((line) => ({
    inventoryItemId: line.inventoryItemId,
    itemName: line.item.name,
    usageUnit: line.item.usageUnit,
    requestedQty: toDecimalString(line.requestedQty),
    dispatchedQty: line.dispatchedQty.toString(),
    confirmedQty: line.confirmedQty ? line.confirmedQty.toString() : null,
    isSubstitute: line.isSubstitute,
    substituteNote: line.substituteNote,
  })),
});
