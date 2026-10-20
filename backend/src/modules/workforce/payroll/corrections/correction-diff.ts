import type { PayLine, Payslip } from '../engine/engine.types';
import { formatCents, parseCents } from '../engine/money';

/** The lines of a payslip as the database holds them (and as the engine makes them): enough to compare. */
export type ComparableLine = Pick<PayLine, 'code' | 'label' | 'kind' | 'amount' | 'tableCode' | 'share'> & { source: { reference?: string } | unknown };

export interface DiffLine {
  code: string;
  label: string;
  now: string | null;
  corrected: string | null;
}

export type Totals = Pick<Payslip, 'gross' | 'net' | 'statutoryEmployee' | 'otherDeductions' | 'employerShare'>;

export interface PayslipDiff {
  lines: DiffLine[];
  totals: { now: Totals; corrected: Totals };
  netChange: string;
}

/** Two lines are "the same line" when the code, the table, the share and the adjustment they came from agree; repeats are numbered. */
function keyed(lines: readonly ComparableLine[]): Map<string, ComparableLine> {
  const seen = new Map<string, number>();
  const map = new Map<string, ComparableLine>();
  for (const line of lines) {
    const reference = (line.source as { reference?: string } | null)?.reference ?? '';
    const base = `${line.code}|${line.tableCode ?? ''}|${line.share ?? ''}|${reference}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    map.set(`${base}|${n}`, line);
  }
  return map;
}

/** E6: lines that changed are listed; lines that did not are not. Money stays text with 2 decimals, never a float. */
export function diffPayslips(before: { lines: readonly ComparableLine[]; totals: Totals }, after: { lines: readonly ComparableLine[]; totals: Totals }): PayslipDiff {
  const was = keyed(before.lines);
  const now = keyed(after.lines);
  const lines: DiffLine[] = [];
  for (const [key, line] of was) {
    const next = now.get(key);
    if (!next) lines.push({ code: line.code, label: line.label, now: line.amount, corrected: null });
    else if (parseCents(next.amount) !== parseCents(line.amount)) lines.push({ code: line.code, label: next.label, now: line.amount, corrected: next.amount });
  }
  for (const [key, line] of now) if (!was.has(key)) lines.push({ code: line.code, label: line.label, now: null, corrected: line.amount });
  return { lines, totals: { now: before.totals, corrected: after.totals }, netChange: formatCents(parseCents(after.totals.net) - parseCents(before.totals.net)) };
}

export const totalsOf = (p: Totals): Totals => ({ gross: p.gross, net: p.net, statutoryEmployee: p.statutoryEmployee, otherDeductions: p.otherDeductions, employerShare: p.employerShare });

/** True when nothing a person would see has changed (the Save button stays off: "This changes nothing."). */
export const isNoChange = (diff: PayslipDiff): boolean => diff.lines.length === 0 && Object.keys(diff.totals.now).every((k) => parseCents(diff.totals.now[k as keyof Totals]) === parseCents(diff.totals.corrected[k as keyof Totals]));
