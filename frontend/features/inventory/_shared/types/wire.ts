/**
 * Inventory: wire types shared by the frozen contracts of Stock, Counting and Waste (front-end mirror).
 *
 * Hand-written mirror of `backend/src/modules/inventory/_shared/wire.ts` (no shared package in this repo, and the front
 * end carries no Zod). The back end parses the shared fixtures against the Zod schemas; the front-end tests type the same
 * fixtures with these types, so drift fails CI.
 *
 * Wire rules: decimals are STRINGS, ids are strings, timestamps are ISO 8601 UTC, dates are `YYYY-MM-DD` (Africa/Nairobi
 * days). A field marked "cap" is ABSENT, never null, unless the caller holds that capability.
 */

export interface Person {
  id: string;
  name: string;
  initials: string;
  /** "Store Attendant" */
  roleLabel: string;
}

/** The numbered pager every table uses (UI_BUILD_RULES §4a). */
export const PAGE_SIZES = [25, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZES)[number];

export interface PageQuery {
  page?: number;
  pageSize?: PageSize;
}

export interface PageInfo {
  page: number;
  pageSize: number;
  /** Rows matching the filters across all pages ("Showing 1–50 of 142"). */
  total: number;
}

/** One cell of a KPI strip, ready to draw. The server decides the words, the screen draws them. */
export interface KpiCell {
  key: string;
  /** "WAITING FOR YOU" */
  label: string;
  /** "1", "7 lines", "KES 482K", "−KES 7,940". */
  value: string;
  /** "Samrat · signed 07:42" */
  caption: string;
  /** Colours the top edge: amber for a thing to do, red for a problem. */
  tone: 'NEUTRAL' | 'WARN' | 'ALERT';
  /** The chip this cell switches to when tapped, when it is drawn as a one-tap filter. */
  filter?: string;
}
