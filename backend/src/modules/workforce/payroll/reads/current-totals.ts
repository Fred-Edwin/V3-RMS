import { formatCents, parseCents } from '../engine/money';
import { monthsRepository, type MonthRow } from '../months/months-repository';
import { readsRepository } from './reads-repository';

export interface TotalsRow {
  people: number;
  basic: string;
  gross: string;
  taxStatutory: string;
  other: string;
  net: string;
  employerShare: string;
}
export interface MonthTotals {
  total: TotalsRow;
  bySite: Record<string, TotalsRow>;
}

const FIELDS = ['basic', 'gross', 'taxStatutory', 'other', 'net', 'employerShare'] as const;

/**
 * The month's figures. Before publish they are the run's stored totals. Once published a correction can add a payslip version, so the
 * totals are summed from the latest version of each payslip (E6: "month totals recompute from the current versions"). The two agree
 * until a correction exists, which the database flow test proves.
 */
export async function monthTotals(month: Pick<MonthRow, 'state' | 'currentRunId'>): Promise<MonthTotals | null> {
  if (!month.currentRunId) return null;
  if (month.state === 'PUBLISHED' || month.state === 'PAID') {
    const sums = await readsRepository.siteSums(month.currentRunId);
    const total = sums.reduce<TotalsRow>(
      (acc, s) => ({
        people: acc.people + s.people,
        ...Object.fromEntries(FIELDS.map((f) => [f, formatCents(parseCents(acc[f]) + parseCents(s[f]))])),
      }) as TotalsRow,
      { people: 0, basic: '0.00', gross: '0.00', taxStatutory: '0.00', other: '0.00', net: '0.00', employerShare: '0.00' },
    );
    return { total, bySite: Object.fromEntries(sums.map(({ siteId, ...row }) => [siteId, row])) };
  }
  const run = await monthsRepository.run(month.currentRunId);
  const stored = run?.totals as { total?: TotalsRow; bySite?: Record<string, TotalsRow> } | null;
  if (!stored?.total) return null;
  return { total: stored.total, bySite: stored.bySite ?? {} };
}
