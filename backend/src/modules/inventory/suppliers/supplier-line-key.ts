/**
 * Supplier catalog pack lines. The line key is (supplier, item, buy unit, pack size) and the
 * database index `supplier_items_line_key` treats a missing buy unit as '' and a missing pack
 * size as 0, so the same normalisation lives here for every caller (create, receipt price,
 * display). Pure: no database access.
 */
import { Prisma } from '@prisma/client';

export type LineKey = {
  buyUnit: string | null | undefined;
  packSize: Prisma.Decimal.Value | null | undefined;
};

type KeyedLine = { buyUnit: string | null; packSize: Prisma.Decimal | null };

/** supplier_items.pack_size is numeric(12,4); compare at that precision. */
const PACK_DECIMALS = 4;

export const normalizeBuyUnit = (buyUnit: string | null | undefined): string => (buyUnit ?? '').trim();

/** null when absent or zero, as COALESCE(pack_size, 0) would read it. */
export const normalizePackSize = (packSize: Prisma.Decimal.Value | null | undefined): Prisma.Decimal | null => {
  if (packSize === null || packSize === undefined) return null;
  const value = new Prisma.Decimal(packSize).toDecimalPlaces(PACK_DECIMALS);
  return value.isZero() ? null : value;
};

export const lineKeyString = (key: LineKey): string =>
  `${normalizeBuyUnit(key.buyUnit)}|${(normalizePackSize(key.packSize) ?? new Prisma.Decimal(0)).toFixed(PACK_DECIMALS)}`;

export const sameLineKey = (a: LineKey, b: LineKey): boolean => lineKeyString(a) === lineKeyString(b);

/** True when the caller actually named a pack (a buy unit and/or a non-zero pack size). */
export const hasPackKey = (key: LineKey): boolean =>
  normalizeBuyUnit(key.buyUnit) !== '' || normalizePackSize(key.packSize) !== null;

/**
 * Which of a supplier's lines for one item does a caller mean?
 * - It named a pack: only the line with exactly that key. No other line is ever "close enough".
 * - It named none: the supplier's single line; with two or more lines it is ambiguous, so none.
 */
export const matchSupplierLine = <T extends KeyedLine>(lines: T[], key: LineKey): T | null => {
  if (hasPackKey(key)) return lines.find((line) => sameLineKey(line, key)) ?? null;
  return lines.length === 1 ? (lines[0] ?? null) : null;
};

/** "bag · 50" — the pack as people say it; "—" when neither part is set. */
export const describePack = (key: LineKey): string => {
  const unit = normalizeBuyUnit(key.buyUnit);
  const size = normalizePackSize(key.packSize);
  const parts = [unit === '' ? null : unit, size ? size.toString() : null].filter((p): p is string => p !== null);
  return parts.length > 0 ? parts.join(' · ') : '—';
};
