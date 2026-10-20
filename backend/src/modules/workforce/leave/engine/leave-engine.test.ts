import { describe, expect, it } from 'vitest';
import type { NairobiDate } from '../../_shared/time/nairobi-time';
import type { LeaveRules, RulesAt } from '../leave.types';
import { balanceOf, shortfallOf, toneOf } from './leave-balance';
import { coverFor } from './leave-cover';
import { balanceDaysOf, countDays, crossesYear, overlaps, returnDate, takenAndBooked } from './leave-days';
import { entitlementFor } from './leave-entitlement';
import { managerMayCancel, personMayCancel, phaseOf } from './leave-phase';
import { currentDecider, effectiveStage, movesToHrAt, refusalFor, routeFor, willMoveToHr, type RoutedApplication } from './leave-routing';

const d = (value: string): NairobiDate => value as NairobiDate;
const type = (over: Partial<LeaveRules['leaveTypes'][number]>): LeaveRules['leaveTypes'][number] => ({
  code: 'ANNUAL', label: 'Annual leave', daysPerYear: 21, paid: true, requiresReason: false, accrual: 'UP_FRONT', perMonthDays: null, carryOverDays: 0, sickNoteAfterDays: null, approvedBy: 'MANAGER', ...over,
});
const rules = (...types: LeaveRules['leaveTypes']): LeaveRules => ({ leaveTypes: types, defaultPolicy: {}, minimumCover: {}, unpaidDayDivisor: 30, hrContact: null });
const always = (r: LeaveRules): RulesAt => () => r;

describe('days', () => {
  it('counts every calendar day, inclusive', () => {
    expect(countDays(d('2026-10-26'), d('2026-10-28'))).toBe(3);
    expect(countDays(d('2026-10-31'), d('2026-11-02'))).toBe(3);
    expect(countDays(d('2026-10-26'), d('2026-10-26'))).toBe(1);
  });
  it('sees a request that runs into next year', () => {
    expect(crossesYear(d('2026-12-30'), d('2027-01-02'))).toBe(true);
    expect(crossesYear(d('2026-12-29'), d('2026-12-31'))).toBe(false);
  });
  it('knows the return day and overlaps', () => {
    expect(returnDate(d('2026-12-31'))).toBe('2027-01-01');
    expect(overlaps({ start: d('2026-10-01'), end: d('2026-10-05') }, { start: d('2026-10-05'), end: d('2026-10-07') })).toBe(true);
    expect(overlaps({ start: d('2026-10-01'), end: d('2026-10-04') }, { start: d('2026-10-05'), end: d('2026-10-07') })).toBe(false);
  });
  it('takes the unpaid tail off the END of the range', () => {
    const app = { start: d('2026-11-02'), end: d('2026-11-08'), days: 7, unpaidTailDays: 2 };
    expect(balanceDaysOf(app)).toEqual(['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06']);
  });
  it('splits a request into taken and booked at today', () => {
    const app = { start: d('2026-10-08'), end: d('2026-10-12'), days: 5, unpaidTailDays: 0 };
    expect(takenAndBooked([app], 2026, d('2026-10-10'))).toEqual({ taken: 3, booked: 2 });
    expect(takenAndBooked([app], 2026, d('2026-10-01'))).toEqual({ taken: 0, booked: 5 });
    expect(takenAndBooked([app], 2026, d('2026-10-20'))).toEqual({ taken: 5, booked: 0 });
  });
});

describe('entitlement (owner decision O1: all at the start, prorated for joiners)', () => {
  const base = { code: 'ANNUAL', year: 2026, asOf: d('2026-10-09'), exitDate: null };
  it('gives the full figure on 1 January for someone who started in an earlier year', () => {
    expect(entitlementFor({ ...base, startDate: d('2020-03-01'), rulesAt: always(rules(type({}))) })).toBe(21);
  });
  it('gives a person who starts on 1 January the full year', () => {
    expect(entitlementFor({ ...base, startDate: d('2026-01-01'), rulesAt: always(rules(type({}))) })).toBe(21);
  });
  it('prorates a mid-year joiner by whole months left, rounded down', () => {
    // 14 July: August to December = 5 months -> 21 * 5 / 12 = 8.75 -> 8
    expect(entitlementFor({ ...base, startDate: d('2026-07-14'), rulesAt: always(rules(type({}))) })).toBe(8);
    // 1 July counts July: 6 months -> 10.5 -> 10
    expect(entitlementFor({ ...base, startDate: d('2026-07-01'), rulesAt: always(rules(type({}))) })).toBe(10);
  });
  it('gives nothing for a year before the person started', () => {
    expect(entitlementFor({ ...base, startDate: d('2027-02-01'), rulesAt: always(rules(type({}))) })).toBe(0);
  });
  it('falls back to the default policy, then to zero', () => {
    const r: LeaveRules = { ...rules(type({ daysPerYear: null })), defaultPolicy: { ANNUAL: 18 } };
    expect(entitlementFor({ ...base, startDate: d('2020-01-01'), rulesAt: always(r) })).toBe(18);
    expect(entitlementFor({ ...base, startDate: d('2020-01-01'), rulesAt: always(rules(type({ daysPerYear: null }))) })).toBe(0);
  });
  it('credits MONTHLY from the month after the start month (Paper: joined 14 Jul, 5 left on 9 Oct)', () => {
    const monthly = rules(type({ accrual: 'MONTHLY', perMonthDays: 1.75, daysPerYear: null }));
    expect(entitlementFor({ ...base, startDate: d('2026-07-14'), rulesAt: always(monthly) })).toBe(5); // Aug, Sep, Oct = 5.25
    expect(entitlementFor({ ...base, startDate: d('2020-01-01'), rulesAt: always(monthly) })).toBe(17); // 10 x 1.75 = 17.5
  });
  it('stops MONTHLY credits at the exit month', () => {
    const monthly = rules(type({ accrual: 'MONTHLY', perMonthDays: 2, daysPerYear: null }));
    expect(entitlementFor({ ...base, startDate: d('2020-01-01'), exitDate: d('2026-03-20'), rulesAt: always(monthly) })).toBe(6);
  });
  it('reads each month from its own rule version', () => {
    const before = rules(type({ accrual: 'MONTHLY', perMonthDays: 1, daysPerYear: null }));
    const after = rules(type({ accrual: 'MONTHLY', perMonthDays: 3, daysPerYear: null }));
    const rulesAt: RulesAt = (date) => (date >= '2026-07-01' ? after : before);
    // Jan to Jun at 1, Jul to Oct at 3
    expect(entitlementFor({ ...base, startDate: d('2020-01-01'), rulesAt })).toBe(6 + 12);
  });
  it('does not double-credit when the mode changes later in the year: the grant date decides', () => {
    const upFront = rules(type({}));
    const monthly = rules(type({ accrual: 'MONTHLY', perMonthDays: 5, daysPerYear: null }));
    const rulesAt: RulesAt = (date) => (date >= '2026-06-01' ? monthly : upFront);
    expect(entitlementFor({ ...base, startDate: d('2020-01-01'), rulesAt })).toBe(21);
  });
  it('gives PER_EVENT types nothing until HR adds days', () => {
    expect(entitlementFor({ ...base, code: 'MATERNITY', startDate: d('2020-01-01'), rulesAt: always(rules(type({ code: 'MATERNITY', accrual: 'PER_EVENT', daysPerYear: 90 }))) })).toBe(0);
  });
  it('after an opening entry the up-front grant is zero and monthly credits follow the opening month', () => {
    expect(entitlementFor({ ...base, startDate: d('2020-01-01'), openingMonth: 9, rulesAt: always(rules(type({}))) })).toBe(0);
    const monthly = rules(type({ accrual: 'MONTHLY', perMonthDays: 2, daysPerYear: null }));
    expect(entitlementFor({ ...base, startDate: d('2020-01-01'), openingMonth: 9, rulesAt: always(monthly) })).toBe(2); // October only
  });
});

describe('balance', () => {
  const app = (start: string, end: string, days: number, tail = 0) => ({ start: d(start), end: d(end), days, unpaidTailDays: tail });
  it('is credited minus taken minus booked, and ignores waiting ones', () => {
    const b = balanceOf({ year: 2026, today: d('2026-10-09'), entitlement: 21, ledger: [], approved: [app('2026-03-02', '2026-03-06', 5), app('2026-12-21', '2026-12-24', 4)] });
    expect(b).toMatchObject({ credited: 21, taken: 5, booked: 4, left: 12 });
  });
  it('adds adjustments and carry-over, and floors the shown figure at zero', () => {
    const ledger = [
      { kind: 'CARRY_OVER' as const, days: 3, asOf: d('2026-01-01') },
      { kind: 'ADJUSTMENT' as const, days: -30, asOf: d('2026-05-01') },
    ];
    const b = balanceOf({ year: 2026, today: d('2026-10-09'), entitlement: 21, ledger, approved: [app('2026-03-02', '2026-03-06', 5)] });
    expect(b.credited).toBe(0);
    expect(b.left).toBe(0);
    expect(b.raw).toBe(-5);
  });
  it('does not take the unpaid tail off the balance', () => {
    const b = balanceOf({ year: 2026, today: d('2026-12-31'), entitlement: 5, ledger: [], approved: [app('2026-11-02', '2026-11-08', 7, 2)] });
    expect(b).toMatchObject({ taken: 5, left: 0 });
  });
  it('shows no fractions and measures a shortfall in whole days', () => {
    expect(balanceOf({ year: 2026, today: d('2026-01-01'), entitlement: 5.9, ledger: [], approved: [] }).credited).toBe(5);
    expect(shortfallOf(7, 5)).toBe(2);
    expect(shortfallOf(3, 5)).toBe(0);
  });
  it('colours the bar by the share left of the year', () => {
    expect(toneOf(12, 21)).toBe('GREEN');
    expect(toneOf(6, 21)).toBe('AMBER');
    expect(toneOf(2, 21)).toBe('RED');
    expect(toneOf(5, 0)).toBe('NONE');
    expect(toneOf(5, null)).toBe('NONE');
  });
});

describe('routing (spec section 5)', () => {
  it.each([
    ['WAITER', 'BRANCH', 'MANAGER', 'MANAGER', 'MANAGER'],
    ['DEPARTMENT_HEAD', 'BRANCH', 'MANAGER', 'MANAGER', 'MANAGER'],
    ['STORE_ATTENDANT', 'CENTRAL_STORE', 'MANAGER', 'STORE_MANAGER', 'MANAGER'],
    ['MANAGER', 'BRANCH', 'MANAGER', 'HR_MANAGER', 'HR'],
    ['STORE_MANAGER', 'CENTRAL_STORE', 'MANAGER', 'HR_MANAGER', 'HR'],
    ['HR_MANAGER', 'BRANCH', 'MANAGER', 'DIRECTOR', 'DIRECTOR'],
    ['DIRECTOR', 'BRANCH', 'MANAGER', 'HR_MANAGER', 'HR'],
    ['ACCOUNTANT', 'BRANCH', 'MANAGER', 'DIRECTOR', 'DIRECTOR'],
    ['BARISTA', 'BRANCH', 'HR', 'HR_MANAGER', 'HR'],
    ['HR_MANAGER', 'BRANCH', 'HR', 'DIRECTOR', 'DIRECTOR'],
  ] as const)('%s at a %s with a type approved by %s goes to %s', (role, site, approvedBy, expectedRole, expectedStage) => {
    expect(routeFor(role, site, approvedBy)).toEqual({ role: expectedRole, stage: expectedStage });
  });
});

describe('72 hours and the stage', () => {
  const asked = new Date('2026-10-09T12:10:00Z');
  const waiting = (over: Partial<RoutedApplication> = {}): RoutedApplication => ({ status: 'WAITING', stage: 'MANAGER', routedToRole: 'MANAGER', askedAt: asked, withHrAt: null, ...over });
  it('stays with the manager before 72 hours and moves to HR at 72 hours', () => {
    expect(effectiveStage(waiting(), new Date(asked.getTime() + 71 * 3_600_000))).toBe('MANAGER');
    expect(effectiveStage(waiting(), movesToHrAt(asked))).toBe('HR');
    expect(currentDecider(waiting(), movesToHrAt(asked))).toBe('HR_MANAGER');
  });
  it('is right even when the job has not written the move (derived)', () => {
    expect(effectiveStage(waiting({ withHrAt: null }), new Date(asked.getTime() + 100 * 3_600_000))).toBe('HR');
  });
  it('honours a written move early', () => {
    expect(effectiveStage(waiting({ withHrAt: asked }), asked)).toBe('HR');
  });
  it('does not move a request that was routed to HR or the Director from the start', () => {
    const late = new Date(asked.getTime() + 500 * 3_600_000);
    expect(effectiveStage(waiting({ stage: 'HR', routedToRole: 'HR_MANAGER' }), late)).toBe('HR');
    expect(effectiveStage(waiting({ stage: 'DIRECTOR', routedToRole: 'DIRECTOR' }), late)).toBe('DIRECTOR');
    expect(willMoveToHr(waiting({ stage: 'HR', routedToRole: 'HR_MANAGER' }), asked)).toBe(false);
  });
  it('never changes a decided request', () => {
    expect(effectiveStage(waiting({ status: 'APPROVED' }), new Date(asked.getTime() + 500 * 3_600_000))).toBe('MANAGER');
  });
});

describe('who may decide', () => {
  const asked = new Date('2026-10-09T12:10:00Z');
  const app: RoutedApplication = { status: 'WAITING', stage: 'MANAGER', routedToRole: 'MANAGER', askedAt: asked, withHrAt: null };
  const soon = new Date(asked.getTime() + 3_600_000);
  const base = { application: app, actorIsSubject: false, sameSite: true, roleHolderExists: true, now: soon };
  it('lets the routed manager of the same site decide', () => {
    expect(refusalFor({ ...base, actorRole: 'MANAGER' })).toBeNull();
  });
  it('refuses a manager of another site', () => {
    expect(refusalFor({ ...base, actorRole: 'MANAGER', sameSite: false })).toBe('NOT_YOUR_DECISION');
  });
  it('refuses your own request first', () => {
    expect(refusalFor({ ...base, actorRole: 'MANAGER', actorIsSubject: true })).toBe('OWN_REQUEST');
  });
  it('tells HR it is not with them yet, then lets them decide after the move', () => {
    expect(refusalFor({ ...base, actorRole: 'HR_MANAGER' })).toBe('NOT_WITH_YOU_YET');
    expect(refusalFor({ ...base, actorRole: 'HR_MANAGER', now: movesToHrAt(asked) })).toBeNull();
  });
  it('takes the decision away from the manager after the move', () => {
    expect(refusalFor({ ...base, actorRole: 'MANAGER', now: movesToHrAt(asked) })).toBe('NOT_YOUR_DECISION');
  });
  it('lets HR decide a manager’s own request at once, and the Director refuses to', () => {
    const own: RoutedApplication = { ...app, stage: 'HR', routedToRole: 'HR_MANAGER' };
    expect(refusalFor({ ...base, application: own, actorRole: 'HR_MANAGER' })).toBeNull();
    expect(refusalFor({ ...base, application: own, actorRole: 'DIRECTOR' })).toBe('NOT_YOUR_DECISION');
  });
  it('keeps the System Admin as a fallback only', () => {
    expect(refusalFor({ ...base, actorRole: 'SYSTEM_ADMIN' })).toBe('NOT_YOUR_DECISION');
    expect(refusalFor({ ...base, actorRole: 'SYSTEM_ADMIN', roleHolderExists: false })).toBeNull();
  });
});

describe('minimum cover', () => {
  const ids = (...list: string[]) => new Set(list);
  const days = [d('2026-10-26'), d('2026-10-27')];
  const empty = new Map<NairobiDate, ReadonlySet<string>>();
  it('counts the planned rota without the person and without those on leave', () => {
    const result = coverFor({
      days, minimum: 4, employeeId: 'me', activeIds: [],
      rostered: new Map([[days[0] as NairobiDate, ids('me', 'a', 'b', 'c', 'd')], [days[1] as NairobiDate, ids('a', 'b', 'c', 'd')]]),
      plannedDays: new Set(days), onLeave: new Map([[days[1] as NairobiDate, ids('d')]]), keptOnRota: empty,
    });
    expect(result.map((r) => [r.working, r.tight])).toEqual([[4, false], [3, true]]);
  });
  it('keeps someone on leave who was kept on the rota with an override', () => {
    const result = coverFor({
      days: [days[0] as NairobiDate], minimum: 4, employeeId: 'me', activeIds: [],
      rostered: new Map([[days[0] as NairobiDate, ids('a', 'b', 'c', 'd')]]), plannedDays: new Set(days),
      onLeave: new Map([[days[0] as NairobiDate, ids('d')]]), keptOnRota: new Map([[days[0] as NairobiDate, ids('d')]]),
    });
    expect(result[0]).toMatchObject({ working: 4, tight: false });
  });
  it('uses the usual team when the rota is not planned', () => {
    const result = coverFor({ days, minimum: 3, employeeId: 'me', activeIds: ['me', 'a', 'b', 'c'], rostered: empty, plannedDays: new Set(), onLeave: new Map([[days[0] as NairobiDate, ids('c')]]), keptOnRota: empty });
    expect(result.map((r) => [r.planned, r.working, r.tight])).toEqual([[false, 2, true], [false, 3, false]]);
  });
  it('never calls a day tight when no minimum is set', () => {
    expect(coverFor({ days, minimum: null, employeeId: 'me', activeIds: ['me'], rostered: empty, plannedDays: new Set(), onLeave: empty, keptOnRota: empty }).some((r) => r.tight)).toBe(false);
  });
});

describe('phase and cancelling', () => {
  const approved = (start: string, end: string) => ({ status: 'APPROVED' as const, start: d(start), end: d(end) });
  const today = d('2026-10-09');
  it('derives booked, on leave and taken from the dates', () => {
    expect(phaseOf(approved('2026-10-12', '2026-10-14'), today)).toBe('BOOKED');
    expect(phaseOf(approved('2026-10-08', '2026-10-10'), today)).toBe('ON_LEAVE');
    expect(phaseOf(approved('2026-10-01', '2026-10-08'), today)).toBe('TAKEN');
    expect(phaseOf({ status: 'WAITING', start: d('2026-10-12'), end: d('2026-10-14') }, today)).toBe('WAITING');
  });
  it('lets the person cancel waiting or booked, never started leave', () => {
    expect(personMayCancel({ status: 'WAITING', start: d('2026-10-01') }, today)).toBe(true);
    expect(personMayCancel(approved('2026-10-12', '2026-10-14'), today)).toBe(true);
    expect(personMayCancel(approved('2026-10-09', '2026-10-14'), today)).toBe(false);
    expect(personMayCancel({ status: 'DECLINED', start: d('2026-10-20') }, today)).toBe(false);
  });
  it('lets a manager cancel only approved leave that has not started', () => {
    expect(managerMayCancel(approved('2026-10-12', '2026-10-14'), today)).toBe(true);
    expect(managerMayCancel({ status: 'WAITING', start: d('2026-10-12') }, today)).toBe(false);
  });
});
