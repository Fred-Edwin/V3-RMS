import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseNairobiDate } from '../../_shared/time/nairobi-time';
import { RULE_DEFAULTS } from '../rules-defaults';
import { as, day, reset, seed } from '../testing/rules-fake';

vi.mock('./rules-repository', async (importOriginal) => ({ ...(await importOriginal<typeof import('./rules-repository')>()), rulesRepository: (await import('../testing/rules-fake')).fakeRulesRepository }));
vi.mock('../../../../config/database', () => ({ prisma: {} }));

import { getEffective } from './effective-service';
import { getEffectiveRuleGroup, getEffectiveRules, isPayConfirmed } from './rules-resolve';

const date = parseNairobiDate;
const lateness = (over: Record<string, unknown> = {}) => ({ ...RULE_DEFAULTS.LATENESS, ...over });
const confirmation = (scope: string, rowId: string) => ({ id: `c-${rowId}-${scope}`, ruleVersionId: rowId, scope, confirmedById: 'acc', confirmerRole: 'ACCOUNTANT', confirmedAt: new Date(), note: null });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-06T08:00:00Z')); // 11:00 in Nairobi
  reset();
});
afterEach(() => vi.useRealTimers());

describe('resolution', () => {
  it('serves the code defaults as version 0 when nothing exists', async () => {
    const rules = await getEffectiveRules('s1', date('2026-10-06'));
    expect(rules.LATENESS).toMatchObject({ isDefault: true, companyVersion: 0, siteVersion: null, effectiveFrom: null });
    expect(rules.LATENESS.values).toEqual(RULE_DEFAULTS.LATENESS);
    expect(rules.STATUTORY.values).toEqual({ tables: [] });
    expect(rules.HOLIDAYS.values.enabled).toBe(false);
  });

  it('picks the company version by date, and a later one is not yet in force', async () => {
    seed({ group: 'LATENESS', version: 1, effectiveFrom: day('2026-09-01'), values: lateness({ graceMinutes: 10 }) });
    seed({ group: 'LATENESS', version: 2, effectiveFrom: day('2026-10-20'), values: lateness({ graceMinutes: 15 }) });
    expect((await getEffectiveRuleGroup('s1', date('2026-10-06'), 'LATENESS')).values.graceMinutes).toBe(10);
    expect((await getEffectiveRuleGroup('s1', date('2026-10-20'), 'LATENESS')).values.graceMinutes).toBe(15);
    expect((await getEffectiveRuleGroup('s1', date('2026-08-01'), 'LATENESS')).isDefault).toBe(true);
  });

  it('on a tie the higher version wins', async () => {
    seed({ group: 'LATENESS', version: 1, effectiveFrom: day('2026-10-01'), values: lateness({ graceMinutes: 10 }) });
    seed({ group: 'LATENESS', version: 2, effectiveFrom: day('2026-10-01'), values: lateness({ graceMinutes: 12 }) });
    expect(await getEffectiveRuleGroup('s1', date('2026-10-06'), 'LATENESS')).toMatchObject({ companyVersion: 2, values: { graceMinutes: 12 } });
  });

  it('a withdrawn version is skipped: the one before it stays in force', async () => {
    seed({ group: 'LATENESS', version: 1, effectiveFrom: day('2026-09-01'), values: lateness({ graceMinutes: 10 }) });
    seed({
      group: 'LATENESS',
      version: 2,
      effectiveFrom: day('2026-10-01'),
      values: lateness({ graceMinutes: 20 }),
      withdrawal: { id: 'w', ruleVersionId: 'x', withdrawnById: 'dir', withdrawnByRole: 'DIRECTOR', withdrawnAt: new Date(), reason: 'changed my mind' },
    });
    expect(await getEffectiveRuleGroup('s1', date('2026-10-06'), 'LATENESS')).toMatchObject({ companyVersion: 1, values: { graceMinutes: 10 } });
  });

  it('a site override supplies only its own rows, whatever subset', async () => {
    seed({ group: 'LATENESS', version: 1, values: lateness({ graceMinutes: 10, excuseWindowHours: 72, deductionCapPercentOfPay: 20 }) });
    seed({ group: 'LATENESS', siteId: 's1', version: 1, values: { graceMinutes: 3 } });
    const atS1 = await getEffectiveRuleGroup('s1', date('2026-10-06'), 'LATENESS');
    expect(atS1.values).toMatchObject({ graceMinutes: 3, excuseWindowHours: 72, deductionCapPercentOfPay: 20 });
    expect(atS1.siteVersion).toBe(1);
    expect((await getEffectiveRuleGroup('s2', date('2026-10-06'), 'LATENESS')).values.graceMinutes).toBe(10);
  });

  it('an empty site override follows the company rule', async () => {
    seed({ group: 'LATENESS', version: 1, values: lateness({ graceMinutes: 10 }) });
    seed({ group: 'LATENESS', siteId: 's1', version: 1, values: { graceMinutes: 3 } });
    seed({ group: 'LATENESS', siteId: 's1', version: 2, values: {} });
    expect((await getEffectiveRuleGroup('s1', date('2026-10-06'), 'LATENESS')).values.graceMinutes).toBe(10);
  });

  it('refuses stored values that no longer pass the schema', async () => {
    seed({ group: 'LATENESS', values: lateness({ graceMinutes: 'ten' }) });
    await expect(getEffectiveRuleGroup('s1', date('2026-10-06'), 'LATENESS')).rejects.toThrow();
  });

  it('reads an older overtime multiplier { standard } as the ordinary-day rate', async () => {
    seed({ group: 'OVERTIME', values: { ...RULE_DEFAULTS.OVERTIME, multipliers: { standard: '1.5' } }, confirmations: [confirmation('overtime.multipliers', 'seed1')] });
    expect((await getEffectiveRuleGroup('s1', date('2026-10-06'), 'OVERTIME')).values.multipliers).toEqual({ ordinaryDay: '1.5', restDay: null });
  });

  it('holidays are on exactly when a pay rate is set (derived)', async () => {
    seed({ group: 'HOLIDAYS', values: { enabled: false, payMultiplier: '2.0', holidays: [] }, confirmations: [confirmation('holidays.pay_rate', 'seed1')] });
    expect((await getEffectiveRuleGroup('s1', date('2026-10-06'), 'HOLIDAYS')).values.enabled).toBe(true);
  });
});

describe('a pay rate waits for its confirmation (D2)', () => {
  const overtime = (ordinaryDay: string | null) => ({ ...RULE_DEFAULTS.OVERTIME, multipliers: { ordinaryDay, restDay: null } });

  it('the older confirmed multiplier stays in use until the new one is confirmed', async () => {
    seed({ group: 'OVERTIME', version: 1, effectiveFrom: day('2026-09-01'), values: overtime('1.50'), confirmations: [confirmation('overtime.multipliers', 'seed1')] });
    seed({ group: 'OVERTIME', version: 2, effectiveFrom: day('2026-10-01'), values: overtime('1.75') });
    const group = await getEffectiveRuleGroup('s1', date('2026-10-06'), 'OVERTIME');
    expect(group.values.multipliers.ordinaryDay).toBe('1.50');
    expect(group).toMatchObject({ companyVersion: 2, pendingConfirmations: ['overtime.multipliers'], missingConfirmations: [] });
    expect(isPayConfirmed(group).ready).toBe(true);
  });

  it('once confirmed, the new multiplier applies from its own date', async () => {
    seed({ group: 'OVERTIME', version: 1, effectiveFrom: day('2026-09-01'), values: overtime('1.50'), confirmations: [confirmation('overtime.multipliers', 'seed1')] });
    seed({ group: 'OVERTIME', version: 2, effectiveFrom: day('2026-10-10'), values: overtime('1.75'), confirmations: [confirmation('overtime.multipliers', 'seed2')] });
    expect((await getEffectiveRuleGroup('s1', date('2026-10-06'), 'OVERTIME')).values.multipliers.ordinaryDay).toBe('1.50');
    expect((await getEffectiveRuleGroup('s1', date('2026-10-10'), 'OVERTIME')).values.multipliers.ordinaryDay).toBe('1.75');
  });

  it('if nothing was ever confirmed, payroll refuses (the value is kept, the scope is missing)', async () => {
    seed({ group: 'OVERTIME', version: 1, effectiveFrom: day('2026-09-01'), values: overtime('1.75') });
    const group = await getEffectiveRuleGroup('s1', date('2026-10-06'), 'OVERTIME');
    expect(group).toMatchObject({ missingConfirmations: ['overtime.multipliers'], pendingConfirmations: [] });
    expect(isPayConfirmed(group)).toEqual({ ready: false, reasons: ['Waiting for confirmation: overtime.multipliers'] });
  });
});

describe('isPayConfirmed', () => {
  it('is not ready with empty statutory tables', async () => {
    expect((isPayConfirmed(await getEffectiveRuleGroup('s1', date('2026-10-06'), 'STATUTORY'))).ready).toBe(false);
  });

  it('a group with nothing set is ready', async () => {
    expect(isPayConfirmed(await getEffectiveRuleGroup('s1', date('2026-10-06'), 'LATENESS')).ready).toBe(true);
  });
});

describe('getEffective (HTTP read)', () => {
  it('STATUTORY is locked without payrun.read, open with it', async () => {
    const asManager = await getEffective(as('bm1'), 's1', date('2026-10-06'));
    expect(asManager.groups.find((g) => g.group === 'STATUTORY')).toEqual({ group: 'STATUTORY', locked: true });
    const asAccountant = await getEffective(as('acc'), 's1', date('2026-10-06'));
    expect(asAccountant.groups.find((g) => g.group === 'STATUTORY')).toMatchObject({ isDefault: true });
  });

  it('a holder limited to one site gets a 404 for another site, a waiter gets 403, another company is a 404', async () => {
    await expect(getEffective(as('bm1'), 's2', date('2026-10-06'))).rejects.toMatchObject({ statusCode: 404 });
    await expect(getEffective(as('w1'), 's1', date('2026-10-06'))).rejects.toMatchObject({ statusCode: 403 });
    await expect(getEffective(as('dir'), 'sx', date('2026-10-06'))).rejects.toMatchObject({ statusCode: 404 });
  });
});
