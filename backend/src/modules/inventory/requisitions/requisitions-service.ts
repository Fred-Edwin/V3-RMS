import type { Request } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../../config/database';
import { ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from '../../../utils/errors';
import { actorCan } from '../_shared/central-store-access';
import { countPin } from '../counting/_shared/count-pin';
import { roleLabelOf, toPerson } from '../counting/_shared/count-people';
import { referenceCounterRepository } from '../_shared/reference-counter';
import {
  REQUISITION_STATUS_TEXT,
  type AddAdditionInput,
  type AddAdditionResult,
  type ApproveAdditionInput,
  type ApproveAdditionResult,
  type ApproveInput,
  type ApproveResult,
  type ApproveSummary,
  type CancelInput,
  type CancelResult,
  type ChangeQuantityInput,
  type ChangeQuantityResult,
  type MutationResult,
  type NudgeResult,
  type Print,
  type RecallSectionResult,
  type RequisitionFile,
  type SaveLinesInput,
  type SectionDetail,
  type SectionEdit,
  type SendSectionResult,
  type SetUrgentInput,
  type SetUrgentResult,
  type SkipSectionResult,
  type StartRequisitionInput,
  type SectionStatus,
  type RequisitionStatus,
} from './_shared/requisitions-contract';
import { ON_BEHALF_REASON } from './_shared/requisitions-sentences';
import { requisitionError, stateConflict } from './requisitions-errors';
import { requisitionNotices } from './requisitions-events';
import { attachAdditionToDispatch } from './requisitions-handoff';
import { buildPrint } from './requisitions-print';
import {
  requisitionsRepository as repo,
  type RequisitionRecord,
  type Scope,
  type SectionRecord,
  type StaffRecord,
  type TaggedItem,
} from './requisitions-repository';
import {
  canRecall,
  canSkip,
  checkSend,
  guardAfterApproval,
  guardApprove,
  guardBeforeApproval,
  sectionStatusAfterSave,
  statusAfterSectionChange,
} from './requisitions-state';
import { additionWire, cycleLabelOf, fileWire, lineWire, sectionDetailWire, sectionSummaryWire, type Viewer } from './requisitions-view';

type Actor = NonNullable<Request['user']>;

export interface Caller {
  actor: Actor;
  staff: StaffRecord;
  /** The department this person heads at their branch, or null. */
  headDepartmentId: string | null;
}

type SignedAs = 'BRANCH_MANAGER' | 'DIRECTOR' | 'SYSTEM_ADMIN';

const SIGNED_AS: Record<string, SignedAs> = { MANAGER: 'BRANCH_MANAGER', DIRECTOR: 'DIRECTOR', SYSTEM_ADMIN: 'SYSTEM_ADMIN' };

const isUniqueViolation = (error: unknown): boolean => error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
const pad4 = (n: number): string => String(n).padStart(4, '0');

// --- Who is calling and what they may do ---------------------------------------------------------------------------------

export const loadCaller = async (actor: Actor): Promise<Caller> => {
  const staff = await repo.findStaff(actor.id);
  if (!staff) throw new UnauthorizedError('Authentication required');
  const headDepartmentId = staff.isDepartmentHead && staff.departmentId && staff.siteId ? staff.departmentId : null;
  return { actor, staff, headDepartmentId };
};

/** The Branch Manager and a head work in their own branch; the System Admin acts anywhere. */
const mayActAt = (c: Caller, siteId: string): boolean => c.actor.role === 'SYSTEM_ADMIN' || c.staff.siteId === siteId;

/** Approval: the Branch Manager at their branch; the Director and the System Admin at any branch. */
const mayApproveAt = (c: Caller, siteId: string): boolean =>
  actorCan(c.actor, 'requisitions.approve') && (c.actor.role === 'DIRECTOR' || c.actor.role === 'SYSTEM_ADMIN' || c.staff.siteId === siteId);

/** A head is restricted to their own department when they hold no read capability of their own. */
export const restrictedHead = (c: Caller): string | null => (actorCan(c.actor, 'requisitions.read') ? null : c.headDepartmentId);

export const readScope = (c: Caller): Scope => {
  if (actorCan(c.actor, 'requisitions.read')) {
    // The Branch Manager reads their own branch; the hub roles read any branch (contract §3).
    if (c.actor.role === 'MANAGER') {
      if (!c.staff.siteId) throw new ValidationError('Branch context missing for this user');
      return { siteId: c.staff.siteId };
    }
    return { anyBranch: true };
  }
  if (c.headDepartmentId && c.staff.siteId) return { siteId: c.staff.siteId };
  throw new ForbiddenError('You do not have permission to view requisitions');
};

export const loadFile = async (c: Caller, id: string): Promise<RequisitionRecord> => {
  const rec = await repo.findFile(id, readScope(c));
  if (!rec) throw new NotFoundError('Requisition not found');
  const dept = restrictedHead(c);
  if (dept && !rec.sections.some((s) => s.departmentId === dept)) throw requisitionError('NOT_YOUR_DEPARTMENT', 'This requisition has no section for your department.');
  return rec;
};

const findSection = (rec: RequisitionRecord, departmentId: string): SectionRecord => {
  const section = rec.sections.find((s) => s.departmentId === departmentId);
  if (!section) throw new NotFoundError('That department has no section in this requisition');
  return section;
};

/** Amendment 2 ("Fill it myself"): the event reason that marks a section filled or sent by the Branch Manager for the head. */
export type SectionHand = 'HEAD' | 'ON_BEHALF';

/**
 * Who may edit or send a section: the head of THAT department at this branch, or the Branch Manager at this branch on behalf of
 * the head (`requisitions.edit_on_behalf` to edit, `requisitions.send_on_behalf` to send; the System Admin and the Director hold
 * neither). On behalf only works while the section is Not started or Draft (`SECTION_NOT_OPEN` otherwise). A head of another
 * department is told so; anyone else is refused. Returns whose hand it is.
 */
const requireSectionEditor = (c: Caller, rec: RequisitionRecord, departmentId: string, capability: 'requisitions.edit_on_behalf' | 'requisitions.send_on_behalf'): SectionHand => {
  if (c.headDepartmentId === departmentId && c.staff.siteId === rec.siteId) return 'HEAD';
  if (actorCan(c.actor, capability) && c.staff.siteId === rec.siteId) {
    const status = findSection(rec, departmentId).status as SectionStatus;
    if (status !== 'NOT_STARTED' && status !== 'DRAFT') throw stateConflict('SECTION_NOT_OPEN', 'That section has been sent or skipped, so it can no longer be filled in for the head.');
    return 'ON_BEHALF';
  }
  if (c.headDepartmentId) throw requisitionError('NOT_YOUR_DEPARTMENT', 'You can only work on your own department.');
  throw new ForbiddenError('You do not have permission to change this section');
};

const requireCapAt = (c: Caller, capability: 'requisitions.nudge' | 'requisitions.cancel' | 'requisitions.change_quantity' | 'requisitions.set_urgent', siteId: string): void => {
  if (!actorCan(c.actor, capability) || !mayActAt(c, siteId)) throw new ForbiddenError('You do not have permission to perform this action');
};

const assertBeforeApproval = (rec: RequisitionRecord): void => {
  const guard = guardBeforeApproval(rec.status as RequisitionStatus);
  if (guard === 'CANCELLED') throw requisitionError('CANCELLED', 'This requisition was cancelled.');
  if (guard === 'ALREADY_APPROVED') throw requisitionError('ALREADY_APPROVED', 'This requisition has been signed.');
};

// --- The view ----------------------------------------------------------------------------------------------------------------

export const viewerFor = async (c: Caller, rec: RequisitionRecord, now: Date): Promise<Viewer> => {
  const deptIds = rec.sections.flatMap((s) => (s.departmentId ? [s.departmentId] : []));
  const parentIds = [...new Set(rec.sections.flatMap((s) => s.lines.map((l) => l.item.category?.parentCategoryId)).filter((id): id is string => Boolean(id)))];
  const [heads, parentNames, locked] = await Promise.all([
    repo.listHeads(rec.siteId, deptIds),
    repo.findCategoryNames(parentIds),
    rec.status === 'APPROVED'
      ? Promise.all(rec.sections.map(async (s) => ((await repo.hasDispatch(rec.id, rec.siteId, s.departmentId)) && s.departmentId ? s.departmentId : null)))
      : Promise.resolve([]),
  ]);
  const headOf = new Map(heads.map((h) => [h.departmentId, { id: h.id, name: h.name, role: h.role as string }]));
  return {
    now,
    seeValue: actorCan(c.actor, 'requisitions.see_value'),
    seeStock: actorCan(c.actor, 'restock.read'),
    headDepartmentId: restrictedHead(c),
    branchOk: mayActAt(c, rec.siteId),
    can: {
      start: actorCan(c.actor, 'requisitions.start'),
      changeQuantity: actorCan(c.actor, 'requisitions.change_quantity'),
      approve: mayApproveAt(c, rec.siteId),
      cancel: actorCan(c.actor, 'requisitions.cancel'),
      nudge: actorCan(c.actor, 'requisitions.nudge'),
      setUrgent: actorCan(c.actor, 'requisitions.set_urgent'),
      read: actorCan(c.actor, 'requisitions.read'),
      editOnBehalf: actorCan(c.actor, 'requisitions.edit_on_behalf'),
      sendOnBehalf: actorCan(c.actor, 'requisitions.send_on_behalf'),
    },
    lockedDepartmentIds: new Set(locked.filter((id): id is string => id !== null)),
    parentCategoryNames: parentNames,
    heads: headOf,
  };
};

const mutation = (rec: RequisitionRecord, replayed: boolean): MutationResult => ({
  requisitionId: rec.id,
  reference: rec.reference,
  status: rec.status as RequisitionStatus,
  statusText: REQUISITION_STATUS_TEXT[rec.status as RequisitionStatus],
  replayed,
});

const reload = async (c: Caller, rec: RequisitionRecord): Promise<RequisitionRecord> => {
  const fresh = await repo.findFile(rec.id, { siteId: rec.siteId });
  if (!fresh) throw new NotFoundError('Requisition not found');
  return fresh;
};

const totalValue = (file: RequisitionFile): string | undefined => file.valueKes;

/** Recomputes Collecting / Ready to approve after a section changed, inside the same transaction. Returns the new status. */
const syncStatus = async (tx: Prisma.TransactionClient, siteId: string, requisitionId: string): Promise<RequisitionStatus> => {
  const facts = await repo.readSectionFacts(tx, siteId, requisitionId);
  if (!facts) throw new NotFoundError('Requisition not found');
  const next = statusAfterSectionChange(facts.status as RequisitionStatus, facts.sections.map((s) => ({ status: s.status as SectionStatus, departmentActive: s.departmentActive })));
  if (next !== facts.status) await repo.setStatus(tx, siteId, requisitionId, next);
  return next;
};

const event = (c: Caller) => ({ actorId: c.actor.id, actorRoleLabel: roleLabelOf(c.staff.role) });

const decimalOf = (v: string): Prisma.Decimal => new Prisma.Decimal(v);

/** Restock level minus on hand for the items of one department, floored at zero, with the snapshots a line keeps. */
const stockFor = async (siteId: string, departmentId: string, items: TaggedItem[], db: Prisma.TransactionClient | typeof prisma = prisma) => {
  const location = await repo.findDepartmentLocation(siteId, departmentId, db);
  if (!location) return new Map<string, { level: Prisma.Decimal | null; onHand: Prisma.Decimal | null; suggested: Prisma.Decimal }>();
  const stock = await repo.readStock(siteId, location.id, items.map((i) => i.id), db);
  return new Map(
    items.map((i) => {
      const level = stock.level.get(i.id) ?? null;
      const onHand = stock.onHand.get(i.id) ?? (level ? new Prisma.Decimal(0) : null);
      const gap = level && onHand ? level.minus(onHand) : new Prisma.Decimal(0);
      return [i.id, { level, onHand, suggested: gap.greaterThan(0) ? gap : new Prisma.Decimal(0) }] as const;
    }),
  );
};

const currentValue = (file: RequisitionFile): { valueKes?: string } => {
  const v = totalValue(file);
  return v === undefined ? {} : { valueKes: v };
};

export const requisitionsService = {
  // ========================================================================================================================
  // Reads owned by back end A
  // ========================================================================================================================

  /** R3. */
  getFile: async (actor: Actor, id: string): Promise<RequisitionFile> => {
    const c = await loadCaller(actor);
    const rec = await loadFile(c, id);
    const now = new Date();
    const allInAt = rec.status === 'OPEN' ? null : await repo.findAllInAt(rec.id, rec.siteId);
    return fileWire(rec, await viewerFor(c, rec, now), allInAt);
  },

  /** R6 (`GET /:id/print`): the data for the A4. No money anywhere. */
  getPrintData: async (actor: Actor, id: string): Promise<Print> => {
    const c = await loadCaller(actor);
    if (!actorCan(actor, 'requisitions.read')) throw new ForbiddenError('You do not have permission to print requisitions');
    const rec = await loadFile(c, id);
    return buildPrint(rec);
  },

  /** R8: the head's editing screen, with the items the department may add. */
  getSection: async (actor: Actor, id: string, departmentId: string): Promise<SectionEdit> => {
    const c = await loadCaller(actor);
    const rec = await loadFile(c, id);
    const restricted = restrictedHead(c);
    if (restricted && restricted !== departmentId) throw requisitionError('NOT_YOUR_DEPARTMENT', 'You can only open your own department.');
    const section = findSection(rec, departmentId);
    const viewer = await viewerFor(c, rec, new Date());
    const items = await repo.listTaggedItems(rec.siteId, departmentId);
    const stock = await stockFor(rec.siteId, departmentId, items);
    const inSection = new Set(section.lines.filter((l) => !l.additionId).map((l) => l.inventoryItemId));
    const stockVisible = viewer.seeStock || viewer.headDepartmentId === departmentId;
    const parentNames = await repo.findCategoryNames([...new Set(items.map((i) => i.category?.parentCategoryId).filter((p): p is string => Boolean(p)))]);
    return {
      requisitionId: rec.id,
      reference: rec.reference,
      cycleLabel: cycleLabelOf(rec.type, rec.openedAt),
      requisitionStatus: rec.status as RequisitionStatus,
      urgent: rec.urgent,
      openedAt: rec.openedAt.toISOString(),
      section: sectionDetailWire(section, rec, viewer),
      addable: items.map((i) => {
        const s = stock.get(i.id);
        const parent = i.category?.parentCategoryId ? parentNames.get(i.category.parentCategoryId) : undefined;
        return {
          itemId: i.id,
          itemName: i.name,
          unit: i.usageUnit,
          categoryPath: [...(parent ? [parent] : []), ...(i.category ? [i.category.name] : [])],
          suggestedQty: (s?.suggested ?? new Prisma.Decimal(0)).toString(),
          ...(stockVisible && s?.onHand ? { onHand: s.onHand.toString() } : {}),
          ...(stockVisible && s?.level ? { level: s.level.toString() } : {}),
          inSection: inSection.has(i.id),
        };
      }),
    };
  },

  /** R10: the approve drawer's summary. */
  getApproveSummary: async (actor: Actor, id: string): Promise<ApproveSummary> => {
    const c = await loadCaller(actor);
    const rec = await loadFile(c, id);
    if (!mayApproveAt(c, rec.siteId)) throw new ForbiddenError('You do not have permission to approve this requisition');
    const file = fileWire(rec, await viewerFor(c, rec, new Date()), null);
    const changes = file.sections.flatMap((s) =>
      s.lines
        .filter((l) => l.changedByManager && l.approvedQty !== null)
        .map((l) => ({ departmentName: s.departmentName, itemName: l.itemName, from: l.requestedQty, to: l.approvedQty as string, reason: l.changeReason })),
    );
    return {
      requisitionId: rec.id,
      reference: rec.reference,
      lineCount: file.lineCount,
      ...currentValue(file),
      departments: file.sections.map((s) => ({
        departmentId: s.departmentId,
        departmentName: s.departmentName,
        status: s.status,
        lineCount: s.lineCount,
        ...(s.valueKes !== undefined ? { valueKes: s.valueKes } : {}),
      })),
      changes,
      signatureLine: 'One signature covers the whole requisition.',
      signingAs: SIGNED_AS[c.actor.role] ?? 'BRANCH_MANAGER',
    };
  },

  // ========================================================================================================================
  // Writes
  // ========================================================================================================================

  /** R11: start the requisition for a cycle. A head (own branch) or a holder of `requisitions.start`. */
  start: async (actor: Actor, input: StartRequisitionInput): Promise<MutationResult> => {
    const c = await loadCaller(actor);
    if (!c.headDepartmentId && !actorCan(actor, 'requisitions.start')) throw new ForbiddenError('You do not have permission to start a requisition');
    const siteId = c.staff.siteId;
    if (!siteId) throw new ValidationError('Branch context missing for this user');
    const site = await repo.findSite(siteId);
    if (!site || site.type !== 'BRANCH') throw new ValidationError('Requisitions belong to a branch');
    if (!site.code) throw requisitionError('BRANCH_CODE_MISSING', 'This branch has no code yet. Ask the System Admin to set it before starting a requisition.');

    const replay = async (): Promise<MutationResult | null> => {
      const prior = await repo.findByStartKey(siteId, actor.id, input.idempotencyKey);
      if (!prior) return null;
      const rec = await repo.findFile(prior.id, { siteId });
      return rec ? mutation(rec, true) : null;
    };
    const earlier = await replay();
    if (earlier) return earlier;

    try {
      const createdId = await prisma.$transaction(async (tx) => {
        await repo.lockCycle(tx, siteId, input.cycle);
        const open = await repo.findOpenForCycle(siteId, input.cycle, tx);
        if (open) throw requisitionError('REQUISITION_ALREADY_OPEN', `The ${input.cycle.toLowerCase()} requisition is already open (${open.reference}).`, { requisitionId: open.id });
        const reference = `REQ-${site.code}-${pad4(await referenceCounterRepository.nextNumber(tx, siteId, 'REQ'))}`;
        const created = await repo.createRequisition(tx, { siteId, type: input.cycle, reference, openedById: actor.id, urgent: input.urgent === true, urgentNote: input.urgent === true ? (input.urgentNote ?? null) : null, idempotencyKey: input.idempotencyKey });
        const departments = await repo.listActiveDepartments(siteId, tx);
        const now = new Date();
        for (const d of departments) {
          // A department with no tagged items counts as done: it is Skipped by rule (nobody signed that).
          const section = await repo.createSection(tx, {
            requisitionId: created.id,
            departmentId: d.id,
            departmentTag: d.key,
            status: d.itemCount === 0 ? 'SKIPPED' : 'NOT_STARTED',
            ...(d.itemCount === 0 ? { skippedAt: now } : {}),
          });
          if (d.id === c.headDepartmentId && d.itemCount > 0) {
            // The starter's own section is pre-filled with restock level minus on hand.
            const items = await repo.listTaggedItems(siteId, d.id, tx);
            const stock = await stockFor(siteId, d.id, items, tx);
            const lines = items.flatMap((i) => {
              const s = stock.get(i.id);
              return s && s.suggested.greaterThan(0)
                ? [{ inventoryItemId: i.id, requestedQty: s.suggested, suggestedQty: s.suggested, parAtRequest: s.level, onHandAtRequest: s.onHand }]
                : [];
            });
            if (lines.length > 0) {
              await repo.createLines(tx, section.id, lines);
              await repo.updateSection(tx, siteId, section.id, { status: 'DRAFT' });
            }
          }
        }
        await repo.appendEvent(tx, { requisitionId: created.id, type: 'STARTED', toValue: input.cycle, ...event(c) });
        if (input.urgent) await repo.appendEvent(tx, { requisitionId: created.id, type: 'URGENT_SET', toValue: input.urgentNote ?? null, ...event(c) });
        await syncStatus(tx, siteId, created.id);
        return created.id;
      });
      const rec = await repo.findFile(createdId, { siteId });
      if (!rec) throw new NotFoundError('Requisition not found');
      if (rec.urgent) requisitionNotices.publish({ type: 'URGENT_SET', requisitionId: rec.id, reference: rec.reference, siteId, actorId: actor.id });
      return mutation(rec, false);
    } catch (error) {
      if (isUniqueViolation(error)) {
        const again = await replay();
        if (again) return again;
      }
      throw error;
    }
  },

  /** R12: save the whole draft of a section. A Sent section reopens as a Draft. */
  saveLines: async (actor: Actor, id: string, departmentId: string, input: SaveLinesInput): Promise<SectionDetail> => {
    const c = await loadCaller(actor);
    const rec = await loadFile(c, id);
    const hand = requireSectionEditor(c, rec, departmentId, 'requisitions.edit_on_behalf');
    assertBeforeApproval(rec);
    const section = findSection(rec, departmentId);
    const saved = sectionStatusAfterSave(section.status as SectionStatus, input.lines.length);
    if (!saved.allowed) throw stateConflict('SECTION_NOT_OPEN', 'This section can no longer be changed.');

    const tagged = await repo.findTaggedItemIds(rec.siteId, departmentId, input.lines.map((l) => l.itemId));
    const stray = input.lines.filter((l) => !tagged.has(l.itemId));
    if (stray.length > 0) throw requisitionError('ITEM_NOT_IN_DEPARTMENT', 'Some items are not tagged to this department.', { itemIds: stray.map((l) => l.itemId) });

    const existing = new Map(section.lines.filter((l) => !l.additionId).map((l) => [l.inventoryItemId, l]));
    const wanted = new Set(input.lines.map((l) => l.itemId));
    const addedItems = input.lines.filter((l) => !existing.has(l.itemId)).map((l) => l.itemId);
    const items = addedItems.length > 0 ? (await repo.listTaggedItems(rec.siteId, departmentId)).filter((i) => addedItems.includes(i.id)) : [];
    const stock = await stockFor(rec.siteId, departmentId, items);

    await prisma.$transaction(async (tx) => {
      for (const line of input.lines) {
        const have = existing.get(line.itemId);
        const qty = decimalOf(line.requestedQty);
        if (have) {
          if (!have.requestedQty || !have.requestedQty.equals(qty)) await repo.updateLine(tx, rec.siteId, have.id, { requestedQty: qty });
        }
      }
      await repo.createLines(
        tx,
        section.id,
        input.lines
          .filter((l) => !existing.has(l.itemId))
          .map((l) => {
            const s = stock.get(l.itemId);
            // A line the head added has no pre-filled number to compare with (`suggestedQty` stays null).
            return { inventoryItemId: l.itemId, requestedQty: decimalOf(l.requestedQty), suggestedQty: null, parAtRequest: s?.level ?? null, onHandAtRequest: s?.onHand ?? null };
          }),
      );
      await repo.removeLines(tx, rec.siteId, [...existing.values()].filter((l) => !wanted.has(l.inventoryItemId)).map((l) => l.id));
      await repo.updateSection(tx, rec.siteId, section.id, {
        status: saved.status,
        ...(section.status === 'SUBMITTED' ? { submittedAt: null, submittedById: null } : {}),
        ...(input.noteForManager !== undefined ? { managerNote: input.noteForManager } : {}),
      });
      await repo.appendEvent(tx, {
        requisitionId: rec.id, sectionId: section.id, type: 'LINE_CHANGED', toValue: `${input.lines.length} ${input.lines.length === 1 ? 'line' : 'lines'}`,
        ...(hand === 'ON_BEHALF' ? { reason: ON_BEHALF_REASON } : {}), ...event(c),
      });
      await syncStatus(tx, rec.siteId, rec.id);
    });
    if (hand === 'ON_BEHALF') {
      requisitionNotices.publish({
        type: 'SECTION_EDITED_ON_BEHALF', requisitionId: rec.id, reference: rec.reference, siteId: rec.siteId, actorId: actor.id, departmentId, departmentName: section.department?.name ?? '',
      });
    }

    const fresh = await reload(c, rec);
    return sectionDetailWire(findSection(fresh, departmentId), fresh, await viewerFor(c, fresh, new Date()));
  },

  /** R13: send a section, signed with the sender's PIN. */
  sendSection: async (actor: Actor, id: string, departmentId: string, pin: string, idempotencyKey: string): Promise<SendSectionResult> => {
    const c = await loadCaller(actor);
    const rec = await loadFile(c, id);
    const done = async (replayed: boolean): Promise<SendSectionResult> => {
      const fresh = await reload(c, rec);
      const viewer = await viewerFor(c, fresh, new Date());
      return { ...mutation(fresh, replayed), section: sectionSummaryWire(findSection(fresh, departmentId), fresh, viewer), readyToApprove: fresh.status === 'PENDING_APPROVAL' };
    };
    // A repeated key answers with the first result before any state rule (the section is Sent by then).
    if (await repo.findEventByKey(rec.id, rec.siteId, actor.id, idempotencyKey)) return done(true);
    const hand = requireSectionEditor(c, rec, departmentId, 'requisitions.send_on_behalf');
    assertBeforeApproval(rec);
    const section = findSection(rec, departmentId);
    const check = checkSend(section.status as SectionStatus, section.lines.filter((l) => !l.additionId).length);
    if (check === 'EMPTY') throw requisitionError('SECTION_EMPTY', 'A section with no lines cannot be sent.');
    if (check === 'NOT_SENDABLE') throw stateConflict('SECTION_ALREADY_SENT', 'This section has already been sent.');
    await countPin.verifyOwn(actor, pin);

    try {
      const status = await prisma.$transaction(async (tx) => {
        await repo.updateSection(tx, rec.siteId, section.id, { status: 'SUBMITTED', submittedAt: new Date(), submittedById: actor.id });
        await repo.appendEvent(tx, { requisitionId: rec.id, sectionId: section.id, type: 'SENT', idempotencyKey, ...(hand === 'ON_BEHALF' ? { reason: ON_BEHALF_REASON } : {}), ...event(c) });
        return syncStatus(tx, rec.siteId, rec.id);
      });
      requisitionNotices.publish({
        type: 'SECTION_SENT', requisitionId: rec.id, reference: rec.reference, siteId: rec.siteId, actorId: actor.id,
        departmentId, departmentName: section.department?.name ?? '', readyToApprove: status === 'PENDING_APPROVAL', onBehalf: hand === 'ON_BEHALF',
      });
      return await done(false);
    } catch (error) {
      if (isUniqueViolation(error)) return done(true);
      throw error;
    }
  },

  /** R14: take a Sent section back to Draft, until the requisition is signed. */
  recallSection: async (actor: Actor, id: string, departmentId: string): Promise<RecallSectionResult> => {
    const c = await loadCaller(actor);
    const rec = await loadFile(c, id);
    if (c.headDepartmentId !== departmentId || c.staff.siteId !== rec.siteId) {
      throw requisitionError('NOT_YOUR_DEPARTMENT', 'You can only recall your own department.');
    }
    assertBeforeApproval(rec);
    const section = findSection(rec, departmentId);
    if (!canRecall(section.status as SectionStatus)) throw stateConflict('SECTION_NOT_SENT', 'This section has not been sent.');
    await prisma.$transaction(async (tx) => {
      await repo.updateSection(tx, rec.siteId, section.id, { status: 'DRAFT', submittedAt: null, submittedById: null });
      await repo.appendEvent(tx, { requisitionId: rec.id, sectionId: section.id, type: 'RECALLED', ...event(c) });
      await syncStatus(tx, rec.siteId, rec.id);
    });
    const fresh = await reload(c, rec);
    return { ...mutation(fresh, false), section: sectionSummaryWire(findSection(fresh, departmentId), fresh, await viewerFor(c, fresh, new Date())) };
  },

  /** R15: set or clear Urgent before approval. The manager, or a head for a requisition their department is part of. */
  setUrgent: async (actor: Actor, id: string, input: SetUrgentInput): Promise<SetUrgentResult> => {
    const c = await loadCaller(actor);
    const rec = await loadFile(c, id);
    const headHere = c.headDepartmentId !== null && c.staff.siteId === rec.siteId && rec.sections.some((s) => s.departmentId === c.headDepartmentId);
    if (!headHere) requireCapAt(c, 'requisitions.set_urgent', rec.siteId);
    assertBeforeApproval(rec);
    if (rec.urgent !== input.urgent) {
      const urgentAt = input.urgent ? new Date() : null;
      const note = input.urgent ? (input.urgentNote ?? null) : null;
      await prisma.$transaction(async (tx) => {
        await repo.setUrgent(tx, rec.siteId, rec.id, { urgent: input.urgent, urgentAt, urgentNote: note });
        await repo.appendEvent(tx, { requisitionId: rec.id, type: input.urgent ? 'URGENT_SET' : 'URGENT_CLEARED', toValue: note, ...event(c) });
      });
      if (input.urgent) requisitionNotices.publish({ type: 'URGENT_SET', requisitionId: rec.id, reference: rec.reference, siteId: rec.siteId, actorId: actor.id });
    } else if (input.urgent && input.urgentNote !== undefined && input.urgentNote !== rec.urgentNote) {
      // Already urgent: only the note changes. The hour keeps running from the first `urgentAt`.
      await prisma.$transaction(async (tx) => {
        await repo.setUrgentNote(tx, rec.siteId, rec.id, input.urgentNote ?? null);
        await repo.appendEvent(tx, { requisitionId: rec.id, type: 'URGENT_SET', toValue: input.urgentNote ?? null, ...event(c) });
      });
    }
    const fresh = await reload(c, rec);
    return { ...mutation(fresh, false), urgent: fresh.urgent, urgentAt: fresh.urgentAt ? fresh.urgentAt.toISOString() : null };
  },

  /** R16: the manager changes an Approved quantity (a reason is required once the requisition is signed). */
  changeQuantity: async (actor: Actor, id: string, lineId: string, input: ChangeQuantityInput): Promise<ChangeQuantityResult> => {
    const c = await loadCaller(actor);
    const rec = await loadFile(c, id);
    requireCapAt(c, 'requisitions.change_quantity', rec.siteId);
    if (rec.status === 'CANCELLED') throw requisitionError('CANCELLED', 'This requisition was cancelled.');
    if (rec.status === 'CLOSED') throw requisitionError('ALREADY_APPROVED', 'This requisition is closed.');
    const section = rec.sections.find((s) => s.lines.some((l) => l.id === lineId));
    const line = section?.lines.find((l) => l.id === lineId);
    if (!section || !line) throw new NotFoundError('Line not found');
    if (section.status !== 'SUBMITTED') throw stateConflict('SECTION_NOT_SENT', 'Only a sent section can be changed here.');
    if (rec.status === 'APPROVED') {
      if (!input.reason) throw requisitionError('REASON_REQUIRED', 'Say why the quantity changed.');
      if (await repo.hasDispatch(rec.id, rec.siteId, section.departmentId)) {
        throw requisitionError('DEPARTMENT_PACKED', 'This department has been packed, so its quantities are locked.');
      }
    }
    const from = (line.approvedQty ?? line.requestedQty ?? new Prisma.Decimal(0)).toString();
    const to = decimalOf(input.approvedQty);
    await prisma.$transaction(async (tx) => {
      await repo.updateLine(tx, rec.siteId, line.id, { approvedQty: to, editedById: actor.id, editReason: input.reason ?? null });
      await repo.appendEvent(tx, {
        requisitionId: rec.id, sectionId: section.id, type: 'QUANTITY_CHANGED', fromValue: from, toValue: to.toString(), reason: input.reason ?? null, lineId: line.id, ...event(c),
      });
    });
    requisitionNotices.publish({
      type: 'QUANTITY_CHANGED', requisitionId: rec.id, reference: rec.reference, siteId: rec.siteId, actorId: actor.id,
      departmentId: section.departmentId ?? '', departmentName: section.department?.name ?? '', itemName: line.item.name, from, to: to.toString(), reason: input.reason ?? null,
    });
    const fresh = await reload(c, rec);
    const viewer = await viewerFor(c, fresh, new Date());
    const freshSection = fresh.sections.find((s) => s.id === section.id) ?? section;
    const freshLine = freshSection.lines.find((l) => l.id === line.id) ?? line;
    return {
      ...mutation(fresh, false),
      line: lineWire(freshLine, freshSection, viewer),
      section: sectionSummaryWire(freshSection, fresh, viewer),
      ...currentValue(fileWire(fresh, viewer, null)),
    };
  },

  /** R17: remind a department's head. */
  nudge: async (actor: Actor, id: string, departmentId: string): Promise<NudgeResult> => {
    const c = await loadCaller(actor);
    const rec = await loadFile(c, id);
    requireCapAt(c, 'requisitions.nudge', rec.siteId);
    assertBeforeApproval(rec);
    const section = findSection(rec, departmentId);
    if (section.status === 'SUBMITTED') throw stateConflict('SECTION_ALREADY_SENT', 'This department has already sent.');
    if (!canSkip(section.status as SectionStatus)) throw stateConflict('SECTION_NOT_OPEN', 'This department was sent without its list.');
    const at = new Date();
    await prisma.$transaction((tx) => repo.appendEvent(tx, { requisitionId: rec.id, sectionId: section.id, type: 'NUDGED', ...event(c) }));
    requisitionNotices.publish({
      type: 'NUDGED', requisitionId: rec.id, reference: rec.reference, siteId: rec.siteId, actorId: actor.id, departmentId, departmentName: section.department?.name ?? '',
    });
    return { ...mutation(rec, false), nudgedAt: at.toISOString() };
  },

  /**
   * R18: "Send without these sections" (Amendment 2: a list). Every listed section is checked FIRST and nothing changes unless all
   * pass: a Sent section is `SECTION_ALREADY_SENT`, a Skipped one `SECTION_NOT_OPEN`. Then one transaction skips them all, with one
   * audit event per section, and recomputes Collecting or Ready to approve once.
   */
  skip: async (actor: Actor, id: string, departmentIds: string[]): Promise<SkipSectionResult> => {
    const c = await loadCaller(actor);
    const rec = await loadFile(c, id);
    requireCapAt(c, 'requisitions.nudge', rec.siteId);
    assertBeforeApproval(rec);
    const sections = departmentIds.map((departmentId) => findSection(rec, departmentId));
    for (const section of sections) {
      const status = section.status as SectionStatus;
      if (status === 'SUBMITTED') throw stateConflict('SECTION_ALREADY_SENT', `${section.department?.name ?? 'That department'} has already sent.`);
      if (!canSkip(status)) throw stateConflict('SECTION_NOT_OPEN', `${section.department?.name ?? 'That department'} was already sent without its list.`);
    }
    await prisma.$transaction(async (tx) => {
      const at = new Date();
      for (const section of sections) {
        await repo.removeSectionLines(tx, rec.siteId, section.id);
        await repo.updateSection(tx, rec.siteId, section.id, { status: 'SKIPPED', skippedAt: at, skippedById: actor.id });
        await repo.appendEvent(tx, { requisitionId: rec.id, sectionId: section.id, type: 'SKIPPED', ...event(c) });
      }
      await syncStatus(tx, rec.siteId, rec.id);
    });
    const fresh = await reload(c, rec);
    const viewer = await viewerFor(c, fresh, new Date());
    return {
      ...mutation(fresh, false),
      sections: departmentIds.map((departmentId) => sectionSummaryWire(findSection(fresh, departmentId), fresh, viewer)),
      readyToApprove: fresh.status === 'PENDING_APPROVAL',
    };
  },

  /** R19: approve and sign. The Branch Manager, or the Director and the System Admin with their own PIN. */
  approve: async (actor: Actor, id: string, input: ApproveInput, idempotencyKey: string): Promise<ApproveResult> => {
    const c = await loadCaller(actor);
    const rec = await loadFile(c, id);
    if (!mayApproveAt(c, rec.siteId)) throw new ForbiddenError('You do not have permission to approve this requisition');
    const done = async (replayed: boolean): Promise<ApproveResult> => {
      const fresh = await reload(c, rec);
      const viewer = await viewerFor(c, fresh, new Date());
      return {
        ...mutation(fresh, replayed),
        approvedAt: (fresh.approvedAt ?? new Date()).toISOString(),
        approvedBy: toPerson(fresh.approvedBy ?? { id: actor.id, name: c.staff.name, role: c.staff.role }),
        ...currentValue(fileWire(fresh, viewer, null)),
      };
    };
    if (await repo.findEventByKey(rec.id, rec.siteId, actor.id, idempotencyKey)) return done(true);
    const guard = guardApprove(rec.status as RequisitionStatus);
    if (guard === 'CANCELLED') throw requisitionError('CANCELLED', 'This requisition was cancelled.');
    if (guard === 'ALREADY_APPROVED') throw requisitionError('ALREADY_APPROVED', 'This requisition has already been signed.');
    if (guard === 'NOT_READY') throw requisitionError('NOT_READY_TO_APPROVE', 'Some departments have not sent yet.');
    await countPin.verifyOwn(actor, input.pin);

    try {
      await prisma.$transaction(async (tx) => {
        await repo.freezeForApproval(tx, rec.siteId, rec.id);
        // The signer is recorded as the approver; when it is not the Branch Manager the record also says who signed as (contract §2.3).
        await repo.setStatus(tx, rec.siteId, rec.id, 'APPROVED', {
          approvedById: actor.id,
          approvedAt: new Date(),
          approvedAsId: c.actor.role === 'MANAGER' ? null : actor.id,
        });
        // `fromValue` keeps how many lines the signature covered, so "Approved REQ-NYR-0112 · 40 lines" stays true as the file moves on.
        const signedLines = rec.sections.filter((s) => s.status === 'SUBMITTED').reduce((sum, s) => sum + s.lines.filter((l) => !l.additionId).length, 0);
        await repo.appendEvent(tx, { requisitionId: rec.id, type: 'APPROVED', fromValue: String(signedLines), toValue: SIGNED_AS[c.actor.role] ?? 'BRANCH_MANAGER', idempotencyKey, ...event(c) });
      });
      requisitionNotices.publish({
        type: 'APPROVED', requisitionId: rec.id, reference: rec.reference, siteId: rec.siteId, actorId: actor.id, signedAs: SIGNED_AS[c.actor.role] ?? 'BRANCH_MANAGER',
      });
      return await done(false);
    } catch (error) {
      if (isUniqueViolation(error)) return done(true);
      throw error;
    }
  },

  /** R20: cancel before approval; the file stays, marked Cancelled. */
  cancel: async (actor: Actor, id: string, input: CancelInput, idempotencyKey: string): Promise<CancelResult> => {
    const c = await loadCaller(actor);
    const rec = await loadFile(c, id);
    requireCapAt(c, 'requisitions.cancel', rec.siteId);
    const done = async (replayed: boolean): Promise<CancelResult> => {
      const fresh = await reload(c, rec);
      return { ...mutation(fresh, replayed), cancelledAt: (fresh.cancelledAt ?? new Date()).toISOString() };
    };
    if (await repo.findEventByKey(rec.id, rec.siteId, actor.id, idempotencyKey)) return done(true);
    assertBeforeApproval(rec);
    await countPin.verifyOwn(actor, input.pin);
    try {
      await prisma.$transaction(async (tx) => {
        await repo.setStatus(tx, rec.siteId, rec.id, 'CANCELLED', { cancelledAt: new Date(), cancelledById: actor.id, cancelReason: input.reason });
        await repo.appendEvent(tx, { requisitionId: rec.id, type: 'CANCELLED', reason: input.reason, idempotencyKey, ...event(c) });
      });
      requisitionNotices.publish({ type: 'CANCELLED', requisitionId: rec.id, reference: rec.reference, siteId: rec.siteId, actorId: actor.id, reason: input.reason });
      return await done(false);
    } catch (error) {
      if (isUniqueViolation(error)) return done(true);
      throw error;
    }
  },

  /** R21: a head adds lines after approval, while their department's dispatch is not signed. */
  addAddition: async (actor: Actor, id: string, input: AddAdditionInput, idempotencyKey: string): Promise<AddAdditionResult> => {
    const c = await loadCaller(actor);
    const rec = await loadFile(c, id);
    const departmentId = c.headDepartmentId;
    if (!departmentId || c.staff.siteId !== rec.siteId) throw requisitionError('NOT_YOUR_DEPARTMENT', 'Only a department head can add to a requisition.');
    const section = findSection(rec, departmentId);
    const done = async (replayed: boolean): Promise<AddAdditionResult> => {
      const fresh = await reload(c, rec);
      const mine = [...fresh.additions].reverse().find((a) => a.addedById === actor.id && a.departmentId === departmentId);
      if (!mine) throw new NotFoundError('Addition not found');
      return { ...mutation(fresh, replayed), addition: additionWire(mine, fresh, await viewerFor(c, fresh, new Date())) };
    };
    if (await repo.findEventByKey(rec.id, rec.siteId, actor.id, idempotencyKey)) return done(true);
    const guard = guardAfterApproval(rec.status as RequisitionStatus);
    if (guard === 'CANCELLED') throw requisitionError('CANCELLED', 'This requisition was cancelled.');
    if (guard === 'CLOSED') throw requisitionError('ADDITION_LOCKED', 'This requisition is closed. Start an Extra requisition.');
    if (guard === 'NOT_APPROVED') throw stateConflict('NOT_APPROVED', 'This requisition is not signed yet, so edit your section instead.');
    if (section.status !== 'SUBMITTED') throw stateConflict('SECTION_NOT_SENT', 'Your department did not send this requisition.');
    if (await repo.hasDispatch(rec.id, rec.siteId, section.departmentId)) {
      throw requisitionError('ADDITION_LOCKED', 'Your department has been dispatched. Start an Extra requisition.');
    }
    const tagged = await repo.findTaggedItemIds(rec.siteId, departmentId, input.lines.map((l) => l.itemId));
    const stray = input.lines.filter((l) => !tagged.has(l.itemId));
    if (stray.length > 0) throw requisitionError('ITEM_NOT_IN_DEPARTMENT', 'Some items are not tagged to this department.', { itemIds: stray.map((l) => l.itemId) });
    await countPin.verifyOwn(actor, input.pin);

    const items = (await repo.listTaggedItems(rec.siteId, departmentId)).filter((i) => input.lines.some((l) => l.itemId === i.id));
    const stock = await stockFor(rec.siteId, departmentId, items);
    try {
      const additionId = await prisma.$transaction(async (tx) => {
        const addition = await repo.createAddition(tx, { requisitionId: rec.id, departmentId, addedById: actor.id, sentPinSignedAt: new Date() });
        await repo.createLines(
          tx,
          section.id,
          input.lines.map((l) => {
            const s = stock.get(l.itemId);
            return { inventoryItemId: l.itemId, requestedQty: decimalOf(l.requestedQty), suggestedQty: null, parAtRequest: s?.level ?? null, onHandAtRequest: s?.onHand ?? null, additionId: addition.id };
          }),
        );
        await repo.appendEvent(tx, { requisitionId: rec.id, sectionId: section.id, type: 'ADDITION_ADDED', toValue: `${input.lines.length} lines`, idempotencyKey, ...event(c) });
        return addition.id;
      });
      requisitionNotices.publish({
        type: 'ADDITION_ADDED', requisitionId: rec.id, reference: rec.reference, siteId: rec.siteId, actorId: actor.id, additionId, departmentId, departmentName: section.department?.name ?? '',
      });
      return await done(false);
    } catch (error) {
      if (isUniqueViolation(error)) return done(true);
      throw error;
    }
  },

  /** R22: approve an addition. Its lines join the department's unsigned dispatch (the hand-off is Block 2's). */
  approveAddition: async (actor: Actor, id: string, additionId: string, input: ApproveAdditionInput, idempotencyKey: string): Promise<ApproveAdditionResult> => {
    const c = await loadCaller(actor);
    const rec = await loadFile(c, id);
    if (!mayApproveAt(c, rec.siteId)) throw new ForbiddenError('You do not have permission to approve this addition');
    const addition = rec.additions.find((a) => a.id === additionId);
    if (!addition) throw new NotFoundError('Addition not found');
    const done = async (replayed: boolean): Promise<ApproveAdditionResult> => {
      const fresh = await reload(c, rec);
      const mine = fresh.additions.find((a) => a.id === additionId);
      if (!mine) throw new NotFoundError('Addition not found');
      return { ...mutation(fresh, replayed), addition: additionWire(mine, fresh, await viewerFor(c, fresh, new Date())) };
    };
    if (await repo.findEventByKey(rec.id, rec.siteId, actor.id, idempotencyKey)) return done(true);
    if (rec.status === 'CANCELLED') throw requisitionError('CANCELLED', 'This requisition was cancelled.');
    if (rec.status !== 'APPROVED') throw stateConflict('NOT_APPROVED', 'This requisition is not signed yet, so there is nothing to add to.');
    if (addition.status !== 'PENDING') throw stateConflict('ADDITION_NOT_PENDING', 'This addition has already been decided.');
    const section = findSection(rec, addition.departmentId);
    if (await repo.hasDispatch(rec.id, rec.siteId, section.departmentId)) {
      throw requisitionError('ADDITION_LOCKED', "This department has been dispatched. The head should start an Extra requisition.");
    }
    await countPin.verifyOwn(actor, input.pin);
    try {
      await prisma.$transaction(async (tx) => {
        await repo.setAdditionStatus(tx, rec.siteId, addition.id, { status: 'APPROVED', approvedById: actor.id, approvedAt: new Date() });
        await repo.freezeAdditionLines(tx, rec.siteId, addition.id);
        await repo.appendEvent(tx, { requisitionId: rec.id, sectionId: section.id, type: 'ADDITION_APPROVED', idempotencyKey, ...event(c) });
      });
      await attachAdditionToDispatch(addition.id);
      requisitionNotices.publish({
        type: 'ADDITION_APPROVED', requisitionId: rec.id, reference: rec.reference, siteId: rec.siteId, actorId: actor.id, additionId, departmentId: addition.departmentId,
        departmentName: addition.department.name,
      });
      return await done(false);
    } catch (error) {
      if (isUniqueViolation(error)) return done(true);
      throw error;
    }
  },
};
