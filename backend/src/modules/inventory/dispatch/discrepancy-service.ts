import type { Request } from 'express';
import { Prisma } from '@prisma/client';
import { discrepancyRepository, type DiscrepancyWithDetail } from './discrepancy-repository';
import { dispatchRepository } from './dispatch-repository';
import { referenceCounterRepository } from '../_shared/reference-counter';
import { branchRepository } from '../../../repositories/branch-repository';
import { locationRepository } from '../../../repositories/location-repository';
import { authRepository } from '../../../repositories/auth-repository';
import { prisma } from '../../../config/database';
import { fcmService } from '../../../services/fcm-service';
import { comparePin } from '../../../utils/password';
import { ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from '../../../utils/errors';
import type { DiscrepancyDetail, DiscrepancyRow, ListDiscrepanciesQuery, ResolveDiscrepancyInput } from './dispatch.types';

type Actor = NonNullable<Request['user']>;

export interface DiscrepancyPage {
  rows: DiscrepancyRow[];
  pagination: { total: number; page: number; perPage: number; totalPages: number };
}

const toDecimalString = (value: Prisma.Decimal | null): string | null => (value === null ? null : value.toString());

const requireHubActor = async (actor: Actor): Promise<string> => {
  const hub = await branchRepository.findHub();
  if (!hub) throw new ValidationError('No hub organization is configured');
  if (actor.siteId !== hub.id) {
    throw new ForbiddenError('Only the hub organization may resolve discrepancies');
  }
  return hub.id;
};

const requireBranchOrg = (actor: Actor): string => {
  if (!actor.siteId) {
    throw new ValidationError('Branch context missing for this user');
  }
  return actor.siteId;
};

const serializeRow = (row: DiscrepancyWithDetail): DiscrepancyRow => ({
  id: row.id,
  referenceNumber: row.referenceNumber,
  status: row.status,
  outcome: row.outcome,
  gapQty: row.gapQty.toString(),
  createdAt: row.createdAt.toISOString(),
  resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
  resolvedByName: row.resolvedBy?.name ?? null,
  branchName: row.dispatchLine.dispatch.toSite.name,
  departmentTag: row.dispatchLine.dispatch.departmentTag as DiscrepancyRow['departmentTag'],
  dispatchSequenceLabel: row.dispatchLine.dispatch.sequenceLabel,
  itemName: row.dispatchLine.item.name,
  usageUnit: row.dispatchLine.item.usageUnit,
  dispatchedQty: row.dispatchLine.dispatchedQty.toString(),
  confirmedQty: toDecimalString(row.dispatchLine.confirmedQty),
});

const serializeDetail = (row: DiscrepancyWithDetail): DiscrepancyDetail => ({
  ...serializeRow(row),
  resolutionNote: row.resolutionNote,
  followUpDispatchId: row.followUpDispatchId,
  costAtDispatch: row.dispatchLine.costAtDispatch.toString(),
  confirmedByName: row.dispatchLine.dispatch.confirmedBy?.name ?? null,
  confirmedAt: row.dispatchLine.dispatch.confirmedAt ? row.dispatchLine.dispatch.confirmedAt.toISOString() : null,
});

export const discrepancyService = {
  /** Role-gated response shape, not two endpoints (session-b-plan.md decision #7). */
  listDiscrepancies: async (actor: Actor, query: ListDiscrepanciesQuery): Promise<DiscrepancyRow[]> => {
    const hub = await branchRepository.findHub();
    if (hub && actor.siteId === hub.id) {
      const branchOrgIds = await branchRepository.findActiveBranchIds();
      const rows = await discrepancyRepository.findAllForHub(branchOrgIds, query.limit);
      return rows.map(serializeRow);
    }
    const rows = await discrepancyRepository.findAllForBranch(requireBranchOrg(actor), query.limit);
    return rows.map(serializeRow);
  },

  /**
   * The shared table's list: the same role-gated scope as `listDiscrepancies`, narrowed by status and search and paged.
   * With no `page` it is the original "newest `limit`" (page 1 of that size), so a caller that only sends `limit` is unchanged.
   */
  listDiscrepancyPage: async (actor: Actor, query: ListDiscrepanciesQuery): Promise<DiscrepancyPage> => {
    const paged = query.page !== undefined;
    const perPage = paged ? (query.perPage ?? 50) : query.limit;
    const page = query.page ?? 1;
    const filter = { status: query.status, search: query.search, skip: (page - 1) * perPage, take: perPage };

    const hub = await branchRepository.findHub();
    const result =
      hub && actor.siteId === hub.id
        ? await discrepancyRepository.pageForHub(await branchRepository.findActiveBranchIds(), filter)
        : await discrepancyRepository.pageForBranch(requireBranchOrg(actor), filter);

    return {
      rows: result.rows.map(serializeRow),
      pagination: { total: result.total, page, perPage, totalPages: Math.max(1, Math.ceil(result.total / perPage)) },
    };
  },

  getDiscrepancy: async (actor: Actor, id: string): Promise<DiscrepancyDetail> => {
    const hub = await branchRepository.findHub();
    let row: DiscrepancyWithDetail | null;
    if (hub && actor.siteId === hub.id) {
      const branchOrgIds = await branchRepository.findActiveBranchIds();
      row = await discrepancyRepository.findByIdForHub(id, branchOrgIds);
    } else {
      row = await discrepancyRepository.findByIdForBranch(id, requireBranchOrg(actor));
    }
    if (!row) throw new NotFoundError('Discrepancy not found');
    return serializeDetail(row);
  },

  /**
   * Store Manager only, sign + PIN. Three outcomes write three different
   * things (session-b-plan.md decision #6):
   *  - FOUND_REDELIVERED: spawns a follow-up Dispatch, no ledger write here
   *    (the follow-up dispatch's own confirm is what eventually writes
   *    DISPATCH_IN for it).
   *  - TRANSIT_LOSS_WRITEOFF: ADJUSTMENT at the Central Store, negative.
   *  - MISCOUNT_CORRECTED: ADJUSTMENT at the branch department, signed by
   *    correction direction (gapQty is confirmed - dispatched, so a
   *    positive gap raises branch stock, a negative gap lowers it).
   */
  resolveDiscrepancy: async (actor: Actor, id: string, input: ResolveDiscrepancyInput): Promise<DiscrepancyDetail> => {
    const hubOrgId = await requireHubActor(actor);

    const actorWithPin = await authRepository.findUserByIdWithPassword(actor.id);
    if (!actorWithPin || !actorWithPin.pinHash) {
      throw new UnauthorizedError('No PIN is set for this account');
    }
    const pinValid = await comparePin(input.pin, actorWithPin.pinHash);
    if (!pinValid) throw new UnauthorizedError('Incorrect PIN');

    const branchOrgIds = await branchRepository.findActiveBranchIds();
    const discrepancy = await discrepancyRepository.findByIdForHub(id, branchOrgIds);
    if (!discrepancy) throw new NotFoundError('Discrepancy not found');
    if (discrepancy.status !== 'OPEN') {
      throw new ValidationError('This discrepancy has already been resolved');
    }

    const resolvedAt = new Date();
    let followUpDispatchId: string | undefined;

    await prisma.$transaction(async (tx) => {
      if (input.outcome === 'FOUND_REDELIVERED') {
        followUpDispatchId = await createFollowUpDispatch(hubOrgId, discrepancy, actor.id, resolvedAt, tx);
      } else if (input.outcome === 'TRANSIT_LOSS_WRITEOFF') {
        const centralStore = await locationRepository.findCentralStore();
        if (!centralStore) throw new ValidationError('No Central Store is configured');
        const reference = await referenceCounterRepository.nextReference(tx, hubOrgId, 'ADJ');
        await tx.inventoryTransaction.create({
          data: {
            siteId: hubOrgId,
            locationId: centralStore.id,
            inventoryItemId: discrepancy.dispatchLine.item.id,
            type: 'ADJUSTMENT',
            quantity: discrepancy.gapQty.lessThan(0) ? discrepancy.gapQty : discrepancy.gapQty.negated(),
            unitCost: discrepancy.dispatchLine.costAtDispatch,
            dispatchLineId: discrepancy.dispatchLine.id,
            reference,
            reason: 'Transit loss',
            userId: actor.id,
          },
        });
      } else if (input.outcome === 'MISCOUNT_CORRECTED') {
        const departmentLocation = await locationRepository.findBySiteTypeDepartment(
          discrepancy.dispatchLine.dispatch.toSiteId,
          'BRANCH_DEPARTMENT',
          discrepancy.dispatchLine.dispatch.departmentTag as never,
        );
        if (!departmentLocation) throw new ValidationError('No branch department location is configured for this dispatch');
        const reference = await referenceCounterRepository.nextReference(
          tx,
          discrepancy.dispatchLine.dispatch.toSiteId,
          'ADJ',
        );
        await tx.inventoryTransaction.create({
          data: {
            siteId: discrepancy.dispatchLine.dispatch.toSiteId,
            locationId: departmentLocation.id,
            inventoryItemId: discrepancy.dispatchLine.item.id,
            type: 'ADJUSTMENT',
            quantity: discrepancy.gapQty,
            unitCost: discrepancy.dispatchLine.costAtDispatch,
            dispatchLineId: discrepancy.dispatchLine.id,
            reference,
            reason: 'Receiving miscount',
            userId: actor.id,
          },
        });
      }

      const count = await discrepancyRepository.markResolved(id, tx, {
        outcome: input.outcome,
        resolutionNote: input.resolutionNote,
        resolvedById: actor.id,
        resolvedAt,
        followUpDispatchId,
      });
      if (count === 0) {
        throw new ValidationError('This discrepancy has already been resolved');
      }
      // Flow 11 step 4: the dispatch closes once its last open discrepancy is resolved.
      await discrepancyRepository.closeDispatchIfResolved(tx, discrepancy.dispatchLine.dispatch.id);
    });

      void notifyResolution(discrepancy, actor.id);

    return discrepancyService.getDiscrepancy(actor, id);
  },
};

/**
 * FOUND_REDELIVERED: a fresh Dispatch for the same department/branch/item,
 * covering the gap quantity, no requisitionLineId (not tied to the original
 * requisition line) and no requisition-approved-status check (this dispatch
 * isn't spawned from a fresh approval) — reuses dispatchRepository.create
 * directly rather than fulfilDepartment's full validation path.
 */
const createFollowUpDispatch = async (
  hubOrgId: string,
  discrepancy: DiscrepancyWithDetail,
  actorId: string,
  dispatchedAt: Date,
  tx: Prisma.TransactionClient,
): Promise<string> => {
  const dispatch = discrepancy.dispatchLine.dispatch;
  const todayCount = await dispatchRepository.countDispatchesTodayForBranch(dispatch.toSiteId, tx);
  const sequenceLabel = `Dispatch ${todayCount + 1} · ${dispatch.toSite.name} · ${dispatchedAt.toLocaleDateString('en-KE', { day: '2-digit', month: 'short', timeZone: 'Africa/Nairobi' })}`;

  const gapQty = discrepancy.gapQty.abs();
  const created = await dispatchRepository.create(
    {
      siteId: hubOrgId,
      toSiteId: dispatch.toSiteId,
      requisitionId: (await tx.dispatch.findUniqueOrThrow({ where: { id: dispatch.id }, select: { requisitionId: true } })).requisitionId,
      departmentTag: dispatch.departmentTag as never,
      sequenceLabel,
      dispatchedById: actorId,
      dispatchedAt,
      lines: [
        {
          requisitionLineId: null,
          inventoryItemId: discrepancy.dispatchLine.item.id,
          requestedQty: null,
          dispatchedQty: gapQty,
          costAtDispatch: discrepancy.dispatchLine.costAtDispatch,
          isSubstitute: false,
          substituteNote: `Follow-up for discrepancy ${discrepancy.referenceNumber}`,
        },
      ],
    },
    tx,
  );

  const fullDispatch = await tx.dispatch.findUniqueOrThrow({ where: { id: created.id }, include: { lines: true } });
  const centralStore = await tx.location.findFirst({ where: { type: 'CENTRAL_STORE' } });
  if (!centralStore) throw new ValidationError('No Central Store is configured');

  for (const line of fullDispatch.lines) {
    if (line.dispatchedQty.lessThanOrEqualTo(0)) continue;
    await tx.inventoryTransaction.create({
      data: {
        siteId: hubOrgId,
        locationId: centralStore.id,
        inventoryItemId: line.inventoryItemId,
        type: 'DISPATCH_OUT',
        quantity: line.dispatchedQty.negated(),
        unitCost: line.costAtDispatch,
        dispatchLineId: line.id,
        userId: actorId,
      },
    });
  }

  return created.id;
};

const notifyResolution = async (discrepancy: DiscrepancyWithDetail, actorId: string): Promise<void> => {
  const managers = await dispatchRepository.findBranchManagers(discrepancy.dispatchLine.dispatch.toSiteId);
  for (const manager of managers) {
    if (manager.id === actorId) continue;
    void fcmService.sendDiscrepancyResolvedPush(manager.id, { discrepancyId: discrepancy.id, referenceNumber: discrepancy.referenceNumber });
  }
};
