/** Branch waste wording helpers both the phone and the desktop screens use (one copy, so the two read the same). */

/** "Grace Wanjiru" → "Grace W." (a first name and a last initial, as Paper draws other people). */
export function shortPerson(name: string): string {
  const [first = '', ...rest] = name.trim().split(/\s+/).filter(Boolean);
  const last = rest[rest.length - 1];
  return last ? `${first} ${last.charAt(0).toUpperCase()}.` : first;
}

const quantityFormat = new Intl.NumberFormat('en-KE', { maximumFractionDigits: 4 });

/** "2" + "kg" → "2 kg"; "2.0000" → "2"; "1.50" → "1.5": the stored decimal without trailing zeros. */
export function quantityLabel(quantity: string, unit: string): string {
  const n = Number(quantity);
  return `${Number.isFinite(n) ? quantityFormat.format(n) : quantity} ${unit}`;
}
