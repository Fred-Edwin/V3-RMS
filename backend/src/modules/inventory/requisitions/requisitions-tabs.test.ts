import { describe, expect, it } from 'vitest';
import type { RequisitionStatus } from './_shared/requisitions-contract';
import { defaultTab, headIsWaited, isWaitingForBranch, tabOf, waitingTab, type DispatchFact } from './requisitions-tabs';

const NOW = new Date('2026-10-09T12:00:00.000Z');
const ago = (minutes: number): Date => new Date(NOW.getTime() - minutes * 60_000);

const fact = (status: DispatchFact['status'], signedMinutesAgo: number | null = null, discrepancyOpen = false): DispatchFact => ({
  status,
  signedAt: signedMinutesAgo === null ? null : ago(signedMinutesAgo),
  discrepancyOpen,
});
const sent = (...dispatches: Array<DispatchFact | null>) => dispatches.map((dispatch) => ({ dispatch }));
const tab = (status: RequisitionStatus, sentDepartments: ReturnType<typeof sent> = [], additionWaiting = false) => tabOf({ status, additionWaiting, sentDepartments, now: NOW });

describe('tabOf (Block 2: one function over the new dispatch statuses)', () => {
  it.each([
    ['OPEN', 'collecting'],
    ['PENDING_APPROVAL', 'to-approve'],
    ['CANCELLED', 'closed'],
    ['CLOSED', 'closed'],
  ] as const)('%s is %s whatever the dispatches say', (status, expected) => {
    expect(tab(status)).toBe(expected);
    expect(tab(status, sent(fact('ON_THE_WAY', 300, true)), true)).toBe(expected);
  });

  it('an approved requisition with an addition waiting is in To approve', () => {
    expect(tab('APPROVED', sent(fact('ON_THE_WAY', 10)), true)).toBe('to-approve');
  });

  it.each([
    ['no live dispatch yet', sent(null, null), 'to-pack'],
    ['dispatch rows exist but nothing is signed (TO_PACK)', sent(fact('TO_PACK')), 'to-pack'],
    ['a department being packed', sent(fact('PACKING')), 'to-pack'],
    ['one department signed, one not', sent(fact('ON_THE_WAY', 10), null), 'to-pack'],
    ['one signed and waiting, one still to pack: the store has work first', sent(fact('ON_THE_WAY', 500), fact('TO_PACK')), 'to-pack'],
    ['every department signed, none waiting', sent(fact('ON_THE_WAY', 10), fact('ON_THE_WAY', 119)), 'on-the-way'],
    ['one department waiting over 2 hours', sent(fact('ON_THE_WAY', 10), fact('ON_THE_WAY', 121)), 'to-confirm'],
    ['some counted, one still on the way', sent(fact('CONFIRMED'), fact('ON_THE_WAY', 30)), 'on-the-way'],
    ['some counted, one waiting', sent(fact('CONFIRMED'), fact('ON_THE_WAY', 600)), 'to-confirm'],
    ['every department counted, nothing open', sent(fact('CONFIRMED'), fact('CLOSED')), 'closed'],
    ['an open discrepancy wins over everything', sent(fact('CONFIRMED', 600, true), null, fact('ON_THE_WAY', 600)), 'discrepancies'],
    ['no department with lines to pack', sent(), 'to-pack'],
  ] as const)('approved: %s -> %s', (_name, departments, expected) => {
    expect(tab('APPROVED', [...departments])).toBe(expected);
  });

  it('the 2-hour wait is strictly more than 2 hours from the final sign', () => {
    expect(isWaitingForBranch(fact('ON_THE_WAY', 120), NOW)).toBe(false);
    expect(isWaitingForBranch(fact('ON_THE_WAY', 121), NOW)).toBe(true);
    expect(isWaitingForBranch(fact('CONFIRMED', 600), NOW)).toBe(false);
    expect(isWaitingForBranch(fact('ON_THE_WAY', null), NOW)).toBe(false);
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
