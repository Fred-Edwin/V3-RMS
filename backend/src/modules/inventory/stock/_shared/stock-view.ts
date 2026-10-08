import type { Request } from 'express';
import { blindnessOf } from '../../_shared/blind-rule';

type Actor = Pick<NonNullable<Request['user']>, 'role'>;

/** The money keys of the Stock responses (S2, S3, S5). They follow `catalog.see_costs`. */
export const STOCK_MONEY_KEYS = ['valueKes', 'closingValueKes', 'unitCostText'] as const;

const omitDeep = (value: unknown, keys: ReadonlySet<string>): unknown => {
  if (Array.isArray(value)) return value.map((entry) => omitDeep(entry, keys));
  if (value === null || typeof value !== 'object' || value instanceof Date) return value;
  const copy: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!keys.has(key)) copy[key] = omitDeep(entry, keys);
  }
  return copy;
};

const MONEY_KEY_SET: ReadonlySet<string> = new Set(STOCK_MONEY_KEYS);

/**
 * Removes the money keys from a Stock response when the caller is blind to item costs. Today every holder of `stock.read`
 * also holds `catalog.see_costs`, so nothing is removed; if a role row changes, the money disappears here and nowhere else.
 */
export const withoutStockCosts = <T extends object>(actor: Actor, value: T): T => (blindnessOf(actor).itemCosts ? (omitDeep(value, MONEY_KEY_SET) as T) : value);
