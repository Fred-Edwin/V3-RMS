/**
 * A count carries ONE idempotency column (`counts.idempotency_key`, unique per site and counter), but three requests are
 * idempotent: start (C9), sign (C13) and approve (C29). The column holds the keys of those requests in the order they happened,
 * joined by "|": `start`, then `start|sign`, then `start|sign|approve`. A retry of any of them finds the count by its own key and
 * gets the same answer instead of an error or a second effect. (A Manager who signs her own count signs and approves in one
 * request, so `start|sign` is the whole story.) No new column: contract §2.1 fixes the shape of `counts`.
 */
const SEPARATOR = '|';

/** A client key as stored: the separator can never appear inside one. */
const clean = (key: string): string => key.split(SEPARATOR).join('_');

export const keysOf = (stored: string | null): string[] => (stored ? stored.split(SEPARATOR) : []);

/** The stored value after a count is started. */
export const startedWith = (startKey: string): string => clean(startKey);

/** The stored value after the counter signs (or the Manager signs her own). */
export const signedWith = (stored: string | null, signKey: string): string => [...keysOf(stored).slice(0, 1), clean(signKey)].join(SEPARATOR);

/** The stored value after a Manager approves a submitted count. */
export const approvedWith = (stored: string | null, approveKey: string): string => [...keysOf(stored).slice(0, 2), clean(approveKey)].join(SEPARATOR);

/** True when this request key is the one the count was started with (a retried C9). */
export const isStartKey = (stored: string | null, key: string): boolean => keysOf(stored)[0] === clean(key);

/** True when this request key is the one the count was signed with (a retried C13). */
export const isSignKey = (stored: string | null, key: string): boolean => keysOf(stored)[1] === clean(key);

/** True when this request key is the one the count was approved with (a retried C29). */
export const isApproveKey = (stored: string | null, key: string): boolean => keysOf(stored)[2] === clean(key);

/** The `where` that finds a count by the key it was STARTED with, whatever has happened to it since. */
export const startKeyWhere = (key: string): { OR: ({ idempotencyKey: string } | { idempotencyKey: { startsWith: string } })[] } => ({
  OR: [{ idempotencyKey: clean(key) }, { idempotencyKey: { startsWith: `${clean(key)}${SEPARATOR}` } }],
});
