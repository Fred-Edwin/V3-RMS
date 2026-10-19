import type { Payslip } from './engine.types';
import { formatWhole, parseCents, roundDiv } from './money';
import { BIG_CHANGE_PERCENT, OVERTIME_HIGH_PERCENT } from './payroll-constants';

export type ReviewKind =
  | 'NEGATIVE_NET'
  | 'MISSING_PAY_PROFILE'
  | 'MISSING_BANK'
  | 'MOVED_BETWEEN_SYSTEMS'
  | 'UNPAID_ABSENCE'
  | 'LATENESS_DEDUCTION'
  | 'NEW_JOINER'
  | 'LEAVER'
  | 'ADJUSTMENT'
  | 'BIG_CHANGE'
  | 'OVERTIME_HIGH'
  | 'LATENESS_CAP_HIT'
  | 'MISSING_ID'
  | 'NO_TIMESHEET_DAYS'
  | 'BANK_DETAILS_CHANGED'
  | 'DUPLICATE_ACCOUNT'
  | 'ARREARS'
  | 'LEFT_OUT'; // made by the service when HR leaves someone out: already ticked, kept so the review shows who was left out

/** BLOCK: the month cannot be sent until HR resolves it. TICK: HR looks and ticks. */
export type ReviewSeverity = 'BLOCK' | 'TICK';

export interface ReviewFlag {
  kind: ReviewKind;
  severity: ReviewSeverity;
  text: string;
}

export const BLOCKING_KINDS: readonly ReviewKind[] = ['NEGATIVE_NET', 'MISSING_PAY_PROFILE', 'MISSING_BANK', 'MOVED_BETWEEN_SYSTEMS'];

/** What the loader knows about the person beyond the payslip. */
export interface PersonFacts {
  leftOut: boolean;
  hasPayProfile: boolean;
  payoutMethod: 'BANK' | 'MPESA' | 'CASH' | null;
  hasBankAccount: boolean;
  joinedThisMonth: boolean;
  firstPayrollMonth: boolean;
  leftThisMonth: boolean;
  employedDays: number;
  daysInMonth: number;
  lastMonthNet: string | null;
  missingIds: string[];
  timesheetDays: number;
  lateDayCount: number;
  lateMinutes: number;
  absentDays: number;
  bankChangedSinceLastMonth: boolean;
  duplicateAccount: boolean;
  movedBetweenSystems: boolean;
  leftOutEarlier: boolean;
  adjustmentCount: number;
}

const flag = (kind: ReviewKind, text: string): ReviewFlag => ({ kind, severity: BLOCKING_KINDS.includes(kind) ? 'BLOCK' : 'TICK', text });
const kes = (value: string): string => `KES ${formatWhole(parseCents(value))}`;

function blocks(facts: PersonFacts, slip: Payslip): ReviewFlag[] {
  const out: ReviewFlag[] = [];
  if (!facts.hasPayProfile || slip.problems.includes('NO_PAY_PROFILE') || slip.problems.includes('NO_HOURS_BASIS') || slip.problems.includes('NO_OVERTIME_RATE')) {
    const why = !facts.hasPayProfile || slip.problems.includes('NO_PAY_PROFILE') ? 'no pay profile' : slip.problems.includes('NO_OVERTIME_RATE') ? 'no confirmed overtime rate' : 'working hours not set on the pay profile';
    out.push(flag('MISSING_PAY_PROFILE', `Cannot be paid: ${why}`));
  }
  if (parseCents(slip.net) < 0n) out.push(flag('NEGATIVE_NET', `Deductions are more than pay: net ${kes(slip.net)}`));
  if (facts.payoutMethod === 'BANK' && !facts.hasBankAccount) out.push(flag('MISSING_BANK', 'Paid by bank but has no bank account'));
  if (facts.movedBetweenSystems) out.push(flag('MOVED_BETWEEN_SYSTEMS', 'Has hours here and an old payslip at another site this month'));
  return out;
}

function ticks(facts: PersonFacts, slip: Payslip): ReviewFlag[] {
  const out: ReviewFlag[] = [];
  const basic = parseCents(slip.basic);
  const net = parseCents(slip.net);
  if (parseCents(slip.unpaidAbsence) > 0n) out.push(flag('UNPAID_ABSENCE', `${facts.absentDays} ${facts.absentDays === 1 ? 'day' : 'days'} deducted, ${kes(slip.unpaidAbsence)}`));
  if (parseCents(slip.latenessDeduction) > 0n) out.push(flag('LATENESS_DEDUCTION', `${facts.lateDayCount} late ${facts.lateDayCount === 1 ? 'day' : 'days'}, ${facts.lateMinutes} min; ${kes(slip.latenessDeduction)} deducted`));
  if (slip.latenessCapHit) out.push(flag('LATENESS_CAP_HIT', 'Lateness deduction stopped at the most the Rules allow'));
  if (facts.firstPayrollMonth) out.push(flag('NEW_JOINER', `First payroll month: paid ${facts.employedDays} of ${facts.daysInMonth} days, ${kes(slip.net)} net`));
  else if (facts.joinedThisMonth) out.push(flag('NEW_JOINER', `Joined this month: paid ${facts.employedDays} of ${facts.daysInMonth} days`));
  if (facts.leftThisMonth) out.push(flag('LEAVER', `Left this month: paid ${facts.employedDays} of ${facts.daysInMonth} days, ${kes(slip.net)} net`));
  if (facts.adjustmentCount > 0) out.push(flag('ADJUSTMENT', `${facts.adjustmentCount} ${facts.adjustmentCount === 1 ? 'line' : 'lines'} added by HR`));
  if (facts.lastMonthNet !== null && !facts.firstPayrollMonth) {
    const last = parseCents(facts.lastMonthNet);
    if (last > 0n) {
      const change = roundDiv((net - last) * 100n, last);
      if (change > BigInt(BIG_CHANGE_PERCENT) || change < -BigInt(BIG_CHANGE_PERCENT)) out.push(flag('BIG_CHANGE', `Net pay is ${change > 0n ? change : -change}% ${change > 0n ? 'higher' : 'lower'} than last month`));
    }
  }
  if (basic > 0n && parseCents(slip.overtimePay) * 100n > basic * BigInt(OVERTIME_HIGH_PERCENT)) out.push(flag('OVERTIME_HIGH', `Overtime is more than ${OVERTIME_HIGH_PERCENT}% of basic pay`));
  if (facts.missingIds.length > 0) out.push(flag('MISSING_ID', `No ${facts.missingIds.join(', ')} on file`));
  if (facts.timesheetDays === 0 && facts.hasPayProfile) out.push(flag('NO_TIMESHEET_DAYS', 'Employed but has no days on the timesheet'));
  if (facts.bankChangedSinceLastMonth) out.push(flag('BANK_DETAILS_CHANGED', 'Bank details changed since last month'));
  if (facts.duplicateAccount) out.push(flag('DUPLICATE_ACCOUNT', 'The same bank account is on another person'));
  if (facts.leftOutEarlier) out.push(flag('ARREARS', 'Was left out of an earlier month: add what was missed as a line, or tick if nothing is owed'));
  return out;
}

/**
 * E5: the lines HR must look at. A person already left out has none (HR already decided). Blocks come first; the order inside a
 * severity is fixed, so a recalculation produces the same lines in the same order.
 */
export function reviewFlags(facts: PersonFacts, slip: Payslip): ReviewFlag[] {
  if (facts.leftOut) return [];
  return [...blocks(facts, slip), ...ticks(facts, slip)];
}
