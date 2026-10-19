import type { Capability } from '../_shared/workforce-access';
import type { RuleGroupCode, RuleValues } from './rules-schemas';

export interface FieldPolicy {
  /** Who may change it. null = the system sets it and nobody edits it (the screen says "Fixed"). */
  edit: Capability | null;
  site: boolean; // may a site override carry this field
  confirm?: { scope: string; capability: Capability }; // scope is stored on RuleConfirmation
  pay?: boolean; // D1: a change to this field is told without figures
  nextMonth?: boolean; // D10: the dialog suggests the first day of next month, so one month never mixes two rules
  derived?: boolean; // D14: the server computes it on every write; nobody types it and it never needs an editor
}

type Policy = { [G in RuleGroupCode]: Record<keyof RuleValues[G] & string, FieldPolicy> };

const fields = (capability: Capability, keys: readonly string[], extra: Partial<FieldPolicy> = {}): Record<string, FieldPolicy> =>
  Object.fromEntries(keys.map((k) => [k, { edit: capability, site: false, ...extra }]));
const fixed = (keys: readonly string[]): Record<string, FieldPolicy> => Object.fromEntries(keys.map((k) => [k, { edit: null, site: false }]));

export const RULE_FIELD_POLICY: Policy = {
  LATENESS: {
    ...fields('rules.edit.lateness', ['graceMinutes', 'policy', 'afterLatesPerMonth', 'makeUpSameDay', 'excuseWindowHours'], { site: true, nextMonth: true }),
    deductionCapPercentOfPay: { edit: 'rules.edit.lateness', site: false, pay: true, nextMonth: true }, // company-wide (unit holders cannot write company rows)
  } as Policy['LATENESS'],
  OVERTIME: {
    ...fields('rules.edit.overtime', ['serviceTailMinutes', 'weeklyCapMinutes', 'branchBudgetMinutesPerPeriod', 'approvalWindowHours'], { site: true, nextMonth: true }),
    multipliers: {
      edit: 'rules.edit.overtime',
      site: false,
      pay: true,
      nextMonth: true,
      confirm: { scope: 'overtime.multipliers', capability: 'rules.confirm.pay_rates' },
    },
  } as Policy['OVERTIME'],
  ATTENDANCE: {
    ...fields('rules.edit.attendance', [
      'clockInOpensMinutesBefore',
      'autoCloseAfterMinutes',
      'locationRadiusMetres',
      'undoWindowSeconds',
      'clockSkewFlagMinutes',
      'shiftEndHeadsUpMinutes',
      'shiftEndPromptRepeatMinutes',
    ]),
    ...fixed(['roundingMinutes', 'roundingMode']), // hours are never rounded (spec section 6)
  } as Policy['ATTENDANCE'],
  LEAVE: {
    ...fields('rules.edit.leave_types', ['leaveTypes', 'defaultPolicy']),
    unpaidDayDivisor: { edit: 'rules.edit.leave_types', site: false, pay: true, nextMonth: true },
    minimumCover: { edit: 'rules.edit.min_cover', site: true },
  } as Policy['LEAVE'],
  PROBATION: fields('rules.edit.probation', ['defaultMonths', 'maxExtensions', 'maxExtensionMonths', 'reminderDaysBeforeEnd', 'reportDays']) as Policy['PROBATION'],
  CASUAL_WORK: {
    ...fields('rules.edit.casual_work', ['defaultDailyRate', 'rates'], { pay: true, nextMonth: true }),
    ...fields('rules.edit.casual_work', ['pettyCashHolder']),
    ...fixed(['latenessReducesPayout']),
  } as Policy['CASUAL_WORK'],
  CONDUCT: fields('rules.edit.conduct', ['levels', 'acknowledgeWithinDays', 'appealWithinDays']) as Policy['CONDUCT'],
  STATUTORY: {
    tables: { edit: 'rules.edit.statutory', site: false, pay: true, nextMonth: true, confirm: { scope: 'statutory', capability: 'rules.confirm.statutory' } },
  },
  HOLIDAYS: {
    enabled: { edit: 'rules.edit.holidays', site: false, derived: true },
    holidays: { edit: 'rules.edit.holidays', site: false, confirm: { scope: 'holidays.dates', capability: 'rules.confirm.holiday_list' } },
    payMultiplier: {
      edit: 'rules.edit.holiday_pay',
      site: false,
      pay: true,
      nextMonth: true,
      confirm: { scope: 'holidays.pay_rate', capability: 'rules.confirm.pay_rates' },
    },
  },
  WEEK_AND_BREAKS: {
    ...fields('rules.edit.week_breaks', ['weekStartsOn']),
    ...fixed(['timesheetPeriod', 'timesheetCutoff']), // the month is the calendar month and nothing closes by itself (owner, 19 Oct)
  } as Policy['WEEK_AND_BREAKS'],
};

/**
 * Who is told when a version is created (spec section 18). The service resolves these to people; delivery is the
 * Notifications slice. ACCOUNTANT_TO_CONFIRM and DIRECTOR_TO_CONFIRM are people who must act, not just read.
 */
export type RuleNoticeAudience =
  | 'DIRECTOR'
  | 'BRANCH_MANAGER_OF_SITE'
  | 'ALL_BRANCH_MANAGERS'
  | 'HR'
  | 'ACCOUNTANT'
  | 'DEPARTMENT_HEADS'
  | 'ACCOUNTANT_TO_CONFIRM'
  | 'DIRECTOR_TO_CONFIRM';
