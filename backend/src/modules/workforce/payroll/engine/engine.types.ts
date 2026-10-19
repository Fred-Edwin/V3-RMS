/** What the engine knows of a statutory table. It never reads a table's code or name to decide anything (P7). */
export interface TableRule {
  code: string;
  name: string;
  kind: 'BANDS' | 'RATE' | 'OTHER';
  base: 'GROSS' | 'BASIC' | 'TAXABLE' | 'BASIC_PLUS_ALLOWANCES';
  reducesTaxable: boolean;
  isIncomeTax: boolean;
  bands: { from: string; to: string | null; ratePercent: string | null; flatAmount: string | null }[];
  employerRatePercent: string | null;
  reliefMonthly: string | null;
  floorAmount: string | null;
  ceilingAmount: string | null;
}

export interface OvertimeMultipliers {
  ordinaryDay: string | null;
  restDay: string | null;
  publicHoliday: string | null;
}

export interface LatenessRule {
  policy: 'RECORD_ONLY' | 'AFTER_N_LATES' | 'FROM_FIRST_MINUTE';
  afterLatesPerMonth: number | null;
  deductionCapPercentOfPay: number | null;
}

/** The rules the month used, already resolved for the month's last day (Rules `getEffectiveRules`). */
export interface EngineRules {
  tables: TableRule[];
  multipliers: OvertimeMultipliers;
  lateness: LatenessRule;
  unpaidDayDivisor: number;
  versions: { ruleKey: string; version: number; effectiveFrom: string }[];
}

export type AdjustmentKind = 'ALLOWANCE' | 'INCENTIVE' | 'ARREARS' | 'OTHER_EARNING' | 'ADVANCE_REPAID' | 'HELB' | 'OTHER_DEDUCTION';
export const EARNING_ADJUSTMENTS: readonly AdjustmentKind[] = ['ALLOWANCE', 'INCENTIVE', 'ARREARS', 'OTHER_EARNING'];

export interface AdjustmentInput {
  id: string;
  kind: AdjustmentKind;
  label: string;
  amount: string; // KES with up to 2 decimals
  taxable: boolean; // only read for earnings
  reason: string;
}

/** One person's month, as the loader assembled it from the approved timesheets, the pay profile and the adjustments. */
export interface PersonInput {
  employeeId: string;
  name: string;
  siteId: string;
  payType: 'MONTHLY_SALARY' | 'DAILY_RATE';
  daysInMonth: number;
  /** Monthly: the amount in force and the calendar days it applied to (a joiner, a leaver or a pay change splits the month). Daily: the rate. */
  basisSegments: { amount: string; days: number }[];
  /** The amount in force on the last day with pay: the monthly salary, or the day rate for a daily-rate person. Hourly rates and absence start from it. */
  amountInForce: string | null;
  overtimeEligible: boolean;
  standardWeekHours: string | null;
  standardDayHours: string | null;
  workedMinutes: number;
  overtimeAuthorisedMinutes: { ordinaryDay: number; restDay: number; publicHoliday: number };
  holidayWorkedMinutes: number;
  /** Counted late days in date order (excused days left out), each with its minutes late. */
  lateDays: number[];
  absentDays: number;
  leaveDays: number;
  adjustments: AdjustmentInput[];
  timesheetDocument: string | null; // the site-month document, for a line's source
}

export type LineKind = 'EARNING' | 'DEDUCTION' | 'STATUTORY' | 'MEMO';

export interface PayLine {
  code: string;
  label: string;
  kind: LineKind;
  amount: string; // 2 decimals, as stored
  taxable: boolean;
  base: string | null; // 'GROSS', 'BASIC', ... for a statutory line
  baseAmount: string | null;
  rate: string | null; // "6%" for a rate; null for bands
  bandsUsed: { from: string; to: string | null; ratePercent: string | null; amount: string }[] | null;
  quantity: string | null;
  unit: string | null; // 'minutes', 'days', 'hours'
  source: { type: 'RULE' | 'PROFILE' | 'TIMESHEET' | 'ADJUSTMENT'; ruleKey?: string; version?: number; reference?: string };
  workingText: string;
  tableCode: string | null; // set on STATUTORY and the employer MEMO line, so exports can group by table
  share: 'EMPLOYEE' | 'EMPLOYER' | null;
}

export interface Payslip {
  employeeId: string;
  lines: PayLine[];
  basic: string;
  gross: string;
  statutoryEmployee: string; // includes income tax
  incomeTax: string;
  otherDeductions: string;
  net: string;
  employerShare: string;
  taxablePay: string;
  overtimePay: string;
  latenessDeduction: string;
  latenessCapHit: boolean;
  unpaidAbsence: string;
  problems: PayslipProblem[];
}

/** Why a payslip cannot be calculated at all (the review turns these into blocking lines). */
export type PayslipProblem = 'NO_PAY_PROFILE' | 'NO_HOURS_BASIS' | 'NO_OVERTIME_RATE';
