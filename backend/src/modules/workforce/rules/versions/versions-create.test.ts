import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetPinTries } from '../../_shared/pin/signer-pin';
import { RULE_DEFAULTS } from '../rules-defaults';
import { as, day, reset, seed, state } from '../testing/rules-fake';

vi.mock('../resolve/rules-repository', async (importOriginal) => ({ ...(await importOriginal<typeof import('../resolve/rules-repository')>()), rulesRepository: (await import('../testing/rules-fake')).fakeRulesRepository }));
vi.mock('./versions-repository', async () => ({ versionsRepository: (await import('../testing/rules-fake')).fakeVersionsRepository }));
vi.mock('../../_shared/audit/audit-writer', async () => ({ runAudited: (await import('../testing/rules-fake')).fakeRunAudited }));
vi.mock('../../_shared/pin/signer-pin-repository', async () => ({ signerPinRepository: { hashOf: (await import('../testing/rules-fake')).fakePinHash } }));
vi.mock('../../../../utils/password', () => ({ comparePin: async (pin: string, hash: string) => pin === hash }));
vi.mock('../../../../config/database', () => ({ prisma: {} }));

import { createVersion } from './versions-create';
import type { CreateBody } from './versions-validators';

const NOW = new Date('2026-10-06T08:00:00Z'); // 11:00 on 6 Oct in Nairobi
const body = (over: Partial<CreateBody> = {}): CreateBody => ({ siteId: null, effectiveFrom: '2026-11-01', values: { graceMinutes: 10 }, reason: 'Busier mornings', pin: '1234', ...over });
const create = (actor: string, group: string = 'LATENESS', over: Partial<CreateBody> = {}, now: Date = NOW) => createVersion(as(actor), group, body(over), now);

beforeEach(() => {
  reset();
  resetPinTries();
});
afterEach(() => vi.useRealTimers());

describe('who may write', () => {
  it('the Director writes a company rule; every Branch Manager, HR and the Accountant are told, the Director is not', async () => {
    const made = await create('dir');
    expect(made).toMatchObject({ replay: false, confirmed: [], waiting: [] });
    expect(made.version).toMatchObject({ version: 1, group: 'LATENESS', siteId: null, changedFields: ['graceMinutes'], reason: 'Busier mornings', status: 'SCHEDULED', effectiveFrom: '2026-11-01' });
    const told = made.notice.recipients.map((r) => `${r.userId}:${r.audience}`).sort();
    expect(told).toEqual(['acc:ACCOUNTANT', 'bm1:ALL_BRANCH_MANAGERS', 'bm2:ALL_BRANCH_MANAGERS', 'hr:HR', 'sm:ALL_BRANCH_MANAGERS']);
  });

  it('a Branch Manager makes one row of their own branch’s rule their own; only that row is stored; the Director is told too', async () => {
    const made = await create('bm1', 'LATENESS', { siteId: 's1', values: { graceMinutes: 3 } });
    expect(made.version).toMatchObject({ siteId: 's1', version: 1, values: { graceMinutes: 3 }, changedFields: ['graceMinutes'] });
    const audiences = new Set(made.notice.recipients.map((r) => r.audience));
    expect(audiences).toEqual(new Set(['HR', 'ACCOUNTANT', 'DIRECTOR'])); // the only manager of s1 made it, so nobody else at s1 is told
    expect(made.notice.recipients.map((r) => r.userId)).not.toContain('bm1');
  });

  it('a Branch Manager cannot write the company rule or another branch', async () => {
    await expect(create('bm1')).rejects.toMatchObject({ statusCode: 403, code: 'RULE_FIELD_NOT_EDITABLE' });
    await expect(create('bm1', 'LATENESS', { siteId: 's2', values: { graceMinutes: 3 } })).rejects.toMatchObject({ statusCode: 403, code: 'RULE_FIELD_NOT_EDITABLE' });
    expect(state.rows).toHaveLength(0);
  });

  it('a Branch Manager cannot own a company-wide row: the deduction cap, a multiplier', async () => {
    await expect(create('bm1', 'LATENESS', { siteId: 's1', values: { deductionCapPercentOfPay: 5 } })).rejects.toMatchObject({ statusCode: 422, code: 'RULE_SITE_FIELD_NOT_OVERRIDABLE' });
    await expect(create('bm1', 'OVERTIME', { siteId: 's1', values: { multipliers: { ordinaryDay: '1.5', restDay: null } } })).rejects.toMatchObject({ code: 'RULE_SITE_FIELD_NOT_OVERRIDABLE' });
  });

  it('the Director may write a site’s own rule too (Applies to: One site)', async () => {
    const made = await create('dir', 'LATENESS', { siteId: 's2', values: { graceMinutes: 7 } });
    expect(made.version).toMatchObject({ siteId: 's2', values: { graceMinutes: 7 } });
    expect(made.notice.recipients).toContainEqual({ userId: 'bm2', audience: 'BRANCH_MANAGER_OF_SITE' });
  });

  it('the Store Manager does the same for the Central Store', async () => {
    const made = await create('sm', 'OVERTIME', { siteId: 'sc', values: { serviceTailMinutes: 30 } });
    expect(made.version).toMatchObject({ siteId: 'sc', values: { serviceTailMinutes: 30 } });
  });

  it.each([
    ['hr', 'LATENESS'],
    ['acc', 'LATENESS'],
    ['adm', 'LATENESS'],
    ['adm', 'OVERTIME'],
    ['adm', 'ATTENDANCE'],
    ['w1', 'LATENESS'],
    ['bm1', 'PROBATION'],
  ])('%s cannot change %s', async (actor, group) => {
    await expect(create(actor, group, { values: {} })).rejects.toMatchObject({ statusCode: 403 });
    expect(state.rows).toHaveLength(0);
  });

  it('only HR changes leave types, only the Director the holiday list, only the Accountant the holiday rate and statutory', async () => {
    const types = { leaveTypes: [...RULE_DEFAULTS.LEAVE.leaveTypes, { ...RULE_DEFAULTS.LEAVE.leaveTypes[0]!, code: 'STUDY', label: 'Study leave' }] };
    await expect(create('dir', 'LEAVE', { values: types })).rejects.toMatchObject({ statusCode: 403, code: 'RULE_FIELD_NOT_EDITABLE' });
    await expect(create('hr', 'LEAVE', { values: types })).resolves.toMatchObject({ version: { changedFields: ['leaveTypes'] } });

    const holiday = { holidays: [{ date: '2026-12-25', name: 'Christmas Day' }] };
    await expect(create('hr', 'HOLIDAYS', { values: holiday })).rejects.toMatchObject({ statusCode: 403 });
    await expect(create('acc', 'HOLIDAYS', { values: holiday })).rejects.toMatchObject({ statusCode: 403 });
    await expect(create('dir', 'HOLIDAYS', { values: holiday })).resolves.toBeTruthy();

    await expect(create('dir', 'HOLIDAYS', { values: { payMultiplier: '2.0' } })).rejects.toMatchObject({ statusCode: 403 });
    await expect(create('acc', 'HOLIDAYS', { values: { payMultiplier: '2.0' } })).resolves.toBeTruthy();
  });

  it('minimum cover: the Director, the System Admin and the branch’s own manager; HR cannot', async () => {
    const cover = (n: number) => ({ minimumCover: { dept1: n } });
    await expect(create('hr', 'LEAVE', { siteId: 's1', values: cover(2) })).rejects.toMatchObject({ statusCode: 403 });
    await expect(create('adm', 'LEAVE', { siteId: 's1', values: cover(2) })).resolves.toBeTruthy();
    await expect(create('bm1', 'LEAVE', { siteId: 's1', values: cover(3) })).resolves.toBeTruthy();
    await expect(create('bm2', 'LEAVE', { siteId: 's1', values: cover(4) })).rejects.toMatchObject({ statusCode: 403 });
  });

  it('a site of another company is not found; a System Admin (no site) resolves to the one company', async () => {
    await expect(create('dir', 'LATENESS', { siteId: 'sx', values: { graceMinutes: 3 } })).rejects.toMatchObject({ statusCode: 404 });
    await expect(create('adm', 'LEAVE', { siteId: 's2', values: { minimumCover: { d: 1 } } })).resolves.toBeTruthy();
  });
});

describe('dates, changes and refusals', () => {
  it('refuses a start day in the past, in Nairobi time', async () => {
    await expect(create('dir', 'LATENESS', { effectiveFrom: '2026-10-05' })).rejects.toMatchObject({ code: 'RULE_BACKDATED' });
    // 00:30 on 7 Oct in Nairobi is still 6 Oct in UTC: today is the 7th
    const justAfterMidnight = new Date('2026-10-06T21:30:00Z');
    await expect(create('dir', 'LATENESS', { effectiveFrom: '2026-10-06' }, justAfterMidnight)).rejects.toMatchObject({ code: 'RULE_BACKDATED' });
    await expect(create('dir', 'LATENESS', { effectiveFrom: '2026-10-07' }, justAfterMidnight)).resolves.toBeTruthy();
  });

  it('refuses a day before a version already stored, naming it, and offers its withdrawal', async () => {
    await create('dir', 'LATENESS', { effectiveFrom: '2026-11-02' });
    const attempt = create('dir', 'LATENESS', { effectiveFrom: '2026-11-01', values: { graceMinutes: 12 } });
    await expect(attempt).rejects.toMatchObject({ statusCode: 409, code: 'RULE_FUTURE_VERSION_EXISTS', details: { version: 1, effectiveFrom: '2026-11-02', withdrawable: true } });
    expect(state.rows).toHaveLength(1);
  });

  it('the same day as a stored version is allowed and becomes the higher number', async () => {
    await create('dir', 'LATENESS', { effectiveFrom: '2026-11-02' });
    const second = await create('dir', 'LATENESS', { effectiveFrom: '2026-11-02', values: { graceMinutes: 12 } });
    expect(second.version.version).toBe(2);
  });

  it('a withdrawn version frees its day and its number is not reused', async () => {
    const first = await create('dir', 'LATENESS', { effectiveFrom: '2026-11-02' });
    state.rows[0]!.withdrawal = { id: 'w1', ruleVersionId: first.version.id, withdrawnById: 'dir', withdrawnByRole: 'DIRECTOR', withdrawnAt: new Date(), reason: 'x' };
    const next = await create('dir', 'LATENESS', { effectiveFrom: '2026-11-01', values: { graceMinutes: 12 } });
    expect(next.version.version).toBe(2);
  });

  it('refuses a change that changes nothing', async () => {
    await expect(create('dir', 'LATENESS', { values: { graceMinutes: 5 } })).rejects.toMatchObject({ statusCode: 409, code: 'RULE_NO_CHANGE' });
    await expect(create('dir', 'LATENESS', { values: {} })).rejects.toMatchObject({ code: 'RULE_NO_CHANGE' });
  });

  it('compares with what is in force on the day, not today', async () => {
    seed({ group: 'LATENESS', version: 1, effectiveFrom: day('2026-10-20'), values: { ...RULE_DEFAULTS.LATENESS, graceMinutes: 9 } });
    await expect(create('dir', 'LATENESS', { effectiveFrom: '2026-11-01', values: { graceMinutes: 9 } })).rejects.toMatchObject({ code: 'RULE_NO_CHANGE' });
  });

  it('rejects values that fail the group’s own rules', async () => {
    await expect(create('dir', 'LATENESS', { values: { graceMinutes: 61 } })).rejects.toThrow();
    await expect(create('dir', 'LATENESS', { values: { policy: 'AFTER_N_LATES' } })).rejects.toThrow(/Say after how many lates/);
    await expect(create('dir', 'LATENESS', { values: { graceMinute: 4 } })).rejects.toMatchObject({ code: 'RULE_FIELD_UNKNOWN' });
  });

  it('a new week start must itself start on that day', async () => {
    await expect(create('dir', 'WEEK_AND_BREAKS', { effectiveFrom: '2026-11-02', values: { weekStartsOn: 7 } })).rejects.toMatchObject({ code: 'RULE_DATE_NOT_WEEK_START', message: 'Pick a Sunday' });
    await expect(create('dir', 'WEEK_AND_BREAKS', { effectiveFrom: '2026-11-01', values: { weekStartsOn: 7 } })).resolves.toBeTruthy();
  });

  it('a fixed row cannot be changed: rounding, the timesheet period', async () => {
    await expect(create('dir', 'ATTENDANCE', { values: { roundingMinutes: 5 } })).rejects.toMatchObject({ statusCode: 403, code: 'RULE_FIELD_NOT_EDITABLE' });
  });

  it('Statutory alone may start in the open month, never before it', async () => {
    const table = { tables: [{ code: 'NSSF', name: 'NSSF', bands: [{ fromAmount: '0', toAmount: null, ratePercent: '6', flatAmount: null }], note: null }] };
    await expect(create('acc', 'STATUTORY', { effectiveFrom: '2026-10-01', values: table })).resolves.toBeTruthy();
    await expect(create('acc', 'STATUTORY', { effectiveFrom: '2026-09-30', values: { tables: [{ ...table.tables[0]!, name: 'NSSF 2' }] } })).rejects.toMatchObject({ code: 'RULE_MONTH_APPROVED' });
    await expect(create('dir', 'LATENESS', { effectiveFrom: '2026-10-01' })).rejects.toMatchObject({ code: 'RULE_BACKDATED' });
  });

  it('refuses a day more than two years ahead', async () => {
    await expect(create('dir', 'LATENESS', { effectiveFrom: '2062-01-01' })).rejects.toMatchObject({ code: 'RULE_DATE_TOO_FAR' });
  });
});

describe('two people at once (stale)', () => {
  it('a save that saw an older newest version is refused and says which is newest', async () => {
    await create('dir', 'LATENESS', { effectiveFrom: '2026-11-01' });
    await expect(create('dir', 'LATENESS', { effectiveFrom: '2026-11-01', values: { graceMinutes: 12 }, expectedVersion: 0 })).rejects.toMatchObject({
      statusCode: 409,
      code: 'RULE_STALE',
      details: { latestVersion: 1 },
    });
  });

  it('a save that saw the newest version goes through; a save with no expectation always does', async () => {
    await create('dir', 'LATENESS', { effectiveFrom: '2026-11-01' });
    await expect(create('dir', 'LATENESS', { effectiveFrom: '2026-11-01', values: { graceMinutes: 12 }, expectedVersion: 1 })).resolves.toBeTruthy();
    await expect(create('dir', 'LATENESS', { effectiveFrom: '2026-11-01', values: { graceMinutes: 14 } })).resolves.toBeTruthy();
  });

  it('a site’s newest version is counted per site', async () => {
    await create('dir', 'LATENESS', { effectiveFrom: '2026-11-01' });
    await expect(create('bm1', 'LATENESS', { siteId: 's1', values: { graceMinutes: 3 }, expectedVersion: 0 })).resolves.toMatchObject({ version: { version: 1 } });
  });
});

describe('a retry is not a second save (idempotency)', () => {
  it('the same key answers with the version already made and writes nothing more', async () => {
    const first = await create('dir', 'LATENESS', { idempotencyKey: 'save-0001-abcd' });
    const again = await create('dir', 'LATENESS', { idempotencyKey: 'save-0001-abcd' });
    expect(first.replay).toBe(false);
    expect(again).toMatchObject({ replay: true, version: { id: first.version.id } });
    expect(state.rows).toHaveLength(1);
    expect(state.entries).toHaveLength(1);
    expect(state.events).toHaveLength(1);
  });

  it('a key used by another person or for another change is refused', async () => {
    await create('dir', 'LATENESS', { idempotencyKey: 'save-0001-abcd' });
    await expect(create('dir2', 'LATENESS', { idempotencyKey: 'save-0001-abcd' })).rejects.toMatchObject({ statusCode: 409, code: 'RULE_IDEMPOTENCY_KEY_REUSED' });
    await expect(create('dir', 'ATTENDANCE', { idempotencyKey: 'save-0001-abcd', values: { undoWindowSeconds: 60 } })).rejects.toMatchObject({ code: 'RULE_IDEMPOTENCY_KEY_REUSED' });
  });
});

describe('the PIN', () => {
  it('a wrong PIN is a 403 PIN_INVALID and nothing is written', async () => {
    await expect(create('dir', 'LATENESS', { pin: '9999' })).rejects.toMatchObject({ statusCode: 403, code: 'PIN_INVALID' });
    expect(state.rows).toHaveLength(0);
    expect(state.entries).toHaveLength(0);
  });

  it('a person with no PIN is told to set one', async () => {
    await expect(create('nopin', 'LATENESS')).rejects.toMatchObject({ statusCode: 403, code: 'PIN_NOT_SET' });
  });

  it('a mistake the person can fix is shown before the PIN is touched, so it does not count as a wrong try', async () => {
    for (let i = 0; i < 6; i += 1) await expect(create('dir', 'LATENESS', { pin: '9999', effectiveFrom: '2026-10-01' })).rejects.toMatchObject({ code: 'RULE_BACKDATED' });
    await expect(create('dir', 'LATENESS')).resolves.toBeTruthy();
  });

  it('five wrong PINs pause signing for a few seconds, even for the right PIN, and never lock it (SD16)', async () => {
    for (let i = 0; i < 5; i += 1) await expect(create('dir', 'LATENESS', { pin: '0000' })).rejects.toMatchObject({ code: 'PIN_INVALID' });
    await expect(create('dir', 'LATENESS')).rejects.toMatchObject({ statusCode: 429, code: 'PIN_SLOWED' });
    await expect(create('dir', 'LATENESS', {}, new Date(NOW.getTime() + 3 * 1000))).resolves.toBeTruthy();
  });
});

describe('audit and events', () => {
  it('writes one entry: the changed fields, the version, the reason, the day and the signature, never the PIN', async () => {
    await create('dir', 'LATENESS', { values: { graceMinutes: 10 } });
    expect(state.entries).toHaveLength(1);
    const entry = state.entries[0]!;
    expect(entry).toMatchObject({
      action: 'rules.version_created',
      category: 'RULES_OPERATING',
      siteId: null,
      actor: { id: 'dir', role: 'DIRECTOR', name: 'Dina Director' },
      subjectType: 'RuleVersion',
      before: { fields: { graceMinutes: 5 } },
      after: { group: 'LATENESS', version: 1, effectiveFrom: '2026-11-01', fields: { graceMinutes: 10 }, signature: { method: 'PIN' } },
      reason: 'Busier mornings',
    });
    expect(JSON.stringify(entry)).not.toContain('1234');
  });

  it('a pay row is filed under RULES_PAY and its notification carries no figures; an ordinary row carries old and new', async () => {
    await create('dir', 'LATENESS', { values: { deductionCapPercentOfPay: 2 } });
    expect(state.entries[0]).toMatchObject({ category: 'RULES_PAY', before: { fields: { deductionCapPercentOfPay: null } }, after: { fields: { deductionCapPercentOfPay: 2 } } });
    expect(state.events[0]).toMatchObject({ name: 'rules.version_created', payload: { pay: true, changes: [] } });

    await create('dir', 'LATENESS', { values: { graceMinutes: 10 } });
    expect(state.events[1]).toMatchObject({ payload: { pay: false, changes: [{ field: 'graceMinutes', from: 5, to: 10 }] } });
  });

  it('a change that fails writes nothing: no row, no entry, no event', async () => {
    state.failCreate = true;
    await expect(create('dir')).rejects.toThrow('database down');
    expect(state.rows).toHaveLength(0);
    expect(state.entries).toHaveLength(0);
    expect(state.events).toHaveLength(0);
  });

  it('a refused change writes nothing either', async () => {
    await expect(create('hr')).rejects.toBeTruthy();
    expect(state.entries).toHaveLength(0);
    expect(state.events).toHaveLength(0);
  });
});

describe('confirmations', () => {
  const multipliers = (ordinaryDay: string) => ({ multipliers: { ordinaryDay, restDay: '2.0' } });

  it('a multiplier set by the Director waits for the Accountant, who is told to confirm', async () => {
    const made = await create('dir', 'OVERTIME', { values: multipliers('1.5') });
    expect(made).toMatchObject({ confirmed: [], waiting: ['overtime.multipliers'] });
    expect(made.version.confirmations).toEqual([]);
    expect(made.notice.recipients).toContainEqual({ userId: 'acc', audience: 'ACCOUNTANT_TO_CONFIRM' });
    expect(state.entries[0]).toMatchObject({ category: 'RULES_PAY' });
  });

  it('the Accountant saves statutory and confirms it in the same step; the Director and HR are told, nobody else', async () => {
    const table = { tables: [{ code: 'NSSF', name: 'NSSF', bands: [{ fromAmount: '0', toAmount: null, ratePercent: '6', flatAmount: null }], note: null }] };
    const made = await create('acc', 'STATUTORY', { effectiveFrom: '2026-10-01', values: table });
    expect(made).toMatchObject({ confirmed: ['statutory'], waiting: [] });
    expect(made.version.confirmations).toMatchObject([{ scope: 'statutory', by: { id: 'acc', name: 'Ann Accountant' } }]);
    expect(new Set(made.notice.recipients.map((r) => r.audience))).toEqual(new Set(['DIRECTOR', 'HR']));
  });

  it('the Director saves the holiday list and confirms it; the Accountant saves the rate and confirms it; holidays turn on with the rate', async () => {
    const list = await create('dir', 'HOLIDAYS', { values: { holidays: [{ date: '2026-12-25', name: 'Christmas Day' }] } });
    expect(list).toMatchObject({ confirmed: ['holidays.dates'], waiting: [] });
    expect(list.version.values).toMatchObject({ enabled: false });

    const rate = await create('acc', 'HOLIDAYS', { values: { payMultiplier: '2.0' }, effectiveFrom: '2026-11-02' });
    expect(rate.confirmed.sort()).toEqual(['holidays.dates', 'holidays.pay_rate']); // the list's confirmation is carried forward
    expect(rate.version.values).toMatchObject({ enabled: true, payMultiplier: '2.0' });
    expect(rate.version.changedFields).toEqual(['payMultiplier']); // `enabled` is derived and never listed
  });

  it('an unchanged, confirmed scope is carried forward into the next version', async () => {
    seed({ group: 'OVERTIME', version: 1, effectiveFrom: day('2026-09-01'), values: { ...RULE_DEFAULTS.OVERTIME, ...multipliers('1.5') } });
    state.rows[0]!.confirmations.push({ id: 'c1', ruleVersionId: state.rows[0]!.id, scope: 'overtime.multipliers', confirmedById: 'acc', confirmerRole: 'ACCOUNTANT', confirmedAt: new Date(), note: null });
    const made = await create('dir', 'OVERTIME', { values: { serviceTailMinutes: 30 } });
    expect(made.confirmed).toEqual(['overtime.multipliers']);
    expect(made.version.confirmations[0]).toMatchObject({ note: 'Carried forward from version 1' });
  });

  it('a changed multiplier is not carried forward: it waits again', async () => {
    const earlier = seed({ group: 'OVERTIME', version: 1, effectiveFrom: day('2026-09-01'), values: { ...RULE_DEFAULTS.OVERTIME, ...multipliers('1.5') } });
    earlier.confirmations.push({ id: 'c1', ruleVersionId: earlier.id, scope: 'overtime.multipliers', confirmedById: 'acc', confirmerRole: 'ACCOUNTANT', confirmedAt: new Date(), note: null });
    const made = await create('dir', 'OVERTIME', { values: multipliers('1.75') });
    expect(made).toMatchObject({ confirmed: [], waiting: ['overtime.multipliers'] });
  });

  it('the Accountant cannot edit overtime at all, only confirm it', async () => {
    await expect(create('acc', 'OVERTIME', { values: multipliers('1.5') })).rejects.toMatchObject({ statusCode: 403 });
  });
});
