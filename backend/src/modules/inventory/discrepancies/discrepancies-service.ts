import type { Request } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../../config/database';
import { branchRepository } from '../../../repositories/branch-repository';
import { locationRepository } from '../../../repositories/location-repository';
import { ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from '../../../utils/errors';
import { actorCan, requireHubActor, type Capability } from '../_shared/central-store-access';
import { countPin } from '../counting/_shared/count-pin';
import { dayAsDate, nairobiDayEnd } from '../counting/_shared/count-time';
import { roleLabelOf, toPerson } from '../counting/_shared/count-people';
import { dispatchRepository } from '../dispatch/dispatch-repository';
import { deliveriesRepository } from '../deliveries/deliveries-repository';
import { closeIfComplete } from '../requisitions/requisitions-handoff';
import { requisitionsRepository } from '../requisitions/requisitions-repository';
import { postStockMovement } from '../stock/ledger/ledger-door';
import {
  FINDING_PROFILE,
  REMINDER_AFTER_HOURS,
  type Finding,
  type FindingPreview,
  type ListDiscrepancies,
  type ListDiscrepanciesQuery,
  type RecordFindingInput,
  type RecordFindingResult,
  type ReverseFindingInput,
  type ReverseFindingResult,
  type DiscrepancyFile,
} from './_shared/discrepancies-contract';
import { discrepancyError } from './discrepancies-errors';
import { discrepancyNotices } from './discrepancies-notify';
import { discrepanciesRepository as repo, HELD, SETTLED, type DiscrepancyRecord, type DiscrepancyScope } from './discrepancies-repository';
import { directionOfGap, isFindingAllowed, lossValueOf, postingsOf, reminderDue } from './discrepancies-state';
import { allowedFor, fileWire, previewWire, recordedFindingWire, rowWire, type Viewer } from './discrepancies-view';

type Actor = NonNullable<Request['user']>;

const isUniqueViolation = (error: unknown): boolean => error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

// --- Who is calling ---------------------------------------------------------------------------------------------------------------

interface Caller {
  actor: Actor;
  staff: NonNullable<Awaited<ReturnType<typeof repo.findStaff>>>;
  hubId: string;
  scope: DiscrepancyScope;
  viewer: Viewer;
  /** The hub roles read every branch and get the branch picker. */
  hubReader: boolean;
}

/**
 * `discrepancies.read`: the four hub desktop roles read everything, the Branch Manager their own branch; a department head (who holds
 * nothing from the access table) reads their own department. Anyone else reads nothing.
 */
const loadReader = async (actor: Actor): Promise<Caller> => {
  const staff = await repo.findStaff(actor.id);
  if (!staff) throw new UnauthorizedError('Authentication required');
  const hub = await branchRepository.findHub();
  if (!hub) throw new ValidationError('No hub organization is configured');
  const viewer: Viewer = { seeValue: actorCan(actor, 'requisitions.see_value'), canRecordFinding: actorCan(actor, 'discrepancies.record'), canReverse: actorCan(actor, 'discrepancies.reverse') };
  if (actorCan(actor, 'discrepancies.read')) {
    if (actor.role === 'MANAGER') {
      if (!staff.siteId) throw new ValidationError('Branch context missing for this user');
      return { actor, staff, hubId: hub.id, scope: { hubId: hub.id, toSiteId: staff.siteId }, viewer, hubReader: false };
    }
    return { actor, staff, hubId: hub.id, scope: { hubId: hub.id }, viewer, hubReader: true };
  }
  if (staff.isDepartmentHead && staff.departmentId && staff.siteId) {
    return { actor, staff, hubId: hub.id, scope: { hubId: hub.id, toSiteId: staff.siteId, departmentId: staff.departmentId }, viewer: { ...viewer, seeValue: false }, hubReader: false };
  }
  throw new ForbiddenError('You do not have permission to view discrepancies');
};

/** A write belongs to the hub (D-15) and to the capability's holder. */
const loadWriter = async (actor: Actor, capability: Capability): Promise<Caller> => {
  if (!actorCan(actor, capability)) throw new ForbiddenError('You do not have permission to perform this action');
  await requireHubActor(actor);
  return loadReader(actor);
};

const loadRecord = async (c: Caller, id: string, db: Prisma.TransactionClient | typeof prisma = prisma): Promise<DiscrepancyRecord> => {
  const rec = await repo.findFile(id, c.scope, db);
  if (!rec) throw new NotFoundError('Discrepancy not found');
  return rec;
};

const costOf = (rec: DiscrepancyRecord): Prisma.Decimal => rec.dispatchLine.unitCostAtDispatch ?? rec.dispatchLine.item.currentCost;

const receiverTitle = (rec: DiscrepancyRecord): string => {
  const by = rec.dispatch.countedBy;
  if (!by) return `${rec.dispatch.department.name} department`;
  if (rec.dispatch.onBehalf) return roleLabelOf('MANAGER');
  return by.isDepartmentHead && by.departmentId === rec.dispatch.department.id ? `${rec.dispatch.department.name} Department Head` : roleLabelOf(by.role);
};

const againstPartyOf = (rec: DiscrepancyRecord, finding: Finding): string | null => {
  switch (FINDING_PROFILE[finding].against) {
    case 'STORE':
      return rec.dispatch.packedBy ? `Packer: ${roleLabelOf(rec.dispatch.packedBy.role)}` : 'Packer: Central Store';
    case 'CARRIER':
      return rec.dispatch.carrier?.name ?? null;
    case 'RECEIVER':
      return `Receiver: ${receiverTitle(rec)}`;
    case 'UNEXPLAINED':
      return 'Unexplained';
  }
};

// --- The service ---------------------------------------------------------------------------------------------------------------

export const discrepanciesService = {
  /** Q1 GET /: the list with the Open and Settled counts. A discrepancy whose finding was reversed counts as Open. */
  list: async (actor: Actor, query: ListDiscrepanciesQuery): Promise<ListDiscrepancies> => {
    const c = await loadReader(actor);
    const filter = {
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.q ? { q: query.q } : {}),
      ...(query.from ? { from: dayAsDate(query.from) } : {}),
      ...(query.to ? { to: nairobiDayEnd(dayAsDate(query.to)) } : {}),
    };
    const [page, counts, branches] = await Promise.all([
      repo.list(c.scope, { ...filter, statuses: query.tab === 'open' ? HELD : SETTLED }, { skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      repo.counts(c.scope, filter),
      c.hubReader ? repo.listBranches() : Promise.resolve(null),
    ]);
    return {
      tab: query.tab,
      rows: page.rows.map((r) => rowWire(r, c.viewer)),
      counts,
      ...(branches ? { branches: branches.map((b) => ({ id: b.id, name: b.name, code: b.code })) } : {}),
      page: { page: query.page, pageSize: query.pageSize, total: page.total },
    };
  },

  /** Q2 GET /:id: the discrepancy file. */
  getFile: async (actor: Actor, id: string): Promise<DiscrepancyFile> => {
    const c = await loadReader(actor);
    const rec = await loadRecord(c, id);
    return fileWire(rec, c.viewer, allowedFor(rec.gapQty));
  },

  /** Q3 GET /:id/finding-preview?finding=: what the finding would do, live, before the PIN. */
  findingPreview: async (actor: Actor, id: string, finding: Finding): Promise<FindingPreview> => {
    const c = await loadWriter(actor, 'discrepancies.record');
    const rec = await loadRecord(c, id);
    if (rec.status === 'RECORDED') throw discrepancyError('FINDING_ALREADY_RECORDED', 'A finding is already recorded. Reverse it first.');
    if (!isFindingAllowed(directionOfGap(rec.gapQty), finding)) throw discrepancyError('FINDING_NOT_ALLOWED', 'That finding does not fit this gap.');
    return previewWire(rec, finding, { store: 'Central Store', department: `${rec.dispatch.department.name} · ${rec.dispatch.toSite.name}` }, againstPartyOf(rec, finding), c.viewer.seeValue);
  },

  /**
   * Q4 POST /:id/findings: records ONE finding with the caller's PIN. ONE transaction: the claim (only while the gap is held), the
   * stock postings through the ledger door as `ADJUSTMENT` rows linked to the dispatch line (the `DSC-` number is found through that
   * link), the events, the loss value at the cost frozen at dispatch. A repeated idempotencyKey returns the first result.
   */
  recordFinding: async (actor: Actor, id: string, input: RecordFindingInput, now: Date = new Date()): Promise<RecordFindingResult> => {
    const c = await loadWriter(actor, 'discrepancies.record');
    const replay = await discrepanciesService.replayRecord(c, id, input.idempotencyKey);
    if (replay) return replay;

    const rec = await loadRecord(c, id);
    if (rec.status === 'RECORDED') throw discrepancyError('FINDING_ALREADY_RECORDED', 'A finding is already recorded on this gap.');
    if (!isFindingAllowed(directionOfGap(rec.gapQty), input.finding)) throw discrepancyError('FINDING_NOT_ALLOWED', 'That finding does not fit this gap.');
    const holder = await countPin.verifyOwn(actor, input.pin);
    const roleLabel = roleLabelOf(holder.role);

    try {
      await prisma.$transaction(async (tx) => {
        await repo.lock(tx, id);
        const fresh = await loadRecord(c, id, tx);
        if (fresh.status === 'RECORDED') throw discrepancyError('FINDING_ALREADY_RECORDED', 'A finding is already recorded on this gap.');
        const cost = costOf(fresh);
        const claimed = await repo.claimFinding(tx, id, c.hubId, {
          finding: input.finding,
          note: input.note ?? null,
          recordedById: actor.id,
          recordedAt: now,
          lossValue: lossValueOf(input.finding, fresh.gapQty, cost),
        });
        if (!claimed) throw discrepancyError('FINDING_ALREADY_RECORDED', 'A finding is already recorded on this gap.');
        for (const p of postingsOf(input.finding, fresh.gapQty)) {
          const locationId = await locationIdOf(tx, fresh, p.place);
          await postStockMovement(tx, {
            type: 'ADJUSTMENT',
            locationId,
            inventoryItemId: fresh.dispatchLine.inventoryItemId,
            quantity: p.quantity,
            unitCost: cost,
            reason: `${fresh.reference} · finding: ${input.finding}`,
            userId: actor.id,
            links: { dispatchLineId: fresh.dispatchLine.id },
          });
        }
        await repo.createEvent(tx, { discrepancyId: id, type: 'FINDING_RECORDED', actorId: actor.id, actorRoleLabel: roleLabel, finding: input.finding, note: input.note ?? null, idempotencyKey: input.idempotencyKey, at: now });
        await dispatchRepository.createEvent(tx, { dispatchId: fresh.dispatch.id, type: 'FINDING_RECORDED', actorId: actor.id, actorRoleLabel: roleLabel, reason: fresh.reference, at: now });
      });
    } catch (error) {
      // The same key racing the first call: the unique event decides, the loser returns the winner's result.
      if (isUniqueViolation(error)) {
        const again = await discrepanciesService.replayRecord(c, id, input.idempotencyKey);
        if (again) return again;
      }
      throw error;
    }

    // Every gap of the dispatch settled: it closes (and the requisition when every department has). Best effort.
    await closeIfComplete(rec.dispatch.requisitionId);
    const after = await loadRecord(c, id);
    const loss = after.lossValue;
    void discrepancyNotices.recorded({
      hubId: c.hubId,
      branchId: after.toSiteId,
      discrepancyId: after.id,
      reference: after.reference,
      dispatchId: after.dispatch.id,
      dispatchReference: after.dispatch.reference,
      finding: input.finding,
      lossValueKes: loss !== null ? loss.toFixed(2) : null,
    });
    return discrepanciesService.recordResultOf(c, after, input.finding, input.note ?? null, actor.id, now, false);
  },

  replayRecord: async (c: Caller, id: string, idempotencyKey: string): Promise<RecordFindingResult | null> => {
    const event = await repo.findEventByKey(c.hubId, id, c.actor.id, idempotencyKey, 'FINDING_RECORDED');
    if (!event?.finding) return null;
    const rec = await loadRecord(c, id);
    return discrepanciesService.recordResultOf(c, rec, event.finding, event.note, c.actor.id, event.at, true);
  },

  recordResultOf: (c: Caller, rec: DiscrepancyRecord, finding: Finding, note: string | null, actorId: string, at: Date, replayed: boolean): RecordFindingResult => ({
    id: rec.id,
    reference: rec.reference,
    status: 'RECORDED',
    finding: recordedFindingWire({ finding, note, by: { id: actorId, name: c.staff.name, role: c.staff.role }, at, lossValue: lossValueOf(finding, rec.gapQty, costOf(rec)) }, c.viewer.seeValue),
    ledgerEntries: postingsOf(finding, rec.gapQty).length,
    replayed,
  }),

  /**
   * Q5 POST /:id/reverse: a new linked entry that undoes each posting of the finding (the original rows stay), a reason and the PIN. The
   * gap is held as unaccounted again: the status goes back to OPEN and a new finding may be recorded. A dispatch or requisition that had
   * closed on this gap opens again.
   */
  reverse: async (actor: Actor, id: string, input: ReverseFindingInput, now: Date = new Date()): Promise<ReverseFindingResult> => {
    const c = await loadWriter(actor, 'discrepancies.reverse');
    const replay = await discrepanciesService.replayReverse(c, id, input.idempotencyKey);
    if (replay) return replay;

    const rec = await loadRecord(c, id);
    if (rec.status !== 'RECORDED' || !rec.finding) throw discrepancyError('FINDING_NOT_REVERSIBLE', 'There is no recorded finding to reverse on this gap.');
    const holder = await countPin.verifyOwn(actor, input.pin);
    const roleLabel = roleLabelOf(holder.role);
    const reversedFinding = rec.finding;
    let ledgerEntries = 0;

    try {
      await prisma.$transaction(async (tx) => {
        await repo.lock(tx, id);
        const fresh = await loadRecord(c, id, tx);
        if (fresh.status !== 'RECORDED' || !fresh.finding) throw discrepancyError('FINDING_NOT_REVERSIBLE', 'There is no recorded finding to reverse on this gap.');
        const adjustments = await repo.findActiveAdjustments(tx, fresh.dispatchLine.id);
        const claimed = await repo.claimReversal(tx, id, c.hubId, { reversedById: actor.id, reversedAt: now, reason: input.reason });
        if (!claimed) throw discrepancyError('FINDING_NOT_REVERSIBLE', 'There is no recorded finding to reverse on this gap.');
        for (const a of adjustments) {
          await postStockMovement(tx, {
            type: 'ADJUSTMENT',
            locationId: a.locationId,
            inventoryItemId: a.inventoryItemId,
            quantity: a.quantity.negated(),
            unitCost: a.unitCost,
            reason: `Reversed the finding on ${fresh.reference}: ${input.reason}`,
            userId: actor.id,
            links: { dispatchLineId: fresh.dispatchLine.id },
            reversesTransactionId: a.id,
          });
        }
        ledgerEntries = adjustments.length;
        await repo.createEvent(tx, { discrepancyId: id, type: 'FINDING_REVERSED', actorId: actor.id, actorRoleLabel: roleLabel, finding: fresh.finding, reason: input.reason, idempotencyKey: input.idempotencyKey, at: now });
        await dispatchRepository.createEvent(tx, { dispatchId: fresh.dispatch.id, type: 'FINDING_REVERSED', actorId: actor.id, actorRoleLabel: roleLabel, reason: input.reason, at: now });
        if (await repo.reopenDispatch(tx, fresh.dispatch.id, c.hubId)) await requisitionsRepository.reopenRequisition(fresh.dispatch.requisitionId, tx);
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        const again = await discrepanciesService.replayReverse(c, id, input.idempotencyKey);
        if (again) return again;
      }
      throw error;
    }

    const after = await loadRecord(c, id);
    void discrepancyNotices.reversed({
      hubId: c.hubId,
      branchId: after.toSiteId,
      discrepancyId: after.id,
      reference: after.reference,
      dispatchId: after.dispatch.id,
      dispatchReference: after.dispatch.reference,
      finding: reversedFinding,
      lossValueKes: null,
    });
    return discrepanciesService.reverseResultOf(c, after, input.reason, now, ledgerEntries, false);
  },

  replayReverse: async (c: Caller, id: string, idempotencyKey: string): Promise<ReverseFindingResult | null> => {
    const event = await repo.findEventByKey(c.hubId, id, c.actor.id, idempotencyKey, 'FINDING_REVERSED');
    if (!event) return null;
    const rec = await loadRecord(c, id);
    return discrepanciesService.reverseResultOf(c, rec, event.reason ?? '', event.at, event.finding ? postingsOf(event.finding, rec.gapQty).length : 0, true);
  },

  reverseResultOf: (c: Caller, rec: DiscrepancyRecord, reason: string, at: Date, ledgerEntries: number, replayed: boolean): ReverseFindingResult => ({
    id: rec.id,
    reference: rec.reference,
    status: 'OPEN',
    reversal: { reason, reversed: { by: toPerson(c.staff), at: at.toISOString() } },
    ledgerEntries,
    replayed,
  }),

  /**
   * The 24-hour reminder (map row 19), run by the worker every few minutes: a gap held for 24 hours without a finding reminds the
   * Store Manager, then again every day. The stamp `reminderSentAt` is the claim, so a run that overlaps another, or a retry, never
   * sends twice in a day. Returns how many reminders went.
   */
  sendReminders: async (now: Date = new Date()): Promise<number> => {
    const hub = await branchRepository.findHub();
    if (!hub) return 0;
    const limitMs = REMINDER_AFTER_HOURS * 60 * 60 * 1000;
    const olderThan = new Date(now.getTime() - limitMs);
    const candidates = await repo.findReminderCandidates(hub.id, olderThan);
    let sent = 0;
    for (const d of candidates) {
      const since = d.reversedAt ?? d.createdAt;
      if (!reminderDue({ since, reminderSentAt: d.reminderSentAt }, now, REMINDER_AFTER_HOURS)) continue;
      if (!(await repo.claimReminder(d.id, hub.id, now, olderThan))) continue;
      sent += 1;
      await discrepancyNotices.reminder({ hubId: hub.id, discrepancyId: d.id, reference: d.reference, hours: (now.getTime() - since.getTime()) / 3_600_000 });
    }
    return sent;
  },
};

/** The stock location a posting lands in: the Central Store, or the counting department's location. */
const locationIdOf = async (tx: Prisma.TransactionClient, rec: DiscrepancyRecord, place: 'CENTRAL_STORE' | 'DEPARTMENT'): Promise<string> => {
  if (place === 'CENTRAL_STORE') {
    const store = await locationRepository.findCentralStore();
    if (!store) throw new ValidationError('No Central Store is configured');
    return store.id;
  }
  const location = await deliveriesRepository.findDepartmentLocation(rec.toSiteId, rec.dispatch.departmentId, tx);
  if (!location) throw new ValidationError(`${rec.dispatch.department.name} has no stock location yet`);
  return location.id;
};
