import type { Request } from 'express';
import { Prisma, type DepartmentTag, type RequisitionSectionStatus } from '@prisma/client';
import {
  requisitionRepository,
  type RequisitionHistoryRowData,
  type RequisitionForManagerList,
  type RequisitionSectionForApproval,
  type RequisitionSectionWithLines,
  type RequisitionWithAllSections,
  type RequisitionWithMySection,
} from './requisitions-repository';
import { inventoryItemRepository, restockLevelRepository } from '../inventory/inventory-repository';
import { branchRepository } from '../../repositories/branch-repository';
import { locationRepository } from '../../repositories/location-repository';
import { authRepository } from '../../repositories/auth-repository';
import { prisma } from '../../config/database';
import { socketService } from '../../sockets/socket-service';
import { fcmService } from '../../services/fcm-service';
import { comparePin } from '../../utils/password';
import { ConflictError, ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from '../../utils/errors';
import type {
  ApproveRequisitionInput,
  ListNeedsApprovalQuery,
  ListRequisitionHistoryQuery,
  ListRequisitionsQuery,
  OpenRequisitionInput,
  RequisitionApprovalDetail,
  RequisitionApprovalLine,
  RequisitionApprovalSection,
  RequisitionHistoryRow,
  RequisitionListRow,
  RequisitionManagerListRow,
  RequisitionSectionDetail,
  RequisitionSectionLine,
  ReturnSectionInput,
  UpsertApprovalLinesInput,
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

/**
 * Belt-and-braces alongside the route's `requireRole('MANAGER')` guard —
 * matches how this module already double-checks department ownership in
 * `assertOwnDepartment`. Bare `requireRole('MANAGER')` at the route layer,
 * never `allowDepartmentHead(requireRole('MANAGER'))` — the latter would let
 * a Kitchen head approve the whole branch requisition.
 */
const requireManager = (actor: Actor): void => {
  if (actor.role !== 'MANAGER') {
    throw new ForbiddenError('Only a Branch Manager may perform this action');
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

// ---------------------------------------------------------------------------
// Session B — Branch Manager approval.
// ---------------------------------------------------------------------------

/**
 * `'14' !== Decimal('14.0000')` compared as strings — the highest-risk bug
 * in this session. Compared naively, every line looks "edited" and demands a
 * reason, making the feature unusable. Used by both the edit-reason guard and
 * the `isAsRequested`/`isEdited` serializers so the two can never disagree.
 */
const decimalsEqual = (a: string | null, b: string | null): boolean => {
  if (a === null || b === null) return a === b;
  return new Prisma.Decimal(a).equals(new Prisma.Decimal(b));
};

/** `approvedQty ?? requestedQty` — drives `isAsRequested`, `totalUnits`, and the approve-time freeze. Defined once. */
const effectiveQty = (line: { approvedQty: Prisma.Decimal | null; requestedQty: Prisma.Decimal | null }): Prisma.Decimal =>
  line.approvedQty ?? line.requestedQty ?? new Prisma.Decimal(0);

const sumUnits = (lines: { approvedQty: Prisma.Decimal | null; requestedQty: Prisma.Decimal | null }[]): string =>
  lines.reduce((sum, l) => sum.add(effectiveQty(l)), new Prisma.Decimal(0)).toString();

/**
 * Widened from Session A's single-section `resolveParentCategoryNames` to
 * take a flat line array so it works across all 5 sections in one query.
 */
const resolveParentCategoryNamesForLines = async (
  lines: { item: { category: { parentCategoryId: string | null } | null } }[],
): Promise<Map<string, string>> => {
  const parentIds = [
    ...new Set(lines.map((l) => l.item.category?.parentCategoryId).filter((id): id is string => Boolean(id))),
  ];
  if (parentIds.length === 0) return new Map();
  const parents = await prisma.category.findMany({ where: { id: { in: parentIds } }, select: { id: true, name: true } });
  return new Map(parents.map((p) => [p.id, p.name]));
};

const serializeApprovalLine = (
  line: RequisitionSectionForApproval['lines'][number],
  parentNamesByCategoryId: Map<string, string>,
): RequisitionApprovalLine => {
  const parentCategoryId = line.item.category?.parentCategoryId ?? null;
  const requestedQty = toDecimalString(line.requestedQty);
  const approvedQty = toDecimalString(line.approvedQty);
  return {
    id: line.id,
    inventoryItemId: line.inventoryItemId,
    itemName: line.item.name,
    usageUnit: line.item.usageUnit,
    categoryName: line.item.category?.name ?? null,
    parentCategoryName: parentCategoryId ? (parentNamesByCategoryId.get(parentCategoryId) ?? null) : null,
    onHand: null, // no branch-department ledger exists until Milestone Five — always null this milestone
    parAtRequest: toDecimalString(line.parAtRequest),
    requestedQty,
    approvedQty,
    editReason: line.editReason,
    // Before the manager reviews a line, approvedQty is null — that is "not
    // yet reviewed", not "edited". Only a line the manager has actually set
    // a differing value on counts as edited; a manager-added line
    // (requestedQty null, approvedQty set) is also edited by definition.
    isEdited: approvedQty !== null && !decimalsEqual(approvedQty, requestedQty),
  };
};

const serializeApprovalSection = (
  section: RequisitionSectionForApproval,
  parentNamesByCategoryId: Map<string, string>,
): RequisitionApprovalSection => {
  const lines = section.lines.map((l) => serializeApprovalLine(l, parentNamesByCategoryId));
  const changedLineCount = lines.filter((l) => l.isEdited).length;
  return {
    departmentTag: section.departmentTag,
    status: section.status,
    managerNote: section.managerNote,
    returnedNote: section.returnedNote,
    submittedAt: section.submittedAt ? section.submittedAt.toISOString() : null,
    submittedByName: section.submittedBy?.name ?? null,
    isAsRequested: changedLineCount === 0,
    changedLineCount,
    totalUnits: sumUnits(section.lines),
    lines,
  };
};

const serializeApprovalDetail = (
  requisition: RequisitionWithAllSections,
  parentNamesByCategoryId: Map<string, string>,
): RequisitionApprovalDetail => ({
  id: requisition.id,
  type: requisition.type,
  note: requisition.note,
  status: requisition.status,
  openedAt: requisition.openedAt.toISOString(),
  approvedAt: requisition.approvedAt ? requisition.approvedAt.toISOString() : null,
  approvedByName: requisition.approvedBy?.name ?? null,
  sections: requisition.sections.map((s) => serializeApprovalSection(s, parentNamesByCategoryId)),
});

const serializeManagerListRow = (row: RequisitionForManagerList): RequisitionManagerListRow => {
  const allLines = row.sections.flatMap((s) => s.lines);
  return {
    id: row.id,
    type: row.type,
    note: row.note,
    status: row.status,
    openedAt: row.openedAt.toISOString(),
    totalUnits: sumUnits(allLines),
    sectionsSubmitted: row.sections.filter((s) => s.status === 'SUBMITTED').length,
    sectionsTotal: row.sections.length,
  };
};

const deriveDisplayStatus = (row: RequisitionHistoryRowData): 'PENDING_APPROVAL' | 'APPROVED' | 'RETURNED' => {
  if (row.status === 'APPROVED') return 'APPROVED';
  if (row.sections.some((s) => s.status === 'RETURNED')) return 'RETURNED';
  return 'PENDING_APPROVAL';
};

const serializeHistoryRow = (row: RequisitionHistoryRowData): RequisitionHistoryRow => ({
  id: row.id,
  type: row.type,
  note: row.note,
  openedAt: row.openedAt.toISOString(),
  approvedAt: row.approvedAt ? row.approvedAt.toISOString() : null,
  displayStatus: deriveDisplayStatus(row),
  // From `approvedBy` only, never `submittedBy` — a Paper mock shows a
  // Department Head signing in History; that is mock-data drift, not spec.
  signedByName: row.approvedBy?.name ?? null,
  totalUnits: sumUnits(row.sections.flatMap((s) => s.lines)),
  dispatchSummary: row.dispatches.map((d) => ({
    dispatchId: d.id,
    departmentTag: d.departmentTag,
    status: d.status as RequisitionHistoryRow['dispatchSummary'][number]['status'],
    sequenceLabel: d.sequenceLabel,
  })),
});

const NOT_SUBMITTED_STATUSES: RequisitionSectionStatus[] = ['NOT_STARTED', 'DRAFT'];

/**
 * Composed inline, fire-and-forget, after commit — the `receiving-service.ts`
 * `notifyHubStoreManagersOfSignedReceipt` shape. Never awaited by the caller;
 * a rejected promise here must never fail the write that triggered it.
 */
const notifyManagersOfSubmission = async (organizationId: string, requisitionId: string, departmentTag: DepartmentTag, actorId: string): Promise<void> => {
  const managers = await requisitionRepository.findBranchManagers(organizationId);
  const recipientIds = managers.map((m) => m.id).filter((id) => id !== actorId);
  if (recipientIds.length === 0) return;
  const payload = { requisitionId, departmentTag };
  recipientIds.forEach((id) => socketService.emitRequisitionSubmitted(id, payload));
  await fcmService.sendRequisitionSubmittedPush(organizationId, payload);
};

const notifyHeadsOfApproval = async (
  organizationId: string,
  requisition: RequisitionWithAllSections,
  actorId: string,
): Promise<void> => {
  const seen = new Set<string>();
  for (const section of requisition.sections) {
    if (section.status !== 'SUBMITTED') continue; // unsubmitted sections were never part of this decision
    const heads = await requisitionRepository.findSectionHeads(organizationId, section.departmentTag, section.submittedBy?.id ?? null);
    for (const head of heads) {
      if (head.id === actorId || seen.has(head.id)) continue;
      seen.add(head.id);
      const payload = { requisitionId: requisition.id, decision: 'APPROVED' as const };
      socketService.emitRequisitionDecision(head.id, payload);
      await fcmService.sendRequisitionDecisionPush(head.id, payload);
    }
  }
};

const notifyHeadOfReturn = async (
  headId: string | null,
  departmentTag: DepartmentTag,
  requisitionId: string,
  actorId: string,
  returnedNote: string,
): Promise<void> => {
  if (!headId || headId === actorId) return;
  const payload = { requisitionId, departmentTag, returnedNote };
  socketService.emitRequisitionSectionReturned(headId, payload);
  await fcmService.sendRequisitionSectionReturnedPush(headId, payload);
};

const notifyHeadOfNudge = async (organizationId: string, departmentTag: DepartmentTag, requisitionId: string, actorId: string): Promise<void> => {
  const heads = await requisitionRepository.findSectionHeads(organizationId, departmentTag, null);
  for (const head of heads) {
    if (head.id === actorId) continue;
    const payload = { requisitionId, departmentTag };
    socketService.emitRequisitionNudge(head.id, payload);
    await fcmService.sendRequisitionNudgePush(head.id, payload);
  }
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

  /**
   * Cancel a started requisition — no way to back out and start fresh
   * existed before this (session-1-quick-wins-prompt #17). Only the
   * requisition's own department head, only while zero sections have ever
   * been SUBMITTED — once a section is submitted there is a real record to
   * preserve (the branch manager may already be reviewing it), so recall +
   * resubmit is the only path from there, not cancel.
   */
  cancelRequisition: async (actor: Actor, requisitionId: string): Promise<void> => {
    const organizationId = requireBranchOrg(actor);
    if (!actor.departmentTag) {
      throw new ValidationError('This user has no department assigned');
    }

    const requisition = await requisitionRepository.findById(requisitionId, organizationId);
    if (!requisition) throw new NotFoundError('Requisition not found');
    if (requisition.openedById !== actor.id) {
      throw new ForbiddenError('You may only cancel a requisition you opened');
    }

    const cancelled = await requisitionRepository.cancel(requisitionId, organizationId);
    if (!cancelled) {
      throw new ConflictError('This requisition can no longer be cancelled — a section has already been submitted');
    }
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

    // Session A shipped this endpoint with no notification at all — the
    // manager's "Awaiting your approval" badge never lit up. Fire-and-forget,
    // after commit, actor filtered out.
    void notifyManagersOfSubmission(organizationId, requisitionId, departmentTag, actor.id);

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

  // -------------------------------------------------------------------------
  // Session B — Branch Manager approval.
  // -------------------------------------------------------------------------

  /** Manager's needs-approval list. Deliberately a new literal path (decision #9) — Session A's list contract stays untouched. */
  listForManagerApproval: async (actor: Actor, query: ListNeedsApprovalQuery): Promise<RequisitionManagerListRow[]> => {
    requireManager(actor);
    const organizationId = requireBranchOrg(actor);
    const rows = await requisitionRepository.findAllByOrganizationForManager(organizationId, query.limit);
    return rows.map(serializeManagerListRow);
  },

  getRequisitionForApproval: async (actor: Actor, requisitionId: string): Promise<RequisitionApprovalDetail> => {
    requireManager(actor);
    const organizationId = requireBranchOrg(actor);

    const requisition = await requisitionRepository.findByIdWithAllSections(requisitionId, organizationId);
    if (!requisition) throw new NotFoundError('Requisition not found');

    const parentNames = await resolveParentCategoryNamesForLines(requisition.sections.flatMap((s) => s.lines));
    return serializeApprovalDetail(requisition, parentNames);
  },

  listHistory: async (actor: Actor, query: ListRequisitionHistoryQuery): Promise<RequisitionHistoryRow[]> => {
    requireManager(actor);
    const organizationId = requireBranchOrg(actor);

    const rows = await requisitionRepository.findHistoryRows(organizationId, {
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      status: query.status,
      limit: query.limit,
      cursor: query.cursor,
    });
    const serialized = rows.map(serializeHistoryRow);
    // status is derived, not stored — filter after serializing so a single
    // derivation function is the only place displayStatus is computed.
    return query.status ? serialized.filter((r) => r.displayStatus === query.status) : serialized;
  },

  /**
   * Bulk line edit for the manager's review screen: qty edits (with the
   * server-enforced edit-reason rule — Zod can't see `requestedQty`, it's
   * server state), manager-added lines (`requestedQty` stays null, decision
   * #5), soft-deletes, and the `fillMyself` section-level transition.
   * Rejected once the requisition is APPROVED.
   */
  upsertApprovalLines: async (
    actor: Actor,
    requisitionId: string,
    departmentTag: DepartmentTag,
    input: UpsertApprovalLinesInput,
  ): Promise<RequisitionApprovalDetail> => {
    requireManager(actor);
    const organizationId = requireBranchOrg(actor);

    const requisition = await requisitionRepository.findById(requisitionId, organizationId);
    if (!requisition) throw new NotFoundError('Requisition not found');
    if (requisition.status === 'APPROVED') {
      throw new ConflictError('This requisition has already been approved');
    }

    const section = await requisitionRepository.findSectionWithLines(requisitionId, departmentTag, organizationId);
    if (!section) throw new NotFoundError('Requisition section not found');
    const existingById = new Map(section.lines.map((l) => [l.id, l]));

    const newItemIds = input.lines.filter((l) => !l.id && l.inventoryItemId).map((l) => l.inventoryItemId!);
    if (newItemIds.length > 0) {
      const hubOrgId = await requireHubOrganization();
      const liveItems = await inventoryItemRepository.findLiveByIds(newItemIds, hubOrgId);
      if (liveItems.length !== new Set(newItemIds).size) {
        throw new NotFoundError('One or more items were not found');
      }
    }

    if (input.fillMyself && !NOT_SUBMITTED_STATUSES.includes(section.status)) {
      throw new ConflictError('This section has already been submitted');
    }

    for (const line of input.lines) {
      if (line.deleted || !line.id) continue;
      const existing = existingById.get(line.id);
      if (!existing) throw new NotFoundError('Requisition line not found');
      const existingRequestedQty = toDecimalString(existing.requestedQty);
      if (!decimalsEqual(line.approvedQty, existingRequestedQty) && !line.editReason) {
        throw new ValidationError('An edit reason is required when the approved quantity differs from what was requested');
      }
    }

    await prisma.$transaction(async (tx) => {
      for (const line of input.lines) {
        if (line.id && line.deleted) {
          await requisitionRepository.softDeleteLine(line.id, tx);
        } else if (line.id) {
          const approvedQty = line.approvedQty === null ? null : new Prisma.Decimal(line.approvedQty);
          await requisitionRepository.updateLineApproval(line.id, { approvedQty, editReason: line.editReason ?? null, editedById: actor.id }, tx);
        } else if (line.inventoryItemId && line.approvedQty !== null) {
          await requisitionRepository.createManagerLine(
            section.id,
            { inventoryItemId: line.inventoryItemId, approvedQty: new Prisma.Decimal(line.approvedQty), editedById: actor.id, editReason: line.editReason ?? null },
            tx,
          );
        }
      }

      if (input.fillMyself) {
        // A manager-filled section counts as settled (decision #6) —
        // SUBMITTED, attributed to the manager, no new enum value.
        const count = await requisitionRepository.setSectionStatus(
          section.id,
          NOT_SUBMITTED_STATUSES,
          { status: 'SUBMITTED', submittedById: actor.id, submittedAt: new Date() },
          tx,
        );
        if (count === 0) throw new ConflictError('This section has already been submitted');
        // Easy to miss: without this the requisition stays at OPEN and
        // approve then refuses with "nothing to approve".
        await requisitionRepository.markPendingApprovalIfOpen(requisitionId, tx);
      }
    });

    return requisitionService.getRequisitionForApproval(actor, requisitionId);
  },

  /** SUBMITTED -> RETURNED with the manager's note. Rejected on an already-approved requisition. */
  returnSection: async (actor: Actor, requisitionId: string, departmentTag: DepartmentTag, input: ReturnSectionInput): Promise<RequisitionApprovalDetail> => {
    requireManager(actor);
    const organizationId = requireBranchOrg(actor);

    const requisition = await requisitionRepository.findById(requisitionId, organizationId);
    if (!requisition) throw new NotFoundError('Requisition not found');
    if (requisition.status === 'APPROVED') {
      throw new ConflictError('This requisition has already been approved');
    }

    const section = await requisitionRepository.findSectionWithLines(requisitionId, departmentTag, organizationId);
    if (!section) throw new NotFoundError('Requisition section not found');

    const count = await prisma.$transaction((tx) =>
      requisitionRepository.setSectionStatus(section.id, ['SUBMITTED'], { status: 'RETURNED', returnedNote: input.note }, tx),
    );
    if (count === 0) throw new ConflictError('This section is not currently submitted');

    void notifyHeadOfReturn(section.submittedById, departmentTag, requisitionId, actor.id, input.note);

    return requisitionService.getRequisitionForApproval(actor, requisitionId);
  },

  /** Pure notification — no state change. Section must be NOT_STARTED/DRAFT (a submitted section needs no nudge). */
  nudgeHead: async (actor: Actor, requisitionId: string, departmentTag: DepartmentTag): Promise<void> => {
    requireManager(actor);
    const organizationId = requireBranchOrg(actor);

    const section = await requisitionRepository.findSectionById(requisitionId, departmentTag, organizationId);
    if (!section) throw new NotFoundError('Requisition section not found');
    if (!NOT_SUBMITTED_STATUSES.includes(section.status)) {
      throw new ConflictError('This section has already been submitted');
    }

    void notifyHeadOfNudge(organizationId, departmentTag, requisitionId, actor.id);
  },

  /**
   * The hard gate: sign once with a PIN to approve the whole requisition
   * (decision #7 — one signature, not per-department; per-department signing
   * is Milestone Five's dispatch pattern).
   */
  approveRequisition: async (actor: Actor, requisitionId: string, input: ApproveRequisitionInput): Promise<RequisitionApprovalDetail> => {
    requireManager(actor);
    const organizationId = requireBranchOrg(actor);

    const actorWithPin = await authRepository.findUserByIdWithPassword(actor.id);
    if (!actorWithPin || !actorWithPin.pinHash) {
      throw new UnauthorizedError('No PIN is set for this account');
    }
    const pinValid = await comparePin(input.pin, actorWithPin.pinHash);
    if (!pinValid) throw new UnauthorizedError('Incorrect PIN');

    const requisition = await requisitionRepository.findByIdWithAllSections(requisitionId, organizationId);
    if (!requisition) throw new NotFoundError('Requisition not found');
    if (requisition.status === 'APPROVED') {
      throw new ConflictError('This requisition has already been approved');
    }
    if (!requisition.sections.some((s) => s.status === 'SUBMITTED')) {
      throw new ConflictError('Nothing in this requisition is ready for approval yet');
    }

    await prisma.$transaction(async (tx) => {
      // Recall race guard: re-assert every currently-SUBMITTED section is
      // *still* SUBMITTED via the guarded updateMany — it takes row locks, a
      // count() under READ COMMITTED does not. Writing a value to itself
      // looks pointless; it is the only way to detect a concurrent recall
      // between the pre-load above and this transaction. Don't "simplify"
      // this to a plain count() — the two claims below (§3, §4) tests catch it.
      const submittedSectionIds = requisition.sections.filter((s) => s.status === 'SUBMITTED').map((s) => s.id);
      for (const sectionId of submittedSectionIds) {
        const count = await requisitionRepository.setSectionStatus(sectionId, ['SUBMITTED'], { status: 'SUBMITTED' }, tx);
        if (count === 0) {
          throw new ConflictError('A department recalled their section while you were reviewing.');
        }
      }

      // Freeze: any line still at approvedQty === null on a submitted
      // section is written to requestedQty. Without this an approved
      // requisition has null approvedQty rows and Milestone Five's dispatch
      // has nothing to pick, with no way to tell "approved as requested"
      // from "never reviewed". One UPDATE per line — fine at this scale
      // (a 60-line requisition = 60 writes in one transaction); don't optimise.
      for (const section of requisition.sections) {
        if (section.status !== 'SUBMITTED') continue; // unsubmitted sections are silently ignored — decision #3's derived "Send without"
        for (const line of section.lines) {
          if (line.approvedQty === null) {
            await requisitionRepository.updateLineApproval(line.id, { approvedQty: line.requestedQty, editReason: null, editedById: actor.id }, tx);
          }
        }
      }

      const approvedCount = await requisitionRepository.markApprovedIfPendingApproval(requisitionId, actor.id, tx);
      if (approvedCount === 0) {
        throw new ConflictError('This requisition was already approved by another manager.');
      }
    });

    const approved = await requisitionRepository.findByIdWithAllSections(requisitionId, organizationId);
    if (!approved) throw new NotFoundError('Requisition not found');

    void notifyHeadsOfApproval(organizationId, approved, actor.id);

    const parentNames = await resolveParentCategoryNamesForLines(approved.sections.flatMap((s) => s.lines));
    return serializeApprovalDetail(approved, parentNames);
  },
};
