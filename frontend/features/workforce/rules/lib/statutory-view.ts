import type { RuleValues, StatutoryBand, StatutoryTable } from '../types/rules-types';
import { grouped } from './rules-words';

/** A band row as the Accountant types it: how wide the band is, and its rate. The last band has no upper limit. */
export interface BandDraft {
  width: string;
  rate: string;
}

const plain = (n: number): string => (Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2))));

/** "First 24,000", "Next 8,333", "Above 800,000": the way Paper writes bands (widths, not from and to). */
export function bandLabel(bands: readonly StatutoryBand[], index: number): string {
  const band = bands[index];
  if (!band) return '';
  if (band.toAmount === null) return index === 0 ? 'All income' : `Above ${grouped(plain(Number(band.fromAmount)))}`;
  const width = plain(Number(band.toAmount) - Number(band.fromAmount));
  return `${index === 0 ? 'First' : 'Next'} ${grouped(width)}`;
}

/** "10%", or the flat amount for a band that has one. */
export function bandValue(band: StatutoryBand): string {
  if (band.ratePercent !== null) return `${Number(band.ratePercent)}%`;
  return band.flatAmount !== null ? grouped(band.flatAmount) : '';
}

/** Draft rows from a stored table. */
export function toDraft(bands: readonly StatutoryBand[]): BandDraft[] {
  return bands.map((b) => ({ width: b.toAmount === null ? '' : plain(Number(b.toAmount) - Number(b.fromAmount)), rate: b.ratePercent === null ? '' : String(Number(b.ratePercent)) }));
}

const WIDTH = /^\d{1,10}(\.\d{1,2})?$/;
const RATE = /^\d{1,3}(\.\d{1,4})?$/;

export function bandProblem(rows: readonly BandDraft[]): string | null {
  if (rows.length === 0) return 'Add at least one band';
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as BandDraft;
    const last = i === rows.length - 1;
    if (!last && (!WIDTH.test(row.width) || Number(row.width) <= 0)) return `Band ${i + 1}: use a width above 0`;
    if (!RATE.test(row.rate) || Number(row.rate) > 100) return `Band ${i + 1}: use a rate from 0 to 100`;
  }
  return null;
}

/** Stored bands from the typed rows: cumulative from 0, the last one open-ended. */
export function fromDraft(rows: readonly BandDraft[]): StatutoryBand[] {
  let from = 0;
  return rows.map((row, i) => {
    const last = i === rows.length - 1;
    const to = last ? null : Math.round((from + Number(row.width)) * 100) / 100;
    const band: StatutoryBand = { fromAmount: plain(from), toAmount: to === null ? null : plain(to), ratePercent: String(Number(row.rate)), flatAmount: null };
    if (to !== null) from = to;
    return band;
  });
}

export const flatBand = (amount: string): StatutoryBand => ({ fromAmount: '0', toAmount: null, ratePercent: null, flatAmount: amount });

export interface HistoryLike {
  effectiveFrom: string;
  status: string;
  values: RuleValues;
}

/**
 * The day today's table took its present form: walk back from the version in force while the table is unchanged (D3 note: derived,
 * never typed per row). Returns null when there is no version in force.
 */
export function appliesFrom(items: readonly HistoryLike[], match: (tables: StatutoryTable[]) => StatutoryTable | undefined): string | null {
  const usable = items.filter((i) => i.status === 'IN_FORCE' || i.status === 'REPLACED');
  const tablesOf = (item: HistoryLike): StatutoryTable[] => (item.values as unknown as { tables: StatutoryTable[] }).tables ?? [];
  const first = usable[0];
  if (!first) return null;
  const current = JSON.stringify(match(tablesOf(first)) ?? null);
  let from = first.effectiveFrom;
  for (const item of usable) {
    if (JSON.stringify(match(tablesOf(item)) ?? null) !== current) break;
    from = item.effectiveFrom;
  }
  return from;
}
