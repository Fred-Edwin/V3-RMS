import type { Request } from 'express';
import { Prisma } from '@prisma/client';
import { AppError } from '../../../../utils/errors';
import { blindnessOf } from '../../_shared/blind-rule';
import { requireHubActor } from '../../_shared/central-store-access';
import { toMoney } from '../_shared/money';
import { roleLabel } from '../_shared/order-view';
import { purchasingError } from '../_shared/purchasing-errors';
import { attendantRepository } from '../attendant/attendant-repository';
import { needsRestockingRepository } from '../needs-restocking/needs-restocking-repository';
import { ordersRepository } from '../orders/orders-repository';
import { ordersService } from '../orders/orders-service';
import { chooseSupplier, groupBySupplier, type ResolvedLine } from './restock-list-logic';
import { restockListRepository } from './restock-list-repository';
import type { RestockReview, RestockSendResult } from './restock-list.types';
import type { RestockLinesInput, RestockSendInput } from './restock-list-validators';

type Actor = NonNullable<Request['user']>;

const D = (v: Prisma.Decimal.Value): Prisma.Decimal => new Prisma.Decimal(v);

interface Built {
  review: RestockReview;
}

/** Resolve every line to a supplier, then group by supplier. Refuses a duplicate item, an unknown item and a supplier that does not sell it. */
const build = async (actor: Actor, siteId: string, input: RestockLinesInput): Promise<Built> => {
  const ids = input.lines.map((l) => l.inventoryItemId);
  if (new Set(ids).size !== ids.length) throw purchasingError('VALIDATION', 'An item is on the list twice. Change its quantity instead.');
  const [items, supplierLines, approver] = await Promise.all([restockListRepository.findItems(siteId, ids), needsRestockingRepository.findSupplierLines(siteId, ids), attendantRepository.findApprover(siteId)]);
  const resolved: ResolvedLine[] = [];
  const unsupplied: RestockReview['unsupplied'] = [];
  for (const l of input.lines) {
    const item = items.find((i) => i.id === l.inventoryItemId);
    if (!item) throw purchasingError('VALIDATION', 'One of the items does not exist.');
    const qty = D(l.qty);
    if (!qty.gt(0)) throw purchasingError('VALIDATION', 'Quantities must be more than zero.', { inventoryItemId: item.id });
    const choice = chooseSupplier(item, supplierLines.filter((s) => s.inventoryItemId === item.id), l.supplierId);
    if (choice.kind === 'not_sold') throw purchasingError('VALIDATION', `That supplier does not sell ${item.name}.`, { inventoryItemId: item.id });
    if (choice.kind === 'none') unsupplied.push({ inventoryItemId: item.id, itemName: item.name });
    else resolved.push({ item, qty, line: choice.line });
  }
  const supplierIds = [...new Set(resolved.map((r) => r.line.supplier.id))];
  const open = new Map<string, { id: string; reference: string | null }>();
  for (const id of supplierIds) {
    const found = await ordersRepository.findOpenOrder(siteId, id);
    if (found) open.set(id, found);
  }
  const showPrices = !blindnessOf(actor).itemCosts;
  const groups = groupBySupplier(resolved, open, showPrices);
  const total = groups.reduce((t, g) => t.plus(g.estimatedTotal === '' ? 0 : g.estimatedTotal), D(0));
  return {
    review: {
      groups,
      unsupplied,
      orderCount: groups.length,
      estimatedTotal: showPrices ? toMoney(total) : '',
      approver: approver ? { id: approver.id, name: approver.name, role: roleLabel(approver.role) } : null,
    },
  };
};

export const restockListService = {
  /** What "Review list" shows: the list grouped by supplier, one order each, with a total and anything that would stop a group. */
  review: async (actor: Actor, input: RestockLinesInput): Promise<RestockReview> => {
    const siteId = await requireHubActor(actor);
    return (await build(actor, siteId, input)).review;
  },

  /**
   * "Send for approval": one order per supplier, each saved and sent to the Store Manager. A supplier that cannot be ordered from (its
   * slot is taken, an item has no price) is reported in `failed`; the other suppliers are still sent. Nothing is approved here.
   */
  send: async (actor: Actor, input: RestockSendInput, now: Date = new Date()): Promise<RestockSendResult> => {
    const siteId = await requireHubActor(actor);
    const { review } = await build(actor, siteId, input);
    const wanted = new Map(input.lines.map((l) => [l.inventoryItemId, l.qty]));
    const result: RestockSendResult = { sent: [], failed: [], unsupplied: review.unsupplied };
    for (const group of review.groups) {
      let orderId: string | null = null;
      try {
        const draft = await ordersService.create(
          actor,
          {
            supplierId: group.supplier.id,
            expectedDate: null,
            supplierNote: null,
            attendantNote: input.note,
            lines: group.lines.map((l) => ({ inventoryItemId: l.inventoryItemId, qty: wanted.get(l.inventoryItemId) ?? l.qty, unitPrice: '' })),
          },
          now,
        );
        orderId = draft.id;
        result.sent.push({ supplier: { id: group.supplier.id, name: group.supplier.name }, order: await ordersService.submit(actor, draft.id, now) });
      } catch (error) {
        if (!(error instanceof AppError)) throw error;
        result.failed.push({ supplier: { id: group.supplier.id, name: group.supplier.name }, code: error.code, message: error.message, orderId });
      }
    }
    return result;
  },
};
