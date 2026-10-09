import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { toPerson } from '../counting/_shared/count-people';
import type {
  DispatchActivityEvent,
  DispatchEventType,
  DispatchFile,
  DispatchItem,
  PackLine,
  PrintDispatch,
  QueueCard,
  Review,
} from './_shared/dispatch-contract';
import { DISPATCH_EVENT_TYPES } from './_shared/dispatch-contract';
import type { DispatchRecord, PackDispatchLine } from './dispatch-repository';
import { canCancelDispatch, dispatchTrackerOf, isShort, nextActionOf, sentVisibleTo, stageOf } from './dispatch-state';

/**
 * The wire shapes of Dispatch (docs/features/inventory/dispatch-contract.md §4 and §9) built from the records. The blind rule and the
 * money rule are decided HERE, once: a key the caller may not see is left out (absent, never null), and the branch side never gets
 * the sent figure, the gap or a money total before its department has signed its count.
 */

const dec = (v: Prisma.Decimal): string => v.toString();
const kes = (v: Prisma.Decimal): string => v.toFixed(2);
const iso = (d: Date): string => d.toISOString();
const isoOrNull = (d: Date | null): string | null => (d ? d.toISOString() : null);

/** A stable uuid from a seed: the delivery-note versions of the Documents tab have no table of their own. */
export const derivedUuid = (seed: string): string => {
  const h = createHash('sha1').update(seed).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

/** An authenticated link to a delivery photo; the route (`GET /inventory/deliveries/photos/:photoId`) is served by the Deliveries module. */
export const photoUrl = (photoId: string): string => `/inventory/deliveries/photos/${photoId}`;

/** "Category names from the top": the parent category (when it has one), then the item's own. */
export const categoryPathOf = (category: { name: string; parentCategoryId: string | null } | null, parentNames: ReadonlyMap<string, string>): string[] => {
  const parent = category?.parentCategoryId ? parentNames.get(category.parentCategoryId) : undefined;
  return [...(parent ? [parent] : []), ...(category ? [category.name] : [])];
};

type ItemWithCategory = PackDispatchLine['item'];

export const packLineWire = (
  line: PackDispatchLine,
  onHand: Prisma.Decimal,
  parentNames: ReadonlyMap<string, string>,
  addedAfterApproval: boolean,
): PackLine => ({
  lineId: line.requisitionLineId ?? line.id,
  itemId: line.inventoryItemId,
  itemName: line.item.name,
  unit: line.item.usageUnit,
  categoryPath: categoryPathOf((line.item as ItemWithCategory).category, parentNames),
  requestedQty: dec(line.requestedQty),
  onHand: dec(onHand),
  sentQty: dec(line.sentQty),
  packedTick: line.packedTick,
  short: isShort(line.sentQty, line.requestedQty),
  addedAfterApproval,
});

export const queueCardWire = (card: QueueCard): QueueCard => card;

export const reviewWire = (r: Review): Review => r;

// --- The file (P6) ---------------------------------------------------------------------------------------------------------------

export interface FileViewer {
  now: Date;
  /** The caller holds `requisitions.see_value`. */
  seeValue: boolean;
  /** The Branch Manager reading a branch's dispatch. */
  branchSide: boolean;
  canPack: boolean;
  /** The caller may open the delivery note (P7 needs `dispatch.read`; a department member reading V7 does not hold it). */
  canPrint: boolean;
  canCancel: boolean;
  canRecordFinding: boolean;
  canConfirmForDepartment: boolean;
  parentNames: ReadonlyMap<string, string>;
  siblings: Array<{ id: string; reference: string | null; departmentName: string; stage: DispatchFile['stage'] }>;
}

const EVENT_TYPES: ReadonlySet<string> = new Set(DISPATCH_EVENT_TYPES);

const sentenceOf = (type: DispatchEventType, rec: DispatchRecord): string => {
  const ref = rec.reference ?? 'the dispatch';
  const dept = rec.department.name;
  switch (type) {
    case 'SIGNED_AND_SENT':
      return `Signed and sent ${ref} · ${rec.lines.length} ${rec.lines.length === 1 ? 'line' : 'lines'}${rec.carrier ? ` · carried by ${rec.carrier.name}` : ''}`;
    case 'CANCELLED':
      return `Cancelled ${ref}`;
    case 'DELIVERY_CONFIRMED':
      return `${dept} counted the delivery`;
    case 'DELIVERY_CONFIRMED_ON_BEHALF':
      return `Confirmed the delivery for ${dept}`;
    case 'DISCREPANCY_OPENED':
      return 'A gap was held as unaccounted';
    case 'FINDING_RECORDED':
      return 'A finding was recorded';
    case 'FINDING_REVERSED':
      return 'A finding was reversed';
    case 'CLOSED':
      return `Closed ${ref}`;
  }
};

const activityOf = (rec: DispatchRecord): DispatchActivityEvent[] =>
  rec.events.flatMap((e) =>
    EVENT_TYPES.has(e.type)
      ? [
          {
            id: e.id,
            type: e.type as DispatchEventType,
            at: iso(e.at),
            actor: toPerson(e.actor),
            sentence: sentenceOf(e.type as DispatchEventType, rec),
            link: rec.reference ? { kind: 'DISPATCH' as const, id: rec.id, reference: rec.reference } : null,
            reason: e.reason,
          },
        ]
      : [],
  );

const shortCountOf = (lines: ReadonlyArray<{ sentQty: Prisma.Decimal; requestedQty: Prisma.Decimal }>): number => lines.filter((l) => isShort(l.sentQty, l.requestedQty)).length;

export const gapHeldOf = (discrepancies: ReadonlyArray<{ status: 'OPEN' | 'RECORDED' | 'REVERSED' }>): boolean => discrepancies.some((d) => d.status !== 'RECORDED');

export const fileWire = (rec: DispatchRecord, v: FileViewer): DispatchFile => {
  const visible = sentVisibleTo({ branchSide: v.branchSide }, rec);
  const gapHeld = gapHeldOf(rec.discrepancies);
  const stage = stageOf({ status: rec.status, signedAt: rec.signedAt, allTicked: rec.lines.every((l) => l.packedTick), gapHeld }, v.now);
  const signedBy = rec.signedBy ? toPerson(rec.signedBy) : null;
  const packedBy = rec.packedBy ? toPerson(rec.packedBy) : signedBy;
  const carrier = rec.carrier ? { id: rec.carrier.id, name: rec.carrier.name, kind: rec.carrier.kind } : null;
  const openDiscrepancy = rec.discrepancies.find((d) => d.status !== 'RECORDED') ?? null;
  const lossValue = rec.discrepancies.reduce((sum, d) => sum.add(d.lossValue ?? 0), new Prisma.Decimal(0));
  const items: DispatchItem[] = rec.lines.map((line) => {
    const counted = rec.countedAt !== null && line.countedQty !== null ? line.countedQty : null;
    const gap = counted !== null ? counted.minus(line.sentQty) : null;
    const cost = line.unitCostAtDispatch;
    return {
      lineId: line.id,
      itemId: line.inventoryItemId,
      itemName: line.item.name,
      unit: line.item.usageUnit,
      categoryPath: categoryPathOf(line.item.category, v.parentNames),
      requestedQty: dec(line.requestedQty),
      ...(visible ? { sentQty: dec(line.sentQty) } : {}),
      countedQty: counted !== null ? dec(counted) : null,
      ...(visible ? { gapQty: gap !== null ? dec(gap) : null } : {}),
      countedTwice: line.countedTwice,
      countReason: line.countReason,
      countReasonNote: line.countReasonNote,
      photos: line.photos.map((p) => ({ id: p.id, url: photoUrl(p.id) })),
      discrepancy: line.discrepancy ? { id: line.discrepancy.id, reference: line.discrepancy.reference, status: line.discrepancy.status } : null,
      ...(v.seeValue && cost ? { unitCostKes: kes(cost) } : {}),
      ...(v.seeValue && cost && visible ? { valueKes: kes(cost.mul(line.sentQty)) } : {}),
    };
  });
  const value = rec.lines.reduce((sum, l) => sum.add(l.unitCostAtDispatch ? l.unitCostAtDispatch.mul(l.sentQty) : 0), new Prisma.Decimal(0));
  const reference = rec.reference ?? '';
  const documents = rec.signedAt && signedBy
    ? (['DELIVERY_NOTE_STORE', 'DELIVERY_NOTE_BRANCH'] as const).map((kind) => ({ id: derivedUuid(`${rec.id}:${kind}`), kind, at: iso(rec.signedAt as Date), by: signedBy, voided: rec.status === 'CANCELLED' }))
    : [];
  return {
    id: rec.id,
    reference,
    requisition: { id: rec.requisition.id, reference: rec.requisition.reference },
    branch: { id: rec.toSite.id, name: rec.toSite.name, code: rec.toSite.code },
    department: { id: rec.department.id, name: rec.department.name },
    status: rec.status,
    stage,
    lineCount: rec.lines.length,
    // The count of short lines would give the sent figure away, so a blind caller gets 0 (`sentVisible` says why).
    shortCount: visible ? shortCountOf(rec.lines) : 0,
    carrier: carrier ?? { id: derivedUuid(`${rec.id}:no-carrier`), name: '', kind: 'PERSON' },
    packed: { by: packedBy ?? emptyPerson, at: iso(rec.packedAt ?? rec.signedAt ?? rec.createdAt) },
    signed: { by: signedBy ?? emptyPerson, at: iso(rec.signedAt ?? rec.createdAt) },
    sendBatchId: rec.sendBatchId ?? derivedUuid(`${rec.id}:no-batch`),
    packedAt: iso(rec.packedAt ?? rec.signedAt ?? rec.createdAt),
    arrivedAt: isoOrNull(rec.arrivedAt),
    countedById: rec.countedById,
    countedAt: isoOrNull(rec.countedAt),
    onBehalf: rec.onBehalf,
    ...(v.seeValue && visible && rec.discrepancies.some((d) => d.lossValue !== null) ? { lossValueKes: kes(lossValue) } : {}),
    counted: rec.countedBy && rec.countedAt ? { by: toPerson(rec.countedBy), at: iso(rec.countedAt) } : null,
    onBehalfOfDepartment: rec.onBehalf ? { id: rec.department.id, name: rec.department.name } : null,
    cancelled: rec.cancelledAt && rec.cancelledBy ? { at: iso(rec.cancelledAt), by: toPerson(rec.cancelledBy), reason: rec.cancelReason ?? '' } : null,
    closedAt: isoOrNull(rec.closedAt),
    siblings: v.siblings.map((s) => ({ id: s.id, reference: s.reference ?? '', departmentName: s.departmentName, stage: s.stage })),
    tracker: dispatchTrackerOf({
      status: rec.status,
      approvedAt: rec.requisition.approvedAt,
      approvedBy: rec.requisition.approvedBy ? toPerson(rec.requisition.approvedBy) : null,
      packedAt: rec.packedAt,
      packedBy,
      signedAt: rec.signedAt,
      signedBy,
      carrier,
      countedAt: rec.countedAt,
      countedBy: rec.countedBy ? toPerson(rec.countedBy) : null,
      closedAt: rec.closedAt,
    }),
    nextStep: {
      action: nextActionOf({ stage, canPack: v.canPack, canRecordFinding: v.canRecordFinding && openDiscrepancy !== null, canConfirmForDepartment: v.canConfirmForDepartment }),
      facts: {
        gapLineCount: visible ? rec.lines.filter((l) => l.countedQty !== null && !l.countedQty.equals(l.sentQty)).length : 0,
        discrepancyId: openDiscrepancy ? openDiscrepancy.id : null,
        waitingSince: rec.status === 'ON_THE_WAY' ? isoOrNull(rec.signedAt) : null,
      },
    },
    sentVisible: visible,
    items,
    documents,
    activity: activityOf(rec),
    ...(v.seeValue && visible ? { valueKes: kes(value) } : {}),
    can: {
      print: v.canPrint && rec.signedAt !== null,
      cancel: v.canCancel && canCancelDispatch(rec),
      recordFinding: v.canRecordFinding && openDiscrepancy !== null,
      confirmForDepartment: v.canConfirmForDepartment && rec.status === 'ON_THE_WAY' && rec.countedAt === null,
    },
  };
};

/** A placeholder for a stamp that does not exist yet (an unsigned dispatch is never served by P6, so this only guards the type). */
const emptyPerson = { id: '', name: '', initials: '', roleLabel: '' };

// --- The print data (P7) ---------------------------------------------------------------------------------------------------------

export const printWire = (rec: DispatchRecord, copy: 'store' | 'branch', now: Date): PrintDispatch => {
  const signedBy = rec.signedBy ? toPerson(rec.signedBy) : emptyPerson;
  const packedBy = rec.packedBy ? toPerson(rec.packedBy) : signedBy;
  const signedAt = rec.signedAt ?? rec.createdAt;
  const header = {
    reference: rec.reference ?? '',
    voided: rec.status === 'CANCELLED',
    cancelledAt: isoOrNull(rec.cancelledAt),
    requisitionReference: rec.requisition.reference,
    branch: { id: rec.toSite.id, name: rec.toSite.name, code: rec.toSite.code },
    department: { id: rec.department.id, name: rec.department.name },
    date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' }).format(signedAt),
    carrier: rec.carrier ? { id: rec.carrier.id, name: rec.carrier.name, kind: rec.carrier.kind } : { id: derivedUuid(`${rec.id}:no-carrier`), name: '', kind: 'PERSON' as const },
    packed: { by: packedBy, at: iso(rec.packedAt ?? signedAt) },
    signed: { by: signedBy, at: iso(signedAt) },
    generatedAt: iso(now),
    qrPayload: `/app/inventory/dispatch/${rec.id}`,
  };
  if (copy === 'store') {
    return {
      copy: 'store',
      ...header,
      lines: rec.lines.map((l, i) => ({ n: i + 1, itemName: l.item.name, unit: l.item.usageUnit, requestedQty: dec(l.requestedQty), sentQty: dec(l.sentQty) })),
    };
  }
  // The branch copy carries NO quantity: the count stays blind.
  return { copy: 'branch', ...header, lines: rec.lines.map((l, i) => ({ n: i + 1, itemName: l.item.name, unit: l.item.usageUnit })) };
};
