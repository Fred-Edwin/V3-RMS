import { formatCents, parseCents } from '../../payroll/engine/money';
import type { PayslipData } from '../reads/payslip-model';
import type { P9ColumnKey } from './p9-layout';
import type { MonthRowState } from './p9-rules';

export type P9Values = Record<P9ColumnKey, string>;

export interface P9Row {
  monthKey: string;
  state: MonthRowState;
  values: P9Values | null;
}

const ZERO: P9Values = { gross: '0.00', contributions: '0.00', taxable: '0.00', taxCharged: '0.00', relief: '0.00', paye: '0.00' };

/**
 * One month's figures, read from the frozen payslip (PD16), never worked out from tax rules:
 *  - gross, taxable pay and PAYE are the payslip's own;
 *  - contributions that reduce taxable pay = the taxable earnings less the taxable pay (what was taken off before tax);
 *  - tax charged = the bands of the income tax line added up; relief = tax charged less PAYE (never below zero).
 * A payslip whose income tax line carries no bands shows tax charged equal to PAYE and no relief; the Accountant's format check covers it.
 */
export function p9Values(p: PayslipData): P9Values {
  const taxableEarnings = p.lines.filter((l) => l.kind === 'EARNING' && l.taxable).reduce((s, l) => s + parseCents(l.amount), 0n);
  const contributions = taxableEarnings - parseCents(p.taxablePay);
  const taxLine = p.lines.find((l) => l.kind === 'STATUTORY' && l.share !== 'EMPLOYER' && l.bandsUsed !== null && parseCents(l.amount) === parseCents(p.incomeTax));
  const charged = taxLine?.bandsUsed ? taxLine.bandsUsed.reduce((s, b) => s + parseCents(b.amount), 0n) : parseCents(p.incomeTax);
  const paye = parseCents(p.incomeTax);
  const relief = charged > paye ? charged - paye : 0n;
  return {
    gross: p.gross,
    contributions: formatCents(contributions > 0n ? contributions : 0n),
    taxable: p.taxablePay,
    taxCharged: formatCents(charged),
    relief: formatCents(relief),
    paye: p.incomeTax,
  };
}

export function p9Rows(states: readonly { monthKey: string; state: MonthRowState }[], latestByMonth: ReadonlyMap<string, PayslipData>): P9Row[] {
  return states.map((s) => {
    const slip = latestByMonth.get(s.monthKey);
    return { monthKey: s.monthKey, state: s.state, values: s.state === 'PAYSLIP' && slip ? p9Values(slip) : null };
  });
}

/** The totals row: the months that were paid, added column by column. */
export function p9Totals(rows: readonly P9Row[]): P9Values {
  const sums: Record<keyof P9Values, bigint> = { gross: 0n, contributions: 0n, taxable: 0n, taxCharged: 0n, relief: 0n, paye: 0n };
  for (const r of rows) for (const k of Object.keys(sums) as (keyof P9Values)[]) sums[k] += parseCents(r.values?.[k] ?? ZERO[k]);
  return { gross: formatCents(sums.gross), contributions: formatCents(sums.contributions), taxable: formatCents(sums.taxable), taxCharged: formatCents(sums.taxCharged), relief: formatCents(sums.relief), paye: formatCents(sums.paye) };
}
