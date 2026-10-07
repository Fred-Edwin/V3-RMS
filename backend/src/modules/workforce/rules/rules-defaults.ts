import type { RuleValues } from './rules-schemas';

/** EXAMPLES ONLY, so the engine can run before anyone sets a rule. None of these is a legal or policy value. */
export const RULE_DEFAULTS: RuleValues = {
  LATENESS: { graceMinutes: 5, policy: 'RECORD_ONLY', afterLatesPerMonth: null, makeUpSameDay: false, excuseWindowHours: 48, deductionCapPercentOfPay: null },
  OVERTIME: { serviceTailMinutes: 15, weeklyCapMinutes: null, branchBudgetMinutesPerPeriod: null, approvalWindowHours: 48, multipliers: { standard: null } },
  ATTENDANCE: {
    clockInOpensMinutesBefore: 30,
    autoCloseAfterMinutes: 15,
    locationRadiusMetres: null,
    undoWindowSeconds: 120,
    clockSkewFlagMinutes: 10,
    shiftEndHeadsUpMinutes: 10,
    shiftEndPromptRepeatMinutes: 2,
    roundingMinutes: 0,
    roundingMode: 'NEAREST',
  },
  LEAVE: {
    leaveTypes: [
      { code: 'ANNUAL', label: 'Annual leave', daysPerYear: null, paid: true, requiresReason: false },
      { code: 'SICK', label: 'Sick leave', daysPerYear: null, paid: true, requiresReason: false },
      { code: 'EMERGENCY', label: 'Emergency leave', daysPerYear: null, paid: true, requiresReason: true },
      { code: 'UNPAID', label: 'Unpaid leave', daysPerYear: null, paid: false, requiresReason: true },
    ],
    defaultPolicy: {},
    minimumCover: {},
  },
  PROBATION: { defaultMonths: 3, maxExtensions: 1, maxExtensionMonths: 3 },
  CASUAL_WORK: { defaultDailyRate: null, rates: [], pettyCashHolder: { mode: 'BRANCH_MANAGER' }, latenessReducesPayout: true },
  CONDUCT: {
    levels: [
      { level: 'VERBAL_NOTE', label: 'Verbal note', validForMonths: 3, requiresLetter: false, issuableBy: ['UNIT_MANAGER', 'HR'] },
      { level: 'WRITTEN_WARNING', label: 'Written warning', validForMonths: 6, requiresLetter: true, issuableBy: ['UNIT_MANAGER', 'HR'] },
      { level: 'FINAL_WRITTEN_WARNING', label: 'Final written warning', validForMonths: 12, requiresLetter: true, issuableBy: ['HR'] },
    ],
    acknowledgeWithinDays: 3,
    appealWithinDays: 7,
  },
  STATUTORY: { tables: [] }, // ships empty; the Accountant types and confirms before the first pay run
  HOLIDAYS: { enabled: false, payMultiplier: null, holidays: [] }, // off by default (decision D5)
  WEEK_AND_BREAKS: { weekStartsOn: 1, timesheetPeriod: { kind: 'FIXED_WEEKS', weeks: 4, anchorDate: '2026-09-21' } }, // Monday; the anchor is the owner's sample period
};
