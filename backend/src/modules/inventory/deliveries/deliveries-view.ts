import { toPerson, roleLabelOf } from '../counting/_shared/count-people';
import { cycleOf } from '../requisitions/requisitions-view';
import { photoUrl, categoryPathOf } from '../dispatch/dispatch-view';
import { stageOf } from '../dispatch/dispatch-state';
import type { Person } from '../_shared/wire';
import type { ConfirmPreview, CountLine, CountView, DeliveryRow } from './_shared/deliveries-contract';
import type { DeliveryLineRecord, DeliveryRecord, DeliveryRowRecord } from './deliveries-repository';
import { canCheck, deliveryResultOf, differs, directionOf, gapOf, isFinal, lineStateOf, visibleDirectionOf, type CountFacts } from './deliveries-state';

/**
 * The wire shapes of Deliveries built from the records. THE BLIND RULE is kept here, once: the count view, the check and the lists
 * are built from `countFacts` and never read `sentQty` into a field; the only builders that name the sent figure are `previewWire`
 * (V5, after the counts are final) and the discrepancies it opens.
 */

const iso = (d: Date): string => d.toISOString();
const isoOrNull = (d: Date | null): string | null => (d ? d.toISOString() : null);

export const countFactsOf = (l: DeliveryLineRecord): CountFacts => ({ sentQty: l.sentQty, countedQty: l.countedQty, checkCount: l.checkCount });

export const countLineWire = (l: DeliveryLineRecord, parentNames: ReadonlyMap<string, string>): CountLine => {
  const facts = countFactsOf(l);
  return {
    lineId: l.id,
    itemName: l.item.name,
    unit: l.item.usageUnit,
    categoryPath: categoryPathOf(l.item.category, parentNames),
    countedQty: l.countedQty ? l.countedQty.toString() : null,
    state: lineStateOf(facts),
    attempt: Math.min(Math.max(l.checkCount, 0), 2),
    recountUsed: isFinal(facts),
    direction: visibleDirectionOf(facts),
    reason: l.countReason,
    reasonNote: l.countReasonNote,
    photos: l.photos.map((p) => ({ id: p.id, url: photoUrl(p.id) })),
  };
};

export const countViewWire = (rec: DeliveryRecord, parentNames: ReadonlyMap<string, string>, onBehalf: boolean): CountView => {
  const lines = rec.lines.map((l) => countLineWire(l, parentNames));
  return {
    id: rec.id,
    reference: rec.reference ?? '',
    branch: { id: rec.toSite.id, name: rec.toSite.name, code: rec.toSite.code },
    department: { id: rec.department.id, name: rec.department.name },
    signedAt: iso(rec.signedAt ?? rec.createdAt),
    arrivedAt: isoOrNull(rec.arrivedAt),
    lineCount: lines.length,
    countedCount: lines.filter((l) => l.countedQty !== null).length,
    countAgainCount: lines.filter((l) => l.state === 'COUNT_AGAIN').length,
    lines,
    canCheck: canCheck(rec.lines),
    onBehalfOfDepartment: onBehalf ? { id: rec.department.id, name: rec.department.name } : null,
  };
};

/** The lines a check lists: only those that differ, with the way they differ and never the size. */
export const differingOf = (rec: DeliveryRecord): Array<{ lineId: string; itemName: string; countedQty: string; direction: 'SHORT' | 'EXTRA'; state: 'COUNT_AGAIN' | 'SHORT' | 'EXTRA' }> =>
  rec.lines.flatMap((l) => {
    const facts = countFactsOf(l);
    const state = lineStateOf(facts);
    const direction = directionOf(facts);
    if (l.countedQty === null || direction === null || (state !== 'COUNT_AGAIN' && state !== 'SHORT' && state !== 'EXTRA')) return [];
    return [{ lineId: l.id, itemName: l.item.name, countedQty: l.countedQty.toString(), direction, state }];
  });

/** V5: the summary. Called only once every line is final, so the sent figure may be told here. */
export const previewWire = (rec: DeliveryRecord, signedBy: Person, onBehalf: boolean): ConfirmPreview => {
  const differing = rec.lines.filter((l) => differs(countFactsOf(l)));
  const matching = rec.lines.filter((l) => !differs(countFactsOf(l)));
  return {
    id: rec.id,
    reference: rec.reference ?? '',
    department: { id: rec.department.id, name: rec.department.name },
    lineCount: rec.lines.length,
    matchingLines: matching.map((l) => ({ lineId: l.id, itemName: l.item.name })),
    differingLines: differing.flatMap((l) => {
      if (l.countedQty === null) return [];
      const direction = directionOf(countFactsOf(l));
      if (direction === null) return [];
      return [
        {
          lineId: l.id,
          itemName: l.item.name,
          unit: l.item.usageUnit,
          countedQty: l.countedQty.toString(),
          sentQty: l.sentQty.toString(),
          gapQty: gapOf({ sentQty: l.sentQty, countedQty: l.countedQty }).toString(),
          direction,
          reason: l.countReason,
          reasonNote: l.countReasonNote,
          photoCount: l.photos.length,
        },
      ];
    }),
    signedBy,
    onBehalfOfDepartment: onBehalf ? { id: rec.department.id, name: rec.department.name } : null,
    canConfirm: differing.every((l) => l.countReason !== null),
  };
};

/** "Barista Department Head" for a head, the role for anyone else, "Branch Manager" when signed on behalf. */
export const confirmerTitleOf = (rec: Pick<DeliveryRowRecord, 'onBehalf' | 'countedBy' | 'department'>): string | null => {
  if (!rec.countedBy) return null;
  if (rec.onBehalf) return roleLabelOf('MANAGER');
  if (rec.countedBy.isDepartmentHead && rec.countedBy.departmentId === rec.department.id) return `${rec.department.name} Department Head`;
  return roleLabelOf(rec.countedBy.role);
};

export interface RowViewer {
  now: Date;
  /** The caller is the Branch Manager (counts and confirms for any department of the branch). */
  branchManager: boolean;
  /** The caller's own department, when they are a head or member. */
  departmentId: string | null;
}

export const rowWire = (r: DeliveryRowRecord, v: RowViewer): DeliveryRow => {
  const gapHeld = r.discrepancies.some((d) => d.status !== 'RECORDED');
  const counted = r.status === 'CONFIRMED' || r.status === 'CLOSED';
  const own = v.branchManager || v.departmentId === r.department.id;
  return {
    id: r.id,
    reference: r.reference ?? '',
    department: { id: r.department.id, name: r.department.name },
    cycle: cycleOf(r.requisition.type),
    carrier: r.carrier ? { id: r.carrier.id, name: r.carrier.name, kind: r.carrier.kind } : { id: '00000000-0000-4000-8000-000000000000', name: '', kind: 'PERSON' },
    lineCount: r.lines.length,
    signedAt: iso(r.signedAt ?? v.now),
    arrivedAt: isoOrNull(r.arrivedAt),
    stage: stageOf({ status: r.status, signedAt: r.signedAt, allTicked: true, gapHeld }, v.now),
    countStarted: r.lines.some((l) => l.countedQty !== null),
    confirmedAt: counted ? isoOrNull(r.countedAt) : null,
    confirmedBy: counted && r.countedBy ? toPerson(r.countedBy) : null,
    confirmedByTitle: counted ? confirmerTitleOf(r) : null,
    result: counted ? deliveryResultOf(r.discrepancies) : null,
    gapCount: counted ? r.discrepancies.length : null,
    can: { count: own && r.status === 'ON_THE_WAY', confirmOnBehalf: v.branchManager && r.status === 'ON_THE_WAY' },
  };
};
