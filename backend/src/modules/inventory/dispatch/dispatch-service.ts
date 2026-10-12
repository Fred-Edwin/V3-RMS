import { randomUUID } from 'node:crypto';
import type { Request } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../../config/database';
import { branchRepository } from '../../../repositories/branch-repository';
import { locationRepository } from '../../../repositories/location-repository';
import { ForbiddenError, NotFoundError, ValidationError } from '../../../utils/errors';
import { actorCan } from '../_shared/central-store-access';
import { referenceCounterRepository } from '../_shared/reference-counter';
import { countPin } from '../counting/_shared/count-pin';
import { dayAsDate, nairobiDayEnd } from '../counting/_shared/count-time';
import { roleLabelOf, toPerson } from '../counting/_shared/count-people';
import { CYCLE_TEXT } from '../requisitions/_shared/requisitions-contract';
import { requisitionsRepository } from '../requisitions/requisitions-repository';
import { cycleOf } from '../requisitions/requisitions-view';
import { postStockMovement } from '../stock/ledger/ledger-door';
import type {
  CancelDispatchInput,
  CancelDispatchResult,
  DispatchFile,
  DispatchMine,
  DispatchMineQuery,
  PackDepartment,
  PrintDispatch,
  Queue,
  Review,
  SavePackLinesInput,
  SignDispatchInput,
  SignDispatchResult,
} from './_shared/dispatch-contract';
import { isBranchSide, loadCaller, readScope, type Caller } from './dispatch-caller';
import { dispatchError } from './dispatch-errors';
import { dispatchNotices } from './dispatch-notify';
import {
  dispatchRepository as repo,
  type NewDispatchLine,
  type PackDispatch,
  type PackRequisition,
  type PackSection,
} from './dispatch-repository';
import { doneResultOf, effectiveQty, isShort, isUnsigned, mineTabOf, packStateOf, stageOf, statusAfterSave } from './dispatch-state';
import { categoryPathOf, fileWire, gapHeldOf, packLineWire, printWire, type FileViewer } from './dispatch-view';

type Actor = NonNullable<Request['user']>;
type Tx = Prisma.TransactionClient;

const pad4 = (n: number): string => String(n).padStart(4, '0');
const ZERO = new Prisma.Decimal(0);
const minOf = (a: Prisma.Decimal, b: Prisma.Decimal): Prisma.Decimal => (a.lessThan(b) ? a : b);
const isUniqueViolation = (error: unknown): boolean => error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

// --- Reading the requisition -------------------------------------------------------------------------------------------------

/** The lines of a section that have something to pack: a positive approved quantity. */
const desiredLinesOf = (section: PackSection): Array<NewDispatchLine & { itemCost: Prisma.Decimal; additionId: string | null }> =>
  section.lines.flatMap((l) => {
    const requestedQty = effectiveQty(l);
    return requestedQty.greaterThan(0) ? [{ requisitionLineId: l.id, inventoryItemId: l.inventoryItemId, requestedQty, sentQty: requestedQty, itemCost: l.item.currentCost, additionId: l.additionId }] : [];
  });

const loadRequisition = async (requisitionId: string, db: Tx | typeof prisma = prisma): Promise<PackRequisition> => {
  const rec = await repo.findRequisitionForPack(requisitionId, db);
  if (rec) return rec;
  const basics = await repo.findRequisitionStatus(requisitionId, db);
  if (!basics) throw new NotFoundError('Requisition not found');
  throw dispatchError('REQUISITION_NOT_APPROVED', 'This requisition is not approved (or was cancelled), so there is nothing to pack.');
};

/** The sections that count: Sent, with at least one line to pack, in the order of the departments. */
const packSectionsOf = (rec: PackRequisition): PackSection[] => rec.sections.filter((s) => s.departmentId !== null && desiredLinesOf(s).length > 0);

const storeLocation = async (): Promise<{ id: string }> => {
  const store = await locationRepository.findCentralStore();
  if (!store) throw new ValidationError('No Central Store is configured');
  return store;
};

/**
 * Makes sure a department has a live, unsigned dispatch that matches the requisition now: the lines are created on the first look,
 * and later look-ups follow what changed before the sign (a quantity the manager edited, an approved addition, a removed line).
 * A pre-filled sent quantity is the requested one, or what is in the store when that is less. Returns a signed dispatch untouched.
 */
const ensureDispatch = async (tx: Tx, c: Pick<Caller, 'hubId'>, rec: PackRequisition, section: PackSection, onHand: Map<string, Prisma.Decimal>): Promise<PackDispatch> => {
  if (!section.departmentId) throw new NotFoundError('Department not found');
  const desired = desiredLinesOf(section);
  const prefill = (l: { inventoryItemId: string; requestedQty: Prisma.Decimal }): Prisma.Decimal => minOf(l.requestedQty, (onHand.get(l.inventoryItemId) ?? ZERO).isNegative() ? ZERO : (onHand.get(l.inventoryItemId) ?? ZERO));
  // Two first looks racing take turns here; the second reads the first one's row (the partial unique index stays as the backstop).
  await repo.lockDepartment(tx, rec.id, section.departmentId);
  const existing = await repo.findLiveDispatch(c.hubId, rec.id, section.departmentId, tx);
  if (!existing) {
    return repo.createDispatch(tx, {
      hubId: c.hubId,
      toSiteId: rec.siteId,
      requisitionId: rec.id,
      departmentId: section.departmentId,
      lines: desired.map((l) => ({ requisitionLineId: l.requisitionLineId, inventoryItemId: l.inventoryItemId, requestedQty: l.requestedQty, sentQty: prefill(l) })),
    });
  }
  if (!isUnsigned(existing.status)) return existing;
  const byRequisitionLine = new Map(existing.lines.flatMap((l) => (l.requisitionLineId ? [[l.requisitionLineId, l] as const] : [])));
  const wanted = new Set(desired.map((l) => l.requisitionLineId));
  let changed = false;
  const toAdd: NewDispatchLine[] = [];
  for (const l of desired) {
    const line = byRequisitionLine.get(l.requisitionLineId);
    if (!line) {
      toAdd.push({ requisitionLineId: l.requisitionLineId, inventoryItemId: l.inventoryItemId, requestedQty: l.requestedQty, sentQty: prefill(l) });
    } else if (!line.requestedQty.equals(l.requestedQty)) {
      // The manager changed the quantity before the sign: an untouched pre-fill follows it, a sent figure above it is cut to it.
      const follows = !line.packedTick && line.sentQty.equals(minOf(line.requestedQty, onHand.get(line.inventoryItemId) ?? ZERO));
      await repo.updateLineQuantities(tx, line.id, { requestedQty: l.requestedQty, sentQty: follows ? prefill(l) : minOf(line.sentQty, l.requestedQty) });
      changed = true;
    }
  }
  const stale = existing.lines.filter((l) => !l.requisitionLineId || !wanted.has(l.requisitionLineId)).map((l) => l.id);
  await repo.deleteLines(tx, stale);
  await repo.addLines(tx, existing.id, toAdd);
  if (!changed && stale.length === 0 && toAdd.length === 0) return existing;
  return (await repo.findLiveDispatch(c.hubId, rec.id, section.departmentId, tx)) ?? existing;
};

interface DepartmentState {
  section: PackSection;
  departmentId: string;
  dispatch: PackDispatch | null;
  /** The store has signed this department (it is no longer to pack). */
  signed: boolean;
  lineCount: number;
}

/** Every department that counts, with its live dispatch, in department order. */
const departmentStatesOf = (rec: PackRequisition, dispatches: PackDispatch[]): DepartmentState[] =>
  packSectionsOf(rec).flatMap((section) => {
    if (!section.departmentId) return [];
    const dispatch = dispatches.find((d) => d.departmentId === section.departmentId) ?? null;
    return [{ section, departmentId: section.departmentId, dispatch, signed: dispatch !== null && !isUnsigned(dispatch.status), lineCount: desiredLinesOf(section).length }];
  });

const tickedOf = (d: DepartmentState): number => (d.dispatch ? d.dispatch.lines.filter((l) => l.packedTick).length : 0);
const allTickedOf = (d: DepartmentState): boolean => d.dispatch !== null && d.dispatch.lines.length > 0 && d.dispatch.lines.every((l) => l.packedTick);

const parentNamesOf = async (itemCategories: Array<{ parentCategoryId: string | null } | null>): Promise<Map<string, string>> =>
  repo.findCategoryNames([...new Set(itemCategories.flatMap((c) => (c?.parentCategoryId ? [c.parentCategoryId] : [])))]);

// --- P2 and P3: the pack views ---------------------------------------------------------------------------------------------------

const packDepartmentView = async (c: Caller, rec: PackRequisition, departmentId: string): Promise<PackDepartment> => {
  const states = departmentStatesOf(rec, await repo.listLiveDispatches(c.hubId, rec.id));
  const current = states.find((s) => s.departmentId === departmentId);
  if (!current || !current.dispatch) throw new NotFoundError('Department not found');
  if (current.signed) throw dispatchError('ALREADY_SIGNED', 'This department has already been signed and sent.');
  const toPack = states.filter((s) => !s.signed);
  const itemIds = [...new Set(current.dispatch.lines.map((l) => l.inventoryItemId))];
  const store = await storeLocation();
  const [onHand, parentNames] = await Promise.all([repo.onHand(c.hubId, store.id, itemIds), parentNamesOf(current.dispatch.lines.map((l) => l.item.category))]);
  const additionOf = new Map(current.section.lines.map((l) => [l.id, l.additionId !== null]));
  const lines = current.dispatch.lines.map((l) => packLineWire(l, onHand.get(l.inventoryItemId) ?? ZERO, parentNames, l.requisitionLineId ? (additionOf.get(l.requisitionLineId) ?? false) : false));
  const index = toPack.findIndex((s) => s.departmentId === departmentId);
  const others = toPack.filter((s) => s.departmentId !== departmentId && !allTickedOf(s));
  const next = others.find((s) => toPack.indexOf(s) > index) ?? others[0] ?? null;
  return {
    requisitionId: rec.id,
    reference: rec.reference,
    branch: { id: rec.site.id, name: rec.site.name, code: rec.site.code },
    department: { id: current.section.department?.id ?? departmentId, name: current.section.department?.name ?? '' },
    position: { index: index + 1, total: toPack.length },
    lineCount: current.dispatch.lines.length,
    packedCount: tickedOf(current),
    state: packStateOf(current.dispatch.lines),
    lines,
    nextDepartmentId: next ? next.departmentId : null,
    allPacked: toPack.every(allTickedOf),
    canReview: toPack.some(allTickedOf) || states.some((s) => s.signed && toPack.length === 0),
  };
};

// --- The service ------------------------------------------------------------------------------------------------------------------

export const dispatchService = {
  /** P1 GET /queue: one card per approved requisition that still has a department to pack, oldest approval first. No money. */
  queue: async (actor: Actor): Promise<Queue> => {
    await loadCaller(actor);
    const rows = await repo.findApprovedForQueue();
    const cards = rows.flatMap((r) => {
      const departments = r.sections
        .slice()
        .sort((a, b) => (a.department?.position ?? 0) - (b.department?.position ?? 0))
        .flatMap((s) => {
          const lineCount = s.lines.filter((l) => effectiveQty(l).greaterThan(0)).length;
          if (!s.departmentId || !s.department || lineCount === 0) return [];
          const dispatch = r.dispatches.find((d) => d.departmentId === s.departmentId);
          if (dispatch && !isUnsigned(dispatch.status)) return [];
          const packedCount = dispatch ? Math.min(dispatch.lines.filter((l) => l.packedTick).length, lineCount) : 0;
          const state = packedCount === 0 ? ('TO_PACK' as const) : packedCount === lineCount ? ('PACKED' as const) : ('PACKING' as const);
          return [{ departmentId: s.departmentId, departmentName: s.department.name, lineCount, packedCount, state }];
        });
      if (departments.length === 0) return [];
      const cycle = cycleOf(r.type);
      return [
        {
          requisitionId: r.id,
          reference: r.reference,
          branch: { id: r.site.id, name: r.site.name, code: r.site.code },
          cycle,
          cycleLabel: CYCLE_TEXT[cycle],
          approvedAt: (r.approvedAt ?? r.openedAt).toISOString(),
          lineCount: departments.reduce((sum, d) => sum + d.lineCount, 0),
          departments,
        },
      ];
    });
    return { cards, branchesToPack: new Set(cards.map((card) => card.branch.id)).size };
  },

  /** P2 GET /pack/:requisitionId/departments/:departmentId: the lines of a department with what is in the store. No money. */
  getDepartment: async (actor: Actor, requisitionId: string, departmentId: string): Promise<PackDepartment> => {
    const c = await loadCaller(actor);
    const rec = await loadRequisition(requisitionId);
    const section = packSectionsOf(rec).find((s) => s.departmentId === departmentId);
    if (!section) throw new NotFoundError('Department not found');
    const store = await storeLocation();
    const onHand = await repo.onHand(c.hubId, store.id, [...new Set(desiredLinesOf(section).map((l) => l.inventoryItemId))]);
    await prisma.$transaction((tx) => ensureDispatch(tx, c, rec, section, onHand));
    return packDepartmentView(c, rec, departmentId);
  },

  /**
   * P3 PUT /pack/:requisitionId/departments/:departmentId/lines: save ticks and sent quantities (last write wins; a line left out of
   * the body is left as it is). More than requested is OVER_REQUESTED; a ticked line that sends more than the store holds is
   * STOCK_CHANGED (the affected lines are in `details.lineIds`); a signed department is ALREADY_SIGNED. Nothing is saved on an error.
   */
  saveLines: async (actor: Actor, requisitionId: string, departmentId: string, input: SavePackLinesInput): Promise<PackDepartment> => {
    const c = await loadCaller(actor);
    const rec = await loadRequisition(requisitionId);
    const section = packSectionsOf(rec).find((s) => s.departmentId === departmentId);
    if (!section) throw new NotFoundError('Department not found');
    const store = await storeLocation();
    const onHand = await repo.onHand(c.hubId, store.id, [...new Set(desiredLinesOf(section).map((l) => l.inventoryItemId))]);
    const dispatchId = await prisma.$transaction(async (tx) => {
      const dispatch = await ensureDispatch(tx, c, rec, section, onHand);
      if (!isUnsigned(dispatch.status)) throw dispatchError('ALREADY_SIGNED', 'This department has already been signed and sent.');
      const byRequisitionLine = new Map(dispatch.lines.flatMap((l) => (l.requisitionLineId ? [[l.requisitionLineId, l] as const] : [])));
      const unknown = input.lines.filter((l) => !byRequisitionLine.has(l.lineId));
      if (unknown.length > 0) throw new NotFoundError('Line not found', 'NOT_FOUND', { lineIds: unknown.map((l) => l.lineId) });
      const over = input.lines.filter((l) => new Prisma.Decimal(l.sentQty).greaterThan(byRequisitionLine.get(l.lineId)?.requestedQty ?? ZERO));
      if (over.length > 0) throw dispatchError('OVER_REQUESTED', 'A line cannot send more than was asked for.', { lineIds: over.map((l) => l.lineId) });
      const lack = input.lines.filter((l) => l.packedTick && new Prisma.Decimal(l.sentQty).greaterThan(onHand.get(byRequisitionLine.get(l.lineId)?.inventoryItemId ?? '') ?? ZERO));
      if (lack.length > 0) throw dispatchError('STOCK_CHANGED', 'There is not enough in the store for some lines.', { lineIds: lack.map((l) => l.lineId) });
      for (const l of input.lines) {
        const line = byRequisitionLine.get(l.lineId);
        if (line) await repo.savePackLine(tx, line.id, { sentQty: new Prisma.Decimal(l.sentQty), packedTick: l.packedTick });
      }
      const after = await repo.findLiveDispatch(c.hubId, rec.id, departmentId, tx);
      await repo.setStatus(tx, dispatch.id, statusAfterSave(after?.lines ?? dispatch.lines));
      return dispatch.id;
    });
    void dispatchNotices.packed({ hubId: c.hubId, branchId: rec.siteId, id: dispatchId });
    return packDepartmentView(c, rec, departmentId);
  },

  /** P4 GET /pack/:requisitionId/review: every department still to pack, short counts and all lines, the carriers and the signer. */
  review: async (actor: Actor, requisitionId: string): Promise<Review> => {
    const c = await loadCaller(actor);
    const rec = await loadRequisition(requisitionId);
    const store = await storeLocation();
    const sections = packSectionsOf(rec);
    const onHand = await repo.onHand(c.hubId, store.id, [...new Set(sections.flatMap((s) => desiredLinesOf(s).map((l) => l.inventoryItemId)))]);
    await prisma.$transaction(async (tx) => {
      for (const section of sections) await ensureDispatch(tx, c, rec, section, onHand);
    });
    const states = departmentStatesOf(rec, await repo.listLiveDispatches(c.hubId, rec.id)).filter((s) => !s.signed);
    const person = toPerson({ id: c.staff.id, name: c.staff.name, role: c.staff.role });
    const carriers = await repo.listActiveCarriers(c.hubId);
    const readyDepartments = states.filter(allTickedOf);
    const departments = states.map((s) => {
      const lines = s.dispatch?.lines ?? [];
      const short = lines.filter((l) => isShort(l.sentQty, l.requestedQty));
      return {
        departmentId: s.departmentId,
        departmentName: s.section.department?.name ?? '',
        lineCount: lines.length,
        allTicked: allTickedOf(s),
        canLeaveOut: allTickedOf(s),
        shortCount: short.length,
        shortLines: short.map((l) => ({ itemName: l.item.name, unit: l.item.usageUnit, requestedQty: l.requestedQty.toString(), sentQty: l.sentQty.toString() })),
      };
    });
    const shipping = readyDepartments.flatMap((s) => s.dispatch?.lines ?? []);
    const cycle = cycleOf(rec.type);
    return {
      requisitionId: rec.id,
      reference: rec.reference,
      branch: { id: rec.site.id, name: rec.site.name, code: rec.site.code },
      cycleLabel: CYCLE_TEXT[cycle],
      lineCount: shipping.length,
      shortCount: shipping.filter((l) => isShort(l.sentQty, l.requestedQty)).length,
      departments,
      lines: states.flatMap((s) =>
        (s.dispatch?.lines ?? []).map((l) => ({
          departmentId: s.departmentId,
          lineId: l.requisitionLineId ?? l.id,
          itemName: l.item.name,
          unit: l.item.usageUnit,
          requestedQty: l.requestedQty.toString(),
          sentQty: l.sentQty.toString(),
          short: isShort(l.sentQty, l.requestedQty),
        })),
      ),
      packedBy: person,
      signedBy: person,
      carriers: carriers.map((k) => ({ id: k.id, name: k.name, kind: k.kind })),
      canSign: readyDepartments.length > 0,
    };
  },

  /**
   * P5 POST /pack/:requisitionId/sign: the final signature, ONE transaction. Departments left out (and any not ready) stay in To pack.
   * Numbers each shipped department `DSP-<branch code>-nnnn`, freezes the cost, writes `DISPATCH_OUT` through the ledger door,
   * and (after commit) pushes the department. Errors: NOT_ALL_PACKED, INVALID_PIN, CARRIER_INACTIVE, NOTHING_TO_SEND, STOCK_CHANGED.
   * A repeated idempotencyKey returns the first result (`replayed`).
   */
  sign: async (actor: Actor, requisitionId: string, input: SignDispatchInput, now: Date = new Date()): Promise<SignDispatchResult> => {
    const c = await loadCaller(actor);
    const replay = await dispatchService.replaySign(c, requisitionId, input.idempotencyKey);
    if (replay) return replay;

    const rec = await loadRequisition(requisitionId);
    const holder = await countPin.verifyOwn(actor, input.pin);
    const carrier = await repo.findCarrier(c.hubId, input.carrierId);
    if (!carrier) throw new NotFoundError('Carrier not found');
    if (!carrier.active) throw dispatchError('CARRIER_INACTIVE', 'This carrier has been retired. Pick another.');
    const branch = await repo.findBranch(rec.siteId);
    if (!branch?.code) throw new ValidationError('This branch has no code yet, so a dispatch cannot be numbered');
    const store = await storeLocation();
    const sections = packSectionsOf(rec);
    const leaveOut = new Set(input.leaveOut ?? []);
    const roleLabel = roleLabelOf(holder.role);

    let batch: { id: string; reference: string; departmentId: string; departmentName: string }[];
    let sendBatchId: string;
    try {
      const out = await prisma.$transaction(async (tx) => {
        await repo.lockHub(tx, c.hubId);
        const fresh = await loadRequisition(requisitionId, tx);
        const freshSections = packSectionsOf(fresh);
        const onHandNow = await repo.onHand(c.hubId, store.id, [...new Set(freshSections.flatMap((s) => desiredLinesOf(s).map((l) => l.inventoryItemId)))], tx);
        for (const section of freshSections) await ensureDispatch(tx, c, fresh, section, onHandNow);
        const states = departmentStatesOf(fresh, await repo.listLiveDispatches(c.hubId, fresh.id, tx));
        const toPack = states.filter((s) => !s.signed);
        const shipping = toPack.filter((s) => !leaveOut.has(s.departmentId));
        if (shipping.length === 0) throw dispatchError('NOTHING_TO_SEND', 'Nothing is ready to send. Tick every line of at least one department.');
        const notPacked = shipping.filter((s) => !allTickedOf(s));
        if (notPacked.length > 0) throw dispatchError('NOT_ALL_PACKED', 'Some lines are not ticked yet.', { departmentIds: notPacked.map((s) => s.departmentId) });

        // Stock check, per item across every department that ships now (two departments may ask for the same item).
        const want = new Map<string, Prisma.Decimal>();
        for (const s of shipping) for (const l of s.dispatch?.lines ?? []) want.set(l.inventoryItemId, (want.get(l.inventoryItemId) ?? ZERO).add(l.sentQty));
        const lacking = new Set([...want].filter(([itemId, qty]) => qty.greaterThan(onHandNow.get(itemId) ?? ZERO)).map(([itemId]) => itemId));
        if (lacking.size > 0) {
          const lineIds = shipping.flatMap((s) => (s.dispatch?.lines ?? []).filter((l) => lacking.has(l.inventoryItemId)).map((l) => l.requisitionLineId ?? l.id));
          throw dispatchError('STOCK_CHANGED', 'The stock in the store changed. Check the flagged lines.', { lineIds });
        }

        const batchId = randomUUID();
        const signed: { id: string; reference: string; departmentId: string; departmentName: string }[] = [];
        for (const s of shipping) {
          const dispatch = s.dispatch;
          if (!dispatch) continue;
          const reference = `DSP-${branch.code}-${pad4(await referenceCounterRepository.nextNumber(tx, rec.siteId, 'DSP'))}`;
          await repo.signDispatch(tx, dispatch.id, { reference, packedById: actor.id, signedById: actor.id, signedAt: now, carrierId: carrier.id, sendBatchId: batchId });
          for (const line of dispatch.lines) {
            await repo.freezeLineCost(tx, line.id, line.item.currentCost);
            if (line.sentQty.greaterThan(0)) {
              await postStockMovement(tx, {
                type: 'DISPATCH_OUT',
                locationId: store.id,
                inventoryItemId: line.inventoryItemId,
                quantity: line.sentQty,
                unitCost: line.item.currentCost,
                userId: actor.id,
                links: { dispatchLineId: line.id },
              });
            }
          }
          await repo.createEvent(tx, { dispatchId: dispatch.id, type: 'SIGNED_AND_SENT', actorId: actor.id, actorRoleLabel: roleLabel, idempotencyKey: input.idempotencyKey, at: now });
          signed.push({ id: dispatch.id, reference, departmentId: s.departmentId, departmentName: s.section.department?.name ?? '' });
        }
        return { signed, batchId };
      });
      batch = out.signed;
      sendBatchId = out.batchId;
    } catch (error) {
      // A repeat of the same key racing the first one: the unique event decides, the loser returns the winner's result.
      if (isUniqueViolation(error)) {
        const again = await dispatchService.replaySign(c, requisitionId, input.idempotencyKey);
        if (again) return again;
      }
      throw error;
    }

    void dispatchNotices.signed({ hubId: c.hubId, branchId: rec.siteId, requisitionReference: rec.reference, dispatches: batch });
    const result = await dispatchService.signResultOf(c, requisitionId, sendBatchId, false);
    if (!result) throw new NotFoundError('Dispatch not found');
    void sections;
    return result;
  },

  /** The first result of a sign with this key, or null when the key was not used. */
  replaySign: async (c: Caller, requisitionId: string, idempotencyKey: string): Promise<SignDispatchResult | null> => {
    const event = await repo.findEventByKey(c.hubId, requisitionId, c.actor.id, idempotencyKey, 'SIGNED_AND_SENT');
    if (!event?.dispatch.sendBatchId) return null;
    return dispatchService.signResultOf(c, requisitionId, event.dispatch.sendBatchId, true);
  },

  signResultOf: async (c: Caller, requisitionId: string, sendBatchId: string, replayed: boolean): Promise<SignDispatchResult | null> => {
    const [rows, live, basics] = await Promise.all([repo.findBatch(c.hubId, sendBatchId), repo.listLiveDispatches(c.hubId, requisitionId), repo.findRequisitionBasics(requisitionId)]);
    const first = rows[0];
    if (!first?.signedAt || !first.carrier || !first.signedBy || !first.packedBy || !basics) return null;
    const leftOut = live.filter((d) => isUnsigned(d.status)).map((d) => d.departmentId);
    const departmentNames = await repo.findDepartmentNames(leftOut);
    const dispatches = rows.map((r) => ({
      id: r.id,
      reference: r.reference ?? '',
      departmentId: r.departmentId,
      departmentName: r.department.name,
      lineCount: r.lines.length,
      shortCount: r.lines.filter((l) => isShort(l.sentQty, l.requestedQty)).length,
    }));
    return {
      requisitionId,
      reference: basics.reference,
      branch: { id: basics.site.id, name: basics.site.name, code: basics.site.code },
      signedAt: first.signedAt.toISOString(),
      packedBy: toPerson(first.packedBy),
      signedBy: toPerson(first.signedBy),
      carrier: { id: first.carrier.id, name: first.carrier.name, kind: first.carrier.kind },
      sendBatchId,
      dispatches,
      leftOut: leftOut.map((id) => ({ id, name: departmentNames.get(id) ?? '' })),
      lineCount: dispatches.reduce((sum, d) => sum + d.lineCount, 0),
      shortCount: dispatches.reduce((sum, d) => sum + d.shortCount, 0),
      sentDepartments: live.filter((d) => !isUnsigned(d.status)).length,
      totalDepartments: Math.max(live.length, 1),
      replayed,
    };
  },

  // --- P6 and P7: the file and the print data ----------------------------------------------------------------------------------

  /** P6 GET /:id: the dispatch file. A branch-side caller gets no sent figure, gap or value before the department signs its count. */
  getFile: async (actor: Actor, id: string, now: Date = new Date()): Promise<DispatchFile> => {
    const c = await loadCaller(actor);
    const rec = await repo.findFile(id, readScope(c));
    if (!rec) throw new NotFoundError('Dispatch not found');
    if (isUnsigned(rec.status)) throw dispatchError('NOT_SIGNED', 'This dispatch has not been signed yet.');
    const siblings = await repo.listSiblings(c.hubId, rec.requisitionId, rec.id);
    const parentNames = await parentNamesOf(rec.lines.map((l) => l.item.category));
    const viewer: FileViewer = {
      now,
      seeValue: actorCan(actor, 'requisitions.see_value'),
      branchSide: isBranchSide(c),
      canPack: actorCan(actor, 'dispatch.pack'),
      canPrint: true,
      canCancel: actorCan(actor, 'dispatch.cancel'),
      canRecordFinding: actorCan(actor, 'discrepancies.record'),
      canConfirmForDepartment: actorCan(actor, 'deliveries.confirm_on_behalf'),
      parentNames,
      siblings: siblings.map((s) => ({
        id: s.id,
        reference: s.reference,
        departmentName: s.department.name,
        stage: stageOf({ status: s.status, signedAt: s.signedAt, allTicked: s.lines.every((l) => l.packedTick), gapHeld: gapHeldOf(s.discrepancies) }, now),
      })),
    };
    return fileWire(rec, viewer);
  },

  /** P7 GET /:id/print?copy=store|branch: the delivery note data. The branch copy has no quantity; the store copy is not for the blind branch side. */
  print: async (actor: Actor, id: string, copy: 'store' | 'branch', now: Date = new Date()): Promise<PrintDispatch> => {
    const c = await loadCaller(actor);
    const rec = await repo.findFile(id, readScope(c));
    if (!rec) throw new NotFoundError('Dispatch not found');
    if (isUnsigned(rec.status)) throw dispatchError('NOT_SIGNED', 'This dispatch has not been signed yet.');
    if (copy === 'store' && isBranchSide(c) && rec.countedAt === null) throw new ForbiddenError('The store copy shows what was sent, so it is not available to the branch before the count is signed');
    return printWire(rec, copy, now);
  },

  // --- P8: cancel ----------------------------------------------------------------------------------------------------------------

  /**
   * P8 POST /:id/cancel: only while the dispatch is On the way and no department member has signed its count. Locks THAT dispatch
   * only. Stock goes back by a linked reversing ledger entry per line (the door's `DISPATCH` reversal), the note is voided and kept,
   * and the lines return to the queue as a fresh dispatch (ticks reset) the next time the department is opened.
   */
  cancel: async (actor: Actor, id: string, input: CancelDispatchInput, now: Date = new Date()): Promise<CancelDispatchResult> => {
    const c = await loadCaller(actor);
    if (!actorCan(actor, 'dispatch.cancel')) throw new ForbiddenError('You do not have permission to cancel a dispatch');
    const done = (rec: { id: string; reference: string | null; cancelledAt: Date | null; cancelledBy: { id: string; name: string; role: string } | null; lines: unknown[] }, replayed: boolean): CancelDispatchResult => {
      if (!rec.cancelledAt || !rec.cancelledBy) throw dispatchError('DISPATCH_CANCELLED', 'This dispatch was cancelled.');
      return { id: rec.id, reference: rec.reference ?? '', status: 'CANCELLED', cancelledAt: rec.cancelledAt.toISOString(), cancelledBy: toPerson(rec.cancelledBy), linesReturnedToQueue: rec.lines.length, replayed };
    };
    const replay = await repo.findDispatchEventByKey(c.hubId, id, actor.id, input.idempotencyKey, 'CANCELLED');
    if (replay) {
      const again = await repo.findFile(id, { hubId: c.hubId });
      if (again) return done(again, true);
    }
    const rec = await repo.findFile(id, { hubId: c.hubId });
    if (!rec) throw new NotFoundError('Dispatch not found');
    if (rec.status === 'CANCELLED') throw dispatchError('DISPATCH_CANCELLED', 'This dispatch was already cancelled.');
    if (isUnsigned(rec.status)) throw dispatchError('NOT_SIGNED', 'This dispatch has not been signed yet.');
    if (rec.countedAt !== null || rec.status === 'CONFIRMED' || rec.status === 'CLOSED') throw dispatchError('DISPATCH_ALREADY_COUNTED', 'The department has already counted this delivery, so it cannot be cancelled.');
    const holder = await countPin.verifyOwn(actor, input.pin);

    try {
      await prisma.$transaction(async (tx) => {
        await repo.lockHub(tx, c.hubId);
        const won = await repo.cancelDispatch(tx, rec.id, { cancelledById: actor.id, cancelledAt: now, cancelReason: input.reason });
        if (won.count === 0) {
          const now2 = await repo.findFile(id, { hubId: c.hubId }, tx);
          if (now2?.status === 'CANCELLED') throw dispatchError('DISPATCH_CANCELLED', 'This dispatch was already cancelled.');
          throw dispatchError('DISPATCH_ALREADY_COUNTED', 'The department has already counted this delivery, so it cannot be cancelled.');
        }
        const outs = await repo.findOutRows(tx, rec.lines.map((l) => l.id));
        for (const out of outs) {
          if (!out.dispatchLineId) continue;
          await postStockMovement(tx, {
            type: 'DISPATCH_OUT',
            locationId: out.locationId,
            inventoryItemId: out.inventoryItemId,
            quantity: out.quantity.abs(),
            unitCost: out.unitCost,
            reason: `Cancelled ${rec.reference ?? 'dispatch'}`,
            userId: actor.id,
            links: { dispatchLineId: out.dispatchLineId },
            reversesTransactionId: out.id,
          });
        }
        await repo.createEvent(tx, { dispatchId: rec.id, type: 'CANCELLED', actorId: actor.id, actorRoleLabel: roleLabelOf(holder.role), reason: input.reason, idempotencyKey: input.idempotencyKey, at: now });
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        const again = await repo.findFile(id, { hubId: c.hubId });
        if (again?.status === 'CANCELLED') return done(again, true);
      }
      throw error;
    }
    void dispatchNotices.cancelled({ hubId: c.hubId, branchId: rec.toSiteId, id: rec.id, reference: rec.reference });
    const after = await repo.findFile(id, { hubId: c.hubId });
    if (!after) throw new NotFoundError('Dispatch not found');
    return done(after, false);
  },

  // --- The two Block 1 hand-offs (called by the requisition flow, `requisitions-handoff.ts`) --------------------------------------------

  /**
   * An approved addition joins the department's UNSIGNED dispatch now (the pack screens also reconcile on every look, so this only
   * makes an open screen hear about it). A department with no dispatch yet, or a signed one, is left alone: the first look builds it
   * from the requisition, and a signed department refuses an addition earlier (`ADDITION_LOCKED`).
   */
  attachAddition: async (requisitionId: string, departmentId: string): Promise<boolean> => {
    const hub = await branchRepository.findHub();
    if (!hub) return false;
    const rec = await repo.findRequisitionForPack(requisitionId);
    const section = rec ? packSectionsOf(rec).find((s) => s.departmentId === departmentId) : undefined;
    if (!rec || !section) return false;
    const existing = await repo.findLiveDispatch(hub.id, rec.id, departmentId);
    if (!existing || !isUnsigned(existing.status)) return false;
    const store = await storeLocation();
    const onHand = await repo.onHand(hub.id, store.id, [...new Set(desiredLinesOf(section).map((l) => l.inventoryItemId))]);
    await prisma.$transaction((tx) => ensureDispatch(tx, { hubId: hub.id }, rec, section, onHand));
    void dispatchNotices.packed({ hubId: hub.id, branchId: rec.siteId, id: existing.id });
    return true;
  },

  /**
   * After a department's count or a discrepancy settles: a CONFIRMED dispatch with no gap still held becomes CLOSED, and when every
   * department of the requisition has a CLOSED dispatch the requisition is CLOSED too. Returns whether the requisition closed now.
   */
  closeIfComplete: async (requisitionId: string, now: Date = new Date()): Promise<boolean> => {
    const hub = await branchRepository.findHub();
    if (!hub) return false;
    const rec = await repo.findRequisitionForPack(requisitionId);
    if (!rec) return false;
    return prisma.$transaction(async (tx) => {
      const live = await repo.listLiveDispatchesWithGaps(hub.id, rec.id, tx);
      await repo.markClosed(tx, live.filter((d) => d.status === 'CONFIRMED' && !gapHeldOf(d.discrepancies)).map((d) => d.id), now);
      const sections = packSectionsOf(rec);
      const closed = new Set(live.filter((d) => d.status === 'CLOSED' || (d.status === 'CONFIRMED' && !gapHeldOf(d.discrepancies))).map((d) => d.departmentId));
      const everyDepartment = sections.length > 0 && sections.every((s) => s.departmentId !== null && closed.has(s.departmentId));
      return everyDepartment ? requisitionsRepository.closeRequisition(rec.id, now, tx) : false;
    });
  },

  // --- P9: the Attendant's history ------------------------------------------------------------------------------------------------

  /** P9 GET /mine: On the way and Done, with a result chip on Done. No money. The Attendant reads their own; the store manager reads all. */
  mine: async (actor: Actor, query: DispatchMineQuery, now: Date = new Date()): Promise<DispatchMine> => {
    const c = await loadCaller(actor);
    const scope = readScope(c);
    const statuses = query.tab === 'on-the-way' ? (['ON_THE_WAY'] as const) : (['CONFIRMED', 'CLOSED', 'CANCELLED'] as const);
    const [page, onTheWay, done] = await Promise.all([
      repo.listMine(scope, {
        statuses: [...statuses],
        ...(query.branchId ? { branchId: query.branchId } : {}),
        ...(query.from ? { from: dayAsDate(query.from) } : {}),
        ...(query.to ? { to: nairobiDayEnd(dayAsDate(query.to)) } : {}),
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      repo.countMine(scope, ['ON_THE_WAY']),
      repo.countMine(scope, ['CONFIRMED', 'CLOSED', 'CANCELLED']),
    ]);
    return {
      tab: query.tab,
      rows: page.rows.flatMap((r) =>
        mineTabOf(r.status) === null
          ? []
          : [
              {
                id: r.id,
                reference: r.reference ?? '',
                branch: { id: r.toSite.id, name: r.toSite.name, code: r.toSite.code },
                department: { id: r.department.id, name: r.department.name },
                requisition: { id: r.requisition.id, reference: r.requisition.reference, cycle: cycleOf(r.requisition.type), cycleLabel: CYCLE_TEXT[cycleOf(r.requisition.type)] },
                carrier: r.carrier ? { id: r.carrier.id, name: r.carrier.name, kind: r.carrier.kind } : null,
                lineCount: r.lines.length,
                signedAt: (r.signedAt ?? now).toISOString(),
                stage: stageOf({ status: r.status, signedAt: r.signedAt, allTicked: true, gapHeld: gapHeldOf(r.discrepancies) }, now),
                result: doneResultOf(r.status, r.discrepancies),
              },
            ],
      ),
      tabCounts: { 'on-the-way': onTheWay, done },
      page: { page: query.page, pageSize: query.pageSize, total: page.total },
    };
  },
};

void categoryPathOf;
