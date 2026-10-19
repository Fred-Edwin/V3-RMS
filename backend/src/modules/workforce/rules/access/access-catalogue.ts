import type { RuleGroupCode } from '../rules-schemas';

/**
 * The rows of every Rules tab, by id, with the stored fields each row sets. A row is what the screen shows (one Change link);
 * several fields may share one row (a shift-end prompt sets two numbers, D28) and a Fixed row sets none. A static test checks
 * that every field of every group sits in exactly one row, so a new field cannot be left without an answer.
 * `short` is the few words the "Who edits what" table uses when a role edits only some of a tab's rows.
 */
export interface RowDef {
  id: string;
  fields: string[];
  fixed?: boolean; // the system sets it; nobody changes it
  short?: string;
}

export const ROWS: Record<RuleGroupCode, RowDef[]> = {
  LATENESS: [
    { id: 'graceMinutes', fields: ['graceMinutes'] },
    { id: 'afterGrace', fields: ['policy', 'afterLatesPerMonth'] },
    { id: 'deductionCap', fields: ['deductionCapPercentOfPay'], short: 'the deduction cap' },
    { id: 'excuseWindow', fields: ['excuseWindowHours'] },
    { id: 'makeUpSameDay', fields: ['makeUpSameDay'] },
  ],
  OVERTIME: [
    { id: 'serviceTail', fields: ['serviceTailMinutes'], short: 'tail' },
    { id: 'weeklyCap', fields: ['weeklyCapMinutes'], short: 'caps' },
    { id: 'branchBudget', fields: ['branchBudgetMinutesPerPeriod'], short: 'budget' },
    { id: 'approvalWindow', fields: ['approvalWindowHours'], short: 'window' },
    { id: 'multiplier', fields: ['multipliers'], short: 'the multiplier' },
  ],
  ATTENDANCE: [
    { id: 'clockInOpens', fields: ['clockInOpensMinutesBefore'] },
    { id: 'locationRadius', fields: ['locationRadiusMetres'] },
    { id: 'undoWindow', fields: ['undoWindowSeconds'] },
    { id: 'shiftEndPrompt', fields: ['shiftEndHeadsUpMinutes', 'shiftEndPromptRepeatMinutes'] },
    { id: 'autoClose', fields: ['autoCloseAfterMinutes'] },
    { id: 'clockSkew', fields: ['clockSkewFlagMinutes'] },
    { id: 'rounding', fields: ['roundingMinutes', 'roundingMode'], fixed: true },
  ],
  LEAVE: [
    { id: 'leaveTypes', fields: ['leaveTypes', 'defaultPolicy', 'unpaidDayDivisor'], short: 'leave types' },
    { id: 'minimumCover', fields: ['minimumCover'], short: 'minimum cover' },
  ],
  PROBATION: [
    { id: 'defaultMonths', fields: ['defaultMonths'] },
    { id: 'extension', fields: ['maxExtensions', 'maxExtensionMonths'] },
    { id: 'reminder', fields: ['reminderDaysBeforeEnd'] },
    { id: 'signedContract', fields: [], fixed: true },
    { id: 'reportDays', fields: ['reportDays'] },
  ],
  CASUAL_WORK: [
    { id: 'rates', fields: ['defaultDailyRate', 'rates'], short: 'the rates' },
    { id: 'whoRecords', fields: [], fixed: true },
    { id: 'whoApproves', fields: [], fixed: true },
    { id: 'cashHolder', fields: ['pettyCashHolder'], short: 'the cash holder' },
    { id: 'latenessReducesPayout', fields: ['latenessReducesPayout'], fixed: true },
  ],
  CONDUCT: [
    { id: 'levels', fields: ['levels'] },
    { id: 'acknowledgeWithin', fields: ['acknowledgeWithinDays'] },
    { id: 'appealWithin', fields: ['appealWithinDays'] },
  ],
  STATUTORY: [{ id: 'tables', fields: ['tables'] }],
  HOLIDAYS: [
    { id: 'holidays', fields: ['holidays', 'enabled'], short: 'the list' },
    { id: 'payRate', fields: ['payMultiplier'], short: 'the pay rate' },
  ],
  WEEK_AND_BREAKS: [
    { id: 'weekStartsOn', fields: ['weekStartsOn'] },
    { id: 'unpaidBreak', fields: [], fixed: true },
    { id: 'period', fields: ['timesheetPeriod', 'timesheetCutoff'], fixed: true },
  ],
};
