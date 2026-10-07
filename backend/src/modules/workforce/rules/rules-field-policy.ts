import type { Capability } from '../_shared/workforce-access';
import type { RuleGroupCode, RuleValues } from './rules-schemas';

export interface FieldPolicy {
  edit: Capability;
  site: boolean; // may a site override carry this field
  confirm?: { scope: string; capability: Capability }; // scope is stored on RuleConfirmation
}

type Policy = { [G in RuleGroupCode]: Record<keyof RuleValues[G] & string, FieldPolicy> };

const groupEdit = (capability: Capability, keys: readonly string[], site = false): Record<string, FieldPolicy> =>
  Object.fromEntries(keys.map((k) => [k, { edit: capability, site }]));

export const RULE_FIELD_POLICY: Policy = {
  LATENESS: {
    graceMinutes: { edit: 'rules.edit.lateness', site: true },
    policy: { edit: 'rules.edit.lateness', site: true },
    afterLatesPerMonth: { edit: 'rules.edit.lateness', site: true },
    makeUpSameDay: { edit: 'rules.edit.lateness', site: true },
    excuseWindowHours: { edit: 'rules.edit.lateness', site: true },
    deductionCapPercentOfPay: { edit: 'rules.edit.lateness', site: false }, // company-wide (unit holders cannot write company rows)
  },
  OVERTIME: {
    serviceTailMinutes: { edit: 'rules.edit.overtime', site: true },
    weeklyCapMinutes: { edit: 'rules.edit.overtime', site: true },
    branchBudgetMinutesPerPeriod: { edit: 'rules.edit.overtime', site: true },
    approvalWindowHours: { edit: 'rules.edit.overtime', site: true },
    multipliers: { edit: 'rules.edit.overtime', site: false, confirm: { scope: 'overtime.multipliers', capability: 'rules.confirm.pay_rates' } },
  },
  ATTENDANCE: groupEdit('rules.edit.attendance', [
    'clockInOpensMinutesBefore',
    'autoCloseAfterMinutes',
    'locationRadiusMetres',
    'undoWindowSeconds',
    'clockSkewFlagMinutes',
    'shiftEndHeadsUpMinutes',
    'shiftEndPromptRepeatMinutes',
    'roundingMinutes',
    'roundingMode',
  ]) as Policy['ATTENDANCE'],
  LEAVE: {
    leaveTypes: { edit: 'rules.edit.leave', site: false },
    defaultPolicy: { edit: 'rules.edit.leave', site: false },
    minimumCover: { edit: 'rules.edit.leave', site: true },
  },
  PROBATION: groupEdit('rules.edit.probation', ['defaultMonths', 'maxExtensions', 'maxExtensionMonths']) as Policy['PROBATION'],
  CASUAL_WORK: groupEdit('rules.edit.casual_work', ['defaultDailyRate', 'rates', 'pettyCashHolder', 'latenessReducesPayout']) as Policy['CASUAL_WORK'],
  CONDUCT: groupEdit('rules.edit.conduct', ['levels', 'acknowledgeWithinDays', 'appealWithinDays']) as Policy['CONDUCT'],
  STATUTORY: {
    tables: { edit: 'rules.edit.statutory', site: false, confirm: { scope: 'statutory', capability: 'rules.confirm.statutory' } },
  },
  HOLIDAYS: {
    enabled: { edit: 'rules.edit.holidays', site: false, confirm: { scope: 'holidays.dates', capability: 'rules.confirm.holiday_list' } },
    holidays: { edit: 'rules.edit.holidays', site: false, confirm: { scope: 'holidays.dates', capability: 'rules.confirm.holiday_list' } },
    payMultiplier: { edit: 'rules.edit.holidays', site: false, confirm: { scope: 'holidays.pay_rate', capability: 'rules.confirm.pay_rates' } },
  },
  WEEK_AND_BREAKS: groupEdit('rules.edit.week_breaks', ['weekStartsOn', 'timesheetPeriod']) as Policy['WEEK_AND_BREAKS'],
};

/** Who is told when a version is created (decision D11). The service resolves these to people; delivery is a later slice. */
export type RuleNoticeAudience = 'DIRECTOR' | 'BRANCH_MANAGER_OF_SITE' | 'ALL_BRANCH_MANAGERS' | 'ACCOUNTANT_TO_CONFIRM' | 'DIRECTOR_TO_CONFIRM';
