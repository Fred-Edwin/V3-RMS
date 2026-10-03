/**
 * What the supplier Catalog tab adds to each line (API_CONTRACT.md §30.11): the receipt that set the price and the
 * latest price alert on that pack. Pure: the repository fetches receipts, this decides which line each one belongs to.
 */
import { Prisma } from '@prisma/client';
import { matchSupplierLine, type LineKey } from './supplier-line-key';

type CatalogLine = {
  id: string;
  inventoryItemId: string;
  buyUnit: string | null;
  packSize: Prisma.Decimal | null;
  lastPriceAt: Date | null;
  lastPriceSetById?: string | null;
  lastPriceSetBy: { id: string; name: string } | null;
};

export type ReceiptSignedAt = { id: string; reference: string; signedAt: Date; itemIds: string[] };

export type AlertLine = {
  inventoryItemId: string;
  packBuyUnit: string | null;
  packSize: Prisma.Decimal | null;
  priceAlertPct: Prisma.Decimal;
  priceAlertPrevPrice: Prisma.Decimal | null;
  signedAt: Date;
};

export type CatalogLastReceipt = { id: string; reference: string };
export type CatalogPriceAlert = { pct: string; previousPrice: string | null; alertAt: Date };

/** The signed receipt behind a price: only when the price came from a receipt (not set by hand) and its time is the line's. */
export const findLastReceipt = (line: CatalogLine, receipts: ReceiptSignedAt[]): CatalogLastReceipt | null => {
  if (line.lastPriceSetBy || !line.lastPriceAt) return null;
  const at = line.lastPriceAt.getTime();
  const found = receipts.find((r) => r.signedAt.getTime() === at && r.itemIds.includes(line.inventoryItemId));
  return found ? { id: found.id, reference: found.reference } : null;
};

/**
 * The newest alert on this pack. A receipt line that names a pack belongs to the line with exactly that key; one that
 * names none belongs to the item's only line (never guessed when the supplier has several).
 */
export const findPriceAlert = (line: CatalogLine, itemLines: CatalogLine[], alerts: AlertLine[]): CatalogPriceAlert | null => {
  const mine = alerts
    .filter((a) => a.inventoryItemId === line.inventoryItemId)
    .filter((a) => matchSupplierLine(itemLines, { buyUnit: a.packBuyUnit, packSize: a.packSize } satisfies LineKey)?.id === line.id)
    .sort((a, b) => b.signedAt.getTime() - a.signedAt.getTime());
  const latest = mine[0];
  return latest
    ? { pct: latest.priceAlertPct.toString(), previousPrice: latest.priceAlertPrevPrice ? latest.priceAlertPrevPrice.toString() : null, alertAt: latest.signedAt }
    : null;
};
