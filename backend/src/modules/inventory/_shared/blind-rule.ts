import type { Request } from 'express';
import { actorCan } from './central-store-access';
import { COUNT_STOCK_FIGURE_KEYS } from '../counting/_shared/counting-contract';

type Actor = NonNullable<Request['user']>;

/**
 * The one "blind" rule for the Central Store (owner decision, 6 Oct 2026). A caller without the matching capability is
 * blind to exactly two things; everything else is theirs to see:
 *   - STOCK FIGURES: on-hand, expected stock, restock levels and days of cover. Held by `restock.read`.
 *   - FINANCIAL DATA: what we owe, invoices, payments, supplier balances. Held by `payables.read`.
 * Item costs and prices are NOT part of either: they follow `catalog.see_costs`, which the Store Attendant holds.
 *
 * Every rebuilt sub-module calls `blindnessOf(actor)` instead of writing its own `isAttendant` check, and strips with
 * `withoutStockFigures` / `withoutFinancials`. Counting stays blind to expected stock for the Attendant (a
 * count-integrity rule); it reads `stockFigures` the same way.
 */
export interface Blindness {
  stockFigures: boolean;
  financials: boolean;
  itemCosts: boolean;
}

export const blindnessOf = (actor: Pick<Actor, 'role'>): Blindness => ({
  stockFigures: !actorCan(actor, 'restock.read'),
  financials: !actorCan(actor, 'payables.read'),
  itemCosts: !actorCan(actor, 'catalog.see_costs'),
});

/** Keys that carry stock figures on an item. Add a key here when a response gains a new one. */
export const STOCK_FIGURE_KEYS = ['centralStoreRestockLevel', 'daysOfCover', 'centralStoreOnHand', 'onHand', 'level'] as const;

/** Keys that carry financial data wherever they appear in a Central Store response. */
export const FINANCIAL_KEYS = ['amountOwed', 'balance', 'outstanding', 'invoices', 'invoice', 'payments', 'money', 'supplierBalance'] as const;

const omit = <T extends object>(value: T, keys: readonly string[]): T => {
  const copy: Record<string, unknown> = { ...(value as Record<string, unknown>) };
  for (const key of keys) delete copy[key];
  return copy as T;
};

/** Removes the stock figures from a response object when the caller is blind to them. */
export const withoutStockFigures = <T extends object>(actor: Pick<Actor, 'role'>, value: T): T =>
  blindnessOf(actor).stockFigures ? omit(value, STOCK_FIGURE_KEYS) : value;

const omitDeep = (value: unknown, keys: ReadonlySet<string>): unknown => {
  if (Array.isArray(value)) return value.map((entry) => omitDeep(entry, keys));
  if (value === null || typeof value !== 'object' || value instanceof Date) return value;
  const copy: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!keys.has(key)) copy[key] = omitDeep(entry, keys);
  }
  return copy;
};

const COUNT_FIGURE_KEY_SET: ReadonlySet<string> = new Set(COUNT_STOCK_FIGURE_KEYS);

/**
 * Removes every count stock-figure key (`COUNT_STOCK_FIGURE_KEYS`: expected, difference, result, story, decision, ...)
 * from a count response, at any depth, when the caller is blind to stock figures. The count view builder calls it once
 * on what it returns, so an Attendant payload cannot gain a figure key by accident.
 */
export const withoutCountFigures = <T extends object>(actor: Pick<Actor, 'role'>, value: T): T =>
  blindnessOf(actor).stockFigures ? (omitDeep(value, COUNT_FIGURE_KEY_SET) as T) : value;

/** Removes the financial keys from a response object when the caller is blind to them. */
export const withoutFinancials = <T extends object>(actor: Pick<Actor, 'role'>, value: T): T =>
  blindnessOf(actor).financials ? omit(value, FINANCIAL_KEYS) : value;
