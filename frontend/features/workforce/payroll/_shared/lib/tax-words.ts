import { kes } from './format';
import type { TaxTable } from '../types/tab-types';

/** The band rows of a tax table as the Rules Statutory tab stores them: widths and rates, with no table name or rate written here. */

const BASE_WORDS: Record<string, string> = {
  GROSS: 'Gross pay',
  BASIC: 'Basic pay',
  TAXABLE: 'Taxable pay',
  BASIC_PLUS_ALLOWANCES: 'Basic pay plus allowances',
};
export const baseWords = (base: string): string => BASE_WORDS[base] ?? base;

const percent = (rate: string | null): string => (rate === null ? '' : `${rate.includes('.') ? rate.replace(/\.?0+$/, '') : rate}%`);

export function bandRows(table: Pick<TaxTable, 'kind' | 'bands' | 'employerRatePercent'>): { label: string; value: string }[] {
  if (table.bands.length === 0) return [];
  if (table.kind === 'RATE' || table.bands.length === 1) {
    const only = table.bands[0]!;
    return [{ label: 'Rate', value: only.flatAmount ? `KES ${kes(only.flatAmount)}` : percent(only.ratePercent) }];
  }
  return table.bands.map((band, i) => {
    const first = i === 0;
    const last = band.to === null;
    const label = last ? `Above ${kes(band.from)}` : first ? `First ${kes(band.to)}` : `Next ${kes(subtract(band.to, band.from))}`;
    return { label, value: band.flatAmount ? `KES ${kes(band.flatAmount)}` : percent(band.ratePercent) };
  });
}

function subtract(to: string | null, from: string | null): string {
  const width = Number(to ?? 0) - Number(from ?? 0);
  return width.toFixed(2);
}
