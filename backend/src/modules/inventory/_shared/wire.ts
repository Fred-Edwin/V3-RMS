/**
 * Inventory: wire primitives shared by the frozen contracts of Stock, Counting and Waste
 * (`counting/_shared/counting-contract.ts`, `stock/_shared/stock-contract.ts`, `waste/_shared/waste-contract.ts`).
 *
 * Wire rules (the same as Prep and Purchasing): decimals are STRINGS (never JS numbers), ids are strings,
 * timestamps are ISO 8601 UTC, dates are `YYYY-MM-DD` read as Africa/Nairobi days. A field marked "cap" is present only
 * when the caller holds that capability (`_shared/central-store-access.ts`) and is otherwise ABSENT, never null.
 *
 * The front end mirrors this file by hand in `frontend/features/inventory/_shared/types/wire.ts`.
 */
import { z } from 'zod';

/** A quantity or money value on the wire: always a string. */
export const decimalString = z.string().regex(/^-?\d+(\.\d+)?$/, 'must be a decimal string');

/** A quantity that must be greater than zero. */
export const positiveDecimal = decimalString.refine((v) => Number(v) > 0, 'must be greater than zero');

/** A quantity that may be zero but not negative (a counted number). */
export const nonNegativeDecimal = decimalString.refine((v) => Number(v) >= 0, 'must not be negative');

export const uuid = z.string().uuid();
export const isoDateTime = z.string().datetime({ offset: true });
export const nairobiDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD');

export const personSchema = z.object({
  id: z.string(),
  name: z.string(),
  initials: z.string(),
  /** "Store Attendant" */
  roleLabel: z.string(),
});
export type Person = z.infer<typeof personSchema>;

/** The numbered pager every table uses (`UI_BUILD_RULES.md` §4a): 25, 50 or 100 rows, default 50. */
export const PAGE_SIZES = [25, 50, 100] as const;
export const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .refine((n) => (PAGE_SIZES as readonly number[]).includes(n), 'pageSize must be 25, 50 or 100')
    .default(50),
});
export type PageQuery = z.infer<typeof pageQuerySchema>;

export const pageInfoSchema = z.object({
  page: z.number().int().min(1),
  pageSize: z.number().int(),
  /** Rows matching the filters, across all pages ("Showing 1–50 of 142"). */
  total: z.number().int().nonnegative(),
});
export type PageInfo = z.infer<typeof pageInfoSchema>;

/** One cell of a KPI strip, ready to draw. The server decides the words, the screen draws them. */
export const kpiCellSchema = z.object({
  key: z.string(),
  /** "WAITING FOR YOU" (the screen sets it in the mono label style). */
  label: z.string(),
  /** "1", "7 lines", "KES 482K", "−KES 7,940". */
  value: z.string(),
  /** "Samrat · signed 07:42". */
  caption: z.string(),
  /** Colours the top edge: amber for a thing to do, red for a problem. */
  tone: z.enum(['NEUTRAL', 'WARN', 'ALERT']),
  /** The chip or filter this cell switches to when tapped, when it is drawn as a one-tap filter. */
  filter: z.string().optional(),
});
export type KpiCell = z.infer<typeof kpiCellSchema>;
