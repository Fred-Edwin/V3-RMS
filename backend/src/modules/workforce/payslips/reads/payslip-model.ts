import { formatCents, parseCents } from '../../payroll/engine/money';

/** A stored payslip version as plain strings, so the view maths can be tested without a database. */
export interface PayslipData {
  id: string;
  monthKey: string;
  version: number;
  number: string | null;
  gross: string;
  net: string;
  taxablePay: string;
  incomeTax: string;
  correctedAt: Date | null;
  lines: PayslipLine[];
}

export interface PayslipLine {
  code: string;
  label: string;
  kind: 'EARNING' | 'DEDUCTION' | 'STATUTORY' | 'MEMO';
  amount: string;
  share: string | null;
  taxable: boolean;
  workingText: string;
  baseAmount: string | null;
  bandsUsed: { from: string; to: string | null; ratePercent: string | null; amount: string }[] | null;
}

export interface LineView {
  key: string;
  label: string;
  amount: string;
  working: string | null;
  correctedFrom: string | null;
}

export interface Section {
  earnings: LineView[];
  gross: string;
  deductions: LineView[];
  totalDeductions: string;
  net: string;
}

const isEarning = (l: PayslipLine): boolean => l.kind === 'EARNING';
/** What was taken from the person: deductions and the employee share of statutory lines. The employer's share is a memo, never taken. */
const isDeduction = (l: PayslipLine): boolean => (l.kind === 'DEDUCTION' || l.kind === 'STATUTORY') && l.share !== 'EMPLOYER';
const isEmployer = (l: PayslipLine): boolean => l.share === 'EMPLOYER' || l.kind === 'MEMO';

const view = (l: PayslipLine, earlier: Map<string, string> | null): LineView => {
  const before = earlier?.get(l.code) ?? null;
  return { key: l.code, label: l.label, amount: l.amount, working: l.workingText || null, correctedFrom: before !== null && before !== l.amount ? before : null };
};

/** The month, in the three blocks of the screen. Version 2 marks every line that differs from version 1 as "corrected from". */
export function monthSection(p: PayslipData, previous: PayslipData | null): Section {
  const earlier = previous ? new Map(previous.lines.map((l) => [l.code, l.amount])) : null;
  return {
    earnings: p.lines.filter(isEarning).map((l) => view(l, earlier)),
    gross: p.gross,
    deductions: p.lines.filter(isDeduction).map((l) => view(l, earlier)),
    totalDeductions: formatCents(parseCents(p.gross) - parseCents(p.net)),
    net: p.net,
  };
}

/** What the employer paid on top and did not take from the person (the A4 document's box). */
export const employerLines = (p: PayslipData): LineView[] => p.lines.filter(isEmployer).map((l) => view(l, null));

/** Year to date: the same blocks added up across the months given (the latest version of each). No working lines: they are about one month. */
export function yearSection(months: readonly PayslipData[]): Section {
  const add = (pick: (l: PayslipLine) => boolean): LineView[] => {
    const sums = new Map<string, { label: string; cents: bigint }>();
    for (const p of months) {
      for (const l of p.lines.filter(pick)) {
        const prior = sums.get(l.code);
        sums.set(l.code, { label: l.label, cents: (prior?.cents ?? 0n) + parseCents(l.amount) });
      }
    }
    return [...sums].map(([key, v]) => ({ key, label: v.label, amount: formatCents(v.cents), working: null, correctedFrom: null }));
  };
  const gross = months.reduce((s, p) => s + parseCents(p.gross), 0n);
  const net = months.reduce((s, p) => s + parseCents(p.net), 0n);
  return { earnings: add(isEarning), gross: formatCents(gross), deductions: add(isDeduction), totalDeductions: formatCents(gross - net), net: formatCents(net) };
}

/** The year card on the home screen: earned, taken off, net paid. */
export function yearTotals(months: readonly PayslipData[]): { earned: string; takenOff: string; net: string } {
  const s = yearSection(months);
  return { earned: s.gross, takenOff: s.totalDeductions, net: s.net };
}

/** The latest version of each month, in month order. Versions come in any order. */
export function latestPerMonth<T extends { monthKey: string; version: number }>(rows: readonly T[]): T[] {
  const best = new Map<string, T>();
  for (const r of rows) {
    const prior = best.get(r.monthKey);
    if (!prior || r.version > prior.version) best.set(r.monthKey, r);
  }
  return [...best.values()].sort((a, b) => a.monthKey.localeCompare(b.monthKey));
}

/** "4412" from an account number: only the last four digits ever leave the server. */
export const last4 = (accountNumber: string | null): string | null => {
  const digits = (accountNumber ?? '').replace(/\D/g, '');
  return digits.length >= 4 ? digits.slice(-4) : null;
};

/** "A00•••••••Z": keep the first three and the last character of a tax or social security number. */
export function maskNumber(value: string | null): string {
  if (!value) return 'Not on file';
  if (value.length <= 4) return '•'.repeat(value.length);
  return `${value.slice(0, 3)}${'•'.repeat(value.length - 4)}${value.slice(-1)}`;
}
