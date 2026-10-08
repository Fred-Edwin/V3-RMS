import type { Prisma } from '@prisma/client';
import { toPerson } from '../counting/_shared/count-people';
import type { Print } from './_shared/requisitions-contract';
import { additionStatusMap, cycleLabelOf } from './requisitions-view';
import type { LineRecord, RequisitionRecord } from './requisitions-repository';

/**
 * R6: the data for the printed requisition (Paper step 17): a cover page plus one page per department. It goes to the Central Store
 * to fulfil, so there is NO MONEY anywhere in it (a test pins that no key mentions value, cost or price). This builds data only; the
 * route that serves it is back end B's.
 */
const q = (v: Prisma.Decimal | null): string => (v ? v.toString() : '0');

const printLine = (line: LineRecord, n: number): Print['pages'][number]['lines'][number] => {
  const approved = line.approvedQty ?? line.requestedQty ?? null;
  return {
    n,
    itemName: line.item.name,
    unit: line.item.usageUnit,
    requestedQty: q(line.requestedQty),
    approvedQty: q(approved),
    changed: line.approvedQty !== null && line.requestedQty !== null && !line.approvedQty.equals(line.requestedQty),
  };
};

export const buildPrint = (rec: RequisitionRecord): Print => {
  const additionStatus = additionStatusMap(rec);
  // A section prints when it was Sent; a Skipped section (or one that never went) has nothing to fulfil.
  const sent = rec.sections.filter((s) => s.status === 'SUBMITTED');
  const pages: Print['pages'] = sent.map((section) => {
    const base = section.lines.filter((l) => !l.additionId);
    const additions = rec.additions
      .filter((a) => a.departmentId === section.departmentId && a.status === 'APPROVED')
      .map((a) => ({
        addedAt: a.addedAt.toISOString(),
        addedBy: toPerson(a.addedBy),
        approvedBy: a.approvedBy ? toPerson(a.approvedBy) : null,
        approvedAt: null, // back end B: the addition approver's time (Amendment 2, R6)
        lines: section.lines.filter((l) => l.additionId === a.id).map((l, i) => printLine(l, i + 1)),
      }));
    return {
      departmentId: section.departmentId ?? '',
      departmentName: section.department?.name ?? '',
      askedBy: null, // back end B: who asked, role label and name as recorded (Amendment 2, R6)
      askedAt: null, // back end B: when the section was sent (Amendment 2, R6)
      deliverTo: null, // back end B: the "Deliver to" line (Amendment 2, R6)
      lines: base.map((l, i) => printLine(l, i + 1)),
      additions,
    };
  });
  const changes = sent.flatMap((section) =>
    section.lines
      .filter((l) => !l.additionId && l.editedById !== null && l.approvedQty !== null && l.requestedQty !== null && !l.approvedQty.equals(l.requestedQty))
      .map((l) => ({ departmentName: section.department?.name ?? '', itemName: l.item.name, from: q(l.requestedQty), to: q(l.approvedQty), reason: l.editReason })),
  );
  return {
    reference: rec.reference,
    branch: { id: rec.site.id, name: rec.site.name, code: rec.site.code },
    cycleLabel: cycleLabelOf(rec.type, rec.openedAt),
    urgent: rec.urgent,
    startedAt: rec.openedAt.toISOString(), // back end B: confirm against Paper step 17 (Amendment 2, R6)
    generatedAt: new Date().toISOString(), // back end B: take the time from the caller's clock (Amendment 2, R6)
    approvedAt: rec.approvedAt ? rec.approvedAt.toISOString() : null,
    approvedBy: rec.approvedBy ? toPerson(rec.approvedBy) : null,
    cover: {
      departments: sent.map((section, i) => ({
        departmentId: section.departmentId ?? '',
        departmentName: section.department?.name ?? '',
        lineCount: section.lines.filter((l) => !l.additionId || additionStatus.get(l.additionId) === 'APPROVED').length,
        page: i + 2,
        dispatchReference: null,
      })),
      managerChanges: changes,
      additionsCount: rec.additions.filter((a) => a.status === 'APPROVED').length,
    },
    pages,
    qrPayload: `/app/branch/requisitions/${rec.id}`,
  };
};
