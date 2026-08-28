import type { Request } from 'express';
import { Prisma, type DepartmentTag } from '@prisma/client';
import {
  requisitionRepository,
  type RequisitionWithDetail,
  type RequisitionLineInput,
} from '../repositories/requisition-repository';
import { locationRepository } from '../repositories/location-repository';
import { inventoryItemRepository } from '../repositories/inventory-item-repository';
import { inventoryTransactionRepository } from '../repositories/inventory-transaction-repository';
import { parLevelRepository } from '../repositories/par-level-repository';
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

/** D-17: a DEPARTMENT_HEAD raises requisitions only for their own department. */
const requireDepartmentHead = (actor: Actor): DepartmentTag => {
  if (actor.role !== 'DEPARTMENT_HEAD' || !actor.departmentTag) {
    throw new ForbiddenError('Only a Department Head may raise a requisition');
  }
  return actor.departmentTag;
};

/** D-18: only the Branch Manager (own branch), Director, or System Admin may approve/reject. */
const requireApprovalAccess = (actor: Actor, targetOrgId: string): void => {
  if (actor.role === 'DIRECTOR' || actor.role === 'SYSTEM_ADMIN') return;
  if (actor.role === 'MANAGER' && actor.organizationId === targetOrgId) return;
  throw new ForbiddenError('Only the Branch Manager of this branch, a Director, or a System Admin may act on this requisition');
};

export type RaiseRequisitionInput = {
  notes?: string;
  lines: { inventoryItemId: string; requestedQty: Prisma.Decimal.Value; notes?: string }[];
};

export type ApproveRequisitionInput = {
  lines: { lineId: string; approvedQty: Prisma.Decimal.Value }[];
};

export const requisitionService = {
  /** D-1b scope: only items tagged for the actor's department, from the hub-owned catalog. */
  listOrderableItems: async (actor: Actor) => {
    const organizationId = requireOrganization(actor);
    const departmentTag = requireDepartmentHead(actor);
    const hub = await branchRepository.findHub();
    if (!hub) {
      throw new NotFoundError('No hub organization configured');
    }
    const items = await inventoryItemRepository.findAllByOrganization(hub.id, { isActive: true });
    const scoped = items.filter((item) => item.departmentTags.includes(departmentTag));

    const location = await locationRepository.findByOrganizationTypeDepartment(
      organizationId,
      'BRANCH_DEPARTMENT',
      departmentTag,
    );
    if (!location) {
      throw new NotFoundError('Department location not found for this branch');
    }

    const suggestions = await Promise.all(
      scoped.map(async (item) => {
        const [onHand, par] = await Promise.all([
          inventoryTransactionRepository.sumQuantityByItemAndLocation(organizationId, item.id, location.id),
          parLevelRepository.findByLocationAndItem(location.id, item.id),
        ]);
        const suggestedQty = par ? Prisma.Decimal.max(par.parQty.sub(onHand), 0) : null;
        return { item, onHand, parQty: par?.parQty ?? null, suggestedQty };
      }),
    );

    return suggestions;
  },

  list: async (actor: Actor, status?: string) => {
    const organizationId = requireOrganization(actor);
    if (actor.role === 'DEPARTMENT_HEAD') {
      return requisitionRepository.findAllByOrganization(organizationId, {
        status: status as never,
        requestedById: actor.id,
      });
    }
    return requisitionRepository.findAllByOrganization(organizationId, { status: status as never });
  },

  getById: async (actor: Actor, id: string): Promise<RequisitionWithDetail> => {
    const organizationId = requireOrganization(actor);
    const requisition = await requisitionRepository.findById(id, organizationId);
    if (!requisition) {
      throw new NotFoundError('Requisition not found');
    }
    if (actor.role === 'DEPARTMENT_HEAD' && requisition.requestedById !== actor.id) {
      throw new ForbiddenError('You may only view your own requisitions');
    }
    return requisition;
  },

  /** Raise + submit in one step (D-19: on-demand, no draft workflow needed at the UI). */
  raise: async (actor: Actor, input: RaiseRequisitionInput): Promise<RequisitionWithDetail> => {
    const organizationId = requireOrganization(actor);
    const departmentTag = requireDepartmentHead(actor);

    if (input.lines.length === 0) {
      throw new ValidationError('A requisition must have at least one line');
    }

    const location = await locationRepository.findByOrganizationTypeDepartment(
      organizationId,
      'BRANCH_DEPARTMENT',
      departmentTag,
    );
    if (!location) {
      throw new NotFoundError('Department location not found for this branch');
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
      if (!item.departmentTags.includes(departmentTag)) {
        throw new ForbiddenError(`Item "${item.name}" is not orderable by your department`);
      }
    }

    const requisition = await requisitionRepository.create({
      organizationId,
      locationId: location.id,
      departmentTag,
      requestedById: actor.id,
      notes: input.notes,
      lines: input.lines,
    });

    await fcmService.sendRequisitionSubmittedPush(organizationId, {
      requisitionId: requisition.id,
      departmentTag,
    });

    return requisition;
  },

  /** D-18: Manager may edit line quantities while approving. requestedQty is never overwritten. */
  approve: async (actor: Actor, id: string, input: ApproveRequisitionInput): Promise<RequisitionWithDetail> => {
    const organizationId = requireOrganization(actor);
    const requisition = await requisitionRepository.findById(id, organizationId);
    if (!requisition) {
      throw new NotFoundError('Requisition not found');
    }
    requireApprovalAccess(actor, requisition.organizationId);
    if (requisition.status !== 'PENDING_MANAGER_APPROVAL') {
      throw new ConflictError('Only a requisition pending approval can be approved');
    }

    const lineIds = new Set(requisition.lines.map((l) => l.id));
    for (const line of input.lines) {
      if (!lineIds.has(line.lineId)) {
        throw new ValidationError(`Line ${line.lineId} does not belong to this requisition`);
      }
      const qty = new Prisma.Decimal(line.approvedQty);
      if (qty.lessThan(0)) {
        throw new ValidationError('Approved quantity cannot be negative');
      }
    }

    await prisma.$transaction(async (tx) => {
      // Any line not explicitly edited by the Manager is approved as requested.
      const editedIds = new Set(input.lines.map((l) => l.lineId));
      for (const line of requisition.lines) {
        const approvedQty = editedIds.has(line.id)
          ? input.lines.find((l) => l.lineId === line.id)!.approvedQty
          : line.requestedQty;
        await requisitionRepository.updateLineApprovedQty(line.id, requisition.id, approvedQty, tx);
      }

      const transitioned = await requisitionRepository.transitionStatus(
        requisition.id,
        organizationId,
        ['PENDING_MANAGER_APPROVAL'],
        'APPROVED',
        { approvedById: actor.id, approvedAt: new Date() },
        tx,
      );
      if (!transitioned) {
        throw new ConflictError('Requisition was no longer pending approval');
      }
    });

    const updated = await requisitionRepository.findById(id, organizationId);
    await fcmService.sendRequisitionDecisionPush(requisition.requestedById, {
      requisitionId: id,
      decision: 'APPROVED',
    });
    return updated!;
  },

  reject: async (actor: Actor, id: string, reason: string): Promise<RequisitionWithDetail> => {
    const organizationId = requireOrganization(actor);
    if (!reason || !reason.trim()) {
      throw new ValidationError('A rejection reason is required');
    }

    const requisition = await requisitionRepository.findById(id, organizationId);
    if (!requisition) {
      throw new NotFoundError('Requisition not found');
    }
    requireApprovalAccess(actor, requisition.organizationId);
    if (requisition.status !== 'PENDING_MANAGER_APPROVAL') {
      throw new ConflictError('Only a requisition pending approval can be rejected');
    }

    const transitioned = await requisitionRepository.transitionStatus(
      id,
      organizationId,
      ['PENDING_MANAGER_APPROVAL'],
      'REJECTED',
      { approvedById: actor.id, approvedAt: new Date(), rejectionReason: reason },
    );
    if (!transitioned) {
      throw new ConflictError('Requisition was no longer pending approval');
    }

    const updated = await requisitionRepository.findById(id, organizationId);
    await fcmService.sendRequisitionDecisionPush(requisition.requestedById, {
      requisitionId: id,
      decision: 'REJECTED',
      reason,
    });
    return updated!;
  },

  /** Raiser only, before approval. */
  cancel: async (actor: Actor, id: string): Promise<RequisitionWithDetail> => {
    const organizationId = requireOrganization(actor);
    const requisition = await requisitionRepository.findById(id, organizationId);
    if (!requisition) {
      throw new NotFoundError('Requisition not found');
    }
    if (requisition.requestedById !== actor.id) {
      throw new ForbiddenError('Only the requesting Department Head may cancel their own requisition');
    }
    if (requisition.status !== 'PENDING_MANAGER_APPROVAL') {
      throw new ConflictError('Only a requisition pending approval can be cancelled');
    }

    const transitioned = await requisitionRepository.transitionStatus(
      id,
      organizationId,
      ['PENDING_MANAGER_APPROVAL'],
      'CANCELLED',
    );
    if (!transitioned) {
      throw new ConflictError('Requisition was no longer pending approval');
    }

    return (await requisitionRepository.findById(id, organizationId))!;
  },

  /**
   * Q6: a REJECTED requisition can be edited and resubmitted rather than
   * raised fresh — keeps the audit trail (original rejection reason stays
   * visible in history via the status timeline; lines are replaced wholesale).
   */
  editAndResubmit: async (
    actor: Actor,
    id: string,
    input: RaiseRequisitionInput,
  ): Promise<RequisitionWithDetail> => {
    const organizationId = requireOrganization(actor);
    const departmentTag = requireDepartmentHead(actor);
    const requisition = await requisitionRepository.findById(id, organizationId);
    if (!requisition) {
      throw new NotFoundError('Requisition not found');
    }
    if (requisition.requestedById !== actor.id) {
      throw new ForbiddenError('Only the requesting Department Head may edit their own requisition');
    }
    if (requisition.status !== 'REJECTED') {
      throw new ConflictError('Only a rejected requisition can be edited and resubmitted');
    }
    if (input.lines.length === 0) {
      throw new ValidationError('A requisition must have at least one line');
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
      if (!item.departmentTags.includes(departmentTag)) {
        throw new ForbiddenError(`Item "${item.name}" is not orderable by your department`);
      }
    }

    await prisma.$transaction(async (tx) => {
      const linesInput: RequisitionLineInput[] = input.lines.map((l) => ({
        inventoryItemId: l.inventoryItemId,
        requestedQty: l.requestedQty,
        notes: l.notes,
      }));
      await requisitionRepository.replaceLines(id, linesInput, tx);
      await requisitionRepository.transitionStatus(
        id,
        organizationId,
        ['REJECTED'],
        'PENDING_MANAGER_APPROVAL',
        { approvedById: null, approvedAt: null, rejectionReason: null },
        tx,
      );
    });

    const updated = await requisitionRepository.findById(id, organizationId);
    await fcmService.sendRequisitionSubmittedPush(organizationId, {
      requisitionId: id,
      departmentTag,
    });
    return updated!;
  },
};
