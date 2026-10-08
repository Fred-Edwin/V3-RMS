/** Quantities cross the wire as decimal strings. These helpers keep them as strings on the phone and never show "27.000". */

export const toNumber = (qty: string): number => {
  const n = Number(qty);
  return Number.isFinite(n) ? n : 0;
};

/** "27.50" shows as "27.5", "27.000" as "27". */
export const formatQty = (qty: string | number): string => {
  const n = typeof qty === 'number' ? qty : Number(qty);
  if (!Number.isFinite(n)) return String(qty);
  return String(Number(n.toFixed(3)));
};

/** A typed quantity: digits and one decimal point only; blank stays blank while typing. */
export const cleanTyped = (raw: string): string => {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  const [whole = '', ...rest] = cleaned.split('.');
  return rest.length ? `${whole}.${rest.join('')}` : whole;
};

/** A quantity the server accepts: above zero. */
export const isValidQty = (qty: string): boolean => qty.trim() !== '' && toNumber(qty) > 0;

export const stepQty = (qty: string, delta: 1 | -1): string => {
  const next = Math.max(1, Math.round(toNumber(qty)) + delta);
  return String(next);
};
