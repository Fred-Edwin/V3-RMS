import { Prisma } from '@prisma/client';
import type { Person } from '../_shared/prep-contract';
import { formatAmount } from '../_shared/expected-yield';

/**
 * Pure helpers that shape a recipe for the screens: people, the "10 kg chicken, cut · 1 kg garlic-ginger paste" line,
 * the cost of one unit, and the unchanged-recipe comparison. No database, no clock.
 */

const D = (value: Prisma.Decimal.Value): Prisma.Decimal => new Prisma.Decimal(value);

/** "STORE_MANAGER" becomes "Store Manager"; the Branch Manager's role code is MANAGER. */
export const roleLabelOf = (role: string): string =>
  role === 'MANAGER' ? 'Branch Manager' : role.toLowerCase().split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

/** First letters of the first two words of a name: "Sarah Achieng" is "SA". */
export const initialsOf = (name: string): string => {
  const letters = name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w.charAt(0).toUpperCase());
  return letters.length > 0 ? letters.join('') : '?';
};

export const personOf = (user: { id: string; name: string; role: string }): Person => ({
  id: user.id,
  name: user.name,
  initials: initialsOf(user.name),
  roleLabel: roleLabelOf(user.role),
});

/** "Chicken, cut" reads as "chicken, cut" in a sentence; an acronym ("KFC sauce") keeps its capitals. */
export const lowerFirst = (name: string): string => (/^[A-Z]{2}/.test(name) ? name : name.charAt(0).toLowerCase() + name.slice(1));

interface TextLine {
  amount: Prisma.Decimal.Value;
  inputItem: { name: string; usageUnit: string };
}

/** "10 kg chicken, cut · 1 kg garlic-ginger paste": the ingredients in the recipe's order. */
export const ingredientsTextOf = (lines: readonly TextLine[]): string =>
  lines.map((l) => `${formatAmount(l.amount, l.inputItem.usageUnit)} ${l.inputItem.usageUnit} ${lowerFirst(l.inputItem.name)}`).join(' · ');

/** What one unit of the output costs now: the ingredients at their current cost, divided by the target yield (2 dp). */
export const costPerUnitOf = (targetYield: Prisma.Decimal.Value, lines: ReadonlyArray<{ amount: Prisma.Decimal.Value; inputItem: { currentCost: Prisma.Decimal.Value } }>): string | null => {
  const yieldAmount = D(targetYield);
  if (yieldAmount.lte(0)) return null;
  const total = lines.reduce((sum, l) => sum.plus(D(l.amount).times(D(l.inputItem.currentCost))), D(0));
  return total.dividedBy(yieldAmount).toDecimalPlaces(2).toFixed(2);
};

/** The same yield and the same ingredients with the same amounts and main flag. Order alone is not a change. */
export const sameRecipe = (
  current: { targetYield: Prisma.Decimal.Value; lines: ReadonlyArray<{ inputItemId: string; amount: Prisma.Decimal.Value; isMain: boolean }> },
  next: { targetYield: Prisma.Decimal.Value; lines: ReadonlyArray<{ itemId: string; amount: Prisma.Decimal.Value; isMain: boolean }> },
): boolean => {
  if (!D(current.targetYield).equals(D(next.targetYield))) return false;
  if (current.lines.length !== next.lines.length) return false;
  const byItem = new Map(current.lines.map((l) => [l.inputItemId, l]));
  return next.lines.every((l) => {
    const match = byItem.get(l.itemId);
    return match !== undefined && D(match.amount).equals(D(l.amount)) && match.isMain === l.isMain;
  });
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "5 Oct" for the Nairobi day of an instant (Africa/Nairobi is UTC+3, no daylight saving). */
export const nairobiDayText = (at: Date): string => {
  const local = new Date(at.getTime() + 3 * 60 * 60 * 1000);
  return `${local.getUTCDate()} ${MONTHS[local.getUTCMonth()]}`;
};
