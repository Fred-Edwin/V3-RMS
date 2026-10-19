import { createHash } from 'node:crypto';
import type { Payslip } from './engine.types';
import { formatCents, parseCents, type Cents } from './money';

export interface SiteSlip {
  siteId: string;
  payslip: Payslip;
}

export interface TotalsRow {
  people: number;
  basic: string;
  gross: string;
  taxStatutory: string;
  other: string;
  net: string;
  employerShare: string;
}

const empty = () => ({ people: 0, basic: 0n, gross: 0n, taxStatutory: 0n, other: 0n, net: 0n, employerShare: 0n });
type Acc = ReturnType<typeof empty>;

const add = (acc: Acc, slip: Payslip): void => {
  acc.people += 1;
  acc.basic += parseCents(slip.basic);
  acc.gross += parseCents(slip.gross);
  acc.taxStatutory += parseCents(slip.statutoryEmployee);
  acc.other += parseCents(slip.otherDeductions);
  acc.net += parseCents(slip.net);
  acc.employerShare += parseCents(slip.employerShare);
};

const toRow = (acc: Acc): TotalsRow => ({
  people: acc.people,
  basic: formatCents(acc.basic),
  gross: formatCents(acc.gross),
  taxStatutory: formatCents(acc.taxStatutory),
  other: formatCents(acc.other),
  net: formatCents(acc.net),
  employerShare: formatCents(acc.employerShare),
});

/** Totals are sums of the stored per-person figures, never of rounded displays (E5). */
export function monthTotals(rows: readonly SiteSlip[]): { total: TotalsRow; bySite: Map<string, TotalsRow> } {
  const total = empty();
  const sites = new Map<string, Acc>();
  for (const { siteId, payslip } of rows) {
    add(total, payslip);
    const acc = sites.get(siteId) ?? empty();
    add(acc, payslip);
    sites.set(siteId, acc);
  }
  return { total: toRow(total), bySite: new Map([...sites].map(([id, acc]) => [id, toRow(acc)])) };
}

/** The whole-month checks (E5): the by-site table must add up to the total, and gross − tax/statutory − other must equal net. */
export function totalsDisagree(rows: readonly SiteSlip[]): string[] {
  const { total, bySite } = monthTotals(rows);
  const problems: string[] = [];
  const sumSites = (pick: (row: TotalsRow) => string): Cents => [...bySite.values()].reduce((acc, row) => acc + parseCents(pick(row)), 0n);
  if (sumSites((r) => r.net) !== parseCents(total.net)) problems.push('The sites do not add up to the net pay');
  if (sumSites((r) => r.gross) !== parseCents(total.gross)) problems.push('The sites do not add up to the gross pay');
  if (parseCents(total.gross) - parseCents(total.taxStatutory) - parseCents(total.other) !== parseCents(total.net)) problems.push('Gross less deductions does not equal net pay');
  for (const { payslip } of rows) {
    const lineNet = payslip.lines.reduce((sum, line) => {
      if (line.kind === 'EARNING') return sum + parseCents(line.amount);
      if (line.kind === 'DEDUCTION' || line.kind === 'STATUTORY') return sum - parseCents(line.amount);
      return sum;
    }, 0n);
    if (lineNet !== parseCents(payslip.net)) {
      problems.push('A payslip does not equal its own lines');
      break;
    }
  }
  return problems;
}

const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
};

/** A stable hash of everything a run read, so two runs on the same inputs are known to be the same (and a changed input is visible). */
export const hashInputs = (inputs: unknown): string => createHash('sha256').update(canonical(inputs)).digest('hex');
