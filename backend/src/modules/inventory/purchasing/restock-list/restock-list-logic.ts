import { Prisma } from '@prisma/client';
import { toMoney, toQty } from '../_shared/money';
import type { ItemFacts } from '../attendant/attendant-logic';
import { bestLinePerSupplier, chooseLine } from '../needs-restocking/needs-restocking-logic';
import type { SupplierLine } from '../needs-restocking/needs-restocking-repository';
import type { GroupProblem, ReviewGroup, ReviewLine } from './restock-list.types';

/** The rules of the review (Paper 28C), as pure functions over rows the service read. */

export type SupplierChoice = { kind: 'chosen'; line: SupplierLine } | { kind: 'none' } | { kind: 'not_sold' };

/** The supplier an item is bought from: the one asked for if it sells the item, else the default (preferred, else cheapest). */
export const chooseSupplier = (item: ItemFacts, lines: readonly SupplierLine[], wantedSupplierId: string | undefined): SupplierChoice => {
  const perSupplier = bestLinePerSupplier(lines);
  if (wantedSupplierId) {
    const wanted = perSupplier.find((l) => l.supplier.id === wantedSupplierId);
    return wanted ? { kind: 'chosen', line: wanted } : { kind: 'not_sold' };
  }
  const line = chooseLine(perSupplier, item.preferredSupplierId);
  return line ? { kind: 'chosen', line } : { kind: 'none' };
};

export interface ResolvedLine {
  item: ItemFacts;
  qty: Prisma.Decimal;
  line: SupplierLine;
}

/** One group per supplier, in the order the suppliers first appear on the list. */
export const groupBySupplier = (
  resolved: readonly ResolvedLine[],
  openOrders: ReadonlyMap<string, { id: string; reference: string | null }>,
  showPrices: boolean,
): ReviewGroup[] => {
  const order: string[] = [];
  const bySupplier = new Map<string, ResolvedLine[]>();
  for (const r of resolved) {
    const id = r.line.supplier.id;
    if (!bySupplier.has(id)) order.push(id);
    bySupplier.set(id, [...(bySupplier.get(id) ?? []), r]);
  }
  return order.map((supplierId, index): ReviewGroup => {
    const rows = bySupplier.get(supplierId) ?? [];
    const first = rows[0];
    if (!first) throw new Error('A review group always has a line');
    let total = new Prisma.Decimal(0);
    let unpriced = false;
    const lines = rows.map((r): ReviewLine => {
      const price = r.line.lastPrice;
      if (price === null) unpriced = true;
      else total = total.plus(price.mul(r.qty));
      return {
        inventoryItemId: r.item.id,
        itemName: r.item.name,
        qty: toQty(r.qty),
        buyUnit: r.line.buyUnit ?? r.item.buyUnit,
        unitPrice: !showPrices ? '' : price ? toMoney(price) : null,
        lineTotal: !showPrices ? '' : price ? toMoney(price.mul(r.qty)) : null,
      };
    });
    const open = openOrders.get(supplierId) ?? null;
    const problem: GroupProblem | null = open ? 'SUPPLIER_ORDER_OPEN' : unpriced ? 'ITEM_SETUP_INCOMPLETE' : null;
    return {
      supplier: { id: supplierId, name: first.line.supplier.name, code: first.line.supplier.code },
      orderNumber: index + 1,
      itemCount: lines.length,
      estimatedTotal: showPrices ? toMoney(total) : '',
      openOrder: open,
      problem,
      lines,
    };
  });
};
