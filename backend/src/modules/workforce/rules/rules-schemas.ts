import { z } from 'zod';
import { isoWeekday, parseNairobiDate } from '../_shared/time/nairobi-time';

const money = z.string().regex(/^\d{1,10}(\.\d{1,2})?$/, 'Use digits with up to 2 decimals');
const factor = z.string().regex(/^\d{1,2}(\.\d{1,4})?$/, 'Use digits with up to 4 decimals');
const multiplier = factor.refine((v) => Number(v) >= 1 && Number(v) <= 5, 'Use a number from 1 to 5');
const dailyRate = money.refine((v) => Number(v) >= 1 && Number(v) <= 100000, 'Use an amount from 1 to 100,000');
const minutes = (max: number) => z.number().int().min(0).max(max);
const nairobiDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    try {
      parseNairobiDate(v);
      return true;
    } catch {
      return false;
    }
  }, 'Not a real date');

// Every number in the defaults of these groups is an EXAMPLE (rules-defaults.ts), never a legal or policy value.

// 1. LATENESS (decision D11). Edited by the Director (any site) and a Branch Manager (own site, via a site override).
export const LatenessBase = z.object({
  graceMinutes: minutes(60),
  policy: z.enum(['RECORD_ONLY', 'AFTER_N_LATES', 'FROM_FIRST_MINUTE']),
  afterLatesPerMonth: z.number().int().min(1).max(31).nullable(), // required when policy is AFTER_N_LATES
  makeUpSameDay: z.boolean(),
  excuseWindowHours: minutes(720),
  deductionCapPercentOfPay: z.number().min(0).max(100).nullable(), // the legal limit is for the Accountant and the lawyer
});
const afterNNeedsCount = (v: { policy: string; afterLatesPerMonth: number | null }) => v.policy !== 'AFTER_N_LATES' || v.afterLatesPerMonth !== null;
export const LatenessRulesSchema = LatenessBase.refine(afterNNeedsCount, { message: 'Say after how many lates', path: ['afterLatesPerMonth'] });
// A site override carries only the rows the site makes its own (any subset); the merged result is checked by the full schema.
export const LatenessSiteSchema = LatenessBase.pick({
  graceMinutes: true,
  policy: true,
  afterLatesPerMonth: true,
  makeUpSameDay: true,
  excuseWindowHours: true,
}).partial();

// 2. OVERTIME (decision D10). Multipliers are confirmed by the Accountant. The public-holiday rate lives in HOLIDAYS (D19).
// An older stored { standard } reads as the ordinary-day rate.
const overtimeMultipliers = z.preprocess(
  (value) => {
    if (value !== null && typeof value === 'object' && 'standard' in value && !('ordinaryDay' in value)) {
      return { ordinaryDay: (value as { standard: unknown }).standard, restDay: null };
    }
    return value;
  },
  z.object({ ordinaryDay: multiplier.nullable(), restDay: multiplier.nullable() }),
);
export const OvertimeBase = z.object({
  serviceTailMinutes: minutes(120),
  weeklyCapMinutes: z.number().int().min(0).nullable(),
  branchBudgetMinutesPerPeriod: z.number().int().min(0).nullable(),
  approvalWindowHours: z.number().int().min(1).max(720),
  multipliers: overtimeMultipliers,
});
export const OvertimeRulesSchema = OvertimeBase;
export const OvertimeSiteSchema = OvertimeBase.pick({
  serviceTailMinutes: true,
  weeklyCapMinutes: true,
  branchBudgetMinutesPerPeriod: true,
  approvalWindowHours: true,
}).partial();

// 3. ATTENDANCE. Director only.
export const AttendanceRulesSchema = z.object({
  clockInOpensMinutesBefore: minutes(240),
  autoCloseAfterMinutes: z.number().int().min(1).max(240), // no answer to the shift-end prompt: closes at the scheduled end
  locationRadiusMetres: z.number().int().min(10).max(5000).nullable(), // null: keep using env CLOCK_GEOFENCE_RADIUS_METRES until slice 3
  undoWindowSeconds: minutes(600),
  clockSkewFlagMinutes: z.number().int().min(1).max(120), // device and server time further apart than this is flagged, never trusted
  shiftEndHeadsUpMinutes: minutes(60),
  shiftEndPromptRepeatMinutes: z.number().int().min(1).max(30),
  roundingMinutes: z.union([z.literal(0), z.literal(1), z.literal(5), z.literal(10), z.literal(15), z.literal(30)]), // 0 = no rounding
  roundingMode: z.enum(['NEAREST', 'DOWN', 'UP']),
});

// 4. LEAVE. HR sets the types and the default policy; a Branch Manager (own site) or the Director sets minimum cover.
const leaveType = z.object({
  code: z.string().regex(/^[A-Z][A-Z_]{1,23}$/),
  label: z.string().min(1).max(60),
  daysPerYear: z.number().min(0).max(366).nullable(),
  paid: z.boolean(),
  requiresReason: z.boolean(),
  // D18: the columns of the Leave types table. Older stored types read with these defaults.
  accrual: z.enum(['UP_FRONT', 'MONTHLY', 'PER_EVENT']).default('UP_FRONT'),
  perMonthDays: z.number().min(0).max(31).nullable().default(null), // for MONTHLY
  carryOverDays: z.number().min(0).max(366).default(0),
  sickNoteAfterDays: z.number().int().min(0).max(30).nullable().default(null),
  approvedBy: z.enum(['MANAGER', 'HR']).default('MANAGER'),
});
export const LeaveBase = z.object({
  leaveTypes: z.array(leaveType).min(1),
  defaultPolicy: z.record(z.string(), z.number().min(0).max(366)), // leave type code to days, used until a contract is assigned
  minimumCover: z.record(z.string(), z.number().int().min(0)), // department id to the fewest people on at once; only ever a warning
});
const leaveConsistent = (v: z.infer<typeof LeaveBase>) =>
  new Set(v.leaveTypes.map((t) => t.code)).size === v.leaveTypes.length &&
  Object.keys(v.defaultPolicy).every((code) => v.leaveTypes.some((t) => t.code === code));
const monthlyHasDays = (v: z.infer<typeof LeaveBase>) => v.leaveTypes.every((t) => t.accrual !== 'MONTHLY' || t.perMonthDays !== null);
export const LeaveRulesSchema = LeaveBase.refine(leaveConsistent, { message: 'Leave types must be unique and the default policy must use them' }).refine(monthlyHasDays, {
  message: 'Say how many days build up each month',
  path: ['leaveTypes'],
});
export const LeaveSiteSchema = LeaveBase.pick({ minimumCover: true }).partial();

// 5. PROBATION. Director only. D17: the reminder and the report days.
export const ProbationRulesSchema = z.object({
  defaultMonths: z.number().int().min(0).max(12),
  maxExtensions: z.number().int().min(0).max(3),
  maxExtensionMonths: z.number().int().min(0).max(12),
  reminderDaysBeforeEnd: z.number().int().min(1).max(60).default(14),
  reportDays: z
    .array(z.number().int().min(1).max(365))
    .min(1)
    .max(4)
    .refine((days) => days.every((day, i) => i === 0 || day > (days[i - 1] ?? 0)), 'Report days must go up')
    .default([45, 80]),
});

// 6. CASUAL_WORK. Director only (question 8). D16: rates are per department; an older per-position entry is dropped.
const casualRates = z.preprocess(
  (value) => (Array.isArray(value) ? value.filter((rate) => rate !== null && typeof rate === 'object' && 'departmentId' in rate) : value),
  z.array(z.object({ departmentId: z.string().min(1), dailyRate })),
);
export const CasualWorkRulesSchema = z
  .object({
    defaultDailyRate: money.nullable(),
    rates: casualRates,
    pettyCashHolder: z.discriminatedUnion('mode', [
      z.object({ mode: z.literal('BRANCH_MANAGER') }),
      z.object({ mode: z.literal('NAMED'), userId: z.string().min(1) }),
    ]),
    latenessReducesPayout: z.literal(true), // fixed by decision (proposal 2.6); shown, not editable
  })
  .refine((v) => new Set(v.rates.map((rate) => rate.departmentId)).size === v.rates.length, { message: 'One rate for each department', path: ['rates'] });

// 7. CONDUCT. The ladder's order is fixed in code; names, durations and letters are set here by the Director; HR reads.
const conductLevel = z.object({
  level: z.enum(['VERBAL_NOTE', 'WRITTEN_WARNING', 'FINAL_WRITTEN_WARNING']),
  label: z.string().min(1).max(60),
  validForMonths: z.number().int().min(1).max(60),
  requiresLetter: z.boolean(),
  issuableBy: z.array(z.enum(['UNIT_MANAGER', 'HR', 'DIRECTOR'])).min(1), // policy value; routes still need discipline.issue
});
export const ConductRulesSchema = z
  .object({
    levels: z.array(conductLevel).length(3),
    acknowledgeWithinDays: z.number().int().min(1).max(30),
    appealWithinDays: z.number().int().min(1).max(60),
  })
  .refine((v) => v.levels.map((l) => l.level).join() === 'VERBAL_NOTE,WRITTEN_WARNING,FINAL_WRITTEN_WARNING', {
    message: 'The ladder order is fixed',
    path: ['levels'],
  });

// 8. STATUTORY. Accountant only. Ships EMPTY: no rates are invented.
const band = z.object({
  fromAmount: money,
  toAmount: money.nullable(),
  ratePercent: z
    .string()
    .regex(/^\d{1,3}(\.\d{1,4})?$/)
    .refine((v) => Number(v) <= 100, 'A rate is 0 to 100')
    .nullable(),
  flatAmount: money.nullable(),
});
// Bands are contiguous and not overlapping: the first starts at 0, each starts where the one before ends, only the last is open-ended.
const bandsContiguous = (bands: z.infer<typeof band>[]): boolean =>
  bands.length > 0 &&
  bands.every((b, i) => {
    const next = bands[i + 1];
    const startsRight = i === 0 ? Number(b.fromAmount) === 0 : Number(b.fromAmount) === Number(bands[i - 1]?.toAmount);
    const endsRight = next ? b.toAmount !== null && Number(b.toAmount) > Number(b.fromAmount) : b.toAmount === null;
    return startsRight && endsRight && (b.ratePercent !== null || b.flatAmount !== null);
  });
export const StatutoryRulesSchema = z
  .object({
    tables: z.array(
      z.object({
        code: z.enum(['PAYE', 'NSSF', 'SHA', 'HOUSING_LEVY', 'RELIEF', 'OTHER']),
        name: z.string().min(1).max(80),
        bands: z.array(band).refine(bandsContiguous, 'Bands must start at 0, follow one another with no gap, and only the last has no upper limit'),
        note: z.string().max(500).nullable(),
      }),
    ),
  })
  .refine((v) => new Set(v.tables.map((t) => (t.code === 'OTHER' ? `OTHER:${t.name.toLowerCase()}` : t.code))).size === v.tables.length, {
    message: 'Each deduction appears once',
    path: ['tables'],
  });

// 9. HOLIDAYS. Off by default (decision D5). The Director edits and confirms the list, the Accountant the pay rate (D4).
// `enabled` is derived on every write (D14): on when a pay rate is set.
export const HolidaysRulesSchema = z
  .object({
    enabled: z.boolean(),
    payMultiplier: multiplier.nullable(),
    holidays: z.array(z.object({ date: nairobiDate, name: z.string().trim().min(1).max(80) })),
  })
  .refine((v) => new Set(v.holidays.map((h) => h.date)).size === v.holidays.length, { message: 'There is already a holiday on that date', path: ['holidays'] });

// 10. WEEK_AND_BREAKS. Director edits. The unpaid break is NOT here: it comes from each shift template (read-only on the screen).
const isoDay = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6), z.literal(7)]);
export const WeekAndBreaksRulesSchema = z
  .object({
    weekStartsOn: isoDay,
    timesheetPeriod: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('FIXED_WEEKS'), weeks: z.number().int().min(1).max(8), anchorDate: nairobiDate }),
      z.object({ kind: z.literal('CALENDAR_MONTH') }),
    ]),
    // Slice 4a: the period closes by itself this many days AFTER its last day, at this Nairobi time (October closes on
    // 2 Nov at 18:00), so the last days are complete when a manager reviews. An older stored value (daysBeforePeriodEnd)
    // is dropped on parse and the default applies.
    timesheetCutoff: z
      .object({
        daysAfterPeriodEnd: z.number().int().min(0).max(7).default(2),
        time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).default('18:00'),
      })
      .default({ daysAfterPeriodEnd: 2, time: '18:00' }),
  })
  .refine(
    (v) => {
      if (v.timesheetPeriod.kind !== 'FIXED_WEEKS') return true;
      try {
        // An impossible date is reported by the field's own check; this one must not throw on it.
        return isoWeekday(parseNairobiDate(v.timesheetPeriod.anchorDate)) === v.weekStartsOn;
      } catch {
        return true;
      }
    },
    { message: 'The first period must start on the first day of the week', path: ['timesheetPeriod'] },
  );

export const RULE_SCHEMAS = {
  LATENESS: LatenessRulesSchema,
  OVERTIME: OvertimeRulesSchema,
  ATTENDANCE: AttendanceRulesSchema,
  LEAVE: LeaveRulesSchema,
  PROBATION: ProbationRulesSchema,
  CASUAL_WORK: CasualWorkRulesSchema,
  CONDUCT: ConductRulesSchema,
  STATUTORY: StatutoryRulesSchema,
  HOLIDAYS: HolidaysRulesSchema,
  WEEK_AND_BREAKS: WeekAndBreaksRulesSchema,
} as const;

/** What a site override of each group may contain: only the fields that group lets a site change. */
export const RULE_SITE_SCHEMAS = {
  LATENESS: LatenessSiteSchema,
  OVERTIME: OvertimeSiteSchema,
  LEAVE: LeaveSiteSchema,
} as const;

export type RuleGroupCode = keyof typeof RULE_SCHEMAS;
export type RuleValues = { [G in RuleGroupCode]: z.infer<(typeof RULE_SCHEMAS)[G]> };
export type LatenessRules = RuleValues['LATENESS'];
export type OvertimeRules = RuleValues['OVERTIME'];
export type AttendanceRules = RuleValues['ATTENDANCE'];
export type WeekAndBreaksRules = RuleValues['WEEK_AND_BREAKS'];
