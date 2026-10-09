import { Prisma } from '@prisma/client';
import { toPerson } from '../counting/_shared/count-people';
import {
  CYCLE_TEXT,
  REQUISITION_STATUS_TEXT,
  SECTION_STATUS_TEXT,
  type Addition,
  type DispatchRef,
  type RequisitionCycle,
  type RequisitionFile,
  type RequisitionLine,
  type RequisitionStatus,
  type SectionDetail,
  type SectionStatus,
  type SectionSummary,
} from './_shared/requisitions-contract';
import type { AdditionRecord, LineRecord, RequisitionRecord, SectionRecord } from './requisitions-repository';
import { canRecall, canSkip, lineValueKes, nextStepOf, SECTION_EDITABLE, trackerOf, urgentOverHour, type DispatchTrackerFacts } from './requisitions-state';

/**
 * Builds the wire shapes of the file (contract §4 and §6) from the records. The money and the stock figures are decided HERE, once:
 * a key the caller may not see is left out (absent, never null). Heads see their own department only and never money.
 */
export interface Viewer {
  now: Date;
  /** The caller holds `requisitions.see_value`. Heads and members never do. */
  seeValue: boolean;
  /** The caller holds `restock.read`. A head still sees the stock figures of their own department. */
  seeStock: boolean;
  /** Set when the caller is a department head: they see this department only. */
  headDepartmentId: string | null;
  /** The caller may act on THIS branch (own branch, or the System Admin). */
  branchOk: boolean;
  can: {
    start: boolean;
    changeQuantity: boolean;
    approve: boolean;
    cancel: boolean;
    nudge: boolean;
    setUrgent: boolean;
    read: boolean;
    /** Amendment 2: the Branch Manager alone fills and sends a department's section for its head. */
    editOnBehalf: boolean;
    sendOnBehalf: boolean;
  };
  /** Departments of this requisition whose dispatch is signed (additions are closed for them). */
  lockedDepartmentIds: ReadonlySet<string>;
  /** Parent category names by id, for the second level. */
  parentCategoryNames: ReadonlyMap<string, string>;
  /** Heads of the departments, by department id. */
  heads: ReadonlyMap<string, { id: string; name: string; role: string }>;
  /** Block 2: the dispatches of this requisition (`dispatch/dispatch-roll-up.ts`) and the tracker facts they give. Absent = none yet. */
  dispatches?: readonly DispatchRef[];
  dispatchTracker?: DispatchTrackerFacts;
}

const OPENISH: readonly RequisitionStatus[] = ['OPEN', 'PENDING_APPROVAL'];
const dec = (v: Prisma.Decimal): string => v.toString();
const num = (v: Prisma.Decimal | null | undefined): number => (v ? v.toNumber() : 0);
const kes = (n: number): string => n.toFixed(2);
const sameQty = (a: Prisma.Decimal | null, b: Prisma.Decimal | null): boolean => (a === null || b === null ? a === b : a.equals(b));

const counts = (line: LineRecord, additionStatus: Map<string, AdditionRecord['status']>): boolean =>
  !line.additionId || additionStatus.get(line.additionId) === 'APPROVED';

export const additionStatusMap = (rec: RequisitionRecord): Map<string, AdditionRecord['status']> => new Map(rec.additions.map((a) => [a.id, a.status]));

const ADDITION_TEXT: Record<AdditionRecord['status'], string> = { PENDING: 'Waiting for approval', APPROVED: 'Approved', CANCELLED: 'Cancelled' };

export const cycleOf = (type: string): RequisitionCycle => (type === 'MORNING' || type === 'AFTERNOON' ? type : 'EXTRA');

/** "Afternoon · Wed 7 Oct" in Nairobi time. */
export const cycleLabelOf = (type: string, openedAt: Date): string => {
  const day = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Nairobi', weekday: 'short', day: 'numeric', month: 'short' }).format(openedAt).replace(',', '');
  return `${CYCLE_TEXT[cycleOf(type)]} · ${day}`;
};

export const lineWire = (line: LineRecord, section: SectionRecord, v: Viewer): RequisitionLine => {
  const parentId = line.item.category?.parentCategoryId ?? null;
  const parentName = parentId ? v.parentCategoryNames.get(parentId) : undefined;
  const categoryPath = [...(parentName ? [parentName] : []), ...(line.item.category ? [line.item.category.name] : [])];
  const requested = line.requestedQty ?? new Prisma.Decimal(0);
  const stockVisible = v.seeStock || v.headDepartmentId === section.departmentId;
  const value = lineValueKes(
    { requestedQty: num(requested), approvedQty: line.approvedQty ? num(line.approvedQty) : null },
    { unitCostAtApproval: line.unitCostAtApproval ? num(line.unitCostAtApproval) : null, currentCost: num(line.item.currentCost) },
  );
  return {
    id: line.id,
    itemId: line.inventoryItemId,
    itemName: line.item.name,
    unit: line.item.usageUnit,
    categoryPath,
    requestedQty: dec(requested),
    approvedQty: line.approvedQty ? dec(line.approvedQty) : null,
    suggestedQty: line.suggestedQty ? dec(line.suggestedQty) : null,
    ...(stockVisible && line.onHandAtRequest ? { onHand: dec(line.onHandAtRequest) } : {}),
    ...(stockVisible && line.parAtRequest ? { level: dec(line.parAtRequest) } : {}),
    changedFromSuggested: line.suggestedQty !== null && !sameQty(line.suggestedQty, requested),
    changedByManager: line.editedById !== null && line.approvedQty !== null && !sameQty(line.approvedQty, requested),
    changeReason: line.editReason,
    additionId: line.additionId,
    ...(v.seeValue ? { valueKes: kes(value) } : {}),
  };
};

export const sectionLines = (section: SectionRecord, additions: Map<string, AdditionRecord['status']>): LineRecord[] =>
  section.lines.filter((l) => counts(l, additions));

export const sectionValue = (section: SectionRecord, additions: Map<string, AdditionRecord['status']>): number =>
  sectionLines(section, additions).reduce(
    (sum, l) =>
      sum +
      lineValueKes(
        { requestedQty: num(l.requestedQty), approvedQty: l.approvedQty ? num(l.approvedQty) : null },
        { unitCostAtApproval: l.unitCostAtApproval ? num(l.unitCostAtApproval) : null, currentCost: num(l.item.currentCost) },
      ),
    0,
  );

export const sectionSummaryWire = (section: SectionRecord, rec: RequisitionRecord, v: Viewer): SectionSummary => {
  const additions = additionStatusMap(rec);
  const lines = sectionLines(section, additions);
  const head = v.heads.get(section.departmentId ?? '');
  return {
    departmentId: section.departmentId ?? '',
    departmentName: section.department?.name ?? '',
    status: section.status as SectionStatus,
    statusText: SECTION_STATUS_TEXT[section.status as SectionStatus],
    head: head ? toPerson(head) : null,
    sentAt: section.submittedAt ? section.submittedAt.toISOString() : null,
    sentBy: section.submittedBy ? toPerson(section.submittedBy) : null,
    skippedAt: section.skippedAt ? section.skippedAt.toISOString() : null,
    skippedBy: section.skippedBy ? toPerson(section.skippedBy) : null,
    lineCount: lines.length,
    changedCount: lines.filter((l) => l.editedById !== null && l.approvedQty !== null && !sameQty(l.approvedQty, l.requestedQty)).length,
    ...(v.seeValue ? { valueKes: kes(sectionValue(section, additions)) } : {}),
  };
};

export const sectionDetailWire = (section: SectionRecord, rec: RequisitionRecord, v: Viewer): SectionDetail => {
  const open = OPENISH.includes(rec.status);
  const isOwnHead = v.headDepartmentId !== null && v.headDepartmentId === section.departmentId;
  const status = section.status as SectionStatus;
  const notSent = status === 'NOT_STARTED' || status === 'DRAFT';
  const fillMyself = v.can.editOnBehalf && v.branchOk && open && notSent;
  const editable = open && SECTION_EDITABLE.includes(status) && (isOwnHead || fillMyself);
  const lines = section.lines.filter((l) => !l.additionId || additionStatusMap(rec).get(l.additionId) !== 'CANCELLED');
  const mayNudge = v.can.nudge && v.branchOk && rec.status === 'OPEN' && canSkip(status);
  return {
    ...sectionSummaryWire(section, rec, v),
    noteForManager: section.managerNote,
    lines: lines.map((l) => lineWire(l, section, v)),
    can: {
      edit: editable,
      send: editable && notSent && section.lines.length > 0 && (isOwnHead || v.can.sendOnBehalf),
      recall: isOwnHead && open && canRecall(status),
      nudge: mayNudge,
      skip: mayNudge,
      fillMyself,
      changeQuantity: v.can.changeQuantity && v.branchOk && (open || rec.status === 'APPROVED') && status !== 'SKIPPED',
    },
  };
};

export const additionWire = (addition: AdditionRecord, rec: RequisitionRecord, v: Viewer): Addition => {
  const lines = rec.sections.flatMap((s) => s.lines.filter((l) => l.additionId === addition.id).map((l) => ({ line: l, section: s })));
  const value = lines.reduce(
    (sum, { line }) =>
      sum +
      lineValueKes(
        { requestedQty: num(line.requestedQty), approvedQty: line.approvedQty ? num(line.approvedQty) : null },
        { unitCostAtApproval: line.unitCostAtApproval ? num(line.unitCostAtApproval) : null, currentCost: num(line.item.currentCost) },
      ),
    0,
  );
  // `v.can.approve` already carries the branch rule (own branch for the Branch Manager; any branch for the Director and System Admin).
  const approveOk = v.can.approve && rec.status === 'APPROVED' && addition.status === 'PENDING';
  return {
    id: addition.id,
    departmentId: addition.departmentId,
    departmentName: addition.department.name,
    status: addition.status,
    statusText: ADDITION_TEXT[addition.status],
    addedBy: toPerson(addition.addedBy),
    addedAt: addition.addedAt.toISOString(),
    approvedBy: addition.approvedBy ? toPerson(addition.approvedBy) : null,
    approvedAt: addition.approvedAt ? addition.approvedAt.toISOString() : null,
    lines: lines.map(({ line, section }) => lineWire(line, section, v)),
    ...(v.seeValue ? { valueKes: kes(value) } : {}),
    can: { approve: approveOk },
  };
};

/** The file (R3). `allInAt` is the moment the last section went in, for the tracker. */
export const fileWire = (rec: RequisitionRecord, v: Viewer, allInAt: Date | null): RequisitionFile => {
  const additionStatus = additionStatusMap(rec);
  const visibleSections = v.headDepartmentId ? rec.sections.filter((s) => s.departmentId === v.headDepartmentId) : rec.sections;
  const visibleAdditions = v.headDepartmentId ? rec.additions.filter((a) => a.departmentId === v.headDepartmentId) : rec.additions;
  const open = OPENISH.includes(rec.status);
  const signer = rec.approvedBy;
  const additionWaiting = visibleAdditions.some((a) => a.status === 'PENDING');
  const headSection = v.headDepartmentId ? rec.sections.find((s) => s.departmentId === v.headDepartmentId) : undefined;
  const headMayAdd = !!headSection && !!v.headDepartmentId && !v.lockedDepartmentIds.has(v.headDepartmentId) && rec.status === 'APPROVED';
  const mayNudge = v.can.nudge && v.branchOk && rec.status === 'OPEN';
  const can = {
    nudge: mayNudge,
    skip: mayNudge,
    changeQuantity: v.can.changeQuantity && v.branchOk && (open || rec.status === 'APPROVED'),
    approve: v.can.approve && rec.status === 'PENDING_APPROVAL',
    cancel: v.can.cancel && v.branchOk && open,
    setUrgent: open && ((v.can.setUrgent && v.branchOk) || !!headSection),
    addToIt: headMayAdd,
    print: v.can.read && rec.status !== 'CANCELLED',
    startNew: (v.can.start && v.branchOk) || v.headDepartmentId !== null,
  };
  const counting = visibleSections.filter((s) => s.department?.status === 'ACTIVE' || s.status === 'SUBMITTED' || s.status === 'SKIPPED');
  const sectionCounts = { sectionsIn: counting.filter((s) => s.status === 'SUBMITTED' || s.status === 'SKIPPED').length, sectionsTotal: counting.length };
  const allLines = visibleSections.flatMap((s) => sectionLines(s, additionStatus));
  const value = visibleSections.reduce((sum, s) => sum + sectionValue(s, additionStatus), 0);
  return {
    id: rec.id,
    reference: rec.reference,
    cycle: cycleOf(rec.type),
    cycleLabel: cycleLabelOf(rec.type, rec.openedAt),
    branch: { id: rec.site.id, name: rec.site.name, code: rec.site.code },
    status: rec.status as RequisitionStatus,
    statusText: REQUISITION_STATUS_TEXT[rec.status as RequisitionStatus],
    urgent: rec.urgent,
    urgentAt: rec.urgentAt ? rec.urgentAt.toISOString() : null,
    urgentOverHour: urgentOverHour({ urgent: rec.urgent, urgentAt: rec.urgentAt, status: rec.status as RequisitionStatus }, v.now),
    openedBy: toPerson(rec.openedBy),
    openedAt: rec.openedAt.toISOString(),
    approvedBy: signer ? toPerson(signer) : null,
    approvedAt: rec.approvedAt ? rec.approvedAt.toISOString() : null,
    cancelled: rec.cancelledAt && rec.cancelledBy ? { at: rec.cancelledAt.toISOString(), by: toPerson(rec.cancelledBy), reason: rec.cancelReason ?? '' } : null,
    closedAt: rec.closedAt ? rec.closedAt.toISOString() : null,
    tracker: trackerOf(
      {
        status: rec.status as RequisitionStatus,
        openedAt: rec.openedAt,
        openedBy: rec.openedBy,
        allInAt,
        approvedAt: rec.approvedAt,
        approvedBy: signer,
        closedAt: rec.closedAt,
        ...sectionCounts,
        ...(v.dispatchTracker ? { dispatch: v.dispatchTracker } : {}),
      },
      (u) => toPerson(u),
    ),
    nextStep: nextStepOf({
      status: rec.status as RequisitionStatus,
      sections: visibleSections.map((s) => ({
        departmentId: s.departmentId ?? '',
        departmentName: s.department?.name ?? '',
        status: s.status as SectionStatus,
        departmentActive: s.department?.status === 'ACTIVE',
      })),
      additionsWaiting: visibleAdditions.filter((a) => a.status === 'PENDING').length,
      can: { nudge: can.nudge, approve: can.approve || (v.can.approve && additionWaiting), addToIt: can.addToIt, print: can.print },
    }),
    sections: visibleSections.map((s) => sectionDetailWire(s, rec, v)),
    additions: visibleAdditions.map((a) => additionWire(a, rec, v)),
    // A head sees their own department's dispatch only, like their section.
    dispatches: (v.dispatches ?? []).filter((d) => !v.headDepartmentId || d.departmentId === v.headDepartmentId),
    lineCount: allLines.length,
    ...(v.seeValue ? { valueKes: kes(value) } : {}),
    can,
  };
};
