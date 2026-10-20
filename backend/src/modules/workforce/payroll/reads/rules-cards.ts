import type { EffectiveRules } from '../../rules';
import { divisorText } from '../engine/lines/earnings';
import { formatCents, parseCents } from '../engine/money';

export interface LineFigure {
  code: string;
  amount: string;
  quantity: string | null;
  payslipId: string;
  employeeName: string;
}

export interface RuleCard {
  ruleKey: 'OVERTIME' | 'LATENESS' | 'ABSENCE' | 'LEAVE' | 'HOLIDAYS';
  version: number;
  effectiveFrom: string | null;
  rows: { key: string; label: string; value: string }[];
  figures: Record<string, number | string>;
  largest: { name: string; text: string } | null;
}

const distinct = (lines: readonly LineFigure[]): number => new Set(lines.map((l) => l.payslipId)).size;
const total = (lines: readonly LineFigure[]): string => formatCents(lines.reduce((sum, l) => sum + parseCents(l.amount), 0n));
const sumQuantity = (lines: readonly LineFigure[]): number => lines.reduce((sum, l) => sum + Number(l.quantity ?? 0), 0);
const biggest = (lines: readonly LineFigure[]): LineFigure | null => [...lines].sort((a, b) => Number(parseCents(b.amount) - parseCents(a.amount)) || a.employeeName.localeCompare(b.employeeName, 'en'))[0] ?? null;
const hoursText = (minutes: number): string => `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`;
export const timesText = (value: string): string => `${value.includes('.') ? value.replace(/\.?0+$/, '') : value} ×`;

const LATENESS_WORDS = { RECORD_ONLY: 'Recorded only, nothing deducted', FROM_FIRST_MINUTE: 'From the first minute' } as const;

/** S2: what each rule said and what it did, from the month's frozen rules (never today's Rules) and the stored pay lines. */
export function ruleCards(rules: EffectiveRules, lines: readonly LineFigure[], weekHours: string | null): RuleCard[] {
  const of = (...codes: string[]) => lines.filter((l) => codes.includes(l.code));
  const overtime = of('OVERTIME_ORDINARY', 'OVERTIME_REST_DAY', 'OVERTIME_HOLIDAY');
  const late = of('LATENESS');
  const absence = of('UNPAID_ABSENCE');
  const holiday = of('HOLIDAY_PAY');
  const group = rules.OVERTIME;
  const ver = (g: { companyVersion: number; effectiveFrom: string | null }) => ({ version: g.companyVersion, effectiveFrom: g.effectiveFrom });
  const lateness = rules.LATENESS.values;
  const bigOvertime = biggest(overtime);
  const bigLate = biggest(late);
  const bigAbsence = biggest(absence);
  const cards: RuleCard[] = [
    {
      ruleKey: 'OVERTIME', ...ver(group),
      rows: [
        { key: 'paid', label: 'Paid when', value: 'A manager authorises it' },
        { key: 'ordinary', label: 'Ordinary day', value: group.values.multipliers.ordinaryDay ? timesText(group.values.multipliers.ordinaryDay) : 'Not set' },
        { key: 'rest', label: 'Rest day', value: group.values.multipliers.restDay ? timesText(group.values.multipliers.restDay) : 'Not set' },
        { key: 'holiday', label: 'Public holiday', value: rules.HOLIDAYS.values.payMultiplier ? timesText(rules.HOLIDAYS.values.payMultiplier) : 'Not set' },
        { key: 'hourly', label: 'Hourly rate', value: weekHours ? `Basic ÷ ${divisorText(weekHours)}` : 'Basic ÷ (week hours × 52 ÷ 12)' },
      ],
      figures: { people: distinct(overtime), authorisedMinutes: sumQuantity(overtime), authorised: hoursText(sumQuantity(overtime)), paid: total(overtime) },
      largest: bigOvertime ? { name: bigOvertime.employeeName, text: `${hoursText(Number(bigOvertime.quantity ?? 0))} · KES ${bigOvertime.amount}` } : null,
    },
    {
      ruleKey: 'LATENESS', ...ver(rules.LATENESS),
      rows: [
        { key: 'grace', label: 'Grace period', value: `${lateness.graceMinutes} min` },
        { key: 'policy', label: 'Deducted', value: lateness.policy === 'AFTER_N_LATES' ? `After ${lateness.afterLatesPerMonth ?? 1} late days in a month` : LATENESS_WORDS[lateness.policy] },
        { key: 'cap', label: 'Cap', value: lateness.deductionCapPercentOfPay === null ? 'No cap' : `${lateness.deductionCapPercentOfPay}% of basic` },
        { key: 'per', label: 'Counted per', value: 'Calendar month' },
      ],
      figures: { people: distinct(late), lateMinutes: sumQuantity(late), deducted: total(late) },
      largest: bigLate ? { name: bigLate.employeeName, text: `${bigLate.quantity ?? 0} min · KES ${bigLate.amount}` } : null,
    },
    {
      ruleKey: 'ABSENCE', ...ver(rules.LEAVE),
      rows: [
        { key: 'counts', label: 'Counts when', value: 'No clock-in and no leave' },
        { key: 'day', label: 'One unpaid day', value: `Basic ÷ ${rules.LEAVE.values.unpaidDayDivisor}` },
        { key: 'leave', label: 'Approved leave', value: 'Never unpaid' },
        { key: 'per', label: 'Counted per', value: 'Calendar month' },
      ],
      figures: { people: distinct(absence), unpaidDays: sumQuantity(absence), deducted: total(absence) },
      largest: bigAbsence ? { name: bigAbsence.employeeName, text: `${bigAbsence.quantity ?? 0} ${Number(bigAbsence.quantity) === 1 ? 'day' : 'days'} · KES ${bigAbsence.amount}` } : null,
    },
    {
      ruleKey: 'LEAVE', ...ver(rules.LEAVE),
      rows: [{ key: 'paid', label: 'Paid at', value: 'Normal pay' }, { key: 'deducted', label: 'Deducted', value: 'Never' }],
      figures: { people: 0, leaveDays: 0, deducted: '0.00' }, // leave days are 0 until the Leave feature is built
      largest: null,
    },
  ];
  if (rules.HOLIDAYS.values.holidays.length > 0) {
    cards.push({
      ruleKey: 'HOLIDAYS', ...ver(rules.HOLIDAYS),
      rows: [{ key: 'rate', label: 'Pay for hours worked', value: rules.HOLIDAYS.values.payMultiplier ? timesText(rules.HOLIDAYS.values.payMultiplier) : 'Not set' }],
      figures: { people: distinct(holiday), workedMinutes: sumQuantity(holiday), paid: total(holiday) },
      largest: null,
    });
  }
  return cards;
}
