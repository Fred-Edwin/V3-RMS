import type { Request } from 'express';
import { Prisma, type DispatchStatus } from '@prisma/client';
import { prisma } from '../../../config/database';
import { branchRepository } from '../../../repositories/branch-repository';
import { ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from '../../../utils/errors';
import { actorCan } from '../_shared/central-store-access';
import { referenceCounterRepository } from '../_shared/reference-counter';
import { countPin } from '../counting/_shared/count-pin';
import { dayAsDate, nairobiDayEnd } from '../counting/_shared/count-time';
import { roleLabelOf, toPerson } from '../counting/_shared/count-people';
import { PHOTO_MAX_BYTES, PHOTO_MAX_PER_LINE, type DispatchFile } from '../dispatch/_shared/dispatch-contract';
import { dispatchRepository } from '../dispatch/dispatch-repository';
import { isUnsigned } from '../dispatch/dispatch-state';
import { fileWire, photoUrl as photoUrlOf } from '../dispatch/dispatch-view';
import { closeIfComplete } from '../requisitions/requisitions-handoff';
import { postStockMovement } from '../stock/ledger/ledger-door';
import { getDocumentStorage } from '../suppliers/supplier-storage';
import type {
  CheckCountResult,
  ConfirmDeliveryInput,
  ConfirmDeliveryResult,
  ConfirmPreview,
  CountLine,
  CountView,
  DeletePhotoResult,
  ListDeliveries,
  ListDeliveriesQuery,
  SaveCountInput,
  SetReasonInput,
  UploadPhotoFields,
  UploadPhotoResult,
} from './_shared/deliveries-contract';
import { deliveryError } from './deliveries-errors';
import { branchNotices } from './deliveries-notify';
import { photoKeyOf, safeFileName, sniffPhotoMime } from './deliveries-photos';
import { deliveriesRepository as repo, type DeliveryRecord, type DeliveryScope } from './deliveries-repository';
import { checkLine, confirmBlockerOf, differs, gapOf, isFinal, isOnBehalf, lineStateOf, canCheck } from './deliveries-state';
import { countFactsOf, countLineWire, countViewWire, differingOf, previewWire, rowWire } from './deliveries-view';

type Actor = NonNullable<Request['user']>;
type Tx = Prisma.TransactionClient;

const pad4 = (n: number): string => String(n).padStart(4, '0');
const isUniqueViolation = (error: unknown): boolean => error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
const PAST: DispatchStatus[] = ['CONFIRMED', 'CLOSED'];

// --- Who is calling ---------------------------------------------------------------------------------------------------------------

/**
 * A head or member of a branch department counts for THAT department (`deliveries.count`, a department rule held by no role in the
 * table); the Branch Manager counts and confirms for any department of their branch, recorded "on behalf" (`deliveries.confirm_on_behalf`).
 * Nobody else touches the branch side.
 */
interface Caller {
  actor: Actor;
  staff: NonNullable<Awaited<ReturnType<typeof repo.findStaff>>>;
  hubId: string;
  branchId: string;
  branchManager: boolean;
  departmentId: string | null;
}

const loadCaller = async (actor: Actor): Promise<Caller> => {
  const staff = await repo.findStaff(actor.id);
  if (!staff) throw new UnauthorizedError('Authentication required');
  const hub = await branchRepository.findHub();
  if (!hub) throw new ValidationError('No hub organization is configured');
  if (actor.role === 'MANAGER' && actorCan(actor, 'deliveries.confirm_on_behalf')) {
    if (!staff.siteId) throw new ValidationError('Branch context missing for this user');
    return { actor, staff, hubId: hub.id, branchId: staff.siteId, branchManager: true, departmentId: staff.departmentId };
  }
  if (staff.siteId && staff.departmentId && staff.siteId !== hub.id) {
    return { actor, staff, hubId: hub.id, branchId: staff.siteId, branchManager: false, departmentId: staff.departmentId };
  }
  throw new ForbiddenError('Only a branch department can count a delivery');
};

const scopeOf = (c: Caller): DeliveryScope => ({ hubId: c.hubId, toSiteId: c.branchId, ...(c.branchManager ? {} : { departmentId: c.departmentId ?? '' }) });

const loadDelivery = async (c: Caller, id: string, db: Tx | typeof prisma = prisma): Promise<DeliveryRecord> => {
  const rec = await repo.findForCount(id, { hubId: c.hubId, toSiteId: c.branchId }, db);
  if (!rec) throw new NotFoundError('Delivery not found');
  if (!c.branchManager && rec.departmentId !== c.departmentId) throw deliveryError('NOT_YOUR_DEPARTMENT', 'This delivery is for another department.');
  return rec;
};

/** V2 reads a delivery that is on the way; V3 to V6 write to it and say `ALREADY_CONFIRMED` when someone signed first. */
const assertOpen = (rec: Pick<DeliveryRecord, 'status'>, mode: 'read' | 'write'): void => {
  if (rec.status === 'ON_THE_WAY') return;
  if (rec.status === 'CANCELLED') throw deliveryError('DISPATCH_CANCELLED', 'The store cancelled this delivery.');
  if (rec.status === 'CONFIRMED' || rec.status === 'CLOSED') {
    throw mode === 'write' ? deliveryError('ALREADY_CONFIRMED', 'Someone has already confirmed this delivery.') : deliveryError('NOT_ON_THE_WAY', 'This delivery has already been confirmed.');
  }
  throw deliveryError('NOT_ON_THE_WAY', 'This delivery has not left the Central Store yet.');
};

const parentNamesOf = (rec: DeliveryRecord): Promise<Map<string, string>> =>
  repo.findCategoryNames([...new Set(rec.lines.flatMap((l) => (l.item.category?.parentCategoryId ? [l.item.category.parentCategoryId] : [])))]);

const viewOf = async (c: Caller, rec: DeliveryRecord): Promise<CountView> => countViewWire(rec, await parentNamesOf(rec), isOnBehalf(c.staff, rec.departmentId));

const lineIdsOf = (rec: DeliveryRecord): Set<string> => new Set(rec.lines.map((l) => l.id));

const reasonsComplete = (rec: DeliveryRecord): boolean => rec.lines.every((l) => !(isFinal(countFactsOf(l)) && differs(countFactsOf(l))) || l.countReason !== null);

/** Why V5 and V6 cannot go on, for the lines as they stand; REASON_REQUIRED is the confirm's own check (V5 answers `canConfirm: false`). */
const blockerOf = (rec: DeliveryRecord) => confirmBlockerOf(rec.lines.map((l) => ({ ...countFactsOf(l), hasReason: l.countReason !== null })));

const throwBlocker = (blocker: ReturnType<typeof blockerOf>, rec: DeliveryRecord): void => {
  if (blocker === 'NOT_COUNTED') throw deliveryError('NOT_COUNTED', 'Count every line first.', { lineIds: rec.lines.filter((l) => l.countedQty === null).map((l) => l.id) });
  if (blocker === 'COUNT_AGAIN_PENDING') throw deliveryError('COUNT_AGAIN_PENDING', 'Count the flagged lines again and check them first.', { lineIds: rec.lines.filter((l) => !isFinal(countFactsOf(l))).map((l) => l.id) });
  if (blocker === 'REASON_REQUIRED') throw deliveryError('REASON_REQUIRED', 'Pick a reason for every line that is different.', { lineIds: rec.lines.filter((l) => differs(countFactsOf(l)) && l.countReason === null).map((l) => l.id) });
};

// --- The service ---------------------------------------------------------------------------------------------------------------

export const deliveriesService = {
  /**
   * V7 GET /:id: the department's own read-only delivery file (what a My deliveries row opens). It is the same file as P6, built by the
   * same function, so the rules are decided in one place: a department caller is always branch side, so the sent figure, the gap and
   * every total stay out until the count is signed, and money only reaches a holder of `requisitions.see_value`. A member or head
   * reads their own department's file; the Branch Manager any department of the branch. The other departments' dispatches are not
   * listed and the delivery note is not offered (a member holds no `dispatch.read`).
   */
  file: async (actor: Actor, id: string, now: Date = new Date()): Promise<DispatchFile> => {
    const c = await loadCaller(actor);
    const rec = await dispatchRepository.findFile(id, { hubId: c.hubId, toSiteId: c.branchId });
    if (!rec) throw new NotFoundError('Delivery not found');
    if (!c.branchManager && rec.departmentId !== c.departmentId) throw deliveryError('NOT_YOUR_DEPARTMENT', 'This delivery is for another department.');
    if (isUnsigned(rec.status)) throw deliveryError('NOT_ON_THE_WAY', 'This delivery has not left the Central Store yet.');
    const parentNames = await repo.findCategoryNames([...new Set(rec.lines.flatMap((l) => (l.item.category?.parentCategoryId ? [l.item.category.parentCategoryId] : [])))]);
    return fileWire(rec, {
      now,
      seeValue: actorCan(actor, 'requisitions.see_value'),
      branchSide: true,
      canPack: false,
      canPrint: false,
      canCancel: false,
      canRecordFinding: false,
      canConfirmForDepartment: c.branchManager && actorCan(actor, 'deliveries.confirm_on_behalf'),
      parentNames,
      siblings: [],
    });
  },

  /** V1 GET /mine: waiting and past deliveries of the caller's department (the Branch Manager: every department of the branch). */
  list: async (actor: Actor, query: ListDeliveriesQuery, now: Date = new Date()): Promise<ListDeliveries> => {
    const c = await loadCaller(actor);
    const scope = scopeOf(c);
    const waiting = query.tab === 'waiting';
    const [page, waitingCount, pastCount] = await Promise.all([
      repo.list(scope, {
        statuses: waiting ? ['ON_THE_WAY'] : PAST,
        dateField: waiting ? 'signedAt' : 'countedAt',
        ...(query.from ? { from: dayAsDate(query.from) } : {}),
        ...(query.to ? { to: nairobiDayEnd(dayAsDate(query.to)) } : {}),
        ...(!waiting && query.result ? { result: query.result } : {}),
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      repo.count(scope, ['ON_THE_WAY']),
      repo.count(scope, PAST),
    ]);
    const viewer = { now, branchManager: c.branchManager, departmentId: c.departmentId };
    return {
      tab: query.tab,
      rows: page.rows.map((r) => rowWire(r, viewer)),
      tabCounts: { waiting: waitingCount, past: pastCount },
      page: { page: query.page, pageSize: query.pageSize, total: page.total },
    };
  },

  /** V2 GET /:id/count: the blind count view. The first read by someone from the department stamps `arrivedAt`. */
  getCount: async (actor: Actor, id: string, now: Date = new Date()): Promise<CountView> => {
    const c = await loadCaller(actor);
    const rec = await loadDelivery(c, id);
    assertOpen(rec, 'read');
    let current = rec;
    // "Arrived 3:28 pm" is when the department's own people first opened it; the Branch Manager looking in does not count as arrival.
    if (!c.branchManager && rec.arrivedAt === null && (await repo.stampArrived(rec.id, c.hubId, now))) {
      current = { ...rec, arrivedAt: now };
      void branchNotices.arrived({ hubId: c.hubId, branchId: c.branchId, dispatchId: rec.id, reference: rec.reference });
    }
    return viewOf(c, current);
  },

  /** V3 PUT /:id/count: stores what was typed and never says whether it matches. A line that is already final is refused (RECOUNT_USED). */
  saveCount: async (actor: Actor, id: string, input: SaveCountInput): Promise<CountView> => {
    const c = await loadCaller(actor);
    await loadDelivery(c, id);
    const rec = await prisma.$transaction(async (tx) => {
      await repo.lockDispatch(tx, id);
      const fresh = await loadDelivery(c, id, tx);
      assertOpen(fresh, 'write');
      const known = lineIdsOf(fresh);
      const unknown = input.counts.filter((l) => !known.has(l.lineId));
      if (unknown.length > 0) throw new NotFoundError('Line not found', 'NOT_FOUND', { lineIds: unknown.map((l) => l.lineId) });
      const byId = new Map(fresh.lines.map((l) => [l.id, l]));
      const locked = input.counts.filter((l) => {
        const line = byId.get(l.lineId);
        return line !== undefined && isFinal(countFactsOf(line));
      });
      if (locked.length > 0) throw deliveryError('RECOUNT_USED', 'That line has been counted twice. The second count is final.', { lineIds: locked.map((l) => l.lineId) });
      for (const l of input.counts) await repo.saveCount(tx, l.lineId, new Prisma.Decimal(l.countedQty));
      return loadDelivery(c, id, tx);
    });
    return viewOf(c, rec);
  },

  /**
   * V3 POST /:id/check: the moment of comparison. A line that differs for the first time is flagged (COUNT_AGAIN); a line that still
   * differs at the second check is final (SHORT or EXTRA); a line that matches is final at once. The answer lists only the lines
   * that differ, with the way they differ, never the sent figure and never the size.
   */
  check: async (actor: Actor, id: string): Promise<CheckCountResult> => {
    const c = await loadCaller(actor);
    await loadDelivery(c, id);
    const rec = await prisma.$transaction(async (tx) => {
      await repo.lockDispatch(tx, id);
      const fresh = await loadDelivery(c, id, tx);
      assertOpen(fresh, 'write');
      if (!canCheck(fresh.lines)) throw deliveryError('NOT_COUNTED', 'Count every line first.', { lineIds: fresh.lines.filter((l) => l.countedQty === null).map((l) => l.id) });
      for (const line of fresh.lines) {
        const next = checkLine(countFactsOf(line));
        if (next.checkCount !== line.checkCount || next.countedTwice) await repo.applyCheck(tx, line.id, next);
      }
      return loadDelivery(c, id, tx);
    });
    const view = await viewOf(c, rec);
    return { differing: differingOf(rec), final: !rec.lines.some((l) => lineStateOf(countFactsOf(l)) === 'COUNT_AGAIN'), reasonsComplete: reasonsComplete(rec), view };
  },

  /** V4 PUT /:id/lines/:lineId/reason: only a line whose difference is final. */
  setReason: async (actor: Actor, id: string, lineId: string, input: SetReasonInput): Promise<CountLine> => {
    const c = await loadCaller(actor);
    await loadDelivery(c, id);
    const rec = await prisma.$transaction(async (tx) => {
      await repo.lockDispatch(tx, id);
      const fresh = await loadDelivery(c, id, tx);
      assertOpen(fresh, 'write');
      const line = fresh.lines.find((l) => l.id === lineId);
      if (!line) throw new NotFoundError('Line not found');
      const state = lineStateOf(countFactsOf(line));
      if (state !== 'SHORT' && state !== 'EXTRA') throw deliveryError('LINE_NOT_DIFFERENT', 'A reason belongs on a line that is different after the second count.');
      await repo.setReason(tx, lineId, input.reason, input.note ?? null);
      return loadDelivery(c, id, tx);
    });
    const line = rec.lines.find((l) => l.id === lineId);
    if (!line) throw new NotFoundError('Line not found');
    return countLineWire(line, await parentNamesOf(rec));
  },

  /** V4 POST /:id/photos: one JPEG, PNG or WebP of at most 5 MB on a different line, three at most per line. */
  uploadPhoto: async (actor: Actor, id: string, fields: UploadPhotoFields, file: { buffer: Buffer; originalname: string; size: number } | undefined): Promise<UploadPhotoResult> => {
    const c = await loadCaller(actor);
    if (!file) throw new ValidationError('Attach a photo');
    if (file.size > PHOTO_MAX_BYTES) throw deliveryError('PHOTO_TOO_LARGE', 'That photo is too large. The limit is 5 MB.');
    const mime = sniffPhotoMime(file.buffer);
    if (!mime) throw deliveryError('PHOTO_TYPE_NOT_ALLOWED', 'Only JPEG, PNG or WebP photos can be attached.');
    const rec = await loadDelivery(c, id);
    assertOpen(rec, 'write');
    const objectKey = photoKeyOf(c.hubId, rec.id, mime);
    const storage = getDocumentStorage();
    await storage.putObject(objectKey, file.buffer, mime);
    try {
      const created = await prisma.$transaction(async (tx) => {
        await repo.lockDispatch(tx, id);
        const fresh = await loadDelivery(c, id, tx);
        assertOpen(fresh, 'write');
        const line = fresh.lines.find((l) => l.id === fields.lineId);
        if (!line) throw new NotFoundError('Line not found');
        const state = lineStateOf(countFactsOf(line));
        if (state !== 'SHORT' && state !== 'EXTRA') throw deliveryError('LINE_NOT_DIFFERENT', 'A photo belongs on a line that is different after the second count.');
        if ((await repo.countPhotos(line.id, tx)) >= PHOTO_MAX_PER_LINE) throw deliveryError('TOO_MANY_PHOTOS', `A line can have ${PHOTO_MAX_PER_LINE} photos at most.`);
        return repo.createPhoto(tx, { hubId: c.hubId, lineId: line.id, objectKey, fileName: safeFileName(file.originalname), mimeType: mime, sizeBytes: file.size, uploadedById: actor.id });
      });
      const photos = (await repo.listLinePhotos(fields.lineId)).map((p) => ({ id: p.id, url: photoUrlOf(p.id) }));
      return { lineId: fields.lineId, photo: { id: created.id, url: photoUrlOf(created.id) }, photos };
    } catch (error) {
      await storage.deleteObject(objectKey).catch(() => undefined);
      throw error;
    }
  },

  /** DELETE /:id/photos/:photoId: removes a mistaken photo before the confirm. */
  deletePhoto: async (actor: Actor, id: string, photoId: string): Promise<DeletePhotoResult> => {
    const c = await loadCaller(actor);
    const rec = await loadDelivery(c, id);
    assertOpen(rec, 'write');
    const photo = await repo.findPhoto(photoId, c.hubId);
    if (!photo || photo.line.dispatchId !== rec.id) throw new NotFoundError('Photo not found');
    await repo.deletePhoto(photo.id);
    await getDocumentStorage().deleteObject(photo.objectKey).catch(() => undefined);
    return { lineId: photo.dispatchLineId, photos: (await repo.listLinePhotos(photo.dispatchLineId)).map((p) => ({ id: p.id, url: photoUrlOf(p.id) })) };
  },

  /**
   * GET /photos/:photoId: the bytes of one photo for a signed-in reader. The delivery's own department and the Branch Manager of the
   * branch, and the hub roles that read discrepancies, may see it; anyone else is told it does not exist.
   */
  readPhoto: async (actor: Actor, photoId: string): Promise<{ body: Buffer; contentType: string }> => {
    const hub = await branchRepository.findHub();
    if (!hub) throw new ValidationError('No hub organization is configured');
    const photo = await repo.findPhoto(photoId, hub.id);
    if (!photo) throw new NotFoundError('Photo not found');
    const staff = await repo.findStaff(actor.id);
    if (!staff) throw new UnauthorizedError('Authentication required');
    const dispatch = photo.line.dispatch;
    const hubReader = actor.role !== 'MANAGER' && actorCan(actor, 'discrepancies.read');
    const ownBranch = staff.siteId === dispatch.toSiteId;
    const ownDepartment = ownBranch && (actor.role === 'MANAGER' || staff.departmentId === dispatch.departmentId);
    if (!hubReader && !ownDepartment) throw new NotFoundError('Photo not found');
    const stored = await getDocumentStorage().getObject(photo.objectKey);
    if (!stored) throw new NotFoundError('Photo not found');
    return { body: stored.body, contentType: photo.mimeType };
  },

  /** V5 GET /:id/confirm-preview: the summary, and the ONLY place the sent figure is told before the signature. */
  confirmPreview: async (actor: Actor, id: string): Promise<ConfirmPreview> => {
    const c = await loadCaller(actor);
    const rec = await loadDelivery(c, id);
    assertOpen(rec, 'write');
    const blocker = blockerOf(rec);
    if (blocker === 'NOT_COUNTED' || blocker === 'COUNT_AGAIN_PENDING') throwBlocker(blocker, rec);
    return previewWire(rec, toPerson(c.staff), isOnBehalf(c.staff, rec.departmentId));
  },

  /**
   * V6 POST /:id/confirm: signs the count. ONE transaction: `DISPATCH_IN` for the counted quantity of every line through the ledger
   * door at the department's stock, the gap held as unaccounted (neither side's stock), one `DSC-` per differing line, the events.
   * A repeated idempotencyKey by the same person returns the first result; a second member signing is `ALREADY_CONFIRMED`.
   */
  confirm: async (actor: Actor, id: string, input: ConfirmDeliveryInput, now: Date = new Date()): Promise<ConfirmDeliveryResult> => {
    const c = await loadCaller(actor);
    const replay = await deliveriesService.replayConfirm(c, id, input.idempotencyKey);
    if (replay) return replay;

    const rec = await loadDelivery(c, id);
    const onBehalf = isOnBehalf(c.staff, rec.departmentId);
    if (input.onBehalf === true && !onBehalf) throw deliveryError('ON_BEHALF_NOT_ALLOWED', 'Only the Branch Manager can confirm for a department.');
    assertOpen(rec, 'write');
    throwBlocker(blockerOf(rec), rec);
    const holder = await countPin.verifyOwn(actor, input.pin);
    const code = rec.toSite.code;
    if (!code) throw new ValidationError('This branch has no code yet, so a discrepancy cannot be numbered');
    const roleLabel = roleLabelOf(holder.role);

    const opened: Array<{ id: string; reference: string; itemName: string; gapQty: string }> = [];
    try {
      await prisma.$transaction(async (tx) => {
        await repo.lockDispatch(tx, id);
        const fresh = await loadDelivery(c, id, tx);
        assertOpen(fresh, 'write');
        throwBlocker(blockerOf(fresh), fresh);
        const location = await repo.ensureDepartmentLocation(tx, fresh.toSiteId, fresh.departmentId);
        if (!location) throw new ValidationError(`${fresh.department.name} is not a department of this branch`);
        if (!(await repo.markConfirmed(tx, fresh.id, { countedById: actor.id, countedAt: now, onBehalf }))) {
          throw deliveryError('ALREADY_CONFIRMED', 'Someone has already confirmed this delivery.');
        }
        let tick = 0;
        const at = (): Date => new Date(now.getTime() + tick++);
        await dispatchRepository.createEvent(tx, {
          dispatchId: fresh.id,
          type: onBehalf ? 'DELIVERY_CONFIRMED_ON_BEHALF' : 'DELIVERY_CONFIRMED',
          actorId: actor.id,
          actorRoleLabel: roleLabel,
          idempotencyKey: input.idempotencyKey,
          at: at(),
        });
        for (const line of fresh.lines) {
          if (line.countedQty === null) continue;
          if (line.countedQty.greaterThan(0)) {
            await postStockMovement(tx, {
              type: 'DISPATCH_IN',
              locationId: location.id,
              inventoryItemId: line.inventoryItemId,
              quantity: line.countedQty,
              unitCost: line.unitCostAtDispatch ?? line.item.currentCost,
              userId: actor.id,
              links: { dispatchLineId: line.id },
            });
          }
          if (!differs(countFactsOf(line))) continue;
          const reference = `DSC-${code}-${pad4(await referenceCounterRepository.nextNumber(tx, fresh.toSiteId, 'DSC'))}`;
          const gap = gapOf({ sentQty: line.sentQty, countedQty: line.countedQty });
          const created = await repo.createDiscrepancy(tx, { hubId: fresh.siteId, toSiteId: fresh.toSiteId, dispatchId: fresh.id, dispatchLineId: line.id, reference, gapQty: gap });
          await repo.createDiscrepancyEvent(tx, { discrepancyId: created.id, type: 'OPENED', actorId: actor.id, actorRoleLabel: roleLabel, at: now });
          await dispatchRepository.createEvent(tx, { dispatchId: fresh.id, type: 'DISCREPANCY_OPENED', actorId: actor.id, actorRoleLabel: roleLabel, reason: reference, at: at() });
          opened.push({ id: created.id, reference, itemName: line.item.name, gapQty: gap.toString() });
        }
      });
    } catch (error) {
      // The same key racing the first call: the unique event decides, the loser returns the winner's result.
      if (isUniqueViolation(error)) {
        const again = await deliveriesService.replayConfirm(c, id, input.idempotencyKey);
        if (again) return again;
        throw deliveryError('ALREADY_CONFIRMED', 'Someone has already confirmed this delivery.');
      }
      throw error;
    }

    // A delivery with nothing held closes now (and the requisition when every department has); best effort, it never undoes the signature.
    await closeIfComplete(rec.requisitionId);
    void branchNotices.confirmed({ hubId: c.hubId, branchId: c.branchId, branchName: rec.toSite.name, dispatchId: rec.id, dispatchReference: rec.reference ?? '', departmentName: rec.department.name, discrepancies: opened });
    const result = await deliveriesService.confirmResultOf(c, id, false);
    if (!result) throw new NotFoundError('Delivery not found');
    return result;
  },

  /** The first result of a confirm with this key, or null when the key was not used. */
  replayConfirm: async (c: Caller, id: string, idempotencyKey: string): Promise<ConfirmDeliveryResult | null> => {
    const event = await repo.findConfirmEvent(c.hubId, id, c.actor.id, idempotencyKey);
    if (!event) return null;
    return deliveriesService.confirmResultOf(c, id, true);
  },

  confirmResultOf: async (c: Caller, id: string, replayed: boolean): Promise<ConfirmDeliveryResult | null> => {
    const rec = await repo.findForCount(id, { hubId: c.hubId, toSiteId: c.branchId });
    if (!rec || !rec.signedAt || !rec.countedAt || !rec.countedBy || (rec.status !== 'CONFIRMED' && rec.status !== 'CLOSED')) return null;
    const itemOf = new Map(rec.lines.map((l) => [l.id, l.item.name]));
    return {
      id: rec.id,
      reference: rec.reference ?? '',
      status: rec.status,
      signedAt: rec.signedAt.toISOString(),
      arrivedAt: rec.arrivedAt ? rec.arrivedAt.toISOString() : null,
      confirmedAt: rec.countedAt.toISOString(),
      confirmedBy: toPerson(rec.countedBy),
      onBehalfOfDepartment: rec.onBehalf ? { id: rec.department.id, name: rec.department.name } : null,
      lineCount: rec.lines.length,
      matchedCount: rec.lines.filter((l) => !differs(countFactsOf(l))).length,
      discrepancies: rec.discrepancies.map((d) => ({ id: d.id, reference: d.reference, itemName: itemOf.get(d.dispatchLineId) ?? '', gapQty: d.gapQty.toString() })),
      replayed,
    };
  },
};
