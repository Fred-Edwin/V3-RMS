import { describe, expect, it } from 'vitest';
import type { RequisitionStatus, SectionStatus } from './_shared/requisitions-contract';
import {
  allIn,
  canRecall,
  canSkip,
  checkSend,
  guardAfterApproval,
  guardApprove,
  guardBeforeApproval,
  lineValueKes,
  nextStepOf,
  sectionStatusAfterSave,
  statusAfterSectionChange,
  trackerOf,
  urgentOverHour,
} from './requisitions-state';

const sec = (status: SectionStatus, departmentActive = true) => ({ status, departmentActive });

describe('sectionStatusAfterSave (send then reopen on edit)', () => {
  it.each<[SectionStatus, number, string]>([
    ['NOT_STARTED', 3, 'DRAFT'],
    ['DRAFT', 2, 'DRAFT'],
    ['SUBMITTED', 2, 'DRAFT'], // a Sent section reopens as a Draft
    ['DRAFT', 0, 'NOT_STARTED'], // every line removed
    ['SUBMITTED', 0, 'NOT_STARTED'],
  ])('%s with %i lines becomes %s', (from, lines, to) => {
    expect(sectionStatusAfterSave(from, lines)).toEqual({ allowed: true, status: to });
  });
  it('refuses a Skipped section', () => {
    expect(sectionStatusAfterSave('SKIPPED', 2)).toEqual({ allowed: false });
  });
});

describe('send, recall and skip rules', () => {
  it.each<[SectionStatus, number, string]>([
    ['DRAFT', 2, 'OK'],
    ['NOT_STARTED', 2, 'OK'],
    ['DRAFT', 0, 'EMPTY'], // a section with no lines cannot be sent
    ['SUBMITTED', 2, 'NOT_SENDABLE'],
    ['SKIPPED', 2, 'NOT_SENDABLE'],
  ])('checkSend(%s, %i lines) is %s', (status, lines, expected) => {
    expect(checkSend(status, lines)).toBe(expected);
  });
  it('recalls only a Sent section', () => {
    expect((['NOT_STARTED', 'DRAFT', 'SUBMITTED', 'SKIPPED'] as const).map(canRecall)).toEqual([false, false, true, false]);
  });
  it('skips only a section that has not been sent', () => {
    expect((['NOT_STARTED', 'DRAFT', 'SUBMITTED', 'SKIPPED'] as const).map(canSkip)).toEqual([true, true, false, false]);
  });
});

describe('allIn and the status after a section changes', () => {
  it.each<[string, SectionStatus[], boolean]>([
    ['every section sent', ['SUBMITTED', 'SUBMITTED'], true],
    ['sent and skipped', ['SUBMITTED', 'SKIPPED', 'SKIPPED'], true],
    ['one still a draft', ['SUBMITTED', 'DRAFT'], false],
    ['one not started', ['SUBMITTED', 'NOT_STARTED'], false],
    ['all skipped (nothing to approve)', ['SKIPPED', 'SKIPPED'], false],
    ['no sections', [], false],
  ])('%s -> %s', (_label, statuses, expected) => {
    expect(allIn(statuses.map((s) => sec(s)))).toBe(expected);
  });

  it('a retired department that never sent does not hold the requisition up', () => {
    expect(allIn([sec('SUBMITTED'), sec('NOT_STARTED', false)])).toBe(true);
  });

  it.each<[RequisitionStatus, SectionStatus[], RequisitionStatus]>([
    ['OPEN', ['SUBMITTED', 'SUBMITTED'], 'PENDING_APPROVAL'],
    ['PENDING_APPROVAL', ['SUBMITTED', 'DRAFT'], 'OPEN'], // a recall or an edit reopens it
    ['OPEN', ['SUBMITTED', 'DRAFT'], 'OPEN'],
    ['APPROVED', ['SUBMITTED', 'DRAFT'], 'APPROVED'], // never moves after the signature
    ['CANCELLED', ['SUBMITTED', 'SUBMITTED'], 'CANCELLED'],
    ['CLOSED', ['SUBMITTED'], 'CLOSED'],
  ])('%s with %j becomes %s', (current, statuses, expected) => {
    expect(statusAfterSectionChange(current, statuses.map((s) => sec(s)))).toBe(expected);
  });
});

describe('write guards', () => {
  it.each<[RequisitionStatus, string]>([
    ['OPEN', 'OK'],
    ['PENDING_APPROVAL', 'OK'],
    ['APPROVED', 'ALREADY_APPROVED'],
    ['CLOSED', 'ALREADY_APPROVED'],
    ['CANCELLED', 'CANCELLED'],
  ])('before approval: %s -> %s', (status, expected) => expect(guardBeforeApproval(status)).toBe(expected));

  it.each<[RequisitionStatus, string]>([
    ['PENDING_APPROVAL', 'OK'],
    ['OPEN', 'NOT_READY'],
    ['APPROVED', 'ALREADY_APPROVED'],
    ['CLOSED', 'ALREADY_APPROVED'],
    ['CANCELLED', 'CANCELLED'],
  ])('approve: %s -> %s', (status, expected) => expect(guardApprove(status)).toBe(expected));

  it.each<[RequisitionStatus, string]>([
    ['APPROVED', 'OK'],
    ['OPEN', 'NOT_APPROVED'],
    ['PENDING_APPROVAL', 'NOT_APPROVED'],
    ['CLOSED', 'CLOSED'],
    ['CANCELLED', 'CANCELLED'],
  ])('after approval: %s -> %s', (status, expected) => expect(guardAfterApproval(status)).toBe(expected));
});

describe('urgentOverHour', () => {
  const at = new Date('2026-10-08T08:00:00Z');
  it.each<[string, boolean, Date | null, RequisitionStatus, number, boolean]>([
    ['urgent for 59 minutes', true, at, 'OPEN', 59, false],
    ['urgent for exactly an hour', true, at, 'OPEN', 60, true],
    ['urgent and ready to approve for 2 hours', true, at, 'PENDING_APPROVAL', 120, true],
    ['not urgent', false, at, 'OPEN', 120, false],
    ['already signed', true, at, 'APPROVED', 120, false],
    ['no urgent time', true, null, 'OPEN', 120, false],
  ])('%s', (_l, urgent, urgentAt, status, minutes, expected) => {
    expect(urgentOverHour({ urgent, urgentAt, status }, new Date(at.getTime() + minutes * 60_000))).toBe(expected);
  });
});

describe('lineValueKes (money)', () => {
  it('uses the cost frozen at approval once there is one, and the Approved quantity', () => {
    expect(lineValueKes({ requestedQty: 10, approvedQty: 8 }, { unitCostAtApproval: 50, currentCost: 70 })).toBe(400);
  });
  it('uses the current cost and the request before approval', () => {
    expect(lineValueKes({ requestedQty: 10, approvedQty: null }, { unitCostAtApproval: null, currentCost: 70 })).toBe(700);
  });
  it('a quantity set to zero is worth nothing', () => {
    expect(lineValueKes({ requestedQty: 10, approvedQty: 0 }, { unitCostAtApproval: 50, currentCost: 70 })).toBe(0);
  });
});

describe('nextStepOf', () => {
  const sections = [
    { departmentId: 'k', departmentName: 'Kitchen', status: 'SUBMITTED' as const, departmentActive: true },
    { departmentId: 'h', departmentName: 'Housekeeping', status: 'DRAFT' as const, departmentActive: true },
  ];
  const can = { nudge: true, approve: true, addToIt: false, print: true };
  it('names the department that has not sent and offers a nudge', () => {
    expect(nextStepOf({ status: 'OPEN', sections, additionsWaiting: 0, can })).toMatchObject({ action: 'NUDGE', departmentId: 'h', facts: { sectionsIn: 1, sectionsTotal: 2, additionsWaiting: 0 } });
  });
  it('offers no button to someone who cannot nudge', () => {
    expect(nextStepOf({ status: 'OPEN', sections, additionsWaiting: 0, can: { ...can, nudge: false } }).action).toBeNull();
  });
  it('asks for the signature when everything is in', () => {
    expect(nextStepOf({ status: 'PENDING_APPROVAL', sections, additionsWaiting: 0, can })).toMatchObject({ action: 'APPROVE_AND_SIGN' });
  });
  it('shows a waiting addition to the approver and counts it', () => {
    expect(nextStepOf({ status: 'APPROVED', sections, additionsWaiting: 2, can })).toMatchObject({ action: 'APPROVE_ADDITION', facts: { additionsWaiting: 2 } });
  });
  it('lets a head add to an approved requisition', () => {
    expect(nextStepOf({ status: 'APPROVED', sections, additionsWaiting: 0, can: { ...can, approve: false, addToIt: true } })).toMatchObject({ action: 'ADD_TO_THIS_REQUISITION' });
  });
  it('offers a new one after a cancel', () => {
    expect(nextStepOf({ status: 'CANCELLED', sections, additionsWaiting: 0, can })).toMatchObject({ action: 'START_A_NEW_ONE' });
  });
  it('carries facts only: no title, text or button label (Amendment 2)', () => {
    const keys = Object.keys(nextStepOf({ status: 'OPEN', sections, additionsWaiting: 0, can }));
    expect(keys.sort()).toEqual(['action', 'departmentId', 'facts']);
  });
  it('does not count a retired department that never sent', () => {
    const withRetired = [...sections, { departmentId: 'r', departmentName: 'Old', status: 'NOT_STARTED' as const, departmentActive: false }];
    expect(nextStepOf({ status: 'OPEN', sections: withRetired, additionsWaiting: 0, can }).facts).toMatchObject({ sectionsIn: 1, sectionsTotal: 2 });
  });
});

describe('trackerOf', () => {
  const person = (u: { id: string; name: string }) => ({ id: u.id, name: u.name, initials: 'X', roleLabel: 'r' });
  const base = { openedAt: new Date('2026-10-08T06:00:00Z'), openedBy: { id: 'u', name: 'Ann', role: 'CHEF' }, allInAt: null, approvedAt: null, approvedBy: null, closedAt: null, sectionsIn: 3, sectionsTotal: 5 };
  it('returns facts only: key, state, date, who and a count (Amendment 2)', () => {
    const t = trackerOf({ ...base, status: 'OPEN' }, person);
    expect(Object.keys(t[0]!).sort()).toEqual(['at', 'by', 'count', 'key', 'state']);
    expect(t.find((s) => s.key === 'ALL_IN')!.count).toEqual({ done: 3, total: 5 });
    expect(t.find((s) => s.key === 'STARTED')!.count).toBeNull();
  });
  it('marks Started done and All in current while collecting', () => {
    const t = trackerOf({ ...base, status: 'OPEN' }, person);
    expect(t.map((s) => s.state)).toEqual(['DONE', 'CURRENT', 'TODO', 'TODO', 'TODO', 'TODO']);
  });
  it('marks Packed current once approved (Block 2 fills the rest)', () => {
    const t = trackerOf({ ...base, status: 'APPROVED', allInAt: new Date(), approvedAt: new Date(), approvedBy: { id: 'm', name: 'Bo', role: 'MANAGER' } }, person);
    expect(t.map((s) => s.state)).toEqual(['DONE', 'DONE', 'DONE', 'CURRENT', 'TODO', 'TODO']);
  });
  it('has no current step on a cancelled requisition', () => {
    expect(trackerOf({ ...base, status: 'CANCELLED' }, person).some((s) => s.state === 'CURRENT')).toBe(false);
  });
});
