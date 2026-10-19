import { describe, expect, it } from 'vitest';
import { RULE_DEFAULTS } from '../rules-defaults';
import type { Values } from '../rules-values';
import { normaliseChange } from './plan-input';
import type { ChangeRequest } from './plan.types';
import { parseNairobiDate } from '../../_shared/time/nairobi-time';

const ask = (over: Partial<ChangeRequest> = {}): ChangeRequest => ({ siteId: null, effectiveFrom: parseNairobiDate('2026-11-01'), values: {}, ...over });
const company = (group: keyof typeof RULE_DEFAULTS): Values => RULE_DEFAULTS[group] as unknown as Values;

describe('a company change', () => {
  it('lays the supplied rows over what is in force, so a partial body works', () => {
    const { stored, before, after } = normaliseChange('LATENESS', ask({ values: { graceMinutes: 10 } }), { company: company('LATENESS'), site: {} });
    expect(stored).toEqual({ ...RULE_DEFAULTS.LATENESS, graceMinutes: 10 });
    expect(before.graceMinutes).toBe(5);
    expect(after.graceMinutes).toBe(10);
  });

  it('a full group works too', () => {
    const { stored } = normaliseChange('PROBATION', ask({ values: { ...RULE_DEFAULTS.PROBATION, defaultMonths: 6 } }), { company: company('PROBATION'), site: {} });
    expect(stored).toMatchObject({ defaultMonths: 6, reportDays: [45, 80] });
  });

  it('refuses a name that is not a setting of the tab', () => {
    expect(() => normaliseChange('LATENESS', ask({ values: { graceMinute: 10 } }), { company: company('LATENESS'), site: {} })).toThrow(expect.objectContaining({ code: 'RULE_FIELD_UNKNOWN' }));
  });

  it('checks the whole group, so a half-made policy is refused', () => {
    expect(() => normaliseChange('LATENESS', ask({ values: { policy: 'AFTER_N_LATES' } }), { company: company('LATENESS'), site: {} })).toThrow(/Say after how many lates/);
  });

  it('conduct: the screen sends months only and the label, letter and issuers stay', () => {
    const { stored } = normaliseChange('CONDUCT', ask({ values: { levels: [{ level: 'WRITTEN_WARNING', validForMonths: 9 }] } }), { company: company('CONDUCT'), site: {} });
    const levels = (stored as { levels: { level: string; validForMonths: number; label: string; requiresLetter: boolean }[] }).levels;
    expect(levels.map((l) => l.validForMonths)).toEqual([3, 9, 12]);
    expect(levels[1]).toMatchObject({ label: 'Written warning', requiresLetter: true });
  });

  it('holidays: the on/off switch follows the pay rate whatever was sent', () => {
    const on = normaliseChange('HOLIDAYS', ask({ values: { payMultiplier: '2.0', enabled: false } }), { company: company('HOLIDAYS'), site: {} });
    expect(on.stored.enabled).toBe(true);
    const off = normaliseChange('HOLIDAYS', ask({ values: { holidays: [{ date: '2026-12-25', name: 'Christmas Day' }], enabled: true } }), { company: company('HOLIDAYS'), site: {} });
    expect(off.stored.enabled).toBe(false);
  });
});

describe('a site change (an own rule, row by row)', () => {
  const at = { siteId: '3f6b1f0e-0c2a-4a53-9a55-0d6a3b9f2b11' };

  it('stores only the rows the site makes its own', () => {
    const { stored, before, after } = normaliseChange('LATENESS', ask({ ...at, values: { graceMinutes: 3 } }), { company: company('LATENESS'), site: {} });
    expect(stored).toEqual({ graceMinutes: 3 });
    expect(before.graceMinutes).toBe(5);
    expect(after.graceMinutes).toBe(3);
  });

  it('adds to the rows the site already has', () => {
    const { stored } = normaliseChange('LATENESS', ask({ ...at, values: { makeUpSameDay: true } }), { company: company('LATENESS'), site: { graceMinutes: 3 } });
    expect(stored).toEqual({ graceMinutes: 3, makeUpSameDay: true });
  });

  it('hands one row back with useCompanyRuleFor', () => {
    const { stored } = normaliseChange('LATENESS', ask({ ...at, useCompanyRuleFor: ['graceMinutes'] }), { company: company('LATENESS'), site: { graceMinutes: 3, makeUpSameDay: true } });
    expect(stored).toEqual({ makeUpSameDay: true });
  });

  it('an empty body hands every row back (D21)', () => {
    const { stored } = normaliseChange('LATENESS', ask({ ...at, values: {} }), { company: company('LATENESS'), site: { graceMinutes: 3, makeUpSameDay: true } });
    expect(stored).toEqual({});
  });

  it('refuses a row a site cannot own: the cap, a multiplier, a whole company-only tab', () => {
    expect(() => normaliseChange('LATENESS', ask({ ...at, values: { deductionCapPercentOfPay: 5 } }), { company: company('LATENESS'), site: {} })).toThrow(
      expect.objectContaining({ code: 'RULE_SITE_FIELD_NOT_OVERRIDABLE', statusCode: 422 }),
    );
    expect(() => normaliseChange('OVERTIME', ask({ ...at, values: { multipliers: { ordinaryDay: '1.5', restDay: null } } }), { company: company('OVERTIME'), site: {} })).toThrow(
      expect.objectContaining({ code: 'RULE_SITE_FIELD_NOT_OVERRIDABLE' }),
    );
    expect(() => normaliseChange('ATTENDANCE', ask({ ...at, values: { undoWindowSeconds: 60 } }), { company: company('ATTENDANCE'), site: {} })).toThrow(
      expect.objectContaining({ code: 'RULE_SITE_FIELD_NOT_OVERRIDABLE' }),
    );
  });

  it('the merged result must still make sense: an "after N lates" policy needs its count', () => {
    expect(() => normaliseChange('LATENESS', ask({ ...at, values: { policy: 'AFTER_N_LATES' } }), { company: company('LATENESS'), site: {} })).toThrow(/Say after how many lates/);
    const ok = normaliseChange('LATENESS', ask({ ...at, values: { policy: 'AFTER_N_LATES', afterLatesPerMonth: 3 } }), { company: company('LATENESS'), site: {} });
    expect(ok.stored).toEqual({ policy: 'AFTER_N_LATES', afterLatesPerMonth: 3 });
  });
});
