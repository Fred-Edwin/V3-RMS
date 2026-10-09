import type { Request } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';
import { branchRepository } from '../../../../repositories/branch-repository';
import { ConflictError, ForbiddenError, NotFoundError, UnauthorizedError, UnprocessableEntityError, ValidationError } from '../../../../utils/errors';
import { actorCan } from '../../_shared/central-store-access';
import { blindnessOf } from '../../_shared/blind-rule';
import { deliveriesRepository } from '../../deliveries/deliveries-repository';
import { postStockMovement } from '../../stock/ledger/ledger-door';
import { addDays, dayEndInstant, dayStartInstant, nairobiDay } from '../../stock/_shared/nairobi-time';
import {
  WASTE_REVERSAL_TEXT,
  type AllBranchesWasteQuery,
  type BranchWasteDetail,
  type BranchWasteEntry,
  type BranchWasteItems,
  type BranchWasteList,
  type BranchWasteListQuery,
  type LogBranchWasteInput,
  type MyBranchWasteList,
  type MyBranchWasteQuery,
  type ReverseBranchWasteInput,
} from '../_shared/waste-contract';
import { buildBranchWasteKpis } from './branch-kpis';
import { branchReverseCheck, branchUnitCost, type BranchReverseCheck } from './branch-rules';
import { branchWasteRepository as repo, type WasteFilter, type WasteScope } from './branch-repository';
import type { BranchWasteLogRow } from './branch-row';
import { bannerFor, branchWasteView } from './branch-view';
import type { DepartmentCaller, LogOutcome, ReverseMode } from './branch.types';

type Actor = NonNullable<Request['user']>;
type ListQuery = BranchWasteListQuery | AllBranchesWasteQuery;

/** "Most logged" looks back this many days (BW1 `often`, at most OFTEN_LIMIT items). */
const OFTEN_DAYS = 60;
const OFTEN_LIMIT = 6;

const isBatchRace = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002' && String(error.meta?.target ?? '').includes('idempotency_key');

const notYourDepartment = (message = 'You are not a member of a department of this branch.'): ForbiddenError => new ForbiddenError(message, 'NOT_YOUR_DEPARTMENT');

const noPermission = (): ForbiddenError => new ForbiddenError('You do not have permission to perform this action');

const hubIdOf = async (): Promise<string> => {
  const hub = await branchRepository.findHub();
  if (!hub) throw new ValidationError('No hub organization is configured');
  return hub.id;
};

// --- Who is calling -------------------------------------------------------------------------------------------------------------

/**
 * The department rule (`branch_waste.log` and `branch_waste.reverse_own` are held by no role in the table): an active head or member
 * of an ACTIVE department of a branch, found by `users.department_id`. A person who holds a desktop read (the Branch Manager, the hub
 * roles, the System Admin) is not a department, whatever their record says. A retired department's members cannot log.
 */
const departmentCaller = async (actor: Actor): Promise<DepartmentCaller> => {
  if (actorCan(actor, 'branch_waste.read') || actorCan(actor, 'branch_waste.read_any_branch')) throw notYourDepartment();
  const staff = await repo.findStaff(actor.id);
  if (!staff) throw new UnauthorizedError('Authentication required');
  const hubId = await hubIdOf();
  if (!staff.siteId || staff.siteId === hubId || !staff.departmentId || !staff.department || staff.department.siteId !== staff.siteId) throw notYourDepartment();
  if (staff.department.status !== 'ACTIVE') throw notYourDepartment('Your department has been retired, so it can no longer log or reverse waste.');
  return { kind: 'DEPARTMENT', userId: staff.id, branchId: staff.siteId, departmentId: staff.department.id, departmentName: staff.department.name };
};

/** The Branch Manager's branch (BW4): their own, which must be a branch and not the hub. */
const ownBranchOf = async (actor: Actor): Promise<string> => {
  if (!actor.siteId || actor.siteId === (await hubIdOf())) throw new ValidationError('Branch context missing for this user');
  return actor.siteId;
};

const activeBranches = async (): Promise<Array<{ id: string; name: string }>> => branchRepository.findActiveBranchOptions();

/**
 * How far BW6 and BW7 reach for this caller, and how they may reverse: every branch (Director, Accountant, Store Manager, System Admin),
 * their own branch (Branch Manager), or their own department (a head or member). `ANY` follows `branch_waste.reverse_any`.
 */
const reachOf = async (actor: Actor): Promise<{ scope: WasteScope; mode: ReverseMode }> => {
  const mode: ReverseMode = actorCan(actor, 'branch_waste.reverse_any') ? 'ANY' : 'NONE';
  if (actorCan(actor, 'branch_waste.read_any_branch')) return { scope: { siteIds: (await activeBranches()).map((b) => b.id) }, mode };
  if (actorCan(actor, 'branch_waste.read')) return { scope: { siteIds: [await ownBranchOf(actor)] }, mode };
  const caller = await departmentCaller(actor);
  return { scope: { siteIds: [caller.branchId], departmentId: caller.departmentId }, mode: 'OWN' };
};

// --- Windows --------------------------------------------------------------------------------------------------------------------

/** Nairobi days, both included; either may be given alone. With neither, the default window (today, or the last 7 days to today). */
const windowOf = (from: string | undefined, to: string | undefined, fallback: 'TODAY' | 'LAST_7', now: Date): WasteFilter => {
  if (from && to && from > to) throw new ValidationError('"from" must not be after "to"');
  if (!from && !to) {
    const today = nairobiDay(now);
    return { loggedFrom: dayStartInstant(fallback === 'TODAY' ? today : addDays(today, -6)), loggedBefore: dayEndInstant(today) };
  }
  return { ...(from ? { loggedFrom: dayStartInstant(from) } : {}), ...(to ? { loggedBefore: dayEndInstant(to) } : {}) };
};

const refuse = (check: Exclude<BranchReverseCheck, 'OK'>): never => {
  if (check === 'ALREADY_REVERSED') throw new ConflictError('This entry was already reversed', 'ALREADY_REVERSED');
  if (check === 'REVERSAL_WINDOW_PASSED') throw new ForbiddenError('Entries can only be reversed on the day they were logged. Ask the Branch Manager', 'REVERSAL_WINDOW_PASSED');
  throw new ForbiddenError('You can only reverse entries you logged yourself', 'NOT_YOUR_ENTRY');
};

/** The list of W6 and W8: filters, rows, the Department options, and (with `catalog.see_costs`) the four figures over the whole scope. */
const listFor = async (
  actor: Actor,
  scope: WasteScope,
  query: ListQuery,
  extra: { mode: ReverseMode; branches?: Array<{ id: string; name: string }>; figures: 'ONE_BRANCH' | 'MANY_BRANCHES' },
  now: Date,
): Promise<BranchWasteList> => {
  const filter: WasteFilter = {
    ...windowOf(query.from, query.to, 'TODAY', now),
    ...(query.search ? { search: query.search } : {}),
    ...(query.departmentId ? { departmentId: query.departmentId } : {}),
    ...(query.reason ? { reason: query.reason } : {}),
    ...(query.status ? { status: query.status } : {}),
  };
  const todayStart = dayStartInstant(nairobiDay(now));
  const last7Start = dayStartInstant(addDays(nairobiDay(now), -6));
  const showFigures = !blindnessOf(actor).itemCosts;

  const [{ rows, total }, departments, last7, reversed] = await Promise.all([
    repo.findPage(scope, filter, query.page, query.pageSize),
    repo.departmentsOf(scope.siteIds),
    showFigures ? repo.loggedSince(scope, last7Start) : [],
    showFigures ? repo.reversedSince(scope, last7Start) : [],
  ]);
  return {
    ...(showFigures ? { kpis: buildBranchWasteKpis({ last7, reversedLast7: reversed, todayStart, scope: extra.figures }) } : {}),
    rows: rows.map((log) => branchWasteView.entry(actor, log, extra.mode, now)),
    departments,
    ...(extra.branches ? { branches: extra.branches } : {}),
    page: { page: query.page, pageSize: query.pageSize, total },
  };
};

export const branchWasteService = {
  /** BW1: the picker. `often` is this caller's most logged items of the last 60 days; `items` are live items of their department matching the search. */
  listItems: async (actor: Actor, query: { search?: string; limit: number }, now: Date = new Date()): Promise<BranchWasteItems> => {
    const caller = await departmentCaller(actor);
    const hubId = await hubIdOf();
    const since = dayStartInstant(addDays(nairobiDay(now), -OFTEN_DAYS));
    const oftenIds = await repo.oftenItemIds(caller.branchId, caller.userId, caller.departmentId, since, OFTEN_LIMIT);
    const [often, items] = await Promise.all([
      repo.departmentItemsByIds(hubId, caller.departmentId, oftenIds).then((rows) => rows.slice(0, OFTEN_LIMIT)),
      repo.searchDepartmentItems(hubId, caller.departmentId, query.search, query.limit),
    ]);
    return branchWasteView.items({ often, items });
  },

  /**
   * BW2: log one or several items as one batch for the caller's own department (the department comes from the caller, never from the
   * request). One `WasteLog` and one WASTE ledger row per entry, all in one transaction, so the batch lands whole or not at all. A
   * repeated key returns the same entries (`replayed`); the unique index decides a race. Negative stock is allowed and flagged.
   */
  log: async (actor: Actor, input: LogBranchWasteInput, now: Date = new Date()): Promise<LogOutcome> => {
    const caller = await departmentCaller(actor);
    const hubId = await hubIdOf();
    const blind = blindnessOf(actor);

    const replay = async (): Promise<LogOutcome | null> => {
      const existing = await repo.findBatch(caller.branchId, caller.userId, input.idempotencyKey);
      if (!existing) return null;
      const first = existing.logs[0];
      const wentNegative = !blind.stockFigures && first ? await repo.anyNegative(caller.branchId, first.locationId, existing.logs.map((log) => log.inventoryItemId)) : false;
      return { result: branchWasteView.logResult(actor, existing.logs, { wentNegative, replayed: true }, 'OWN', now), replayed: true };
    };
    const already = await replay();
    if (already) return already;

    const found = new Map((await repo.findLoggableItems(hubId, caller.departmentId, input.entries.map((entry) => entry.inventoryItemId))).map((item) => [item.id, item]));
    const lines = input.entries.map((entry) => {
      const item = found.get(entry.inventoryItemId);
      if (!item) throw new NotFoundError('Inventory item not found');
      if (item.deletedAt) throw new ConflictError('This item is retired', 'ITEM_RETIRED');
      if (!item.inDepartment) throw new UnprocessableEntityError(`${item.name} is not an item of your department.`, 'ITEM_NOT_IN_DEPARTMENT');
      return { entry, item };
    });
    const note = input.note && input.note.length > 0 ? input.note : null;

    try {
      const { logs, wentNegative } = await prisma.$transaction(async (tx) => {
        // A department added after the five were provisioned has no stock location until something lands in it (as Deliveries does).
        const location = await deliveriesRepository.ensureDepartmentLocation(tx, caller.branchId, caller.departmentId);
        if (!location) throw new NotFoundError('Your department has no stock location');
        const batch = await repo.createBatch(tx, caller.branchId, caller.userId, input.idempotencyKey);
        const created: BranchWasteLogRow[] = [];
        for (const { entry, item } of lines) {
          const quantity = new Prisma.Decimal(entry.quantity);
          const unitCost = branchUnitCost(item.currentCost, await repo.latestDispatchInCost(caller.branchId, location.id, item.id, tx));
          const log = await repo.createLog(tx, {
            siteId: caller.branchId,
            locationId: location.id,
            batchId: batch.id,
            inventoryItemId: item.id,
            quantity,
            reason: entry.reason,
            note,
            unitCost,
            loggedById: caller.userId,
          });
          // The door stores WASTE negative, so the quantity goes in as entered and on-hand stays a plain sum.
          await postStockMovement(tx, {
            type: 'WASTE',
            locationId: location.id,
            inventoryItemId: item.id,
            quantity,
            unitCost,
            reason: entry.reason,
            userId: caller.userId,
            links: { wasteLogId: log.id },
          });
          created.push(log);
        }
        const negative = blind.stockFigures ? false : await repo.anyNegative(caller.branchId, location.id, created.map((log) => log.inventoryItemId), tx);
        return { logs: created, wentNegative: negative };
      });
      return { result: branchWasteView.logResult(actor, logs, { wentNegative, replayed: false }, 'OWN', now), replayed: false };
    } catch (error) {
      if (isBatchRace(error)) {
        const raced = await replay();
        if (raced) return raced;
      }
      throw error;
    }
  },

  /**
   * BW3 (step 55): the caller's whole department, today and earlier, newest first. No money and no stock. Default window: the last 7 Nairobi
   * days to today. `can.reverse` is true on the caller's own entries logged today; the banner reminds them of the batch they just logged.
   */
  listMine: async (actor: Actor, query: MyBranchWasteQuery, now: Date = new Date()): Promise<MyBranchWasteList> => {
    const caller = await departmentCaller(actor);
    const scope: WasteScope = { siteIds: [caller.branchId], departmentId: caller.departmentId };
    const filter = windowOf(query.from, query.to, 'LAST_7', now);
    const [{ rows, total }, batch] = await Promise.all([
      repo.findPage(scope, filter, query.page, query.pageSize),
      repo.latestBatchToday(caller.branchId, caller.userId, caller.departmentId, dayStartInstant(nairobiDay(now))),
    ]);
    return {
      department: { id: caller.departmentId, name: caller.departmentName },
      rows: rows.map((log) => branchWasteView.entry(actor, log, 'OWN', now)),
      bannerText: batch ? bannerFor(batch) : null,
      page: { page: query.page, pageSize: query.pageSize, total },
    };
  },

  /** BW4 (W6): the Branch Manager's own branch, with values and the four figures; the System Admin reads the branch they stand in. Reverse on every standing entry. */
  listBranch: async (actor: Actor, query: BranchWasteListQuery, now: Date = new Date()): Promise<BranchWasteList> => {
    if (!actorCan(actor, 'branch_waste.read')) throw noPermission();
    const branchId = await ownBranchOf(actor);
    const mode: ReverseMode = actorCan(actor, 'branch_waste.reverse_any') ? 'ANY' : 'NONE';
    return listFor(actor, { siteIds: [branchId] }, query, { mode, figures: 'ONE_BRANCH' }, now);
  },

  /** BW5 (W8): every branch's waste (or the one picked), read only, with the branch picker. `can.reverse` is false on every row. */
  listBranches: async (actor: Actor, query: AllBranchesWasteQuery, now: Date = new Date()): Promise<BranchWasteList> => {
    if (!actorCan(actor, 'branch_waste.read_any_branch')) throw noPermission();
    const branches = await activeBranches();
    if (query.branchId && !branches.some((b) => b.id === query.branchId)) throw new NotFoundError('Branch not found');
    const siteIds = query.branchId ? [query.branchId] : branches.map((b) => b.id);
    return listFor(actor, { siteIds }, query, { mode: 'NONE', branches, figures: query.branchId ? 'ONE_BRANCH' : 'MANY_BRANCHES' }, now);
  },

  /** BW6: one entry, if it sits inside the caller's reach (else 404). Those who may see stock also get the ledger rows it wrote. */
  detail: async (actor: Actor, id: string, now: Date = new Date()): Promise<BranchWasteDetail> => {
    const { scope, mode } = await reachOf(actor);
    const log = await repo.findLog(id, scope);
    if (!log) throw new NotFoundError('Waste entry not found');
    const entry = branchWasteView.entry(actor, log, mode, now);
    if (blindnessOf(actor).stockFigures) return { entry };
    const rows = await repo.ledgerRowsOf(log.siteId, log.id);
    return { entry, ledger: rows.map((row) => ({ kind: row.reversesTransactionId ? ('REVERSAL' as const) : ('LOGGED' as const), at: row.createdAt.toISOString(), quantity: row.quantity.toString() })) };
  },

  /**
   * BW7: reverse one entry. No PIN. The original log and its WASTE ledger row stay; one reversing row of the same type goes through the
   * door with the same quantity (the door flips the sign, so the stock goes back up) and the log is stamped, all in one transaction with
   * the entry locked, so a repeat or a race is `ALREADY_REVERSED`. `branch_waste.reverse_any` reverses any entry in reach; a head or member
   * reverses their own entry on the day they logged it.
   */
  reverse: async (actor: Actor, id: string, input: ReverseBranchWasteInput, now: Date = new Date()): Promise<BranchWasteEntry> => {
    const { scope, mode } = await reachOf(actor);
    if (mode === 'NONE') throw noPermission();

    const seen = await repo.findLog(id, scope);
    if (!seen) throw new NotFoundError('Waste entry not found');
    const early = branchReverseCheck(mode, actor.id, seen, now);
    if (early !== 'OK') refuse(early);

    const updated = await prisma.$transaction(async (tx) => {
      await repo.lockLog(tx, seen.siteId, id);
      const log = await repo.findLog(id, scope, tx);
      if (!log) throw new NotFoundError('Waste entry not found');
      const check = branchReverseCheck(mode, actor.id, log, now);
      if (check !== 'OK') refuse(check);

      const original = await repo.findWasteLedgerRow(tx, log.siteId, log.id);
      if (!original) throw new NotFoundError('This entry has no stock movement to reverse');

      await postStockMovement(tx, {
        type: 'WASTE',
        locationId: original.locationId,
        inventoryItemId: original.inventoryItemId,
        quantity: original.quantity.abs(),
        unitCost: original.unitCost,
        reason: `Reversed: ${WASTE_REVERSAL_TEXT[input.reason]}`,
        userId: actor.id,
        links: { wasteLogId: log.id },
        reversesTransactionId: original.id,
      });

      return repo.stampReversal(tx, log.siteId, log.id, {
        reversedAt: now,
        reversedById: actor.id,
        reversalReason: input.reason,
        reversalNote: input.note && input.note.length > 0 ? input.note : null,
      });
    });

    return branchWasteView.entry(actor, updated, mode, now);
  },
};
