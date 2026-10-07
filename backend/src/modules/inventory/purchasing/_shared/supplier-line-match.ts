import type { Prisma } from '@prisma/client';
import { matchSupplierLine, normalizeBuyUnit, normalizePackSize } from '../../suppliers/supplier-line-key';

interface CatalogLine {
  buyUnit: string | null;
  packSize: Prisma.Decimal | null;
}

/**
 * Which of a supplier's catalog lines an order line was bought on. An order line stores the pack it was ordered in, which may
 * come from the item (a supplier line with no pack of its own) rather than from the line, so the exact key can differ. In order:
 *  1. the line with exactly that buy unit and pack;
 *  2. the one line with no pack of its own whose buy unit is the same or not stated.
 * A different named pack is never matched (that is a pack missing from the catalog), and nothing is guessed when the supplier
 * has several candidates.
 */
export const matchOrderLine = <T extends CatalogLine>(lines: readonly T[], bought: { buyUnit: string | null; packSize: Prisma.Decimal.Value | null }): T | null => {
  const exact = matchSupplierLine([...lines], bought);
  if (exact) return exact;
  const unit = normalizeBuyUnit(bought.buyUnit).toLowerCase();
  const packless = lines.filter((l) => {
    const own = normalizeBuyUnit(l.buyUnit).toLowerCase();
    return normalizePackSize(l.packSize) === null && (own === '' || own === unit);
  });
  return packless.length === 1 ? (packless[0] ?? null) : null;
};
