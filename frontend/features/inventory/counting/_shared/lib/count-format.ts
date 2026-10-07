/** Small formatting helpers the Counting screens share. Words and numbers the server decides come ready-made; these are only for local ones. */

const NAIROBI = 'Africa/Nairobi';

/** "Tue 13 Oct 2026" in Nairobi, for the phone headers. */
export function todayLabel(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: NAIROBI, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).formatToParts(now);
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('weekday')} ${get('day')} ${get('month')} ${get('year')}`;
}

/** "07:19" in Nairobi from an ISO time. */
export function clockLabel(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: NAIROBI, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
}

/** "13 Oct 07:12" in Nairobi. */
export function dayClockLabel(iso: string): string {
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat('en-GB', { timeZone: NAIROBI, day: 'numeric', month: 'short' }).format(d);
  return `${day} ${clockLabel(iso)}`;
}

export const itemsLabel = (n: number): string => `${n} ${n === 1 ? 'item' : 'items'}`;

const MINUS = '−';
const nf0 = new Intl.NumberFormat('en-KE', { maximumFractionDigits: 0 });
const nfq = new Intl.NumberFormat('en-KE', { maximumFractionDigits: 4 });

/** "-2928.00" → "−2,928"; "120" → "+120" with `plus`. Whole shillings, as Paper draws them. */
export function signedMoney(value: string, plus = false): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  if (n === 0) return '0';
  return `${n < 0 ? MINUS : plus ? '+' : ''}${nf0.format(Math.abs(n))}`;
}

/** "-5681.00" → "−KES 5,681". */
export function signedKes(value: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return `${n < 0 ? MINUS : ''}KES ${nf0.format(Math.abs(n))}`;
}

const singular = (unit: string, n: number): string => (Math.abs(n) === 1 && unit.endsWith('s') && !unit.endsWith('ss') ? unit.slice(0, -1) : unit);

/** "-16" + "kg" → "−16 kg"; "-1" + "jars" → "−1 jar". */
export function signedQty(value: string, unit: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return `${n < 0 ? MINUS : n > 0 ? '+' : ''}${nfq.format(Math.abs(n))} ${singular(unit, n)}`;
}

/** "-8.9" → "−8.9%". */
export function signedPercent(value: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return `${n < 0 ? MINUS : n > 0 ? '+' : ''}${Math.abs(n).toFixed(1)}%`;
}

/** "164" → "164", "1000" → "1,000". */
export function plainQty(value: string | null): string {
  if (value === null || value === '') return '';
  const n = Number(value);
  return Number.isFinite(n) ? nfq.format(n) : value;
}

/** A number typed on the pad: digits and one point, no leading zeros ("007" → "7", "." → "0."), at most 4 decimals. */
export function appendDigit(current: string, digit: string): string {
  if (digit === '.') return current.includes('.') ? current : current === '' ? '0.' : `${current}.`;
  if (current === '0') return digit;
  const [, decimals] = current.split('.');
  if (decimals !== undefined && decimals.length >= 4) return current;
  if (current.replace('.', '').length >= 9) return current;
  return `${current}${digit}`;
}

/** "3" → "3", "12.50" → "12.5": the number as it is shown in a count box. */
export function showQty(value: string | null): string {
  if (value === null || value === '') return '';
  return /^\d+\.\d+$/.test(value) ? value.replace(/\.?0+$/, '') : value;
}
