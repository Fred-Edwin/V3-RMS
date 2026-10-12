import { Prisma, type DiscrepancyFinding } from '@prisma/client';
import { roleLabelOf, toPerson } from '../counting/_shared/count-people';
import type { DispatchActivityEvent } from '../dispatch/_shared/dispatch-contract';
import { photoUrl } from '../dispatch/dispatch-view';
import {
  FINDING_PROFILE,
  FINDING_TEXT,
  REMINDER_AFTER_HOURS,
  FINDINGS_FOR,
  type DiscrepancyFile,
  type DiscrepancyRow,
  type FindingPreview,
  type Finding,
  type RecordedFinding,
} from './_shared/discrepancies-contract';
import type { DiscrepancyRecord, DiscrepancyRowRecord } from './discrepancies-repository';
import { directionOfGap, effectRowsOf, heldValueOf, lossValueOf } from './discrepancies-state';

/**
 * The wire shapes of Discrepancies built from the records. The money rule is kept here, once: `lossValueKes` and `valueKes` are
 * ABSENT (never null) for a caller without `requisitions.see_value`. A discrepancy exists only after the department has signed its
 * count, so the sent figure is shown here freely.
 */

const iso = (d: Date): string => d.toISOString();
const isoOrNull = (d: Date | null): string | null => (d ? d.toISOString() : null);
const kes = (v: Prisma.Decimal): string => v.toFixed(2);
const trim = (v: Prisma.Decimal): string => v.toString();

export interface Viewer {
  seeValue: boolean;
  canRecordFinding: boolean;
  canReverse: boolean;
}

const emptyPerson = { id: '', name: '', initials: '', roleLabel: '' };

export const recordedFindingWire = (
  f: { finding: Finding; note: string | null; by: { id: string; name: string; role: string } | null; at: Date | null; lossValue: Prisma.Decimal | null },
  seeValue: boolean,
): RecordedFinding => ({
  finding: f.finding,
  note: f.note,
  recorded: { by: f.by ? toPerson(f.by) : emptyPerson, at: iso(f.at ?? new Date(0)) },
  against: FINDING_PROFILE[f.finding].against,
  lossKind: FINDING_PROFILE[f.finding].lossKind,
  ...(seeValue && f.lossValue !== null ? { lossValueKes: kes(f.lossValue) } : {}),
});

export const rowWire = (r: DiscrepancyRowRecord, v: Viewer): DiscrepancyRow => ({
  id: r.id,
  reference: r.reference,
  status: r.status,
  branch: { id: r.dispatch.toSite.id, name: r.dispatch.toSite.name, code: r.dispatch.toSite.code },
  department: { id: r.dispatch.department.id, name: r.dispatch.department.name },
  itemName: r.dispatchLine.item.name,
  unit: r.dispatchLine.item.usageUnit,
  gapQty: trim(r.gapQty),
  direction: directionOfGap(r.gapQty),
  branchReason: r.dispatchLine.countReason,
  dispatch: { id: r.dispatch.id, reference: r.dispatch.reference ?? '' },
  openedAt: iso(r.createdAt),
  reminderSentAt: isoOrNull(r.reminderSentAt),
  finding: r.status === 'RECORDED' && r.finding ? recordedFindingWire({ finding: r.finding, note: r.findingNote, by: r.recordedBy, at: r.recordedAt, lossValue: r.lossValue }, v.seeValue) : null,
  can: { recordFinding: v.canRecordFinding && r.status !== 'RECORDED' },
});

const EVENT_TYPE: Record<string, DispatchActivityEvent['type'] | undefined> = {
  OPENED: 'DISCREPANCY_OPENED',
  FINDING_RECORDED: 'FINDING_RECORDED',
  FINDING_REVERSED: 'FINDING_REVERSED',
};

const sentenceOf = (e: DiscrepancyRecord['events'][number], rec: DiscrepancyRecord): string => {
  switch (e.type) {
    case 'OPENED':
      return `A gap of ${trim(rec.gapQty.abs())} ${rec.dispatchLine.item.usageUnit} was held as unaccounted`;
    case 'FINDING_RECORDED':
      return `Recorded a finding: ${e.finding ? FINDING_TEXT[e.finding] : 'a finding'}${e.note ? ` · ${e.note}` : ''}`;
    default:
      return 'Reversed the finding · the gap is held again';
  }
};

export const fileWire = (rec: DiscrepancyRecord, v: Viewer, allowed: readonly Finding[]): DiscrepancyFile => {
  const line = rec.dispatchLine;
  const cost = line.unitCostAtDispatch ?? line.item.currentCost;
  const direction = directionOfGap(rec.gapQty);
  const open = rec.status !== 'RECORDED';
  const signedBy = rec.dispatch.signedBy ? toPerson(rec.dispatch.signedBy) : emptyPerson;
  const packedBy = rec.dispatch.packedBy ? toPerson(rec.dispatch.packedBy) : signedBy;
  const events: DispatchActivityEvent[] = rec.events.flatMap((e) => {
    const type = EVENT_TYPE[e.type];
    return type ? [{ id: e.id, type, at: iso(e.at), actor: toPerson(e.actor), sentence: sentenceOf(e, rec), link: { kind: 'DISCREPANCY' as const, id: rec.id, reference: rec.reference }, reason: e.reason }] : [];
  });
  return {
    id: rec.id,
    reference: rec.reference,
    status: open ? 'OPEN' : 'RECORDED',
    branch: { id: rec.dispatch.toSite.id, name: rec.dispatch.toSite.name, code: rec.dispatch.toSite.code },
    department: { id: rec.dispatch.department.id, name: rec.dispatch.department.name },
    dispatch: { id: rec.dispatch.id, reference: rec.dispatch.reference ?? '' },
    requisition: { id: rec.dispatch.requisition.id, reference: rec.dispatch.requisition.reference },
    item: { id: line.item.id, name: line.item.name, unit: line.item.usageUnit },
    sentQty: trim(line.sentQty),
    countedQty: trim(line.countedQty ?? new Prisma.Decimal(0)),
    gapQty: trim(rec.gapQty),
    direction,
    countedTwice: line.countedTwice,
    branchReason: line.countReason,
    branchReasonNote: line.countReasonNote,
    photos: line.photos.map((p) => ({ id: p.id, url: photoUrl(p.id) })),
    packed: { by: packedBy, at: iso(rec.dispatch.packedAt ?? rec.dispatch.signedAt ?? rec.createdAt) },
    signed: { by: signedBy, at: iso(rec.dispatch.signedAt ?? rec.createdAt) },
    carrier: rec.dispatch.carrier ? { id: rec.dispatch.carrier.id, name: rec.dispatch.carrier.name } : { id: rec.dispatch.id, name: '' },
    counted: { by: rec.dispatch.countedBy ? toPerson(rec.dispatch.countedBy) : emptyPerson, at: iso(rec.dispatch.countedAt ?? rec.createdAt) },
    assignedTo: roleLabelOf('STORE_MANAGER'),
    openedAt: iso(rec.createdAt),
    reminderSentAt: isoOrNull(rec.reminderSentAt),
    finding: !open && rec.finding ? recordedFindingWire({ finding: rec.finding, note: rec.findingNote, by: rec.recordedBy, at: rec.recordedAt, lossValue: rec.lossValue }, v.seeValue) : null,
    reversal: rec.reversedAt && rec.reversedBy && rec.reverseReason ? { reason: rec.reverseReason, reversed: { by: toPerson(rec.reversedBy), at: iso(rec.reversedAt) } } : null,
    allowedFindings: open ? [...allowed] : [],
    events,
    nextStep: { action: v.canRecordFinding && open ? 'RECORD_A_FINDING' : null, facts: { reminderAfterHours: REMINDER_AFTER_HOURS } },
    ...(v.seeValue ? { valueKes: kes(heldValueOf(rec.gapQty, cost)) } : {}),
    can: { recordFinding: v.canRecordFinding && open, reverse: v.canReverse && !open },
  };
};

export const allowedFor = (gap: Prisma.Decimal): readonly Finding[] => FINDINGS_FOR[directionOfGap(gap)];

/** Q3: what the finding would do, before the PIN. `placeNames` names the places the ledger rows land in. */
export const previewWire = (
  rec: Pick<DiscrepancyRecord, 'id' | 'reference' | 'gapQty'> & { dispatchLine: { item: { name: string; usageUnit: string; currentCost: Prisma.Decimal }; unitCostAtDispatch: Prisma.Decimal | null } },
  finding: DiscrepancyFinding,
  placeNames: { store: string; department: string },
  againstParty: string | null,
  seeValue: boolean,
): FindingPreview => {
  const cost = rec.dispatchLine.unitCostAtDispatch ?? rec.dispatchLine.item.currentCost;
  const loss = lossValueOf(finding, rec.gapQty, cost);
  return {
    id: rec.id,
    reference: rec.reference,
    finding,
    itemName: rec.dispatchLine.item.name,
    unit: rec.dispatchLine.item.usageUnit,
    effects: effectRowsOf(finding, rec.gapQty).map((e) => ({
      place: e.place,
      placeName: e.place === 'CENTRAL_STORE' ? placeNames.store : e.place === 'DEPARTMENT' ? placeNames.department : rec.gapQty.isNegative() ? 'Written off' : 'Taken in, unexplained',
      quantity: trim(e.quantity),
    })),
    against: FINDING_PROFILE[finding].against,
    againstParty,
    lossKind: FINDING_PROFILE[finding].lossKind,
    ...(seeValue && loss !== null ? { lossValueKes: kes(loss) } : {}),
  };
};
