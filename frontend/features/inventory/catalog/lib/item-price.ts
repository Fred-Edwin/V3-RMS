import type { ItemHistoryEntry } from '../../types';

/** "8,900" or " 8900 " → "8900". People type thousands separators; the API takes a plain decimal. */
export function normalizePriceInput(raw: string): string {
  return raw.replace(/[,\s]/g, '');
}

const PRICE = /^\d{1,8}(\.\d{1,4})?$/;

/** Optional price, as the backend reads it: up to 8 digits and 4 decimals, more than zero. Empty is fine. */
export function validateOptionalPrice(raw: string): string | null {
  const value = normalizePriceInput(raw);
  if (value === '') return null;
  if (!PRICE.test(value) || Number.parseFloat(value) <= 0) return 'Enter an amount like 8,900 or 380.50.';
  return null;
}

/** "KES 8,900", "KES 178.5" — up to two decimals, none when whole. */
export function formatMoney(value: string | number): string {
  const n = typeof value === 'number' ? value : Number.parseFloat(value);
  return `KES ${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

/**
 * The price per usage unit for a price per pack: KES 8,900 a 50 kg bag is KES 178 a kg. `holds` is how many
 * usage units one pack holds; with none (the same unit both ways) the price is already per usage unit.
 * `null` when the numbers are not there yet.
 */
export function pricePerUsageUnit(pricePerPack: string, holds: string | null): number | null {
  const price = Number.parseFloat(normalizePriceInput(pricePerPack));
  if (!Number.isFinite(price) || price <= 0) return null;
  if (holds === null || holds.trim() === '') return price;
  const per = Number.parseFloat(holds);
  if (!Number.isFinite(per) || per <= 0) return null;
  return price / per;
}

const WHEN = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Nairobi' });

/** "12 Oct 09:58" */
export function formatHistoryWhen(iso: string): string {
  const parts = Object.fromEntries(WHEN.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return `${parts.day} ${parts.month} ${parts.hour}:${parts.minute}`;
}

/** The sentence the item page shows: "Created by Isabel Njoki", otherwise "{who} {what happened}". */
export function formatHistoryEntry(entry: Pick<ItemHistoryEntry, 'kind' | 'summary' | 'changedBy'>): string {
  return entry.kind === 'CREATED' ? `Created by ${entry.changedBy.name}` : `${entry.changedBy.name} ${entry.summary}`;
}
