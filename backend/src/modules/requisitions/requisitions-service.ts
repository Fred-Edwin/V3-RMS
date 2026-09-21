import type { Request } from 'express';
import { Prisma, type DepartmentTag } from '@prisma/client';
import {
  requisitionRepository,
  type RequisitionSectionWithLines,
  type RequisitionWithMySection,
} from './requisitions-repository';
import { inventoryItemRepository, restockLevelRepository } from '../inventory/inventory-repository';
import { branchRepository } from '../../repositories/branch-repository';
import { locationRepository } from '../../repositories/location-repository';
import { prisma } from '../../config/database';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../utils/errors';
import type {
  ListRequisitionsQuery,
  OpenRequisitionInput,
  RequisitionListRow,
  RequisitionSectionDetail,
  RequisitionSectionLine,
  UpsertRequisitionLinesInput,
} from './requisitions.types';

type Actor = NonNullable<Request['user']>;

const toDecimalString = (value: Prisma.Decimal | null): string | null => (value === null ? null : value.toString());

/**
 * Every section-scoped method asserts this — the single highest-priority
 * check in this session. The route's `requireDepartmentHead` middleware only
 * confirms *a* department head, not *which* department; without this check a
 * Kitchen head could read/write another department's section by changing
 * the URL param.
 */
const assertOwnDepartment = (actor: Actor, departmentTag: DepartmentTag): void => {
  if (actor.departmentTag !== departmentTag) {
    throw new ForbiddenError('You may only access your own department');
  }
};

const requireBranchOrg = (actor: Actor): string => {
  if (!actor.organizationId) {
    throw new ValidationError('Branch context missing for this user');
  }
  return actor.organizationId;
};

/**
 * The item catalog lives on the hub organization only (D-15), never on a
 * branch org — a requisition line's `inventoryItemId` must be validated
 * against the hub, not the branch the requisition itself belongs to. Same
 * hub resolution `inventory-service.ts`'s `requireHubActor`/
 * `requireHubOrgForCatalogRead` use, duplicated locally per this module's
 * own-repository convention (prep/receiving precedent).
 */
const requireHubOrganization = async (): Promise<string> => {
  const hub = await branchRepository.findHub();
  if (!hub) {
    throw new ValidationError('No hub organization is configured');
  }
  return hub.id;
};

const serializeListRow = (row: RequisitionWithMySection, departmentTag: DepartmentTag): RequisitionListRow => {
  const mySection = row.sections.find((s) => s.departmentTag === departmentTag);
  return {
    id: row.id,
    type: row.type,
    note: row.note,
    status: row.status,
    openedAt: row.openedAt.toISOString(),
    // A section is always created for every DepartmentTag at open time
    // (requisitionRepository.create), so this is only missing on corrupt
    // data — fall back to NOT_STARTED rather than throwing on a list read.
    mySectionStatus: mySection?.status ?? 'NOT_STARTED',
  };
};

const serializeLine = (line: RequisitionSectionWithLines['lines'][number]): RequisitionSectionLine => ({
  id: line.id,
  inventoryItemId: line.inventoryItemId,
  itemName: line.item.name,
  usageUnit: line.item.usageUnit,
  categoryName: line.item.category?.name ?? null,
  parentCategoryName: null, // resolved below when a parent exists — see getSection
  parAtRequest: toDecimalString(line.parAtRequest),
  requestedQty: toDecimalString(line.requestedQty),
});

const serializeSectionDetail = (
  section: RequisitionSectionWithLines,
  parentNamesByCategoryId: Map<string, string>,
): RequisitionSectionDetail => ({
  requisitionId: section.requisition.id,
  departmentTag: section.departmentTag,
  status: section.status,
  managerNote: section.managerNote,
  returnedNote: section.returnedNote,
  submittedAt: section.submittedAt ? section.submittedAt.toISOString() : null,
  lines: section.lines.map((line) => {
    const parentCategoryId = line.item.category?.parentCategoryId ?? null;
    return {
      ...serializeLine(line),
      parentCategoryName: parentCategoryId ? (parentNamesByCategoryId.get(parentCategoryId) ?? null) : null,
    };
  }),
});

/**
 * Second lookup for parent-category names — Category.parentCategoryId is a
 * bare column (no self-relation), matching this milestone's schema (session-
 * a-plan.md §1). Reads name + parent name via a straightforward extra query
 * rather than a relation Session A's query pattern doesn't need.
 */
const resolveParentCategoryNames = async (
  section: RequisitionSectionWithLines,
): Promise<Map<string, string>> => {
  const parentIds = [
    ...new Set(section.lines.map((l) => l.item.category?.parentCategoryId).filter((id): id is string => Boolean(id))),
  ];
  if (parentIds.length === 0) return new Map();
  const parents = await prisma.category.findMany({ where: { id: { in: parentIds } }, select: { id: true, name: true } });
  return new Map(parents.map((p) => [p.id, p.name]));
};

/**
 * `parAtRequest` sourcing: look up RestockLevel for (branch-department
 * location for this org+departmentTag, item); if none exists, snapshot
 * null — no fallback, no zero (session-a-plan.md §2).
 */
const resolveParAtRequest = async (
  organizationId: string,
  departmentTag: DepartmentTag,
  inventoryItemId: string,
): Promise<Prisma.Decimal | null> => {
  const location = await locationRepository.findByOrganizationTypeDepartment(organizationId, 'BRANCH_DEPARTMENT', departmentTag);
  if (!location) return null;
  const levels = await restockLevelRepository.findByItemIdsForLocation(organizationId, location.id, [inventoryItemId]);
  return levels.get(inventoryItemId) ?? null;
};

export const requisitionService = {
  openRequisition: async (actor: Actor, input: OpenRequisitionInput): Promise<RequisitionListRow> => {
    const organizationId = requireBranchOrg(actor);
    if (!actor.departmentTag) {
      throw new ValidationError('This user has no department assigned');
    }

    const created = await requisitionRepository.create({
      organizationId,
      type: input.type,
      note: input.note,
      openedById: actor.id,
    });

    const withSections = await requisitionRepository.findAllByOrganization(organizationId, 1);
    const row = withSections.find((r) => r.id === created.id);
    if (!row) throw new NotFoundError('Requisition not found');
    return serializeListRow(row, actor.departmentTag as DepartmentTag);
  },

  listRequisitions: async (actor: Actor, query: ListRequisitionsQuery): Promise<RequisitionListRow[]> => {
    const organizationId = requireBranchOrg(actor);
    if (!actor.departmentTag) {
      throw new ValidationError('This user has no department assigned');
    }
    const rows = await requisitionRepository.findAllByOrganization(organizationId, query.limit);
    return rows.map((row) => serializeListRow(row, actor.departmentTag as DepartmentTag));
  },

  getSection: async (actor: Actor, requisitionId: string, departmentTag: DepartmentTag): Promise<RequisitionSectionDetail> => {
    assertOwnDepartment(actor, departmentTag);
    const organizationId = requireBranchOrg(actor);

    const section = await requisitionRepository.findSectionWithLines(requisitionId, departmentTag, organizationId);
    if (!section) throw new NotFoundError('Requisition section not found');

    const parentNames = await resolveParentCategoryNames(section);
    return serializeSectionDetail(section, parentNames);
  },

  /**
   * Bulk upsert: existing line qty edits (incl. "0", zero-not-delete) + new
   * lines (add-item, snapshots parAtRequest from RestockLevel at creation
   * time) + managerNote. Rejected when the section is SUBMITTED/RETURNED —
   * a section awaiting approval or bounced back for a specific reason is not
   * silently editable outside the submit/recall/resubmit flow.
   */
  upsertLines: async (
    actor: Actor,
    requisitionId: string,
    departmentTag: DepartmentTag,
    input: UpsertRequisitionLinesInput,
  ): Promise<RequisitionSectionDetail> => {
    assertOwnDepartment(actor, departmentTag);
    const organizationId = requireBranchOrg(actor);

    const section = await requisitionRepository.findSectionById(requisitionId, departmentTag, organizationId);
    if (!section) throw new NotFoundError('Requisition section not found');
    if (section.status === 'SUBMITTED' || section.status === 'RETURNED') {
      throw new ConflictError('This section cannot be edited in its current state');
    }

    const newItemIds = input.lines.filter((l) => !l.id && l.inventoryItemId).map((l) => l.inventoryItemId!);
    if (newItemIds.length > 0) {
      // The catalog lives on the hub org (D-15), not this branch — validate
      // against the hub, never `organizationId` (the branch).
      const hubOrgId = await requireHubOrganization();
      const liveItems = await inventoryItemRepository.findLiveByIds(newItemIds, hubOrgId);
      if (liveItems.length !== new Set(newItemIds).size) {
        throw new NotFoundError('One or more items were not found');
      }
    }

    await prisma.$transaction(async (tx) => {
      for (const line of input.lines) {
        const requestedQty = line.requestedQty === null ? null : new Prisma.Decimal(line.requestedQty);
        if (line.id) {
          // Zero-not-delete: "0" is a real value, the row stays.
          await requisitionRepository.updateLineQty(line.id, requestedQty, tx);
        } else if (line.inventoryItemId) {
          const parAtRequest = await resolveParAtRequest(organizationId, departmentTag, line.inventoryItemId);
          await requisitionRepository.createLine(
            section.id,
            { inventoryItemId: line.inventoryItemId, requestedQty, parAtRequest },
            tx,
          );
        }
      }

      if (input.managerNote !== undefined) {
        await requisitionRepository.updateManagerNote(section.id, input.managerNote || null, tx);
      }

      // DRAFT once the head has any unsaved/in-progress edits (session-a-plan
      // §1.2 RequisitionSectionStatus). NOT_STARTED -> DRAFT on first save;
      // an already-DRAFT section stays DRAFT.
      if (section.status === 'NOT_STARTED') {
        await requisitionRepository.setSectionStatus(section.id, ['NOT_STARTED'], { status: 'DRAFT' }, tx);
      }
    });

    return requisitionService.getSection(actor, requisitionId, departmentTag);
  },

  /** NOT_STARTED/DRAFT -> SUBMITTED; flips parent Requisition.status OPEN -> PENDING_APPROVAL only on the first section submitted. */
  submitSection: async (actor: Actor, requisitionId: string, departmentTag: DepartmentTag): Promise<RequisitionSectionDetail> => {
    assertOwnDepartment(actor, departmentTag);
    const organizationId = requireBranchOrg(actor);

    const section = await requisitionRepository.findSectionById(requisitionId, departmentTag, organizationId);
    if (!section) throw new NotFoundError('Requisition section not found');

    await prisma.$transaction(async (tx) => {
      // RETURNED -> SUBMITTED is a real transition (resubmit after a branch
      // manager bounce-back) — returnedNote is cleared server-side here, not
      // just hidden client-side, so a stale bounce-back reason never lingers
      // on a resubmitted section.
      const count = await requisitionRepository.setSectionStatus(
        section.id,
        ['NOT_STARTED', 'DRAFT', 'RETURNED'],
        { status: 'SUBMITTED', submittedById: actor.id, submittedAt: new Date(), returnedNote: null },
        tx,
      );
      if (count === 0) {
        throw new ConflictError('This section has already been submitted or is no longer editable');
      }
      // Flips only on the first section submitted — the where-status check
      // makes this a no-op (count: 0, ignored) on every subsequent submit.
      await requisitionRepository.markPendingApprovalIfOpen(requisitionId, tx);
    });

    return requisitionService.getSection(actor, requisitionId, departmentTag);
  },

  /** SUBMITTED -> DRAFT; rejected if Requisition.status === 'APPROVED'. */
  recallSection: async (actor: Actor, requisitionId: string, departmentTag: DepartmentTag): Promise<RequisitionSectionDetail> => {
    assertOwnDepartment(actor, departmentTag);
    const organizationId = requireBranchOrg(actor);

    const requisition = await requisitionRepository.findById(requisitionId, organizationId);
    if (!requisition) throw new NotFoundError('Requisition not found');
    if (requisition.status === 'APPROVED') {
      throw new ConflictError('This requisition has already been approved and can no longer be recalled');
    }

    const section = await requisitionRepository.findSectionById(requisitionId, departmentTag, organizationId);
    if (!section) throw new NotFoundError('Requisition section not found');

    const count = await prisma.$transaction((tx) =>
      requisitionRepository.setSectionStatus(section.id, ['SUBMITTED'], { status: 'DRAFT' }, tx),
    );
    if (count === 0) {
      throw new ConflictError('This section is not currently submitted');
    }

    return requisitionService.getSection(actor, requisitionId, departmentTag);
  },
};
