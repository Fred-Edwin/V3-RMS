import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CAPABILITIES } from '../_shared/workforce-access';
import { RULE_DEFAULTS } from './rules-defaults';
import { RULE_FIELD_POLICY } from './rules-field-policy';
import { RULE_SCHEMAS, RULE_SITE_SCHEMAS, type RuleGroupCode } from './rules-schemas';

const GROUPS = Object.keys(RULE_SCHEMAS) as RuleGroupCode[];
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

describe('defaults', () => {
  it.each(GROUPS)('%s default validates', (group) => {
    expect(RULE_SCHEMAS[group].safeParse(RULE_DEFAULTS[group]).success).toBe(true);
  });

  it('statutory ships empty and holidays are off', () => {
    expect(RULE_DEFAULTS.STATUTORY).toEqual({ tables: [] });
    expect(RULE_DEFAULTS.HOLIDAYS).toMatchObject({ enabled: false, payMultiplier: null, holidays: [] });
    expect(RULE_DEFAULTS.OVERTIME.multipliers.standard).toBeNull();
  });

  it('the group keys equal the Prisma RuleGroup enum', () => {
    const schema = readFileSync(join(__dirname, '../../../../prisma/schema/workforce.prisma'), 'utf8');
    const body = /enum RuleGroup \{([^}]*)\}/.exec(schema)?.[1] ?? '';
    const values = body
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    expect(values).toEqual(GROUPS);
  });
});

describe('group rules', () => {
  it('AFTER_N_LATES needs a count', () => {
    expect(RULE_SCHEMAS.LATENESS.safeParse({ ...RULE_DEFAULTS.LATENESS, policy: 'AFTER_N_LATES' }).success).toBe(false);
    expect(RULE_SCHEMAS.LATENESS.safeParse({ ...RULE_DEFAULTS.LATENESS, policy: 'AFTER_N_LATES', afterLatesPerMonth: 3 }).success).toBe(true);
  });

  it('leave types must be unique and the default policy must use them', () => {
    const [first] = RULE_DEFAULTS.LEAVE.leaveTypes;
    expect(RULE_SCHEMAS.LEAVE.safeParse({ ...RULE_DEFAULTS.LEAVE, leaveTypes: [first, first] }).success).toBe(false);
    expect(RULE_SCHEMAS.LEAVE.safeParse({ ...RULE_DEFAULTS.LEAVE, defaultPolicy: { MADE_UP: 5 } }).success).toBe(false);
    expect(RULE_SCHEMAS.LEAVE.safeParse({ ...RULE_DEFAULTS.LEAVE, defaultPolicy: { ANNUAL: 21 } }).success).toBe(true);
  });

  it('the conduct ladder order is enforced', () => {
    const levels = clone(RULE_DEFAULTS.CONDUCT.levels).reverse();
    expect(RULE_SCHEMAS.CONDUCT.safeParse({ ...RULE_DEFAULTS.CONDUCT, levels }).success).toBe(false);
  });

  it('a week anchor on the wrong weekday fails; an impossible date does not crash', () => {
    const wrong = { weekStartsOn: 1, timesheetPeriod: { kind: 'FIXED_WEEKS', weeks: 4, anchorDate: '2026-09-22' } };
    expect(RULE_SCHEMAS.WEEK_AND_BREAKS.safeParse(wrong).success).toBe(false);
    const impossible = { weekStartsOn: 1, timesheetPeriod: { kind: 'FIXED_WEEKS', weeks: 4, anchorDate: '2026-02-30' } };
    expect(RULE_SCHEMAS.WEEK_AND_BREAKS.safeParse(impossible).success).toBe(false);
    expect(RULE_SCHEMAS.WEEK_AND_BREAKS.safeParse({ weekStartsOn: 7, timesheetPeriod: { kind: 'FIXED_WEEKS', weeks: 2, anchorDate: '2026-09-20' } }).success).toBe(true);
    expect(RULE_SCHEMAS.WEEK_AND_BREAKS.safeParse({ weekStartsOn: 3, timesheetPeriod: { kind: 'CALENDAR_MONTH' } }).success).toBe(true);
  });

  it('money and multipliers are decimal strings, never numbers', () => {
    expect(RULE_SCHEMAS.CASUAL_WORK.safeParse({ ...RULE_DEFAULTS.CASUAL_WORK, defaultDailyRate: '1500.50' }).success).toBe(true);
    expect(RULE_SCHEMAS.CASUAL_WORK.safeParse({ ...RULE_DEFAULTS.CASUAL_WORK, defaultDailyRate: 1500 }).success).toBe(false);
    expect(RULE_SCHEMAS.CASUAL_WORK.safeParse({ ...RULE_DEFAULTS.CASUAL_WORK, defaultDailyRate: '1500.555' }).success).toBe(false);
    expect(RULE_SCHEMAS.OVERTIME.safeParse({ ...RULE_DEFAULTS.OVERTIME, multipliers: { standard: '1.5' } }).success).toBe(true);
    expect(RULE_SCHEMAS.OVERTIME.safeParse({ ...RULE_DEFAULTS.OVERTIME, multipliers: { standard: 1.5 } }).success).toBe(false);
  });

  it('holiday dates must be real dates', () => {
    expect(RULE_SCHEMAS.HOLIDAYS.safeParse({ enabled: true, payMultiplier: null, holidays: [{ date: '2026-02-30', name: 'x' }] }).success).toBe(false);
  });
});

describe('field policy', () => {
  it.each(GROUPS)('%s: covers every field of the group, no more, no less', (group) => {
    expect(Object.keys(RULE_FIELD_POLICY[group]).sort()).toEqual(Object.keys(RULE_DEFAULTS[group]).sort());
  });

  it('every capability it names exists', () => {
    for (const group of GROUPS) {
      for (const policy of Object.values<{ edit: string; confirm?: { capability: string } }>(RULE_FIELD_POLICY[group])) {
        expect(CAPABILITIES).toContain(policy.edit);
        if (policy.confirm) expect(CAPABILITIES).toContain(policy.confirm.capability);
      }
    }
  });

  it.each(Object.keys(RULE_SITE_SCHEMAS) as (keyof typeof RULE_SITE_SCHEMAS)[])('the %s site schema holds exactly the site fields', (group) => {
    const siteFields = Object.entries<{ site: boolean }>(RULE_FIELD_POLICY[group])
      .filter(([, policy]) => policy.site)
      .map(([field]) => field)
      .sort();
    const defaults = RULE_DEFAULTS[group] as unknown as Record<string, unknown>;
    const full = Object.fromEntries(siteFields.map((field) => [field, defaults[field]]));
    const parsed = RULE_SITE_SCHEMAS[group].safeParse(full);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(Object.keys(parsed.data).sort()).toEqual(siteFields);
    for (const field of siteFields) {
      const { [field]: _removed, ...without } = full;
      expect(RULE_SITE_SCHEMAS[group].safeParse(without).success, `without ${field}`).toBe(false);
    }
  });

  it('only lateness, overtime and leave (minimum cover) can be overridden by a site', () => {
    expect(Object.keys(RULE_SITE_SCHEMAS).sort()).toEqual(['LATENESS', 'LEAVE', 'OVERTIME']);
  });
});
