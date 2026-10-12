/** A correction this far from the count is probably a typo (101234 for 10): the drawer says so, and still lets it post. */
export const FAR_FACTOR = 5;
export const FAR_VALUE_KES = 100_000;

/**
 * True when the new closing figure is more than five times the count it replaces, or moves the stock value by more than KES 100,000.
 * `closingValueKes` is the line's value at the old figure (absent for a reader who cannot see money); the unit price is worked from it.
 */
export const farFromCount = (was: number, next: number, closingValueKes?: string | null): boolean => {
  if (was > 0 && next > was * FAR_FACTOR) return true;
  if (closingValueKes === undefined || closingValueKes === null || was <= 0) return false;
  const unitPrice = Number(closingValueKes) / was;
  return Number.isFinite(unitPrice) && Math.abs((next - was) * unitPrice) > FAR_VALUE_KES;
};
