import type { Request } from 'express';
import { branchRepository } from '../../../repositories/branch-repository';
import { ForbiddenError, ValidationError } from '../../../utils/errors';
import { requireHubReader } from '../_shared/central-store-access';
import { trimDecimal } from '../catalog/item-history';
import { describeItemChange, describeRecipeVersion, describeRestockChange, describeRunEntry, describeSupplierAudit, describeSupplierCreated, auditReason, recipeReason, runEntryReason } from './audit-log-describe';
import { auditLogRepository, type PurchasingArea, type RunEntryKind, type Scope } from './audit-log-repository';
import type { AuditArea, AuditEntry, AuditLogPage } from './audit-log.types';
import { AUDIT_AREAS } from './audit-log.types';
import type { AuditLogQuery } from './audit-log-validators';
import type { AuditSource } from './sources/source';
import { stockAdjustmentsSource } from './sources/stock-adjustments-source';
import { requisitionsSource } from './sources/requisitions-source';
import { dispatchSource } from './sources/dispatch-source';
import { discrepanciesSource } from './sources/discrepancies-source';
import { stockCountsSource } from './sources/stock-counts-source';
import { wasteSource } from './sources/waste-source';
import { branchWasteSource } from './sources/branch-waste-source';

type Actor = NonNullable<Request['user']>;

const DEPARTMENT_LABEL: Record<string, string> = {
  KITCHEN: 'Kitchen',
  PASTRY: 'Pastry',
  BARISTA: 'Barista',
  SERVICE: 'Service',
  HOUSEKEEPING: 'Housekeeping',
};

const jsonOf = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const idOf = (after: Record<string, unknown> | null, before: Record<string, unknown> | null): string | null => {
  const id = after?.inventoryItemId ?? before?.inventoryItemId;
  return typeof id === 'string' ? id : null;
};

/** The areas read from rows other features keep, each its own small module (`sources/`). */
const DERIVED_SOURCES: readonly AuditSource[] = [stockCountsSource, wasteSource, stockAdjustmentsSource, requisitionsSource, dispatchSource, discrepanciesSource, branchWasteSource];

/** The areas a branch can have entries in. With the Branch filter on, the hub's own areas answer nothing. */
const BRANCH_AREAS: readonly AuditArea[] = ['RESTOCK_LEVELS', 'REQUISITIONS', 'DISPATCH', 'DISCREPANCIES', 'BRANCH_DAY', 'BRANCH_WASTE'];

/**
 * The scope of one read. The hub roles (Store Manager, Accountant, Director, System Admin) read every branch and every Central Store
 * area, narrowed by the Branch filter when it is set. The Branch Manager (Paper step 60, the own-branch audit link) reads ONE branch:
 * their own. The Branch filter is forced to it, so the hub-only areas answer nothing and no other branch can be named.
 */
const requireScope = async (actor: Actor, requestedBranchId: string | undefined): Promise<{ scope: Scope; branches: Array<{ id: string; name: string }> }> => {
  const hubId = await requireHubReader(actor);
  const allBranches = (await branchRepository.findActiveBranchOptions()).map((b) => ({ id: b.id, name: b.name }));
  const ownBranchOnly = actor.role === 'MANAGER';
  if (ownBranchOnly && (!actor.siteId || (requestedBranchId !== undefined && requestedBranchId !== actor.siteId))) {
    throw new ForbiddenError('You can only read the audit log of your own branch');
  }
  const branchId = ownBranchOnly ? (actor.siteId ?? undefined) : requestedBranchId;
  const branches = ownBranchOnly ? allBranches.filter((b) => b.id === actor.siteId) : allBranches;
  // The Branch Manager's "who" list never reaches the hub's people.
  const peopleOrgIds = ownBranchOnly ? branches.map((b) => b.id) : [hubId, ...branches.map((b) => b.id)];
  if (branchId === undefined) return { scope: { hubId, restockOrgIds: peopleOrgIds, peopleOrgIds }, branches };
  if (!branches.some((b) => b.id === branchId)) throw new ValidationError('That branch is not one of yours to read', 'BRANCH_NOT_FOUND');
  return { scope: { hubId, restockOrgIds: [branchId], peopleOrgIds, branchId }, branches };
};

type RunEntryRow = Awaited<ReturnType<typeof auditLogRepository.runEntries>>[number];
const RUN_VERB = { RECORDED: 'Recorded', CORRECTED: 'Corrected', CANCELLED: 'Cancelled', REVIEWED: 'Reviewed' } as const;

/** One Prep run entry; the id carries the kind so a run's four entries never collide. */
const runEntry = (run: RunEntryRow, kind: RunEntryKind, at: Date, actor: { id: string; name: string }): AuditEntry => ({
  id: `run:${kind.toLowerCase()}:${run.id}`,
  at: at.toISOString(),
  actor,
  area: 'PREP',
  what: describeRunEntry(RUN_VERB[kind], { reference: run.reference, outputName: run.outputItem.name, made: trimDecimal(run.actualYield.toString()), unit: run.outputItem.usageUnit }),
  reason: kind === 'CORRECTED' ? runEntryReason(run.correctionReason, run.reasonNote, 'CORRECTED') : kind === 'CANCELLED' ? runEntryReason(run.cancelReason, run.reasonNote, 'CANCELLED') : null,
});

/**
 * The Audit log (API_CONTRACT.md §30.12): item history, supplier audit rows, supplier creations, restock level
 * changes, Prep, the purchase file's Purchasing and Payments rows and the derived areas in `sources/` (Stock counts, Waste, Stock
 * adjustments), newest first, in one list. Read-only; each source is read up to the end of the requested page and the
 * merged list is cut to it, so a page is exact whatever the mix. The Branch filter narrows to one branch: only restock levels
 * set there answer (the five Branches areas are listed and stay empty until each block adds its source).
 */
export const auditLogService = {
  list: async (actor: Actor, query: AuditLogQuery): Promise<AuditLogPage> => {
    const { scope, branches } = await requireScope(actor, query.branchId);
    const filter = { from: query.from, to: query.to, actorId: query.actorId };
    const areas: readonly AuditArea[] = query.area ? [query.area] : AUDIT_AREAS;
    const take = query.page * query.perPage;
    const wants = (area: AuditArea) => areas.includes(area) && (scope.branchId === undefined || BRANCH_AREAS.includes(area));
    const derived = DERIVED_SOURCES.filter((source) => wants(source.area));

    const purchasingAreas = areas.filter((a): a is PurchasingArea => (a === 'PURCHASING' || a === 'PAYMENTS') && wants(a));

    const prepWanted = wants('PREP');
    const [itemRows, auditRows, createdRows, restockRows, purchasingRows, recipeRows, runRecorded, runCorrected, runCancelled, runReviewed, counts, actorIds, derivedEntries, derivedCounts, derivedActorIds] = await Promise.all([
      wants('CATALOG') ? auditLogRepository.itemChanges(scope, filter, take) : [],
      wants('SUPPLIERS') ? auditLogRepository.supplierAudits(scope, filter, take) : [],
      wants('SUPPLIERS') ? auditLogRepository.suppliersCreated(scope, filter, take) : [],
      wants('RESTOCK_LEVELS') ? auditLogRepository.restockChanges(scope, filter, take) : [],
      purchasingAreas.length > 0 ? auditLogRepository.purchasingEntries(scope, filter, purchasingAreas, take) : [],
      wants('PREP') ? auditLogRepository.recipeVersions(scope, filter, take) : [],
      prepWanted ? auditLogRepository.runEntries(scope, filter, 'RECORDED', take) : [],
      prepWanted ? auditLogRepository.runEntries(scope, filter, 'CORRECTED', take) : [],
      prepWanted ? auditLogRepository.runEntries(scope, filter, 'CANCELLED', take) : [],
      prepWanted ? auditLogRepository.runEntries(scope, filter, 'REVIEWED', take) : [],
      Promise.all([
        wants('CATALOG') ? auditLogRepository.countItemChanges(scope, filter) : 0,
        wants('SUPPLIERS') ? auditLogRepository.countSupplierAudits(scope, filter) : 0,
        wants('SUPPLIERS') ? auditLogRepository.countSuppliersCreated(scope, filter) : 0,
        wants('RESTOCK_LEVELS') ? auditLogRepository.countRestockChanges(scope, filter) : 0,
        purchasingAreas.length > 0 ? auditLogRepository.countPurchasingEntries(scope, filter, purchasingAreas) : 0,
        wants('PREP') ? auditLogRepository.countRecipeVersions(scope, filter) : 0,
        prepWanted ? auditLogRepository.countRunEntries(scope, filter, 'RECORDED') : 0,
        prepWanted ? auditLogRepository.countRunEntries(scope, filter, 'CORRECTED') : 0,
        prepWanted ? auditLogRepository.countRunEntries(scope, filter, 'CANCELLED') : 0,
        prepWanted ? auditLogRepository.countRunEntries(scope, filter, 'REVIEWED') : 0,
      ]),
      auditLogRepository.actorIds(scope, { from: query.from, to: query.to }),
      Promise.all(derived.map((source) => source.entries(scope, filter, take))),
      Promise.all(derived.map((source) => source.count(scope, filter))),
      // The Who list lists everyone with an entry in the period, in the areas shown; a branch narrows it with the rest.
      // With the Branch filter on, only the sources that belong to a branch list their people (the hub's own areas answer nothing).
      Promise.all(DERIVED_SOURCES.filter((source) => scope.branchId === undefined || BRANCH_AREAS.includes(source.area)).map((source) => source.actorIds(scope, { from: query.from, to: query.to }))),
    ]);

    const snapshotItemIds = [...new Set(auditRows.map((r) => idOf(jsonOf(r.after), jsonOf(r.before))).filter((id): id is string => id !== null))];
    const creatorIds = [...new Set(createdRows.map((r) => r.createdById).filter((id): id is string => id !== null))];
    const everyActorId = [...new Set([...actorIds, ...derivedActorIds.flat()])];
    const [itemNames, userNames] = await Promise.all([
      auditLogRepository.itemNames(scope, snapshotItemIds),
      auditLogRepository.userNames(scope, [...new Set([...creatorIds, ...everyActorId])]),
    ]);

    const entries: AuditEntry[] = [
      ...itemRows.map((r): AuditEntry => ({
        id: `item:${r.id}`,
        at: r.createdAt.toISOString(),
        actor: r.changedBy,
        area: 'CATALOG',
        what: describeItemChange(r.kind, r.inventoryItem.name, r.summary),
        reason: r.reason,
      })),
      ...auditRows.map((r): AuditEntry => {
        const before = jsonOf(r.before);
        const after = jsonOf(r.after);
        const itemId = idOf(after, before);
        return {
          id: `supplier:${r.id}`,
          at: r.createdAt.toISOString(),
          actor: r.actor,
          area: 'SUPPLIERS',
          what: describeSupplierAudit(r.action, r.supplier.name, before, after, itemId ? (itemNames.get(itemId) ?? null) : null),
          reason: auditReason(after),
        };
      }),
      ...createdRows.flatMap((r): AuditEntry[] =>
        r.createdById
          ? [{ id: `created:${r.id}`, at: r.createdAt.toISOString(), actor: { id: r.createdById, name: userNames.get(r.createdById) ?? 'A colleague' }, area: 'SUPPLIERS', what: describeSupplierCreated(r.name, r.code), reason: null }]
          : [],
      ),
      ...restockRows.map((r): AuditEntry => {
        const place =
          r.location.type === 'CENTRAL_STORE'
            ? 'Central Store'
            : `${DEPARTMENT_LABEL[r.location.departmentTag ?? ''] ?? 'Department'} · ${r.location.site.name}`;
        return {
          id: `restock:${r.id}`,
          at: r.createdAt.toISOString(),
          actor: r.changedBy,
          area: 'RESTOCK_LEVELS',
          what: describeRestockChange(place, r.inventoryItem.name, r.inventoryItem.usageUnit, r.oldLevel?.toString() ?? null, r.newLevel?.toString() ?? null),
          reason: r.reason,
        };
      }),
      ...recipeRows.map((r): AuditEntry => ({
        id: `recipe:${r.id}`,
        at: r.createdAt.toISOString(),
        actor: r.createdBy,
        area: 'PREP',
        what: describeRecipeVersion(r.version, r.recipe.outputItem.name),
        reason: recipeReason(r.version, r.reason, r.reasonNote),
      })),
      ...runRecorded.map((r): AuditEntry => runEntry(r, 'RECORDED', r.createdAt, r.createdBy)),
      ...runCorrected.map((r): AuditEntry => runEntry(r, 'CORRECTED', r.createdAt, r.createdBy)),
      ...runCancelled.flatMap((r): AuditEntry[] => (r.closedAt && r.closedBy ? [runEntry(r, 'CANCELLED', r.closedAt, r.closedBy)] : [])),
      ...runReviewed.flatMap((r): AuditEntry[] => (r.reviewedAt && r.reviewedBy ? [runEntry(r, 'REVIEWED', r.reviewedAt, r.reviewedBy)] : [])),
      ...derivedEntries.flat(),
      ...purchasingRows.map((r): AuditEntry => ({
        id: `purchasing:${r.id}`,
        at: r.at.toISOString(),
        actor: { id: r.actor.id, name: r.actor.name, role: r.actor.role },
        area: r.area,
        what: r.what,
        reason: null,
        purchasing: {
          action: r.action,
          document: r.document,
          detail: r.detail,
          orderId: r.order.id,
          orderReference: r.order.reference,
          supplierName: r.supplier.name,
        },
      })),
    ];

    entries.sort((a, b) => (a.at === b.at ? (a.id < b.id ? 1 : -1) : a.at < b.at ? 1 : -1));
    const total = [...counts, ...derivedCounts].reduce((sum, n) => sum + n, 0);
    const start = (query.page - 1) * query.perPage;

    return {
      entries: entries.slice(start, start + query.perPage),
      actors: everyActorId.flatMap((id) => (userNames.has(id) ? [{ id, name: userNames.get(id) as string }] : [])).sort((a, b) => a.name.localeCompare(b.name)),
      branches,
      pagination: { total, page: query.page, perPage: query.perPage, totalPages: Math.max(1, Math.ceil(total / query.perPage)) },
    };
  },
};
