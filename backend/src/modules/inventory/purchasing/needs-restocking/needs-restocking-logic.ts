import { Prisma } from '@prisma/client';
import { restockStatus } from '../../restock/restock-suggestion';
import { suggestedQty, toMoney, toQty } from '../_shared/money';
import type { BelowLevelItem, CatalogLine, ItemStock, SupplierLine, SupplierSummary } from './needs-restocking-repository';
import type { CatalogItem, CatalogQuery, CatalogResult, NeedsGroup, NeedsLine, NeedsQuery, NeedsRestocking, SupplierOption } from './needs-restocking.types';

/** The rules of "Needs restocking" (backend-rules.md §2), as pure functions over rows the repository read. */
const TYPE_WORD = { REGULAR: 'Regular', OCCASIONAL: 'Occasional', ONE_OFF: 'One-off', MARKET: 'Market' } as const;

export const termsLabelOf = (s: Pick<SupplierSummary, 'type' | 'defaultPaymentTerms' | 'paymentDays'>): string =>
  `${TYPE_WORD[s.type]} · ${s.defaultPaymentTerms === 'PAY_NOW' || s.paymentDays <= 0 ? 'Cash on delivery' : `Invoice ${s.paymentDays} days`}`;

interface ItemUnits {
  usageUnit: string;
  buyUnit: string;
  packSize: Prisma.Decimal | null;
}

const sameUnit = (a: string | null, b: string): boolean => a !== null && a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Usage units in one buy unit for this supplier line: the line's own pack, else 1 when it is sold in the unit we use,
 * else the item's pack. Null when it cannot be known (an item never bought before), so no quantity is suggested.
 */
export const packOf = (line: Pick<SupplierLine, 'buyUnit' | 'packSize'>, item: ItemUnits): Prisma.Decimal | null => {
  if (line.packSize !== null) return line.packSize;
  if (line.buyUnit === null || sameUnit(line.buyUnit, item.usageUnit)) return new Prisma.Decimal(1);
  return item.packSize;
};

/** A supplier may hold several lines for one item (different packs): the preferred one, else the cheapest priced, else the newest. */
export const bestLinePerSupplier = (lines: readonly SupplierLine[]): SupplierLine[] => {
  const best = new Map<string, SupplierLine>();
  for (const line of lines) {
    const current = best.get(line.supplier.id);
    if (!current || compareLines(line, current) < 0) best.set(line.supplier.id, line);
  }
  return [...best.values()];
};

const compareLines = (a: SupplierLine, b: SupplierLine): number => {
  if (a.isPreferred !== b.isPreferred) return a.isPreferred ? -1 : 1;
  if ((a.lastPrice === null) !== (b.lastPrice === null)) return a.lastPrice === null ? 1 : -1;
  if (a.lastPrice && b.lastPrice && !a.lastPrice.equals(b.lastPrice)) return a.lastPrice.lt(b.lastPrice) ? -1 : 1;
  return (b.lastPriceAt?.getTime() ?? 0) - (a.lastPriceAt?.getTime() ?? 0);
};

/** The default supplier: the item's preferred one, else the cheapest by last price. */
export const chooseLine = (lines: readonly SupplierLine[], preferredSupplierId: string | null): SupplierLine | null => {
  if (lines.length === 0) return null;
  const marked = lines.map((l) => (preferredSupplierId !== null && l.supplier.id === preferredSupplierId ? { ...l, isPreferred: true } : l));
  const [first] = [...marked].sort(compareLines);
  return lines.find((l) => l.supplier.id === first?.supplier.id) ?? null;
};

const statusOf = (onHand: Prisma.Decimal, level: Prisma.Decimal): 'LOW' | 'OUT' => (restockStatus(onHand, level) === 'OUT' ? 'OUT' : 'LOW');

export const buildNeedsLine = (item: BelowLevelItem, lines: readonly SupplierLine[]): NeedsLine => {
  const perSupplier = bestLinePerSupplier(lines);
  const chosen = chooseLine(perSupplier, item.preferredSupplierId);
  const pack = chosen ? packOf(chosen, item) : null;
  const qty = suggestedQty(item.level, item.onHand, pack);
  const price = chosen?.lastPrice ?? null;
  const options: SupplierOption[] = perSupplier.map((l) => ({
    supplierId: l.supplier.id,
    name: l.supplier.name,
    lastPrice: l.lastPrice ? toMoney(l.lastPrice) : null,
    lastBoughtAt: l.lastPriceAt ? l.lastPriceAt.toISOString() : null,
    preferred: l.isPreferred || l.supplier.id === item.preferredSupplierId,
    cheaperBy: l.lastPrice && price && l.lastPrice.lt(price) ? toMoney(price.minus(l.lastPrice)) : null,
  }));
  const category = item.category ?? 'Item';
  return {
    inventoryItemId: item.id,
    itemName: item.name,
    subLabel: chosen
      ? `${category} · bought by the ${chosen.buyUnit ?? item.buyUnit}${pack && pack.gt(1) ? ` (${toQty(pack)} ${item.usageUnit})` : ''}`
      : `${category} · never bought before`,
    status: statusOf(item.onHand, item.level),
    onHand: toQty(item.onHand),
    level: toQty(item.level),
    usageUnit: item.usageUnit,
    supplierOptions: options,
    chosenSupplierId: chosen?.supplier.id ?? null,
    suggestedQty: qty === null ? null : String(qty),
    buyUnit: chosen ? (chosen.buyUnit ?? item.buyUnit) : null,
    lastPrice: price ? toMoney(price) : null,
    estimatedTotal: price && qty !== null ? toMoney(price.mul(qty)) : null,
  };
};

const ratio = (l: NeedsLine): number => (Number(l.level) > 0 ? Number(l.onHand) / Number(l.level) : 0);

const sortLines = (lines: NeedsLine[], sort: NeedsQuery['sort']): NeedsLine[] =>
  [...lines].sort((a, b) => {
    if (sort === 'name') return a.itemName.localeCompare(b.itemName);
    if (sort === 'value') return Number(b.estimatedTotal ?? 0) - Number(a.estimatedTotal ?? 0);
    return Number(b.status === 'OUT') - Number(a.status === 'OUT') || ratio(a) - ratio(b) || a.itemName.localeCompare(b.itemName);
  });

export const buildNeeds = (
  items: readonly BelowLevelItem[],
  lines: readonly SupplierLine[],
  suppliers: readonly SupplierSummary[],
  query: NeedsQuery,
): NeedsRestocking => {
  const byItem = new Map<string, SupplierLine[]>();
  for (const l of lines) byItem.set(l.inventoryItemId, [...(byItem.get(l.inventoryItemId) ?? []), l]);

  const built = items
    .map((item) => buildNeedsLine(item, byItem.get(item.id) ?? []))
    .filter((l) => !query.supplierId || l.chosenSupplierId === query.supplierId);
  const sorted = sortLines(built, query.sort);

  const supplierById = new Map(suppliers.map((s) => [s.id, s]));
  const bySupplier = new Map<string, NeedsLine[]>();
  for (const l of sorted) {
    const key = l.chosenSupplierId ?? '';
    bySupplier.set(key, [...(bySupplier.get(key) ?? []), l]);
  }
  const groups: NeedsGroup[] = [...bySupplier.entries()]
    .sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : 0))
    .map(([id, ls]) => {
      const sup = id ? supplierById.get(id) : undefined;
      const total = ls.reduce((t, l) => t.plus(l.estimatedTotal ?? 0), new Prisma.Decimal(0));
      return {
        supplier: sup ? { id: sup.id, name: sup.name, code: sup.code } : null,
        termsLabel: sup ? termsLabelOf(sup) : null,
        itemCount: ls.length,
        estimatedTotal: toMoney(total),
        lines: ls,
      };
    });

  return {
    itemCount: sorted.length,
    supplierCount: groups.filter((g) => g.supplier).length,
    groups,
    suppliers: suppliers.map((s) => ({ id: s.id, name: s.name, code: s.code, termsLabel: termsLabelOf(s) })),
  };
};

/** A supplier's catalog for New order: low and out items by default, or everything it sells. */
export const buildCatalog = (lines: readonly CatalogLine[], stock: readonly ItemStock[], query: CatalogQuery): CatalogResult => {
  const stockOf = new Map(stock.map((s) => [s.inventoryItemId, s]));
  const wantedCategory = query.category?.trim().toLowerCase();
  const all: CatalogItem[] = lines
    .filter((l) => !wantedCategory || (l.item.category ?? '').toLowerCase() === wantedCategory)
    .map((l) => {
      const s = stockOf.get(l.inventoryItemId);
      const onHand = s?.onHand ?? new Prisma.Decimal(0);
      const level = s?.level ?? null;
      const state = restockStatus(onHand, level);
      const status: CatalogItem['status'] = state === 'OUT' ? 'OUT' : state === 'LOW' ? 'LOW' : 'OK';
      const pack = packOf(l, l.item);
      const qty = status === 'OK' || level === null ? null : suggestedQty(level, onHand, pack);
      const unit = l.buyUnit ?? l.item.buyUnit;
      return {
        inventoryItemId: l.item.id,
        itemName: l.item.name,
        category: l.item.category ?? 'Item',
        status,
        onHand: toQty(onHand),
        level: level ? toQty(level) : '0',
        soldAs: `${unit}${pack && pack.gt(1) ? ` (${toQty(pack)} ${l.item.usageUnit})` : ''}`,
        buyUnit: unit,
        price: l.lastPrice ? toMoney(l.lastPrice) : null,
        qty: qty === null ? null : String(qty),
      };
    });
  const lowOrOut = all.filter((i) => i.status !== 'OK');
  const items = query.filter === 'all' ? all : lowOrOut;
  return { items, shown: items.length, total: all.length, counts: { lowOrOut: lowOrOut.length, all: all.length } };
};
