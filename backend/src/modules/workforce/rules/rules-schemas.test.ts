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
    expect(RULE_DEFAULTS.OVERTIME.multipliers).toEqual({ ordinaryDay: null, restDay: null });
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
    expect(RULE_SCHEMAS.OVERTIME.safeParse({ ...RULE_DEFAULTS.OVERTIME, multipliers: { ordinaryDay: '1.5', restDay: '2.0' } }).success).toBe(true);
    expect(RULE_SCHEMAS.OVERTIME.safeParse({ ...RULE_DEFAULTS.OVERTIME, multipliers: { ordinaryDay: 1.5, restDay: null } }).success).toBe(false);
  });

  it('a multiplier is 1 to 5; an older { standard } reads as the ordinary-day rate', () => {
    expect(RULE_SCHEMAS.OVERTIME.safeParse({ ...RULE_DEFAULTS.OVERTIME, multipliers: { ordinaryDay: '0.5', restDay: null } }).success).toBe(false);
    expect(RULE_SCHEMAS.OVERTIME.safeParse({ ...RULE_DEFAULTS.OVERTIME, multipliers: { ordinaryDay: '5.5', restDay: null } }).success).toBe(false);
    const parsed = RULE_SCHEMAS.OVERTIME.parse({ ...RULE_DEFAULTS.OVERTIME, multipliers: { standard: '1.5' } });
    expect(parsed.multipliers).toEqual({ ordinaryDay: '1.5', restDay: null });
  });

  it('casual rates are per department, one each, and an older per-position entry is dropped', () => {
    const rates = [{ departmentId: 'd1', dailyRate: '900.00' }];
    expect(RULE_SCHEMAS.CASUAL_WORK.safeParse({ ...RULE_DEFAULTS.CASUAL_WORK, rates }).success).toBe(true);
    expect(RULE_SCHEMAS.CASUAL_WORK.safeParse({ ...RULE_DEFAULTS.CASUAL_WORK, rates: [...rates, ...rates] }).success).toBe(false);
    expect(RULE_SCHEMAS.CASUAL_WORK.safeParse({ ...RULE_DEFAULTS.CASUAL_WORK, rates: [{ departmentId: 'd1', dailyRate: '0' }] }).success).toBe(false);
    const legacy = RULE_SCHEMAS.CASUAL_WORK.parse({ ...RULE_DEFAULTS.CASUAL_WORK, rates: [{ positionId: 'p1', dailyRate: '900' }] });
    expect(legacy.rates).toEqual([]);
  });

  it('probation: the reminder and report days are bounded, older stored values read with the defaults', () => {
    expect(RULE_SCHEMAS.PROBATION.parse({ defaultMonths: 3, maxExtensions: 1, maxExtensionMonths: 3 })).toMatchObject({ reminderDaysBeforeEnd: 14, reportDays: [45, 80] });
    expect(RULE_SCHEMAS.PROBATION.safeParse({ ...RULE_DEFAULTS.PROBATION, reportDays: [80, 45] }).success).toBe(false);
    expect(RULE_SCHEMAS.PROBATION.safeParse({ ...RULE_DEFAULTS.PROBATION, reminderDaysBeforeEnd: 0 }).success).toBe(false);
  });

  it('leave types: older stored types read with defaults, and a monthly type needs its days', () => {
    const old = { code: 'ANNUAL', label: 'Annual', daysPerYear: 21, paid: true, requiresReason: false };
    const parsed = RULE_SCHEMAS.LEAVE.parse({ ...RULE_DEFAULTS.LEAVE, leaveTypes: [old] });
    expect(parsed.leaveTypes[0]).toMatchObject({ accrual: 'UP_FRONT', carryOverDays: 0, approvedBy: 'MANAGER', sickNoteAfterDays: null });
    expect(RULE_SCHEMAS.LEAVE.safeParse({ ...RULE_DEFAULTS.LEAVE, leaveTypes: [{ ...old, accrual: 'MONTHLY' }] }).success).toBe(false);
    expect(RULE_SCHEMAS.LEAVE.safeParse({ ...RULE_DEFAULTS.LEAVE, leaveTypes: [{ ...old, accrual: 'MONTHLY', perMonthDays: 1.75 }] }).success).toBe(true);
  });

  it('statutory bands start at 0, follow with no gap, and only the last is open-ended', () => {
    const band = (fromAmount: string, toAmount: string | null, ratePercent: string | null = '10') => ({ fromAmount, toAmount, ratePercent, flatAmount: null });
    const table = (bands: ReturnType<typeof band>[]) => ({ tables: [{ code: 'PAYE', name: 'PAYE', bands, note: null }] });
    expect(RULE_SCHEMAS.STATUTORY.safeParse(table([band('0', '24000'), band('24000', null, '25')])).success).toBe(true);
    expect(RULE_SCHEMAS.STATUTORY.safeParse(table([band('0', '24000'), band('25000', null)])).success).toBe(false); // a gap
    expect(RULE_SCHEMAS.STATUTORY.safeParse(table([band('0', '24000'), band('20000', null)])).success).toBe(false); // an overlap
    expect(RULE_SCHEMAS.STATUTORY.safeParse(table([band('0', '24000')])).success).toBe(false); // the last must be open
    expect(RULE_SCHEMAS.STATUTORY.safeParse(table([band('1000', null)])).success).toBe(false); // must start at 0
    expect(RULE_SCHEMAS.STATUTORY.safeParse(table([band('0', null, '120')])).success).toBe(false); // a rate is 0 to 100
    expect(RULE_SCHEMAS.STATUTORY.safeParse(table([band('0', null, null)])).success).toBe(false); // a band has a rate or a flat amount
    expect(RULE_SCHEMAS.STATUTORY.safeParse({ tables: [] }).success).toBe(true); // ships empty
  });

  it('a deduction appears once in statutory', () => {
    const one = { code: 'NSSF', name: 'NSSF', bands: [{ fromAmount: '0', toAmount: null, ratePercent: '6', flatAmount: null }], note: null };
    expect(RULE_SCHEMAS.STATUTORY.safeParse({ tables: [one, one] }).success).toBe(false);
  });

  it('holiday dates must be real dates, one holiday a date, and the pay rate 1 to 5', () => {
    expect(RULE_SCHEMAS.HOLIDAYS.safeParse({ enabled: true, payMultiplier: null, holidays: [{ date: '2026-02-30', name: 'x' }] }).success).toBe(false);
    const day = { date: '2026-12-25', name: 'Christmas Day' };
    expect(RULE_SCHEMAS.HOLIDAYS.safeParse({ enabled: false, payMultiplier: null, holidays: [day, { ...day, name: 'Again' }] }).success).toBe(false);
    expect(RULE_SCHEMAS.HOLIDAYS.safeParse({ enabled: true, payMultiplier: '6', holidays: [] }).success).toBe(false);
  });
});

describe('field policy', () => {
  it.each(GROUPS)('%s: covers every field of the group, no more, no less', (group) => {
    expect(Object.keys(RULE_FIELD_POLICY[group]).sort()).toEqual(Object.keys(RULE_DEFAULTS[group]).sort());
  });

  it('every capability it names exists', () => {
    for (const group of GROUPS) {
      for (const policy of Object.values<{ edit: string | null; confirm?: { capability: string } }>(RULE_FIELD_POLICY[group])) {
        if (policy.edit !== null) expect(CAPABILITIES).toContain(policy.edit);
        if (policy.confirm) expect(CAPABILITIES).toContain(policy.confirm.capability);
      }
    }
  });

  it.each(Object.keys(RULE_SITE_SCHEMAS) as (keyof typeof RULE_SITE_SCHEMAS)[])('the %s site schema holds exactly the site fields, any subset of them', (group) => {
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
      const only = { [field]: full[field] };
      const one = RULE_SITE_SCHEMAS[group].safeParse(only);
      expect(one.success, `only ${field}`).toBe(true);
      if (one.success) expect(Object.keys(one.data)).toEqual([field]);
    }
    expect(RULE_SITE_SCHEMAS[group].safeParse({}).success).toBe(true); // "use the company rule again"
  });

  it('a fixed field has no editor, and a derived field never needs one', () => {
    expect(RULE_FIELD_POLICY.ATTENDANCE.roundingMinutes.edit).toBeNull();
    expect(RULE_FIELD_POLICY.CASUAL_WORK.latenessReducesPayout.edit).toBeNull();
    expect(RULE_FIELD_POLICY.WEEK_AND_BREAKS.timesheetCutoff.edit).toBeNull();
    expect(RULE_FIELD_POLICY.HOLIDAYS.enabled.derived).toBe(true);
  });

  it('pay fields are flagged: the multiplier, the cap, casual rates, statutory tables and the holiday rate', () => {
    const pay = GROUPS.flatMap((group) => Object.entries<{ pay?: boolean }>(RULE_FIELD_POLICY[group]).filter(([, p]) => p.pay === true).map(([field]) => `${group}.${field}`));
    expect(pay.sort()).toEqual(['CASUAL_WORK.defaultDailyRate', 'CASUAL_WORK.rates', 'HOLIDAYS.payMultiplier', 'LATENESS.deductionCapPercentOfPay', 'OVERTIME.multipliers', 'STATUTORY.tables']);
  });

  it('only lateness, overtime and leave (minimum cover) can be overridden by a site', () => {
    expect(Object.keys(RULE_SITE_SCHEMAS).sort()).toEqual(['LATENESS', 'LEAVE', 'OVERTIME']);
  });
});
