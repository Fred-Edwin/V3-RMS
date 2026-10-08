import { describe, expect, it } from 'vitest';
import {
  additionSchema,
  printSchema,
  requisitionFileSchema,
  sectionDetailSchema,
} from './_shared/requisitions-contract';
import { buildPrint } from './requisitions-print';
import { fileWire, sectionDetailWire, type Viewer } from './requisitions-view';
import { BARISTA, KITCHEN, kitchenHead, makeAddition, makeLine, makeRequisition, makeSection, manager, readyRequisition } from './requisitions-fixtures';
import { additionWire } from './requisitions-view';

/**
 * The shapes the views produce are parsed by the FROZEN contract schemas (`_shared/requisitions-contract.ts`), so a drift between
 * the code and the contract fails here, not on the front end.
 */
const UUIDS: Record<string, string> = {};
const idOf = (s: string): string => {
  UUIDS[s] ??= `00000000-0000-4000-8000-${String(Object.keys(UUIDS).length + 1).padStart(12, '0')}`;
  return UUIDS[s];
};

const viewer = (extra: Partial<Viewer> = {}): Viewer => ({
  now: new Date('2026-10-08T10:00:00Z'),
  seeValue: true,
  seeStock: true,
  headDepartmentId: null,
  branchOk: true,
  can: { start: true, changeQuantity: true, approve: true, cancel: true, nudge: true, setUrgent: true, read: true },
  lockedDepartmentIds: new Set(),
  parentCategoryNames: new Map(),
  heads: new Map(),
  ...extra,
});

/** The schemas want uuids; swap every id in a record for a stable uuid. */
const withUuids = <T>(rec: T): T => JSON.parse(JSON.stringify(rec), (_k, v: unknown) => (typeof v === 'string' && /^(req|sec|dept|site|l\d|la|add|mgr|head|i\d|cat)-?/.test(v) && !v.includes(' ') && !v.includes(':') ? idOf(v) : v)) as T;

describe('the file wire parses against the frozen contract', () => {
  const signed = () => ({
    ...makeRequisition('APPROVED', readyRequisition().sections, { approvedAt: new Date('2026-10-08T08:00:00Z'), approvedBy: manager, approvedById: manager.id, urgent: true, urgentAt: new Date('2026-10-08T07:00:00Z') }),
    additions: [makeAddition('add-1', KITCHEN)],
  });

  it('as the Branch Manager (money, stock, can flags)', () => {
    const file = fileWire(signed(), viewer(), new Date('2026-10-08T07:30:00Z'));
    const parsed = requisitionFileSchema.safeParse(withUuids(file));
    expect(parsed.error?.issues ?? []).toEqual([]);
    expect(file.urgentOverHour).toBe(false); // signed, so no longer waiting
    const waiting = { ...readyRequisition(), urgent: true, urgentAt: new Date('2026-10-08T07:00:00Z') };
    expect(fileWire(waiting, viewer(), null).urgentOverHour).toBe(true); // ready to approve for 3 hours
  });

  it('as a head (own section only, no money)', () => {
    const file = fileWire(signed(), viewer({ seeValue: false, seeStock: false, headDepartmentId: KITCHEN, can: { start: false, changeQuantity: false, approve: false, cancel: false, nudge: false, setUrgent: false, read: false } }), null);
    expect(requisitionFileSchema.safeParse(withUuids(file)).error?.issues ?? []).toEqual([]);
    expect(file.sections).toHaveLength(1);
    expect(file.can.addToIt).toBe(true);
    expect(file.can.approve).toBe(false);
  });

  it('a cancelled file carries who, when and why', () => {
    const rec = makeRequisition('CANCELLED', readyRequisition().sections, { cancelledAt: new Date('2026-10-08T08:00:00Z'), cancelledBy: manager, cancelledById: manager.id, cancelReason: 'Wrong day' });
    const file = fileWire(rec, viewer(), null);
    expect(file.cancelled).toMatchObject({ reason: 'Wrong day' });
    expect(requisitionFileSchema.safeParse(withUuids(file)).error?.issues ?? []).toEqual([]);
    expect(file.nextStep.action).toBe('START_A_NEW_ONE');
  });
});

describe('section and addition wires', () => {
  it('a section detail parses and marks the manager\'s change and the head\'s change', () => {
    const rec = makeRequisition('PENDING_APPROVAL', [
      makeSection('sec-k', KITCHEN, 'Kitchen', 'SUBMITTED', [
        makeLine('l1', 'i1', 'Milk', 30, { suggestedQty: undefined, approvedQty: undefined }),
      ]),
    ]);
    const first = rec.sections[0]!;
    first.lines[0]!.suggestedQty = first.lines[0]!.requestedQty!.plus(3); // the head changed the pre-filled 33 to 30
    first.lines[0]!.approvedQty = first.lines[0]!.requestedQty!.minus(6); // the manager lowered it to 24
    first.lines[0]!.editedById = manager.id;
    const detail = sectionDetailWire(first, rec, viewer());
    expect(detail.lines[0]).toMatchObject({ changedFromSuggested: true, changedByManager: true, approvedQty: '24', suggestedQty: '33' });
    expect(sectionDetailSchema.safeParse(withUuids(detail)).error?.issues ?? []).toEqual([]);
  });

  it('a manager-edited line whose quantity equals the request is not "changed"', () => {
    const rec = makeRequisition('PENDING_APPROVAL', [makeSection('sec-k', KITCHEN, 'Kitchen', 'SUBMITTED', [makeLine('l1', 'i1', 'Milk', 30)])]);
    const line = rec.sections[0]!.lines[0]!;
    line.approvedQty = line.requestedQty;
    line.editedById = manager.id;
    expect(sectionDetailWire(rec.sections[0]!, rec, viewer()).lines[0]?.changedByManager).toBe(false);
  });

  it('an addition parses and offers its approve action only while pending on a signed requisition', () => {
    const added = makeLine('la', 'i9', 'Cream', 4, { additionId: 'add-1' });
    const rec = { ...makeRequisition('APPROVED', [makeSection('sec-k', KITCHEN, 'Kitchen', 'SUBMITTED', [added])]), additions: [makeAddition('add-1', KITCHEN)] };
    const wire = additionWire(rec.additions[0]!, rec, viewer());
    expect(additionSchema.safeParse(withUuids(wire)).error?.issues ?? []).toEqual([]);
    expect(wire.lines).toHaveLength(1);
    expect(wire.can.approve).toBe(true);
    expect(additionWire(rec.additions[0]!, rec, viewer({ can: { ...viewer().can, approve: false } })).can.approve).toBe(false);
  });
});

describe('the print data parses against the frozen contract', () => {
  it('carries a cover and a page for each Sent department, with no skipped one', () => {
    const rec = makeRequisition('APPROVED', [
      makeSection('sec-k', KITCHEN, 'Kitchen', 'SUBMITTED', [makeLine('l1', 'i1', 'Milk', 30)]),
      makeSection('sec-b', BARISTA, 'Barista', 'SKIPPED', []),
    ], { approvedAt: new Date('2026-10-08T08:00:00Z'), approvedBy: { ...manager, name: kitchenHead.name }, approvedById: manager.id });
    const print = buildPrint(rec);
    expect(printSchema.safeParse(withUuids(print)).error?.issues ?? []).toEqual([]);
    expect(print.pages.map((p) => p.departmentName)).toEqual(['Kitchen']);
  });
});
