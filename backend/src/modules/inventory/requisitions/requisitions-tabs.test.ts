import { describe, expect, it } from 'vitest';
import type { RequisitionStatus } from './_shared/requisitions-contract';
import { defaultTab, headIsWaited, tabOf, waitingTab, type DispatchState } from './requisitions-tabs';

const sent = (...states: Array<DispatchState | null>) => states.map((dispatch) => ({ dispatch }));
const tab = (status: RequisitionStatus, sentDepartments: ReturnType<typeof sent> = [], additionWaiting = false) => tabOf({ status, additionWaiting, sentDepartments });

describe('tabOf (the replaceable derivation, Block 2 swaps it)', () => {
  it.each([
    ['OPEN', 'collecting'],
    ['PENDING_APPROVAL', 'to-approve'],
    ['CANCELLED', 'closed'],
    ['CLOSED', 'closed'],
  ] as const)('%s is %s whatever the dispatches say', (status, expected) => {
    expect(tab(status)).toBe(expected);
    expect(tab(status, sent('IN_TRANSIT'), true)).toBe(expected === 'to-approve' ? 'to-approve' : expected);
  });

  it('an approved requisition with an addition waiting is in To approve', () => {
    expect(tab('APPROVED', sent('IN_TRANSIT'), true)).toBe('to-approve');
  });

  it.each([
    ['nothing signed by the store yet', sent(null, null), 'to-pack'],
    ['one department signed, one not', sent('IN_TRANSIT', null), 'to-pack'],
    ['an AWAITING dispatch counts as not signed', sent('AWAITING'), 'to-pack'],
    ['every department in transit', sent('IN_TRANSIT', 'IN_TRANSIT'), 'on-the-way'],
    ['some confirmed, some still in transit', sent('CONFIRMED', 'IN_TRANSIT'), 'on-the-way'],
    ['every department confirmed', sent('CONFIRMED', 'CONFIRMED'), 'closed'],
    ['any open discrepancy wins over everything', sent('DISCREPANCY_OPEN', null, 'IN_TRANSIT'), 'discrepancies'],
    ['no department the old dispatch can see (all added in Block 1)', sent(), 'to-pack'],
  ] as const)('approved: %s -> %s', (_name, departments, expected) => {
    expect(tab('APPROVED', [...departments])).toBe(expected);
  });

  it('to-confirm is never produced before Block 2', () => {
    const all = [null, 'AWAITING', 'IN_TRANSIT', 'CONFIRMED', 'DISCREPANCY_OPEN'] as const;
    for (const a of all) for (const b of all) expect(tab('APPROVED', sent(a, b))).not.toBe('to-confirm');
  });
});

describe('who is waited for', () => {
  it('approvers wait on To approve, the store on To pack, a head and the rest on no tab', () => {
    expect(waitingTab('APPROVER')).toBe('to-approve');
    expect(waitingTab('STORE')).toBe('to-pack');
    expect(waitingTab('HEAD')).toBeNull();
    expect(waitingTab('NONE')).toBeNull();
  });
  it('a head is waited for while the requisition collects and their list is unsent', () => {
    expect(headIsWaited('OPEN', 'NOT_STARTED')).toBe(true);
    expect(headIsWaited('OPEN', 'DRAFT')).toBe(true);
    expect(headIsWaited('OPEN', 'SUBMITTED')).toBe(false);
    expect(headIsWaited('OPEN', 'SKIPPED')).toBe(false);
    expect(headIsWaited('PENDING_APPROVAL', 'DRAFT')).toBe(false);
    expect(headIsWaited('APPROVED', 'NOT_STARTED')).toBe(false);
  });
  it('the default tab follows the role', () => {
    expect(defaultTab('APPROVER')).toBe('to-approve');
    expect(defaultTab('STORE')).toBe('to-pack');
    expect(defaultTab('HEAD')).toBe('collecting');
    expect(defaultTab('NONE')).toBe('collecting');
  });
});
