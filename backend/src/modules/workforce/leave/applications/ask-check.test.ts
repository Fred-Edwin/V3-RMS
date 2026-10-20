import { describe, expect, it } from 'vitest';
import type { NairobiDate } from '../../_shared/time/nairobi-time';
import type { RequestableType } from '../balances/balance-service';
import type { LeavePerson } from '../data/people-repository';
import { assessAsk } from './ask-check';

const d = (value: string): NairobiDate => value as NairobiDate;
const person = (over: Partial<LeavePerson> = {}): LeavePerson => ({
  id: 'p1', companyId: 'c', siteId: 's', siteName: 'Nyeri Town', siteKind: 'BRANCH', name: 'Cynthia Wairimu', userId: 'u1', role: 'BARISTA', departmentId: 'd', departmentName: 'Barista',
  positionName: 'Barista', status: 'ACTIVE', isCasual: false, startDate: d('2020-01-01'), exitedOn: null, ...over,
});
const annual = (over: Partial<RequestableType> = {}): RequestableType => ({ code: 'ANNUAL', label: 'Annual leave', paid: true, left: 12, requiresReason: false, approvedBy: 'MANAGER', sickNoteAfterDays: null, tailAllowed: true, ...over });
const today = d('2026-10-09');
const run = (ask: { start: string; end: string; unpaidTailDays?: number }, requestable: RequestableType | undefined = annual(), who = person(), overlap = null) =>
  assessAsk({ person: who, requestable, ask: { typeCode: 'ANNUAL', start: d(ask.start), end: d(ask.end), unpaidTailDays: ask.unpaidTailDays }, overlap, today });

describe('assessAsk', () => {
  it('accepts a normal request and shows the figures', () => {
    const r = run({ start: '2026-10-26', end: '2026-10-28' });
    expect(r.errors).toEqual([]);
    expect(r).toMatchObject({ days: 3, left: 12, leftAfter: 9, shortfall: 0, returnOn: '2026-10-29' });
  });
  it('refuses a start in the past, an end before the start, and a request across 31 December', () => {
    expect(run({ start: '2026-10-08', end: '2026-10-10' }).errors[0]?.code).toBe('START_IN_PAST');
    expect(run({ start: '2026-10-12', end: '2026-10-10' }).errors.map((e) => e.code)).toContain('END_BEFORE_START');
    expect(run({ start: '2026-12-30', end: '2027-01-02' }).errors.map((e) => e.code)).toContain('LEAVE_CROSSES_YEAR');
  });
  it('refuses days after the exit date', () => {
    expect(run({ start: '2026-10-26', end: '2026-10-28' }, annual(), person({ exitedOn: d('2026-10-27') })).errors.map((e) => e.code)).toContain('AFTER_EXIT');
  });
  it('turns the overlap into a state error that names the other request', () => {
    const overlap = { id: 'x', start: d('2026-10-27'), end: d('2026-10-29'), status: 'WAITING' } as never;
    const r = run({ start: '2026-10-26', end: '2026-10-28' }, annual(), person(), overlap);
    expect(r.errors[0]).toMatchObject({ code: 'OVERLAP', kind: 'state' });
  });
  it('offers an unpaid tail for a shortfall, accepts exactly that tail and refuses any other', () => {
    const short = annual({ left: 5 });
    const noTail = run({ start: '2026-11-02', end: '2026-11-08' }, short);
    expect(noTail.errors[0]).toMatchObject({ code: 'BALANCE_TOO_LOW', details: { shortfall: 2, suggestedTail: 2 } });
    expect(noTail.suggestedTail).toBe(2);
    const ok = run({ start: '2026-11-02', end: '2026-11-08', unpaidTailDays: 2 }, short);
    expect(ok.errors).toEqual([]);
    expect(ok).toMatchObject({ appliedTail: 2, leftAfter: 0 });
    expect(run({ start: '2026-11-02', end: '2026-11-08', unpaidTailDays: 1 }, short).errors[0]?.code).toBe('TAIL_MISMATCH');
  });
  it('gives no tail where the type does not allow one', () => {
    const r = run({ start: '2026-11-02', end: '2026-11-08' }, annual({ left: 5, tailAllowed: false, code: 'MATERNITY', label: 'Maternity leave' }));
    expect(r.errors[0]).toMatchObject({ code: 'BALANCE_TOO_LOW', details: { tailAllowed: false } });
    expect(r.suggestedTail).toBe(0);
  });
  it('refuses a tail when none is needed', () => {
    expect(run({ start: '2026-10-26', end: '2026-10-28', unpaidTailDays: 1 }).errors[0]?.code).toBe('TAIL_NOT_NEEDED');
  });
  it('needs no balance for a type without a limit (unpaid)', () => {
    const r = run({ start: '2026-10-26', end: '2026-10-30' }, annual({ left: null, paid: false, code: 'UNPAID', label: 'Unpaid leave', tailAllowed: false }));
    expect(r.errors).toEqual([]);
    expect(r.leftAfter).toBeNull();
  });
  it('gives a casual worker a plain refusal, never a crash', () => {
    const r = run({ start: '2026-10-26', end: '2026-10-28' }, undefined, person({ isCasual: true }));
    expect(r.errors[0]).toMatchObject({ code: 'CASUAL_NO_LEAVE', kind: 'state' });
  });
  it('says when a sick note is needed', () => {
    expect(run({ start: '2026-10-26', end: '2026-10-30' }, annual({ sickNoteAfterDays: 2 })).sickNote).toBe(true);
    expect(run({ start: '2026-10-26', end: '2026-10-27' }, annual({ sickNoteAfterDays: 2 })).sickNote).toBe(false);
  });
});
