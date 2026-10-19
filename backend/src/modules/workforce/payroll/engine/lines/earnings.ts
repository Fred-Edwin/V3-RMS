import { EARNING_ADJUSTMENTS, type EngineRules, type PayLine, type PayslipProblem, type PersonInput } from '../engine.types';
import { formatCents, formatPercent, minCents, parseCents, parseScaled, percentOf, roundDiv, type Cents } from '../money';
import { daysText, minutesText, multiplierText, payLine, whole } from './line-text';

/** Cents per hour as a fraction, so a line is rounded once at the end and never from a rounded hourly rate. */
export interface Hourly {
  num: bigint;
  den: bigint;
}

export interface Earnings {
  basic: Cents;
  overtime: Cents;
  holiday: Cents;
  absence: Cents;
  lateness: Cents;
  latenessCapHit: boolean;
  allowances: Cents;
  nonTaxableEarnings: Cents;
  earningAdjustments: Cents;
  lines: PayLine[];
  problems: PayslipProblem[];
}

const MULTIPLIER_PLACES = 4;
const MULTIPLIER_SCALE = 10n ** BigInt(MULTIPLIER_PLACES);

/** Monthly: amount ÷ (week hours × 52 ÷ 12). Daily: rate ÷ day hours. Null when the hours are missing. */
export function hourlyRate(person: PersonInput): Hourly | null {
  if (person.amountInForce === null) return null;
  const amount = parseCents(person.amountInForce);
  if (person.payType === 'DAILY_RATE') {
    if (person.standardDayHours === null) return null;
    const dayHundredths = parseScaled(person.standardDayHours, 2);
    return dayHundredths > 0n ? { num: amount * 100n, den: dayHundredths } : null;
  }
  if (person.standardWeekHours === null) return null;
  const weekHundredths = parseScaled(person.standardWeekHours, 2);
  return weekHundredths > 0n ? { num: amount * 12n * 100n, den: weekHundredths * 52n } : null;
}

/** A line worked from approved hours cites the site-month document it came from. */
const fromSheet = (person: PersonInput, ruleKey: string): PayLine['source'] =>
  person.timesheetDocument === null ? { type: 'RULE', ruleKey } : { type: 'TIMESHEET', ruleKey, reference: person.timesheetDocument };

const payForMinutes =(minutes: number, rate: Hourly, multiplier: bigint = MULTIPLIER_SCALE): Cents => roundDiv(BigInt(minutes) * rate.num * multiplier, 60n * rate.den * MULTIPLIER_SCALE);
const hourlyText = (rate: Hourly): string => formatCents(roundDiv(rate.num, rate.den));
/** "Basic ÷ 208": the divisor Rules and the profile produce for a monthly person. */
export const divisorText = (weekHours: string): string => formatCents(roundDiv(parseScaled(weekHours, 2) * 52n * 100n, 12n * 100n)).replace(/\.00$/, '');

function basicFor(person: PersonInput, rate: Hourly | null, problems: PayslipProblem[]): { basic: Cents; line: PayLine | null } {
  if (person.amountInForce === null || person.basisSegments.length === 0) {
    problems.push('NO_PAY_PROFILE');
    return { basic: 0n, line: null };
  }
  const source = { type: 'PROFILE' as const };
  if (person.payType === 'DAILY_RATE') {
    if (rate === null) {
      problems.push('NO_HOURS_BASIS');
      return { basic: 0n, line: null };
    }
    const basic = payForMinutes(person.workedMinutes, rate);
    const workingText = `${minutesText(person.workedMinutes)} approved × ${hourlyText(rate)} an hour`;
    return { basic, line: payLine({ code: 'BASIC', label: 'Basic pay', kind: 'EARNING', amount: basic, taxable: true, quantity: String(person.workedMinutes), unit: 'minutes', source, workingText }) };
  }
  const numerator = person.basisSegments.reduce((total, segment) => total + parseCents(segment.amount) * BigInt(segment.days), 0n);
  const basic = roundDiv(numerator, BigInt(person.daysInMonth));
  const inEffect = person.basisSegments.reduce((total, segment) => total + segment.days, 0);
  const parts = person.basisSegments.map((segment) => `${whole(parseCents(segment.amount))} × ${segment.days}`).join(' + ');
  const workingText = inEffect >= person.daysInMonth && person.basisSegments.length === 1 ? `Monthly pay ${whole(basic)}` : `${parts} of ${person.daysInMonth} days`;
  return { basic, line: payLine({ code: 'BASIC', label: 'Basic pay', kind: 'EARNING', amount: basic, taxable: true, quantity: String(inEffect), unit: 'days', source, workingText }) };
}

function overtimeLines(person: PersonInput, rules: EngineRules, rate: Hourly | null, problems: PayslipProblem[]): { total: Cents; lines: PayLine[] } {
  const types = [
    { code: 'OVERTIME_ORDINARY', label: 'Overtime, ordinary day', minutes: person.overtimeAuthorisedMinutes.ordinaryDay, multiplier: rules.multipliers.ordinaryDay, ruleKey: 'OVERTIME' },
    { code: 'OVERTIME_REST_DAY', label: 'Overtime, rest day', minutes: person.overtimeAuthorisedMinutes.restDay, multiplier: rules.multipliers.restDay, ruleKey: 'OVERTIME' },
    { code: 'OVERTIME_HOLIDAY', label: 'Overtime, public holiday', minutes: person.overtimeAuthorisedMinutes.publicHoliday, multiplier: rules.multipliers.publicHoliday, ruleKey: 'HOLIDAYS' },
  ];
  const lines: PayLine[] = [];
  let total = 0n;
  for (const type of types) {
    if (!person.overtimeEligible || type.minutes <= 0) continue;
    if (rate === null) {
      if (!problems.includes('NO_HOURS_BASIS')) problems.push('NO_HOURS_BASIS');
      continue;
    }
    if (type.multiplier === null) {
      if (!problems.includes('NO_OVERTIME_RATE')) problems.push('NO_OVERTIME_RATE');
      continue;
    }
    const amount = payForMinutes(type.minutes, rate, parseScaled(type.multiplier, MULTIPLIER_PLACES));
    total += amount;
    const workingText = `${minutesText(type.minutes)} authorised × ${hourlyText(rate)} an hour × ${multiplierText(type.multiplier)}`;
    lines.push(payLine({ code: type.code, label: type.label, kind: 'EARNING', amount, taxable: true, quantity: String(type.minutes), unit: 'minutes', source: fromSheet(person, type.ruleKey), workingText }));
  }
  return { total, lines };
}

function holidayLine(person: PersonInput, rules: EngineRules, rate: Hourly | null, problems: PayslipProblem[]): { amount: Cents; line: PayLine | null } {
  const multiplier = rules.multipliers.publicHoliday;
  if (person.holidayWorkedMinutes <= 0) return { amount: 0n, line: null };
  if (rate === null || multiplier === null) {
    problems.push(rate === null ? 'NO_HOURS_BASIS' : 'NO_OVERTIME_RATE');
    return { amount: 0n, line: null };
  }
  const amount = payForMinutes(person.holidayWorkedMinutes, rate, parseScaled(multiplier, MULTIPLIER_PLACES));
  const workingText = `${minutesText(person.holidayWorkedMinutes)} on a public holiday × ${hourlyText(rate)} an hour × ${multiplierText(multiplier)}`;
  return { amount, line: payLine({ code: 'HOLIDAY_PAY', label: 'Public holiday pay', kind: 'EARNING', amount, taxable: true, quantity: String(person.holidayWorkedMinutes), unit: 'minutes', source: fromSheet(person, 'HOLIDAYS'), workingText }) };
}

function absenceLine(person: PersonInput, rules: EngineRules): { amount: Cents; line: PayLine | null } {
  if (person.payType !== 'MONTHLY_SALARY' || person.amountInForce === null || person.absentDays <= 0) return { amount: 0n, line: null };
  const monthly = parseCents(person.amountInForce);
  const amount = roundDiv(monthly * BigInt(person.absentDays), BigInt(rules.unpaidDayDivisor));
  const workingText = `${daysText(person.absentDays)} unpaid: ${whole(monthly)} ÷ ${rules.unpaidDayDivisor} × ${person.absentDays}`;
  return { amount, line: payLine({ code: 'UNPAID_ABSENCE', label: 'Unpaid absence', kind: 'DEDUCTION', amount, quantity: String(person.absentDays), unit: 'days', source: fromSheet(person, 'LEAVE'), workingText }) };
}

function latenessLine(person: PersonInput, rules: EngineRules, rate: Hourly | null, basic: Cents, problems: PayslipProblem[]): { amount: Cents; capHit: boolean; line: PayLine | null } {
  const { policy, afterLatesPerMonth, deductionCapPercentOfPay } = rules.lateness;
  const start = policy === 'AFTER_N_LATES' ? Math.max(0, (afterLatesPerMonth ?? 1) - 1) : 0;
  const counted = policy === 'RECORD_ONLY' ? [] : person.lateDays.slice(start);
  const minutes = counted.reduce((total, value) => total + value, 0);
  if (minutes <= 0) return { amount: 0n, capHit: false, line: null };
  if (rate === null) {
    if (!problems.includes('NO_HOURS_BASIS')) problems.push('NO_HOURS_BASIS');
    return { amount: 0n, capHit: false, line: null };
  }
  const uncapped = payForMinutes(minutes, rate);
  const cap = deductionCapPercentOfPay === null ? null : percentOf(basic, String(deductionCapPercentOfPay));
  const amount = cap === null ? uncapped : minCents(uncapped, cap);
  const capHit = cap !== null && uncapped > cap;
  const from = policy === 'AFTER_N_LATES' ? `${person.lateDays.length} late days, ${minutesText(person.lateDays.reduce((t, v) => t + v, 0))}; deducted from day ${start + 1} on: ` : '';
  const capText = capHit && deductionCapPercentOfPay !== null ? `; capped at ${formatPercent(String(deductionCapPercentOfPay))} of basic` : '';
  const workingText = `${from}${minutesText(minutes)} × ${hourlyText(rate)} an hour${capText}`;
  return { amount, capHit, line: payLine({ code: 'LATENESS', label: 'Lateness', kind: 'DEDUCTION', amount, quantity: String(minutes), unit: 'minutes', source: fromSheet(person, 'LATENESS'), workingText }) };
}

/** Basic, earnings, and the pay deductions taken before gross is fixed (E4 steps 1 to 3). */
export function calculateEarnings(person: PersonInput, rules: EngineRules): Earnings {
  const problems: PayslipProblem[] = [];
  const rate = hourlyRate(person);
  const { basic, line: basicLine } = basicFor(person, rate, problems);
  const overtime = overtimeLines(person, rules, rate, problems);
  const holiday = holidayLine(person, rules, rate, problems);
  const absence = absenceLine(person, rules);
  const lateness = latenessLine(person, rules, rate, basic, problems);

  let allowances = 0n;
  let nonTaxableEarnings = 0n;
  let earningAdjustments = 0n;
  const adjustmentLines: PayLine[] = [];
  for (const adjustment of person.adjustments.filter((a) => EARNING_ADJUSTMENTS.includes(a.kind))) {
    const amount = parseCents(adjustment.amount);
    earningAdjustments += amount;
    if (adjustment.kind === 'ALLOWANCE') allowances += amount;
    if (!adjustment.taxable) nonTaxableEarnings += amount;
    const workingText = `${adjustment.label}: ${whole(amount)} added by HR (${adjustment.reason})`;
    adjustmentLines.push(payLine({ code: adjustment.kind, label: adjustment.label, kind: 'EARNING', amount, taxable: adjustment.taxable, source: { type: 'ADJUSTMENT', reference: adjustment.id }, workingText }));
  }

  const lines = [basicLine, ...overtime.lines, holiday.line, ...adjustmentLines, absence.line, lateness.line].filter((line): line is PayLine => line !== null);
  return {
    basic,
    overtime: overtime.total,
    holiday: holiday.amount,
    absence: absence.amount,
    lateness: lateness.amount,
    latenessCapHit: lateness.capHit,
    allowances,
    nonTaxableEarnings,
    earningAdjustments,
    lines,
    problems,
  };
}
